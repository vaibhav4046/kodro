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
      console.warn("[RoboLearn] pywebview API not ready; returning null for", name);
      return null;
    }
    const fn = window.pywebview.api[name];
    if (typeof fn !== "function") {
      console.warn("[RoboLearn] no such API:", name);
      return null;
    }
    try {
      return await fn(...args);
    } catch (err) {
      console.error("[RoboLearn] API call failed:", name, err);
      return null;
    }
  };

  window.RoboLearn = {
    isAvailable: isPywebview,
    listLessons: () => call("list_lessons"),
    getLesson: (id) => call("get_lesson", id),
    submitAttempt: (lessonId, source, traceJson) =>
      call("submit_attempt", lessonId, source, traceJson),
    getPupilSummary: () => call("get_pupil_summary"),
    listPupils: () => call("list_pupils"),
    createPupil: (name) => call("create_pupil", name),
    selectPupil: (id) => call("select_pupil", id),
    renamePupil: (id, name) => call("rename_pupil", id, name),
    getHint: (lessonId, source, errKind) =>
      call("get_hint", lessonId, source, errKind),
    exportReport: () => call("export_report"),
    aiStatus: () => call("ai_status"),
    aiGenerate: (prompt, lessonId) => call("ai_generate", prompt, lessonId),
    aiChat: (messages, lessonId) => call("ai_chat", messages, lessonId),
    aiChatStart: (messages, lessonId) => call("ai_chat_start", messages, lessonId),
    aiChatPoll: (jobId) => call("ai_chat_poll", jobId),
    listen: (timeoutS) => call("listen", timeoutS),
    pickPhoto: () => call("pick_photo"),
    speak: (text, voice) => call("speak", text, voice || "female"),
    log: (level, msg) => call("log", level, msg),
  };

  // Best-effort hello, so the Python side knows the UI is alive.
  waitForPywebview().then((ok) => {
    if (ok) call("on_ui_ready");
  });
})();
