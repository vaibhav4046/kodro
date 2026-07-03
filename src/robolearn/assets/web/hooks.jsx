/* window.KodroHooks -- custom React hooks extracted from the App() God
 * component to start reducing app.jsx. Each hook owns one cohesive concern,
 * moved VERBATIM (same logic, same deps) so behaviour is preserved exactly.
 *
 * useAiStatus(vibeOpen): the AI-status concern (local Ollama: Qwen/Gemma;
 * graceful when absent). It owns the {available, model, models...} state and
 * the status-refresh / model-pick logic, polling at mount (the desktop bridge
 * injects late) and re-checking whenever the vibe panel opens. The ONLY
 * external input is vibeOpen (App state); everything else is owned here.
 *
 * useResizers(): the panel-resizer / layout concern. It owns the three panel
 * size states (editor width, telemetry width, console height) and the
 * startDrag(kind, e) pointer handler that mutates them via window
 * pointermove/pointerup listeners. Fully self-contained -- no external inputs;
 * exposes the sizes + startDrag to the JSX.
 *
 * useBlocks({ sfx, addConsole, typewriteCode }): the Scratch-style visual
 * block-editor concern. It owns blocksOpen + the blocks array + blockIndent
 * and every handler that mutates them (addBlock / endBlock / removeBlock /
 * moveBlock / blocksToPython / insertBlocksCode). BLOCK_DEFS is pure data
 * pulled off window.KodroBlockDefs here. The three callbacks it needs from the
 * App belong to other concerns and are threaded in: sfx (sound cue),
 * addConsole (console line), typewriteCode (animate code into the editor).
 * blocksToPython is kept byte-identical so generated Python is unchanged.
 *
 * useReview({ code, addConsole, typewriteCode, currentLessonId, aiInfo,
 * selfTestReport }): the second-agent code-review concern (propose-then-critique
 * on the local model). It owns reviewOpen/reviewBusy/reviewData/reviewErr and
 * the runReview (calls window.KodroAI.reviewCode) + applyReview handlers, moved
 * VERBATIM. The handlers read the live editor code, the current lesson id, the
 * AI model label (aiInfo) and three App callbacks (addConsole, typewriteCode,
 * selfTestReport) -- all threaded in because they belong to other concerns.
 *
 * useVibeChat({ terrain, currentLessonIdRef }): the AI vibe-chat concern. Owns
 * vibeOpen + the vibe prompt/thread/error/live state, the vibeEndRef auto-scroll
 * effect and the vibeCancelRef, and the streamed vibeSend poll loop (chatStart ->
 * chatPoll). Moved VERBATIM; the only external inputs are the live world (for the
 * memory-lesson grounding line) and the current-lesson ref (job scope). vibeApply
 * stays in the App because it bridges to the editor. Folds in the L2 cancel fix:
 * vibeSend re-checks vibeCancelRef AFTER each chatPoll await resolves.
 *
 * useSwarm({ code, currentLessonId, addConsole }): the agent-swarm concern
 * (swarmOpen/swarmBusy/swarmData + runSwarm, which runs the live program on a
 * fleet via window.RoboLearn.swarmRun). Moved VERBATIM.
 *
 * useAsk(): the grounded-Ask concern (askOpen/askQuery/askBusy/askData + runAsk,
 * offline retrieval via window.KodroAI.ask). Fully self-contained; setAskData is
 * returned so the toolbar button can clear the last answer on reopen.
 *
 * useTeacher({ setSettingsOpen }): the teacher-dashboard concern (teacherOpen/
 * teacherData + openTeacher, class heatmap via window.RoboLearn.getClassHeatmap).
 * Its only external input is setSettingsOpen (openTeacher closes the popover it
 * launches from). Moved VERBATIM.
 *
 * useBuild({ setRobotLabOpen, showToast }): the budget-build planner concern
 * (buildOpen/buildBudget/buildGoal/buildBusy/buildPlan/buildErr + runBuild,
 * specGoalText, openBuildReal, adoptPlanParts). Threads setRobotLabOpen (the Lab
 * toggle) and showToast. Moved VERBATIM.
 *
 * useProjectIO({ setSettingsOpen, showToast, addConsole }): the .kodro project
 * document I/O concern (projectFileRef + saveProjectClick / openProjectClick /
 * applyProjectText / onProjectFilePicked). Moved VERBATIM.
 *
 * Uses the global React (like every other web module), so the IIFE reads
 * React.useState / React.useEffect / React.useRef rather than importing.
 */
