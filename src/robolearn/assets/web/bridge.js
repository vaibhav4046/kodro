/* RoboLearn <-> design bridge.
 *
 * Exposes window.RoboLearn for the React app to call into the Python
 * backend (lessons, grading, persistence, hints, achievements).
 * Under pywebview, window.pywebview.api.<method>() is the actual sync /
 * async hop into Python. We wrap it so the React app stays unaware of
 * the transport.
 */

(function () {
  "use strict";

  const isPywebview = () =>
    typeof window !== "undefined" &&
    !!window.pywebview &&
    !!window.pywebview.api;

  const waitForPywebview = (timeoutMs = 5000) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        if (isPywebview()) return resolve(true);
        if (Date.now() - t0 > timeoutMs) return resolve(false);
        setTimeout(tick, 25);
      };
      tick();
    });

  const call = async (name, ...args) => {
    const ready = await waitForPywebview();
    if (!ready) {
      console.warn("[Kodro bridge] pywebview API not ready; returning null for", name);
      return null;
    }
    const fn = window.pywebview.api[name];
    if (typeof fn !== "function") {
      console.warn("[Kodro bridge] no such API:", name);
      return null;
    }
    try {
      return await fn(...args);
    } catch (err) {
      console.error("[Kodro bridge] API call failed:", name, err);
      return null;
    }
  };

  // --- browser (no-pywebview) lesson fallback ------------------------------
  // On the zero-install static build there is no Python bridge, so the lessons
  // are shipped as a sibling lessons.json (written by scripts/export_lessons.py
  // with the SAME shape list_lessons() returns). Fetch it once, cache the
  // parsed array, and degrade to []/null on any failure so classroom mode
  // renders instead of crashing. The desktop pywebview path never reaches here.
  let lessonsCache = null;
  const fetchLessons = async () => {
    if (lessonsCache !== null) return lessonsCache;
    try {
      const res = await fetch("./lessons.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      lessonsCache = Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("[Kodro bridge] could not load lessons.json (browser mode):", err);
      lessonsCache = [];
    }
    return lessonsCache;
  };
  const listLessonsBrowser = () => fetchLessons();
  const getLessonBrowser = async (id) => {
    const all = await fetchLessons();
    return all.find((lesson) => lesson && lesson.id === id) || null;
  };

  // Browser grading (WebBackend slice 2): with no Python bridge, submit and
  // hints route to the JS lesson grader (lesson-grader.jsx), which re-runs
  // the source headlessly in the lesson's world and applies the same
  // success-criteria checks as robolearn/lessons/grader.py. The response
  // mirrors BridgeAPI.submit_attempt's shape, so the UI renders the same
  // verdict panel in both modes. Degrades to {ok:false, reason} on any
  // failure instead of crashing the classroom panel.
  const submitAttemptBrowser = async (lessonId, source) => {
    if (!window.KodroLessonGrader) {
      return { ok: false, reason: 'lesson grader not loaded' };
    }
    const lesson = await getLessonBrowser(lessonId);
    if (!lesson) return { ok: false, reason: 'unknown lesson: ' + lessonId };
    try {
      return await window.KodroLessonGrader.grade(lesson, source || '');
    } catch (err) {
      console.warn('[Kodro bridge] browser grading failed:', err);
      return { ok: false, reason: String((err && err.message) || err) };
    }
  };
  // Read-only hint preview: grade without recording anything (the browser
  // grader records nothing anyway) and surface just the hint, matching the
  // desktop get_hint contract ({ruleName, message} | null).
  const getHintBrowser = async (lessonId, source) => {
    const r = await submitAttemptBrowser(lessonId, source);
    return r && r.ok ? (r.hint || null) : null;
  };

  // Teacher / roster features persist pupil data on the Python (desktop) side
  // only. In the static browser build there is no bridge and nothing is ever
  // saved, so routing these through call() would block on the ~5s pywebview
  // wait and then resolve null -- the dashboard hangs on a spinner, then shows
  // an empty table implying scores will appear. Return an honest, immediate
  // "desktop only" signal instead. We invent NO pupil data.
  const TEACHER_BROWSER_REASON =
    'Teacher records are saved only in the desktop app. Browser mode does not keep pupil data.';
  const teacherUnavailable = () => ({
    ok: false,
    unavailable: true,
    reason: TEACHER_BROWSER_REASON,
    concepts: [],
    pupils: [],
  });

  window.RoboLearn = {
    isAvailable: isPywebview,
    listLessons: () => (isPywebview() ? call("list_lessons") : listLessonsBrowser()),
    getLesson: (id) => (isPywebview() ? call("get_lesson", id) : getLessonBrowser(id)),
    submitAttempt: (lessonId, source, traceJson) =>
      (isPywebview()
        ? call("submit_attempt", lessonId, source, traceJson)
        : submitAttemptBrowser(lessonId, source)),
    // Desktop persists these; browser mode has no store, so resolve fast and
    // honestly instead of blocking on the pywebview wait and returning null.
    getPupilSummary: () =>
      (isPywebview() ? call("get_pupil_summary") : Promise.resolve(teacherUnavailable())),
    getClassHeatmap: () =>
      (isPywebview() ? call("get_class_heatmap") : Promise.resolve(teacherUnavailable())),
    // A roster is a list; the honest browser answer is an empty roster (safe to
    // .map over) rather than a hang or a shape that would break list callers.
    listPupils: () =>
      (isPywebview() ? call("list_pupils") : Promise.resolve([])),
    createPupil: (name) => call("create_pupil", name),
    selectPupil: (id) => call("select_pupil", id),
    renamePupil: (id, name) => call("rename_pupil", id, name),
    getHint: (lessonId, source, errKind) =>
      (isPywebview()
        ? call("get_hint", lessonId, source, errKind)
        : getHintBrowser(lessonId, source)),
    exportReport: () => call("export_report"),
    aiStatus: () => call("ai_status"),
    aiGenerate: (prompt, lessonId) => call("ai_generate", prompt, lessonId),
    aiReviewCode: (source, lessonId) => call("ai_review_code", source, lessonId),
    aiAsk: (query) => call("ai_ask", query),
    swarmRun: (source, lessonId, n) => call("swarm_run", source, lessonId || null, n || 5),
    aiChat: (messages, lessonId) => call("ai_chat", messages, lessonId),
    aiChatStart: (messages, lessonId) => call("ai_chat_start", messages, lessonId),
    aiChatPoll: (jobId) => call("ai_chat_poll", jobId),
    pickPhoto: () => call("pick_photo"),
    importRobotSpec: () => call("import_robot_spec"),
    exportRobotSpec: (jsonText, name) => call("export_robot_spec", jsonText, name || "robot.kodro.json"),
    saveVerificationReport: (htmlText, name) => call("save_verification_report", htmlText, name || "kodro-verification.html"),
    budgetBuild: (usd, goal) => call("budget_build", usd, goal || ""),
    log: (level, msg) => call("log", level, msg),
    saveScenarioRun: (report) => call("save_scenario_run", report),
    listScenarioRuns: (limit) => call("list_scenario_runs", limit || 50),
    setAiModel: (name) => call("set_ai_model", name || ""),
  };

  // Best-effort hello, so the Python side knows the UI is alive.
  waitForPywebview().then((ok) => {
    if (ok) call("on_ui_ready");
  });
})();