(function () {
  'use strict';

  const { useState, useEffect, useRef } = React;

  function useAiStatus(vibeOpen) {
    // --- AI vibe coding (local Ollama: Qwen/Gemma; graceful when absent) ---
    const [aiInfo, setAiInfo] = useState({ available: false, model: null });
    // The pywebview bridge injects asynchronously AFTER React mounts, so a
    // one-shot check at mount races it and can leave the panel "offline"
    // forever. Poll briefly at mount, and re-check every time the panel is
    // opened -- so starting Ollama later lights it up without a restart.
    function refreshAiStatus() {
      // KodroAI uses the desktop bridge when present, else talks to the local
      // Ollama server directly, so status reflects the model in both run modes.
      if (!window.KodroAI) return;
      Promise.resolve(window.KodroAI.status()).then(s => { if (s) setAiInfo(s); }).catch(() => {});
    }
    // Let the user point Kodro at any local model they have pulled (DeepSeek,
    // Nemotron, Qwen, a custom fine-tune). Persisted server side; empty = auto.
    function pickModel(name) {
      if (!window.KodroAI) return;
      Promise.resolve(window.KodroAI.setModel(name || '')).then(() => refreshAiStatus()).catch(() => {});
    }
    useEffect(() => {
      // Refresh a few times after mount: the desktop bridge injects late, and in
      // browser mode the Ollama probe is async, so one shot can miss it.
      let tries = 0;
      refreshAiStatus();
      const t = setInterval(() => { tries += 1; refreshAiStatus(); if (tries > 6) clearInterval(t); }, 700);
      return () => clearInterval(t);
    }, []);
    useEffect(() => { if (vibeOpen) refreshAiStatus(); }, [vibeOpen]);
    return { aiInfo, pickModel, refreshAiStatus };
  }

  function useResizers() {
    // ---------- layout resizers ----------
    // P7/A10: panel sizes persist across sessions (one JSON key), and three
    // presets give one-click layouts. Bounds match the drag/nudge clamps.
    const LAYOUT_KEY = 'kodro_layout_v1';
    const DEFAULTS = { editorW: 404, teleW: 318, consoleH: 184 };
    function loadLayout() {
      try {
        const raw = localStorage.getItem(LAYOUT_KEY);
        if (!raw) return DEFAULTS;
        const v = JSON.parse(raw);
        return {
          editorW: Math.max(280, Math.min(640, +v.editorW || DEFAULTS.editorW)),
          teleW: Math.max(240, Math.min(460, +v.teleW || DEFAULTS.teleW)),
          consoleH: Math.max(90, Math.min(420, +v.consoleH || DEFAULTS.consoleH)),
        };
      } catch (e) { return DEFAULTS; }
    }
    const initial = loadLayout();
    const [editorW, setEditorW] = useState(initial.editorW);
    const [teleW, setTeleW] = useState(initial.teleW);
    const [consoleH, setConsoleH] = useState(initial.consoleH);
    useEffect(() => {
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ editorW: editorW, teleW: teleW, consoleH: consoleH })); } catch (e) { void e; }
    }, [editorW, teleW, consoleH]);
    // Named layouts: maximize the 3D viewport, focus the editor, or return to
    // the defaults. Values stay inside the same clamps the drag path uses.
    function preset(name) {
      if (name === 'viewport') { setEditorW(280); setTeleW(240); setConsoleH(110); }
      else if (name === 'editor') { setEditorW(640); setTeleW(240); setConsoleH(260); }
      else { setEditorW(DEFAULTS.editorW); setTeleW(DEFAULTS.teleW); setConsoleH(DEFAULTS.consoleH); }
    }
    function startDrag(kind, e) {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const w0 = editorW, t0 = teleW, c0 = consoleH;
      const move = (ev) => {
        if (kind === 'editor') setEditorW(Math.max(280, Math.min(640, w0 + (ev.clientX - sx))));
        else if (kind === 'tele') setTeleW(Math.max(240, Math.min(460, t0 - (ev.clientX - sx))));
        else if (kind === 'console') setConsoleH(Math.max(90, Math.min(420, c0 - (ev.clientY - sy))));
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); document.body.style.cursor = ''; };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      document.body.style.cursor = kind === 'console' ? 'row-resize' : 'col-resize';
    }
    // Keyboard alternative to dragging (WCAG 2.1.1): nudge a split by d pixels,
    // clamped to the same bounds as the pointer drag.
    function nudge(kind, d) {
      if (kind === 'editor') setEditorW(w => Math.max(280, Math.min(640, w + d)));
      else if (kind === 'tele') setTeleW(w => Math.max(240, Math.min(460, w + d)));
      else if (kind === 'console') setConsoleH(h => Math.max(90, Math.min(420, h + d)));
    }
    return { editorW, teleW, consoleH, startDrag, nudge, preset };
  }

  function useBlocks(opts) {
    const sfx = (opts && opts.sfx) || function () {};
    const addConsole = (opts && opts.addConsole) || function () {};
    const typewriteCode = (opts && opts.typewriteCode) || function () {};
    // --- Scratch-style blocks mode -----------------------------------------
    // BLOCK_DEFS is pure data (see app-data.jsx); pulled off window here.
    const BLOCK_DEFS = window.KodroBlockDefs || [];
    const [blocksOpen, setBlocksOpen] = useState(false);
    const [blocks, setBlocks] = useState([]);       // {k,label,val,indent,container,color,unit}
    const [blockIndent, setBlockIndent] = useState(0);
    function addBlock(def) {
      setBlocks(bs => [...bs, { k: def.k, label: def.label, val: def.val, indent: blockIndent, container: !!def.container, color: def.color, unit: def.unit }]);
      if (def.container) setBlockIndent(d => Math.min(3, d + 1));
      sfx('led');
    }
    function endBlock() { setBlockIndent(d => Math.max(0, d - 1)); }
    function removeBlock(i) {
      setBlocks(bs => bs.filter((_, j) => j !== i));
    }
    function moveBlock(i, dir) {
      setBlocks(bs => {
        const j = i + dir;
        if (j < 0 || j >= bs.length) return bs;
        const next = bs.slice();
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
        return next;
      });
      sfx('led');
    }
    function blocksToPython() {
      const defs = {}; BLOCK_DEFS.forEach(d => { defs[d.k] = d; });
      const lines = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        lines.push('    '.repeat(b.indent) + defs[b.k].code(b.val));
        if (b.container) {
          const next = blocks[i + 1];
          // An empty container needs a body to be valid Python.
          if (!next || next.indent <= b.indent) lines.push('    '.repeat(b.indent + 1) + 'pass');
        }
      }
      return lines.join('\n') + '\n';
    }
    function insertBlocksCode() {
      if (!blocks.length) return;
      setBlocksOpen(false);
      addConsole('Blocks turned into Python. Read it, then press Run.', 'sys');
      typewriteCode(blocksToPython());
    }
    return { BLOCK_DEFS, blocksOpen, setBlocksOpen, blocks, setBlocks, blockIndent, setBlockIndent, addBlock, endBlock, removeBlock, moveBlock, blocksToPython, insertBlocksCode };
  }

  function useReview(opts) {
    opts = opts || {};
    const code = opts.code;
    const addConsole = opts.addConsole || function () {};
    const typewriteCode = opts.typewriteCode || function () {};
    const currentLessonId = opts.currentLessonId;
    const aiInfo = opts.aiInfo || {};
    const selfTestReport = opts.selfTestReport || function () {};
    // Second-agent code review (propose-then-critique on the local model).
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewData, setReviewData] = useState(null);
    const [reviewErr, setReviewErr] = useState(null);

    async function runReview() {
      if (reviewBusy) return;
      const src = (code || '').trim();
      if (!src) { setReviewErr('Write some code first, then ask for a review.'); setReviewOpen(true); return; }
      setReviewOpen(true); setReviewBusy(true); setReviewErr(null); setReviewData(null);
      try {
        const r = await window.KodroAI.reviewCode(src, currentLessonId || null);
        if (r && r.ok) setReviewData(r);
        else setReviewErr((r && r.reason) || 'Review unavailable.');
      } catch (e) { setReviewErr(String(e)); }
      setReviewBusy(false);
    }

    function applyReview() {
      if (reviewData && reviewData.revised && reviewData.code) {
        setReviewOpen(false);
        addConsole('Reviewer (' + (reviewData.model || aiInfo.model) + ') tidied your code. Read it, then press Run.', 'sys');
        typewriteCode(reviewData.code);
        selfTestReport(reviewData.code);
      }
    }

    return { reviewOpen, setReviewOpen, reviewBusy, reviewData, reviewErr, runReview, applyReview };
  }

  function useVibeChat(opts) {
    opts = opts || {};
    // Inputs owned by other concerns and threaded in: the live world (for the
    // memory-lesson grounding line vibeSend prepends) and the current-lesson ref
    // (so a streamed job is scoped to the lesson that was open when it started).
    const terrain = opts.terrain || {};
    const currentLessonIdRef = opts.currentLessonIdRef || { current: null };
    // --- AI vibe coding chat: prompt + thread + the streamed poll loop --------
    // Moved VERBATIM from App so the whole vibe-chat concern lives in one place.
    // vibeOpen stays here too (it is this concern's own open flag) and is fed
    // back to useAiStatus and the modal/overlay wiring by the App.
    const [vibeOpen, setVibeOpen] = useState(false);
    const [vibePrompt, setVibePrompt] = useState('');
    const [vibeBusy, setVibeBusy] = useState(false);
    const [vibeError, setVibeError] = useState(null);
    // Chat thread: [{role:'user'|'ai', kind:'text'|'code', text}]
    const [vibeMsgs, setVibeMsgs] = useState([]);
    const vibeEndRef = useRef(null);
    useEffect(() => { if (vibeEndRef.current) vibeEndRef.current.scrollIntoView({ block: 'end' }); }, [vibeMsgs, vibeBusy]);

    // Streamed reply: start a job, poll ~4x/s, and show the model's text live
    // in the thread while it thinks (the response feels instant instead of a
    // long opaque spinner).
    const [vibeLive, setVibeLive] = useState('');
    // Lets the user cancel an in-flight generation by closing the panel; the
    // poll loop checks this and bails quietly instead of showing an error.
    const vibeCancelRef = useRef(false);
    async function vibeSend() {
      const text = vibePrompt.trim();
      if (vibeBusy || !text) return;
      const next = [...vibeMsgs, { role: 'user', kind: 'text', text }];
      setVibeMsgs(next); setVibePrompt(''); setVibeBusy(true); setVibeError(null); setVibeLive(''); vibeCancelRef.current = false;
      try {
        const history = next.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));
        // Self-refinement in action: feed the lesson the system remembers from
        // past runs in this world into the assistant's context, so its advice
        // is shaped by what actually happened, not just the immediate prompt.
        const lesson = window.KodroMemory && window.KodroMemory.lessonFor(terrain.id);
        if (lesson && lesson.reflection) {
          history.unshift({ role: 'user', text: 'Keep in mind, learned from my past runs in the ' + terrain.name + ': ' + lesson.reflection });
        }
        // Ground the assistant in THIS robot's command registry (single source
        // of truth: RobotLab.KodroCommands) so it only suggests commands the
        // build supports and refuses ones whose part is not fitted. The runtime
        // gate in host.sensor and the self-test are the deterministic backstop.
        if (window.KodroCommands && window.getKodroRobot) {
          history.unshift({ role: 'user', text: window.KodroCommands.groundingText(window.getKodroRobot()) });
        }
        const start = await window.KodroAI.chatStart(history, currentLessonIdRef.current);
        if (!start || !start.ok) { setVibeError((start && start.reason) || 'AI unavailable. Start Ollama or run the desktop app.'); setVibeBusy(false); return; }
        let r = null;
        for (;;) {
          await new Promise(res => setTimeout(res, 250));
          if (vibeCancelRef.current) { setVibeLive(''); setVibeBusy(false); return; }
          const p = await window.KodroAI.chatPoll(start.jobId);
          // L2: the await above can resolve AFTER the user cancelled (closed the
          // panel) during it; re-check before committing the poll result to
          // state, so a cancelled generation never writes onto the closed modal.
          if (vibeCancelRef.current) { setVibeLive(''); setVibeBusy(false); return; }
          if (!p || !p.ok) { r = p; break; }
          if (p.done) { r = p; break; }
          setVibeLive(p.text || '');
        }
        setVibeLive('');
        if (r && r.ok && r.type === 'question') {
          setVibeMsgs(m => [...m, { role: 'ai', kind: 'text', text: r.text }]);
        } else if (r && r.ok && r.type === 'code') {
          setVibeMsgs(m => [...m, { role: 'ai', kind: 'code', text: r.code, model: r.model }]);
        } else {
          setVibeError((r && r.reason) || 'Generation failed.');
        }
      } catch (e) { setVibeError(String(e)); }
      setVibeBusy(false);
    }

    return {
      vibeOpen, setVibeOpen, vibePrompt, setVibePrompt, vibeBusy, setVibeBusy,
      vibeError, setVibeError, vibeMsgs, setVibeMsgs, vibeEndRef, vibeLive,
      setVibeLive, vibeCancelRef, vibeSend,
    };
  }

  function useSwarm(opts) {
    opts = opts || {};
    // Inputs from other concerns: the live editor code + current lesson id (the
    // swarm runs THAT program) and the console writer. Moved VERBATIM from App.
    const code = opts.code;
    const currentLessonId = opts.currentLessonId;
    const addConsole = opts.addConsole || function () {};
    // Agent swarm: run the program on a fleet of rovers, draw their trails.
    const [swarmOpen, setSwarmOpen] = useState(false);
    const [swarmBusy, setSwarmBusy] = useState(false);
    const [swarmData, setSwarmData] = useState(null);
    async function runSwarm() {
      const src = (code || '').trim();
      if (!src) { addConsole('Write a program first, then launch the swarm.', 'err'); return; }
      setSwarmOpen(true); setSwarmBusy(true); setSwarmData(null);
      try {
        const r = await window.RoboLearn.swarmRun(src, currentLessonId || null, 6);
        if (r && r.ok) setSwarmData(r);
        else { setSwarmOpen(false); addConsole((r && r.reason) || 'Swarm failed.', 'err'); }
      } catch (e) { setSwarmOpen(false); addConsole('Swarm: ' + e, 'err'); }
      setSwarmBusy(false);
    }
    return { swarmOpen, setSwarmOpen, swarmBusy, swarmData, runSwarm };
  }

  function useAsk() {
    // Grounded Ask: answers from the lesson material, offline retrieval. Fully
    // self-contained (window.KodroAI.ask); no external inputs. Moved VERBATIM.
    const [askOpen, setAskOpen] = useState(false);
    const [askQuery, setAskQuery] = useState('');
    const [askBusy, setAskBusy] = useState(false);
    const [askData, setAskData] = useState(null);
    async function runAsk() {
      const q = (askQuery || '').trim();
      if (!q || askBusy) return;
      setAskBusy(true); setAskData(null);
      try {
        const r = await window.KodroAI.ask(q);
        setAskData(r || { ok: false, reason: 'No response.' });
      } catch (e) { setAskData({ ok: false, reason: String(e) }); }
      setAskBusy(false);
    }
    // setAskData is returned too: the Ask toolbar button clears the last answer
    // (setAskData(null)) when reopening the panel, so App needs the setter.
    return { askOpen, setAskOpen, askQuery, setAskQuery, askBusy, askData, setAskData, runAsk };
  }

  function useTeacher(opts) {
    opts = opts || {};
    // Teacher dashboard: class concept-strength heatmap. The only external
    // input is setSettingsOpen (openTeacher closes the settings popover it is
    // launched from). Moved VERBATIM from App.
    const setSettingsOpen = opts.setSettingsOpen || function () {};
    const [teacherOpen, setTeacherOpen] = useState(false);
    const [teacherData, setTeacherData] = useState(null);
    async function openTeacher() {
      setSettingsOpen(false);
      setTeacherOpen(true);
      setTeacherData(null);
      try {
        const r = await window.RoboLearn.getClassHeatmap();
        if (r && r.ok) setTeacherData(r);
        else setTeacherData({ ok: false, concepts: [], pupils: [] });
      } catch (e) { setTeacherData({ ok: false, concepts: [], pupils: [] }); }
    }
    return { teacherOpen, setTeacherOpen, teacherData, openTeacher };
  }

  function useBuild(opts) {
    opts = opts || {};
    // External inputs: setRobotLabOpen (openBuildReal is launched from the Lab
    // and closes it; adoptPlanParts reopens it after fitting parts) and showToast
    // (adoptPlanParts surfaces the fitted-parts toast). Moved VERBATIM from App.
    const setRobotLabOpen = opts.setRobotLabOpen || function () {};
    const showToast = opts.showToast || function () {};
    const [buildOpen, setBuildOpen] = useState(false);
    const [buildBudget, setBuildBudget] = useState('30');
    const [buildGoal, setBuildGoal] = useState('');
    const [buildBusy, setBuildBusy] = useState(false);
    const [buildPlan, setBuildPlan] = useState(null);
    const [buildErr, setBuildErr] = useState(null);
    // A6: merge of the two build features. The Build-real planner opens seeded
    // with the current spec, and a generated plan's parts can be fitted straight
    // back into the Robot Lab catalogue.
    function specGoalText() {
      const rb = window.getKodroRobot ? window.getKodroRobot() : null;
      if (!rb) return '';
      const parts = [].concat(rb.sensors || [], rb.actuators || []).join(', ');
      return 'a ' + (rb.type || 'rover') + ' like my build "' + (rb.name || 'My Robot') + '"' + (parts ? ' with ' + parts : '');
    }
    async function runBuild() {
      if (buildBusy) return;
      const usd = Math.max(1, Math.min(100000, parseFloat(buildBudget) || 30));
      setBuildBusy(true); setBuildErr(null);
      try {
        if (!window.RoboLearn || !window.RoboLearn.isAvailable()) { setBuildErr('The robot builder needs the desktop app with local AI.'); }
        else {
          // A6: an empty goal prices the ACTIVE Robot Lab build, so the
          // hardware plan and the Lab describe one robot, not two products.
          const r = await window.RoboLearn.budgetBuild(usd, buildGoal.trim() || specGoalText());
          if (r && r.ok) setBuildPlan(r);
          else setBuildErr((r && r.reason) || 'Could not build a plan.');
        }
      } catch (e) { setBuildErr(String(e)); }
      setBuildBusy(false);
    }
    function openBuildReal() {
      setRobotLabOpen(false);
      if (!buildGoal.trim()) setBuildGoal(specGoalText());
      setBuildOpen(true);
    }
    function adoptPlanParts(plan) {
      if (!plan || !plan.parts || !window.RobotLab || !window.RobotLab.buildFromText) return;
      // The plan's part names route through the same catalogue mapper the
      // onboarding agent uses, so only real, buildable parts get fitted.
      const text = plan.parts.map(function (p) { return p.name + ' ' + (p.role || ''); }).join('; ');
      const r = window.RobotLab.buildFromText(text);
      setBuildOpen(false);
      showToast('Plan parts fitted: ' + ((r && r.spec && r.spec.name) || 'build updated'), 'ok');
      setRobotLabOpen(true);
    }
    return {
      buildOpen, setBuildOpen, buildBudget, setBuildBudget, buildGoal, setBuildGoal,
      buildBusy, buildPlan, buildErr, runBuild, specGoalText, openBuildReal, adoptPlanParts,
    };
  }

  function useProjectIO(opts) {
    opts = opts || {};
    // Project-file I/O (one .kodro document for the whole state). External
    // inputs: setSettingsOpen (save/open are launched from the settings popover
    // and close it), showToast and addConsole. Moved VERBATIM from App.
    const setSettingsOpen = opts.setSettingsOpen || function () {};
    const showToast = opts.showToast || function () {};
    const addConsole = opts.addConsole || function () {};
    const projectFileRef = useRef(null);
    async function saveProjectClick() {
      setSettingsOpen(false);
      if (!window.KodroProject) return;
      const doc = window.KodroProject.collect();
      const json = JSON.stringify(doc, null, 2);
      const fname = window.KodroProject.fileName(doc);
      if (window.RoboLearn && window.RoboLearn.isAvailable() && window.RoboLearn.exportProject) {
        const r = await window.RoboLearn.exportProject(json, fname);
        showToast(r && r.ok ? 'Project saved: ' + r.path : 'Project save ' + ((r && r.reason) || 'failed'), r && r.ok ? 'ok' : 'err');
        return;
      }
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      showToast('Project downloaded: ' + fname, 'ok');
    }
    function applyProjectText(text) {
      if (!window.KodroProject) return;
      const r = window.KodroProject.apply(text);
      if (!r.ok) {
        addConsole('Project open failed: ' + (r.errors || []).join(' '), 'err');
        showToast('Not a Kodro project file', 'err');
        return;
      }
      (r.warnings || []).forEach(w => addConsole('Project: ' + w, 'sys'));
      addConsole('Project loaded. Restarting the studio with the saved state...', 'ok');
      // The document was written straight into storage; a clean reload is the
      // honest way to rehydrate every consumer (App, Lab, memory, viewport).
      setTimeout(() => { try { location.reload(); } catch (e) { void e; } }, 400);
    }
    async function openProjectClick() {
      setSettingsOpen(false);
      if (window.RoboLearn && window.RoboLearn.isAvailable() && window.RoboLearn.importProject) {
        try {
          const r = await window.RoboLearn.importProject();
          if (r && r.ok) applyProjectText(r.text);
          else if (r && r.reason && r.reason !== 'cancelled') showToast('Project open: ' + r.reason, 'err');
        } catch (e) { showToast('Project open failed: ' + e, 'err'); }
        return;
      }
      if (projectFileRef.current) projectFileRef.current.click();
    }
    function onProjectFilePicked(e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { showToast('Project file is larger than 2 MB', 'err'); return; }
      const rd = new FileReader();
      rd.onload = () => applyProjectText(String(rd.result));
      rd.readAsText(f);
    }
    return { projectFileRef, saveProjectClick, openProjectClick, onProjectFilePicked };
  }

  window.KodroHooks = { useAiStatus, useResizers, useBlocks, useReview, useVibeChat, useSwarm, useAsk, useTeacher, useBuild, useProjectIO };
})();
