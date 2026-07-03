/* ============================================================================
   KODRO — App (runtime + UI wiring)
   ========================================================================== */
(function () {
  const { useState, useRef, useEffect, useMemo } = React;
  const TERRAINS = window.TERRAINS;
  const WALL = TERRAINS.WALL;
  const RobotLab = window.RobotLab;
  const R_DEFAULT = 30; // rover collision radius (cm) for catalogue builds
  // Live check (re-evaluated per move) so toggling the OS setting takes effect.
  const PREFERS_REDUCED_MOTION = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  // ---------------- example programs & LED colours ----------------
  // Pure data tables, extracted to app-data.jsx (loaded before this module);
  // pulled off window here so usage sites below are unchanged.
  const EXAMPLES = window.KodroExamples || {};
  const LED_COLORS = window.KodroLedColors || {};

  // ---------------- icons ----------------
  // Chrome icons come from the shared procedural sprite (icons.jsx, P7/A2);
  // the four run-control glyphs below predate it and keep their exact shapes.
  const KI = (name, cls) => (window.KodroIcons ? window.KodroIcons.el(name, cls) : null);
  const I = {
    play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
    pause: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>,
    step: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5v14M9 12h11M16 7l5 5-5 5" /></svg>,
    reset: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12a8 8 0 108-8M4 12V6M4 12h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  };

  function App() {
    const [terrainId, setTerrainId] = useState(() => {
      const saved = localStorage.getItem('or_terrain');
      if (saved) return saved;
      // Fresh load: open in the world recommended for the current build, so the
      // first impression matches the rover (the default rover recommends Earth),
      // instead of a hardcoded Mars that contradicts the build's own world.
      try { const rb = window.getKodroRobot && window.getKodroRobot(); if (rb && rb.world) return rb.world; } catch (e) { void e; }
      return 'mars';
    });
    const [activeTab, setActiveTab] = useState(() => {
      const saved = localStorage.getItem('or_tab');
      if (saved) return saved;
      // Default to the short 'starter' example (drive tab) so the first thing a
      // user sees is a friendly 6-line program, not a wall of code. It uses only
      // base commands (forward/turn/say), so it runs on every robot build without
      // a gating refusal -- no need to branch on distance() availability.
      return 'drive';
    });
    const [programs, setPrograms] = useState(() => {
      try { const s = JSON.parse(localStorage.getItem('or_programs')); if (s) return s; } catch (e) {}
      const o = {}; Object.keys(EXAMPLES).forEach(k => o[k] = EXAMPLES[k].code); return o;
    });
    const [runState, setRunState] = useState('idle');
    const [activeLine, setActiveLine] = useState(0);
    const [consoleLines, setConsoleLines] = useState([{ type: 'sys', text: 'Kodro ready. Press Run to deploy.' }]);
    const [speedMul, setSpeedMul] = useState(1);
    const [say, setSay] = useState('');
    const [crashKey, setCrashKey] = useState(0);
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const [cam, setCam] = useState({ tilt: 46, yaw: -8, zoom: 1 });
    // Real WebGL 3D viewport (Three.js) with third-person orbit / first-person.
    const [view3d, setView3d] = useState(() => localStorage.getItem('or_view3d') !== '0');
    const [fpv, setFpv] = useState(() => localStorage.getItem('or_fpv') === '1');
    useEffect(() => { try { localStorage.setItem('or_view3d', view3d ? '1' : '0'); } catch (e) { void e; } }, [view3d]);
    // Spin up the moving-agent simulation for the current world (city traffic
    // and pedestrians); both viewports and the collision test read from it.
    useEffect(() => {
      if (window.KodroAgents) {
        window.KodroAgents.build(terrainId);
        // Reduced-motion: build the agents so they still exist for collision and
        // are drawn once, but stop the sim loop so pedestrians and traffic do not
        // animate (WCAG 2.3.3). Freezing the sim keeps the display and the
        // collision test consistent (both see the same static layout).
        if (PREFERS_REDUCED_MOTION()) window.KodroAgents.stop();
      }
      return () => { if (window.KodroAgents) window.KodroAgents.stop(); };
    }, [terrainId]);
    useEffect(() => { try { localStorage.setItem('or_fpv', fpv ? '1' : '0'); } catch (e) { void e; } }, [fpv]);
    // Escape leaves first person fast (a quick exit for motion sensitivity).
    useEffect(() => {
      if (!fpv) return undefined;
      const onEsc = (e) => { if (e.key === 'Escape') setFpv(false); };
      window.addEventListener('keydown', onEsc);
      return () => window.removeEventListener('keydown', onEsc);
    }, [fpv]);
    const zoom = cam.zoom;
    const trailColor = t.trail === 'cyan' ? '#5ce0d8' : t.trail === 'amber' ? '#e0b45c' : t.trail === 'white' ? '#f5f0e4' : null;

    // R8/R10: time-of-day and weather presets. Noon/clear are the identity
    // (zero change to any baseline). applyTod scales terrain.env.light so the
    // LIGHT gauge, the light() sensor, the realism dashboard and the 3D
    // picture all describe the SAME sky -- the product's honesty promise.
    const [tod, setTod] = useState(() => { try { return localStorage.getItem('kodro_tod') || 'noon'; } catch (e) { return 'noon'; } });
    const [weather, setWeather] = useState(() => { try { return localStorage.getItem('kodro_weather') || 'clear'; } catch (e) { return 'clear'; } });
    useEffect(() => { try { localStorage.setItem('kodro_tod', tod); } catch (e) { void e; } }, [tod]);
    useEffect(() => { try { localStorage.setItem('kodro_weather', weather); } catch (e) { void e; } }, [weather]);

    // terrainId may be a base terrain OR a real-world mission site id.
    // L1: memoise the world derivation so resolveSite (which for a mission site
    // runs an O(n^2) obstacle rejection sample) + applyTod only recompute when
    // the world actually changes (terrainId/tod/weather), not on every
    // rover-position render at animation-frame cadence during a run.
    const terrain = useMemo(() => {
      const baseTerrain = window.resolveSite ? window.resolveSite(terrainId) : TERRAINS[terrainId];
      return (window.KodroWorldFX && window.KodroWorldFX.applyTod)
        ? window.KodroWorldFX.applyTod(baseTerrain, tod, weather) : baseTerrain;
    }, [terrainId, tod, weather]);

    // live rover state (authoritative for sensors/animation)
    const startState = () => ({ x: 0, y: 0, heading: 0, speed: 50, battery: 100, moving: false, led: null, scanning: false, penDown: false });
    const live = useRef(startState());
    const [rover, setRover] = useState(() => ({ ...live.current }));
    const trailRef = useRef([]);            // array of segments; each = [{x,y}]
    const [trail, setTrail] = useState([]);
    const odoRef = useRef(0);
    const [odo, setOdo] = useState(0);
    const [sensorDist, setSensorDist] = useState(600);
    // Per-run stats for the post-run verdict (bugs D5): closest approach the
    // range sensor saw during the run, and how many real commands the program
    // actually executed. Both reset with the rover so each run reports itself.
    const minProxRef = useRef(Infinity);
    const cmdCountRef = useRef(0);

    // RoboLearn bridge: lessons (from Python), currently-loaded lesson id,
    // pupil + verdict + hint after a graded Run. The React app stays
    // unchanged when there's no bridge (browser preview).
    // World props placed by pupil code via place(): flags, beacons, people...
    const [props, setProps] = useState([]);
    // A pupil-chosen local image, shown in the world by place("photo").
    const [photoUrl, setPhotoUrl] = useState(null);
    async function pickPhotoClick() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
        addConsole('Photo props need the desktop app.', 'err');
        return;
      }
      try {
        const r = await window.RoboLearn.pickPhoto();
        if (r && r.ok) {
          setPhotoUrl(r.dataUrl);
          addConsole('Photo "' + r.name + '" loaded - use place("photo") to put it in the world.', 'ok');
        } else if (r && r.reason !== 'cancelled') {
          addConsole('Photo: ' + ((r && r.reason) || 'failed'), 'err');
        }
      } catch (e) { addConsole('Photo: ' + e, 'err'); }
    }
    // Live terminal line + one-deep history (ArrowUp recalls the last line).
    const [replLine, setReplLine] = useState('');
    const replHistRef = useRef('');
    const setReplHist = (v) => { if (v && v.trim()) replHistRef.current = v; };
    const [lessons, setLessons] = useState([]);
    // Multi-pupil: list + active id, so shared classroom machines keep each
    // pupil's progress separate (re-score / "do-all").
    const [pupils, setPupils] = useState([]);
    const [activePupilId, setActivePupilId] = useState(null);
    function reloadPupils() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.listPupils().then(ps => {
        if (!Array.isArray(ps)) return;
        setPupils(ps);
        const active = ps.find(p => p.active);
        if (active) setActivePupilId(active.id);
      });
    }
    useEffect(reloadPupils, []);
    async function onPupilChange(e) {
      const val = e.target.value;
      if (val === '__new__') {
        const r = await window.RoboLearn.createPupil('Pupil ' + (pupils.length + 1));
        if (r && r.ok) { setActivePupilId(r.id); reloadPupils(); }
      } else {
        const r = await window.RoboLearn.selectPupil(val);
        if (r && r.ok) setActivePupilId(val);
      }
      // Switching identity: clear the current verdict (it was the other pupil's).
      setLessonVerdict(null);
      setConsoleLines(l => [...l, { type: 'sys', text: 'Switched pupil.' }]);
    }
    const [currentLessonId, setCurrentLessonId] = useState(null);
    // Lessons keep their OWN editable buffer so loading one never clobbers the
    // example tabs (autopilot.py etc.); the editor shows it while a lesson is
    // active (QA re-score rank 11).
    const [lessonBuffers, setLessonBuffers] = useState({});  // per-lesson editable code
    const [lessonVerdict, setLessonVerdict] = useState(null);  // {passed,score,reasons,hint}
    // The editor's current source: a lesson's own buffer when one is loaded,
    // otherwise the active example tab. (Declared AFTER the state above to
    // avoid a temporal-dead-zone ReferenceError.)
    const code = currentLessonId
      ? (lessonBuffers[currentLessonId] !== undefined ? lessonBuffers[currentLessonId] : '')
      // Never hand the editor undefined (it would .split(undefined) and crash):
      // if activeTab is somehow not a known example key, fall back to basecamp.
      : (programs[activeTab] !== undefined ? programs[activeTab] : (programs.drive || ''));
    // Dyslexia-friendly / larger reading text toggle (QA re-score rank 4).
    const [readable, setReadable] = useState(() => localStorage.getItem('or_readable') === '1');
    const [muted, setMuted] = useState(() => localStorage.getItem('or_muted') === '1');
    // Visual theme. 'dark' is the default mission-control look; the rest are
    // full repaints driven by [data-theme] CSS variable swaps in styles.css.
    const [theme, setTheme] = useState(() => localStorage.getItem('or_theme') || 'dark');
    // P7/A1 mode split: 'studio' is the professional validation tool; the
    // Classroom toggle brings back pupils, lessons, the teacher dashboard,
    // achievements/confetti and the novelty themes. One product, two registers,
    // with the maker profile as the default identity.
    const [mode, setMode] = useState(() => { try { return localStorage.getItem('kodro_mode') || 'studio'; } catch (e) { return 'studio'; } });
    const classroom = mode === 'classroom';
    useEffect(() => {
      try { localStorage.setItem('kodro_mode', mode); } catch (e) { void e; }
      if (mode !== 'classroom') {
        // Leaving Classroom: the novelty themes and any loaded lesson are
        // classroom furniture, so the studio returns to the core theme set
        // and the plain example tabs (A5).
        setTheme(t => (t === 'dark' || t === 'light' || t === 'contrast') ? t : 'dark');
        setCurrentLessonId(null);
      }
    }, [mode]);
    const [showHelp, setShowHelp] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Toast notifications: transient success/error/info messages pinned to the
    // bottom-right. A single CSS keyframe drives fade-in, hold and fade-out, so
    // the JS only needs to mount the toast and unmount it after the animation.
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);
    function showToast(text, kind, action) {
      const id = ++toastIdRef.current;
      setToasts(function (t) { return t.concat([{ id: id, text: text, kind: kind || 'info', action: action || null }]); });
      // A toast carrying an action (e.g. Revert) needs time to be clicked.
      setTimeout(function () { setToasts(function (t) { return t.filter(function (to) { return to.id !== id; }); }); }, action ? 7000 : 2400);
    }
    // Brief "Loading {world}..." overlay shown while the 3D scene rebuilds on a
    // world switch, so the viewport does not flash empty for a frame.
    const [worldLoading, setWorldLoading] = useState(null);
    // Mobile telemetry: collapsed by default under 768px; toggle expands it.
    const [teleCollapsed, setTeleCollapsed] = useState(() => { try { return window.innerWidth <= 768; } catch (e) { return false; } });
    // First-run onboarding / landing flow (shown once, remembered, skippable).
    const [onboarded, setOnboarded] = useState(() => localStorage.getItem('or_onboarded') === '1');
    // Budget robot builder (local AI hardware guide for a real-world rover).
    // ---- P7/A7: project file (one .kodro document for the whole state) ----
    // Extracted VERBATIM to window.KodroHooks.useProjectIO (hooks.jsx); its
    // external inputs are setSettingsOpen (save/open launch from the settings
    // popover and close it), showToast and addConsole.
    const { projectFileRef, saveProjectClick, openProjectClick, onProjectFilePicked } = (window.KodroHooks && window.KodroHooks.useProjectIO)
      ? window.KodroHooks.useProjectIO({ setSettingsOpen, showToast, addConsole })
      : { projectFileRef: { current: null }, saveProjectClick: function () {}, openProjectClick: function () {}, onProjectFilePicked: function () {} };

    // ---- P7/A8: run reports (structured per-run artefact + history) ----
    const [runsOpen, setRunsOpen] = useState(false);
    const [runsTick, setRunsTick] = useState(0);
    const [cmpSel, setCmpSel] = useState([]);   // up to two run ids to compare
    useEffect(() => {
      const on = () => setRunsTick(n => (n + 1) & 1023);
      window.addEventListener('kodro-runreport', on);
      return () => window.removeEventListener('kodro-runreport', on);
    }, []);
    function recordRunReport(outcome, detail, verdictText) {
      if (!window.KodroRunReports) return;
      const rb = window.getKodroRobot ? window.getKodroRobot() : {};
      let predicted = '';
      try {
        if (window.KodroDiagnostics) predicted = window.KodroDiagnostics.assess(robotSpec, rb, terrain).overall || '';
      } catch (e) { void e; }
      window.KodroRunReports.save({
        world: terrain.siteId || terrain.id,
        worldName: terrain.name || '',
        robotName: (robotSpec && robotSpec.name) || (rb && rb.name) || '',
        robotType: (robotSpec && robotSpec.type) || (rb && rb.type) || '',
        massFactor: (rb && rb.massFactor) || 1,
        speedFactor: (rb && rb.speedFactor) || 1,
        outcome: outcome,
        detail: detail || '',
        commands: cmdCountRef.current,
        distanceCm: odoRef.current,
        batteryUsedPct: 100 - live.current.battery,
        minProximityCm: isFinite(minProxRef.current) ? minProxRef.current : null,
        wallMs: runStartRef.current ? (Date.now() - runStartRef.current) : null,
        predicted: predicted,
        verdict: verdictText || '',
      });
    }

    // Click-away + Escape close the settings popover; focus moves into the
    // popover on open and is restored to the gear button on close, so a keyboard
    // user is not dropped back to the top of the page (WCAG 2.4.3).
    const settingsBtnRef = useRef(null);
    useEffect(() => {
      if (!settingsOpen) return undefined;
      const pop = document.querySelector('.settings-pop');
      const first = pop && pop.querySelector('button, select, [tabindex]');
      if (first) first.focus();
      const close = (e) => { if (!e.target.closest || !e.target.closest('.settings-wrap')) setSettingsOpen(false); };
      const key = (e) => { if (e.key === 'Escape') setSettingsOpen(false); };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', key);
      return () => {
        document.removeEventListener('pointerdown', close);
        document.removeEventListener('keydown', key);
        if (settingsBtnRef.current) settingsBtnRef.current.focus();
      };
    }, [settingsOpen]);

    // currentLessonId ref: the vibe streamed job is scoped to the lesson open
    // when it started, so useVibeChat (below) reads this ref. Created here
    // (ahead of useVibeChat) and kept in lockstep with the currentLessonId
    // state; usage sites further down are unchanged.
    const currentLessonIdRef = useRef(null);
    useEffect(() => { currentLessonIdRef.current = currentLessonId; }, [currentLessonId]);
    // --- AI vibe coding chat (prompt + thread + streamed poll loop) ----------
    // Extracted VERBATIM to window.KodroHooks.useVibeChat (hooks.jsx): owns
    // vibeOpen + the vibe-chat state/refs and the streamed vibeSend poll loop.
    // Its only external inputs are the live world (terrain) and the current
    // lesson ref. vibeApply stays in App (it bridges to the editor, like the
    // other apply paths). vibeOpen is fed to useAiStatus and the modal wiring.
    const {
      vibeOpen, setVibeOpen, vibePrompt, setVibePrompt, vibeBusy, setVibeBusy,
      vibeError, setVibeError, vibeMsgs, setVibeMsgs, vibeEndRef, vibeLive,
      setVibeLive, vibeCancelRef, vibeSend,
    } = (window.KodroHooks && window.KodroHooks.useVibeChat)
      ? window.KodroHooks.useVibeChat({ terrain, currentLessonIdRef })
      : {
        vibeOpen: false, setVibeOpen: function () {}, vibePrompt: '', setVibePrompt: function () {},
        vibeBusy: false, setVibeBusy: function () {}, vibeError: null, setVibeError: function () {},
        vibeMsgs: [], setVibeMsgs: function () {}, vibeEndRef: { current: null }, vibeLive: '',
        setVibeLive: function () {}, vibeCancelRef: { current: false }, vibeSend: function () {},
      };
    // --- AI status (local Ollama: Qwen/Gemma; graceful when absent) ---
    // window.KodroHooks.useAiStatus (hooks.jsx): owns aiInfo plus the
    // status-refresh / model-pick logic, polling at mount and re-checking when
    // the vibe panel opens. vibeOpen is its only external input.
    const { aiInfo, pickModel, refreshAiStatus } = (window.KodroHooks ? window.KodroHooks.useAiStatus(vibeOpen) : { aiInfo: {}, pickModel: function(){}, refreshAiStatus: function(){} });
    const [realismOpen, setRealismOpen] = useState(false);
    const [demoOpen, setDemoOpen] = useState(false);
    // Render-quality tier read by Viewport3D (Low/Med/High/Cinematic): bounds
    // shadow + pixel-ratio cost so a laptop stays smooth, or maxes a screenshot.
    const [quality, setQuality] = useState(() => { try { return localStorage.getItem('kodro_quality') || 'high'; } catch (e) { return 'high'; } });
    if (typeof window !== 'undefined') window.KODRO_QUALITY = quality;
    // Bumped each time the user explicitly opens the 3D view, so the canvas can
    // take focus (keyboard orbit) without stealing focus on the initial load.
    const [focus3dKey, setFocus3dKey] = useState(0);
    // Robot Lab: design a custom robot whose spec drives the simulation.
    const [robotLabOpen, setRobotLabOpen] = useState(false);
    const [robotSpec, setRobotSpec] = useState(() => (window.getKodroRobot ? window.getKodroRobot() : null));
    // Build-a-real-robot planner (budget build). Extracted VERBATIM to
    // window.KodroHooks.useBuild (hooks.jsx); its external inputs are
    // setRobotLabOpen (openBuildReal/adoptPlanParts toggle the Lab) and showToast
    // (adoptPlanParts surfaces the fitted-parts toast). specGoalText moves with
    // it (used only inside the build cluster).
    const {
      buildOpen, setBuildOpen, buildBudget, setBuildBudget, buildGoal, setBuildGoal,
      buildBusy, buildPlan, buildErr, runBuild, specGoalText, openBuildReal, adoptPlanParts,
    } = (window.KodroHooks && window.KodroHooks.useBuild)
      ? window.KodroHooks.useBuild({ setRobotLabOpen, showToast })
      : {
        buildOpen: false, setBuildOpen: function () {}, buildBudget: '30', setBuildBudget: function () {},
        buildGoal: '', setBuildGoal: function () {}, buildBusy: false, buildPlan: null, buildErr: null,
        runBuild: function () {}, specGoalText: function () { return ''; }, openBuildReal: function () {}, adoptPlanParts: function () {},
      };
    useEffect(() => {
      const onRobot = (e) => {
        // Resolve a partial detail (a dispatcher may send { type } only)
        // through the archetype defaults, and keep the runtime accessor
        // (window.KODRO_ROBOT, read by the sensor gate) in lockstep with the
        // UI's robotSpec -- ONE build drives both, or telemetry could claim
        // "no range sensor" while distance() happily reads (D3 coherence).
        const full = (window.resolveKodroRobot ? window.resolveKodroRobot(e.detail) : e.detail) || e.detail;
        setRobotSpec(full);
        try { window.KODRO_ROBOT = full; } catch (err) { void err; }
        // Drop the new robot into the world the assistant recommends for it.
        const w = full && full.world;
        if (w && window.TERRAINS && window.TERRAINS[w]) {
          setTerrainId(w);
          try { localStorage.setItem('or_terrain', w); } catch (err) { void err; }
        }
        // If the freshly chosen build cannot range (no ultrasonic), a
        // distance-based example would fail on the first Run with a gating
        // refusal. Move off it to the base-command 'starter' so the first Run
        // after picking, say, a camera-only arm still works.
        try {
          const canRange = !window.KodroCommands || window.KodroCommands.check(full, 'distance').ok;
          if (!canRange) setActiveTab((t) => (t === 'autopilot' || t === 'avoid') ? 'drive' : t);
        } catch (err) { void err; }
      };
      window.addEventListener('kodro-robot', onRobot);
      return () => window.removeEventListener('kodro-robot', onRobot);
    }, []);
    // Self-refinement memory: reflections from past runs and a skill library.
    const [memoryOpen, setMemoryOpen] = useState(false);
    const [memTick, setMemTick] = useState(0);
    useEffect(() => {
      const on = () => setMemTick(n => (n + 1) & 1023);
      window.addEventListener('kodro-memory', on);
      return () => window.removeEventListener('kodro-memory', on);
    }, []);
    // Bridge for toasts fired by sibling modules (e.g. the Memory panel's
    // "Save current code as a skill" button dispatches a kodro-toast event so it
    // can surface a toast without holding a direct reference to showToast).
    useEffect(() => {
      const onToast = (e) => {
        const d = (e && e.detail) || {};
        showToast(d.text || '', d.kind || 'info');
      };
      window.addEventListener('kodro-toast', onToast);
      return () => window.removeEventListener('kodro-toast', onToast);
    }, []);
    // Second-agent code review: extracted to window.KodroHooks.useReview
    // (hooks.jsx). Owns reviewOpen/reviewBusy/reviewData/reviewErr + the
    // runReview/applyReview handlers, moved verbatim. The handlers read the
    // live editor code, currentLessonId, the AI model label (aiInfo) and three
    // App callbacks (addConsole/typewriteCode/selfTestReport, hoisted below).
    const { reviewOpen, setReviewOpen, reviewBusy, reviewData, reviewErr, runReview, applyReview } = (window.KodroHooks && window.KodroHooks.useReview)
      ? window.KodroHooks.useReview({ code, addConsole, typewriteCode, currentLessonId, aiInfo, selfTestReport })
      : { reviewOpen: false, setReviewOpen: function () {}, reviewBusy: false, reviewData: null, reviewErr: null, runReview: function () {}, applyReview: function () {} };
    // Teacher dashboard: class concept-strength heatmap. Extracted VERBATIM to
    // window.KodroHooks.useTeacher (hooks.jsx); its only external input is
    // setSettingsOpen (openTeacher closes the settings popover it launches from).
    const { teacherOpen, setTeacherOpen, teacherData, openTeacher } = (window.KodroHooks && window.KodroHooks.useTeacher)
      ? window.KodroHooks.useTeacher({ setSettingsOpen })
      : { teacherOpen: false, setTeacherOpen: function () {}, teacherData: null, openTeacher: function () {} };
    // Grounded Ask: answers from the lesson material, offline retrieval.
    // Extracted VERBATIM to window.KodroHooks.useAsk (hooks.jsx); fully
    // self-contained (window.KodroAI.ask), no external inputs.
    const { askOpen, setAskOpen, askQuery, setAskQuery, askBusy, askData, setAskData, runAsk } = (window.KodroHooks && window.KodroHooks.useAsk)
      ? window.KodroHooks.useAsk()
      : { askOpen: false, setAskOpen: function () {}, askQuery: '', setAskQuery: function () {}, askBusy: false, askData: null, setAskData: function () {}, runAsk: function () {} };
    // B3 trigger: validate the current program across randomised seeds in the
    // scenario that fits this robot, persist the report, and open the dashboard.
    function runValidation() {
      if (!window.KodroScenario) { addConsole('Validation unavailable.', 'err'); return; }
      // Validate the world ON SCREEN, not the robot's recommended world: the
      // verdict must be about what the user is looking at (product-coherence
      // D1). A mission site validates on its base world's scenario.
      const scn = window.KodroScenario.defaultFor(terrain && terrain.id);
      addConsole('Validating across 5 randomised seeds in "' + scn.name + '" on ' + (terrain.name || terrain.id) + ' (friction, mass, sensor noise and obstacle placement vary)...', 'sys');
      const rep = window.KodroScenario.run(code, scn, 5);
      const a = rep.aggregate;
      // A compile error in the program is a code mistake, not a 0% behaviour
      // result: surface it as an error and do not show a misleading pass rate
      // (scenario.run also skips persisting the junk all-zero report).
      if (a.compileError) {
        addConsole('Validation could not run: ' + a.compileError + ' Fix the code and try again.', 'err');
        return;
      }
      addConsole('Validation: success ' + Math.round((a.successRate || 0) * 100) + '% (' + a.successCount + '/' + a.seeds + '), mean collisions ' + a.meanCollisions + ', mean time ' + (a.meanTimeToGoal != null ? a.meanTimeToGoal + ' steps' : 'n/a') + ', mean battery ' + a.meanBattery + '%, mean score ' + a.meanScore + '. Saved.', (a.passed ? 'ok' : 'warn'));
      // "0%" without context reads as a broken product when the program simply
      // never drove to the goal. Say exactly what 0% measures, and point at
      // the marker the viewport now draws (product-coherence D1).
      if ((a.successRate || 0) === 0) {
        addConsole('0% success means the program never reached the goal marker (the cyan beacon ring drawn in the viewport). It is a mission result, not a crash count.', 'sys');
      }
      setRealismOpen(true);
    }

    // Autonomous test: when code is applied, run it through the real interpreter
    // and kinematics with no animation and report what actually happens, so the
    // assistant checks its own work instead of leaving it to the user.
    function selfTestReport(src) {
      if (!window.KodroSelfTest) return;
      const t = window.KodroSelfTest(src);
      addConsole('Self-test: ' + t.summary, (t.ok && !t.hitWall) ? 'ok' : 'err');
    }

    function vibeApply(code, model) {
      setVibeOpen(false);
      addConsole('AI (' + (model || aiInfo.model) + ') wrote a program. Read it, then press Run.', 'sys');
      typewriteCode(code);
      selfTestReport(code);
    }

    // runReview / applyReview moved to window.KodroHooks.useReview (hooks.jsx).

    // Agent swarm: run the program on a fleet of rovers, draw their trails.
    // Extracted VERBATIM to window.KodroHooks.useSwarm (hooks.jsx); its external
    // inputs are the live editor code, the current lesson id and addConsole.
    const { swarmOpen, setSwarmOpen, swarmBusy, swarmData, runSwarm } = (window.KodroHooks && window.KodroHooks.useSwarm)
      ? window.KodroHooks.useSwarm({ code, currentLessonId, addConsole })
      : { swarmOpen: false, setSwarmOpen: function () {}, swarmBusy: false, swarmData: null, runSwarm: function () {} };

    // Typewriter: animate code into the active editor buffer like live typing.
    // P7/A9: every programmatic write (AI apply, review apply, blocks insert,
    // skill insert) snapshots the buffer it is about to overwrite and offers a
    // one-click Revert toast, so applying a rewrite is never a destructive act.
    const typeRef = useRef(null);
    const undoRef = useRef(null); // { lessonId, tab, code } - the pre-apply buffer
    function snapshotForUndo(lessonId, tab) {
      const prior = lessonId
        ? (lessonBuffers[lessonId] !== undefined ? lessonBuffers[lessonId] : '')
        : (programs[tab] !== undefined ? programs[tab] : '');
      undoRef.current = { lessonId: lessonId || null, tab: tab, code: prior };
      showToast('Editor updated', 'info', { label: 'Revert', onClick: revertLastApply });
    }
    function revertLastApply() {
      const u = undoRef.current;
      if (!u) return;
      undoRef.current = null;
      if (typeRef.current) { clearInterval(typeRef.current); typeRef.current = null; }
      if (u.lessonId) setLessonBuffers(b => ({ ...b, [u.lessonId]: u.code }));
      else setPrograms(p => ({ ...p, [u.tab]: u.code }));
      addConsole('Reverted the last applied code. Your previous program is back.', 'sys');
    }
    function typewriteCode(codeText) {
      if (typeRef.current) { clearInterval(typeRef.current); typeRef.current = null; }
      const lessonId = currentLessonIdRef.current;
      // Snapshot the target tab at invocation (like lessonId) so a tab switch
      // mid-animation cannot redirect the remaining typed code to another buffer.
      const tab = activeTab;
      snapshotForUndo(lessonId, tab);
      const setCode = (v) => {
        if (lessonId) setLessonBuffers(b => ({ ...b, [lessonId]: v }));
        else setPrograms(p => ({ ...p, [tab]: v }));
      };
      if (PREFERS_REDUCED_MOTION() || codeText.length > 4000) { setCode(codeText); return; }
      let i = 0;
      setCode('');
      typeRef.current = setInterval(() => {
        i = Math.min(codeText.length, i + 3);
        setCode(codeText.slice(0, i));
        if (i >= codeText.length) { clearInterval(typeRef.current); typeRef.current = null; }
      }, 12);
    }
    // Skill insert (Memory panel) writes the editor through the same
    // snapshot-then-apply path, so it is revertable like every other apply.
    function applyProgramText(codeText) {
      const lessonId = currentLessonIdRef.current;
      const tab = activeTab;
      snapshotForUndo(lessonId, tab);
      if (lessonId) setLessonBuffers(b => ({ ...b, [lessonId]: codeText }));
      else setPrograms(p => ({ ...p, [tab]: codeText }));
    }

    // If the app ever unmounts, clear the typewriter interval and the say-bubble
    // timer so no stray timer fires against a torn-down tree. (sayTimer is
    // declared below; this cleanup closure only runs at unmount, after init.)
    useEffect(() => () => {
      if (typeRef.current) clearInterval(typeRef.current);
      if (sayTimer.current) clearTimeout(sayTimer.current);
    }, []);

    // --- Scratch-style blocks mode -----------------------------------------
    // Extracted verbatim into window.KodroHooks.useBlocks. The three callbacks
    // it leans on (sfx, addConsole, typewriteCode) are hoisted function decls in
    // this component, so passing them here is safe even though two are textually
    // defined below. Fallback keeps the panel functional if the hook is absent.
    const {
      BLOCK_DEFS, blocksOpen, setBlocksOpen, blocks, setBlocks,
      blockIndent, setBlockIndent, addBlock, endBlock, removeBlock,
      moveBlock, insertBlocksCode,
    } = (window.KodroHooks && window.KodroHooks.useBlocks)
      ? window.KodroHooks.useBlocks({ sfx, addConsole, typewriteCode })
      : {
        BLOCK_DEFS: window.KodroBlockDefs || [],
        blocksOpen: false, setBlocksOpen: () => {}, blocks: [], setBlocks: () => {},
        blockIndent: 0, setBlockIndent: () => {}, addBlock: () => {}, endBlock: () => {},
        removeBlock: () => {}, moveBlock: () => {}, insertBlocksCode: () => {},
      };
    function toggleSound() {
      setMuted(m => { const next = !m; if (window.RLSound) window.RLSound.setMuted(next); return next; });
    }
    useEffect(() => {
      document.body.classList.toggle('a11y-readable', readable);
      try { localStorage.setItem('or_readable', readable ? '1' : '0'); } catch (e) { void e; }
    }, [readable]);
    useEffect(() => {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.listLessons().then(ls => { if (Array.isArray(ls)) setLessons(ls); });
    }, []);
    function loadLesson(lesson) {
      if (!lesson) return;
      setCurrentLessonId(lesson.id);
      setLessonVerdict(null);
      // Render the rover on the SAME world it is graded against. Without this
      // the viewport could show a persisted Mars while the grader ran the
      // lesson's real terrain, so a pass looked like it happened elsewhere.
      if (lesson.terrain && TERRAINS[lesson.terrain]) setTerrainId(lesson.terrain);
      // Seed this lesson's buffer from its starter ONLY if it has no edits yet,
      // so switching A -> B -> A preserves the pupil's work in A (rank 6).
      setLessonBuffers(b => b[lesson.id] !== undefined ? b : { ...b, [lesson.id]: lesson.starterCode || '' });
      setConsoleLines(l => [
        ...l,
        { type: 'sys', text: '─── ' + lesson.id + ' · ' + lesson.title + ' [' + lesson.keyStage + '] ───' },
        { type: 'out', text: (lesson.intro || '').trim() },
      ]);
    }
    async function gradeWithBridge(source) {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      const lessonId = currentLessonIdRef.current;
      if (!lessonId) return;
      try {
        const r = await window.RoboLearn.submitAttempt(lessonId, source, null);
        if (!r) return;
        if (r.ok === false) { setConsoleLines(l => [...l, { type: 'err', text: 'Grader: ' + (r.reason || 'unknown error') }]); return; }
        // Persist the verdict in a panel that survives Reset (QA #3).
        setLessonVerdict({ passed: !!r.passed, score: r.score, reasons: r.reasons || [], hint: r.hint || null });
        // Confetti is a classroom register; the studio celebrates with the
        // verdict chip and the pass tone only (A1).
        if (r.passed) { sfx('pass'); if (classroom) celebrate(); } else { sfx('fail'); }
        const tag = r.passed ? 'ok' : 'err';
        setConsoleLines(l => {
          const lines = [...l, { type: tag, text: (r.passed ? '✓ PASS' : '✗ NOT YET') + '  Score: ' + r.score + '/100' }];
          if (!r.passed && Array.isArray(r.reasons)) r.reasons.forEach(reason => lines.push({ type: 'err', text: '  · ' + reason }));
          if (r.hint && r.hint.message) lines.push({ type: 'sys', text: 'Hint: ' + r.hint.message });
          if (Array.isArray(r.achievements)) r.achievements.forEach(a => lines.push({ type: 'ok', text: 'Achievement unlocked: ' + a.title }));
          if (r.recommended && r.recommended.id) lines.push({ type: 'sys', text: 'Recommended next: ' + r.recommended.id + ' · ' + r.recommended.title });
          return lines;
        });
      } catch (err) {
        setConsoleLines(l => [...l, { type: 'err', text: 'Bridge error: ' + err }]);
      }
    }

    // The run/animation engine (useSimEngine) owns its control refs; these two
    // stay in App because they are read outside the engine too: sayTimer by the
    // unmount-cleanup effect below, and runStartRef by recordRunReport.
    const sayTimer = useRef(null);
    // Wall-clock start of the current editor run (SI3 measured-speed block).
    const runStartRef = useRef(0);

    const consoleEndRef = useRef(null);
    useEffect(() => { if (consoleEndRef.current) consoleEndRef.current.scrollTop = consoleEndRef.current.scrollHeight; }, [consoleLines]);

    // persist
    useEffect(() => { localStorage.setItem('or_terrain', terrainId); }, [terrainId]);
    useEffect(() => {
      try { localStorage.setItem('or_theme', theme); } catch (e) { void e; }
      const root = document.documentElement;
      if (theme && theme !== 'dark') root.setAttribute('data-theme', theme);
      else root.removeAttribute('data-theme');
    }, [theme]);
    useEffect(() => { localStorage.setItem('or_tab', activeTab); }, [activeTab]);
    useEffect(() => { try { localStorage.setItem('or_programs', JSON.stringify(programs)); } catch (e) {} }, [programs]);


    function addConsole(text, type) {
      const ts = new Date();
      const hh = String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0') + ':' + String(ts.getSeconds()).padStart(2, '0');
      setConsoleLines(l => [...l, { type: type || 'out', text, ts: hh }]);
    }

    // Fire a synthesised sound cue (no-op if sound.js absent or muted).
    // `opt` carries a variant (e.g. WHAT was hit, for R6 crash voicing).
    function sfx(kind, opt) { try { if (window.RLSound) window.RLSound.play(kind, opt); } catch (e) { void e; } }
    // R6: motor-loop helpers. motorSfx follows the live speed profile during
    // a move/turn; motorRest lets the loop fall silent between commands.
    function motorSfx(type, v) { try { if (window.RLSound && window.RLSound.motor) window.RLSound.motor(type, v); } catch (e) { void e; } }
    function motorRest() { try { if (window.RLSound && window.RLSound.motorIdle) window.RLSound.motorIdle(); } catch (e) { void e; } }

    // R6: per-world ambience bed (wind, underwater rumble, city hum with
    // traffic swells, room HVAC; space stays silent). The bed follows the
    // active world and starts once the first user gesture unlocks audio.
    useEffect(() => {
      try { if (window.RLSound && window.RLSound.ambience) window.RLSound.ambience(terrain.siteId || terrain.id, terrain.id); } catch (e) { void e; }
    }, [terrainId, muted]);

    // Lightweight celebration: a one-shot confetti burst on a lesson pass.
    function celebrate() {
      try {
        const host = document.getElementById('editor-main') || document.body;
        const layer = document.createElement('div');
        layer.className = 'confetti-layer';
        const colors = ['#5ce0d8', '#e0b45c', '#7cc49b', '#c8685a', '#f5f0e4'];
        for (let i = 0; i < 80; i++) {
          const p = document.createElement('i');
          p.className = 'confetti';
          p.style.left = Math.round(8 + (i / 80) * 84) + '%';
          p.style.background = colors[i % colors.length];
          p.style.animationDelay = (i % 10) * 40 + 'ms';
          p.style.transform = 'rotate(' + (i * 31 % 360) + 'deg)';
          layer.appendChild(p);
        }
        host.appendChild(layer);
        setTimeout(() => { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 2600);
      } catch (e) { void e; }
    }

    // ---------- geometry / sensors ----------
    // SI2: the collision circle honours an imported spec's body footprint
    // (R = hypot(length, width)/2, still a circle, disclosed); a catalogue
    // build keeps the exact 30 cm the sim has always used.
    // ---------- run / animation engine (extracted to useSimEngine) ----------
    // window.KodroHooks.useSimEngine (hooks.jsx) owns the deterministic tick:
    // collisionAt/rayDistance/sensorRayDistance, frames/delay, animateMove/
    // animateTurn, advance, pumpLoop and the run controls. Everything it reaches
    // for (module constants, live state, shared refs, setters, cross-concern
    // callbacks) is threaded in; it returns the seven handlers the chrome and
    // the keyboard layer call. Moved VERBATIM so the odometer still reads 3.4m.
    const { onRun, onStep, onReset, onTerrain, runReplLine, onCodeChange, exportReportClick } =
      (window.KodroHooks && window.KodroHooks.useSimEngine)
        ? window.KodroHooks.useSimEngine({
            LED_COLORS, R_DEFAULT, WALL, TERRAINS, PREFERS_REDUCED_MOTION,
            terrain, robotSpec, code, currentLessonId, activeTab, runState, terrainId,
            speedMul, startState,
            live, trailRef, odoRef, minProxRef, cmdCountRef, sayTimer, runStartRef,
            setRover, setTrail, setOdo, setSensorDist, setActiveLine, setConsoleLines,
            setProps, setSay, setCrashKey, setRunState, setTerrainId, setLessonVerdict,
            setLessonBuffers, setPrograms, setWorldLoading,
            addConsole, showToast, sfx, motorSfx, motorRest, recordRunReport,
            gradeWithBridge, celebrate,
          })
        : { onRun: function () {}, onStep: function () {}, onReset: function () {}, onTerrain: function () {}, runReplLine: function () {}, onCodeChange: function () {}, exportReportClick: function () {} };

    // apply terrain accent to CSS var
    useEffect(() => {
      document.documentElement.style.setProperty('--terrain', terrain.accent);
    }, [terrainId]);

    // ---------- layout resizers ----------
    const { editorW, teleW, consoleH, startDrag, nudge, preset: layoutPreset } = (window.KodroHooks && window.KodroHooks.useResizers) ? window.KodroHooks.useResizers() : { editorW: 404, teleW: 318, consoleH: 184, startDrag: function () {}, nudge: function () {}, preset: function () {} };

    // interactive camera: drag the viewport to orbit (yaw + pitch), wheel to zoom
    function camDrag(e) {
      if (e.target.closest('.terrain-switch') || e.target.closest('.view-mode-pill')) return;
      const sx = e.clientX, sy = e.clientY;
      const y0 = cam.yaw, t0 = cam.tilt;
      let moved = false;
      const move = (ev) => {
        moved = true;
        setCam(c => ({
          ...c,
          yaw: Math.max(-60, Math.min(60, y0 + (ev.clientX - sx) * 0.35)),
          tilt: Math.max(0, Math.min(72, t0 - (ev.clientY - sy) * 0.32))
        }));
      };
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      document.body.style.cursor = 'grabbing';
    }
    function camWheel(e) {
      setCam(c => ({ ...c, zoom: Math.max(0.7, Math.min(1.7, c.zoom - e.deltaY * 0.0012)) }));
    }

    // keyboard shortcuts. The handler is registered ONCE: App re-renders ~60
    // times a second during a run, so a deps-free effect would thrash
    // add/removeEventListener on the hot path. Live handlers and state are read
    // through refs that are kept current every render.
    const onRunRef = useRef(onRun); onRunRef.current = onRun;
    const onStepRef = useRef(onStep); onStepRef.current = onStep;
    const onResetRef = useRef(onReset); onResetRef.current = onReset;
    const onTerrainRef = useRef(onTerrain); onTerrainRef.current = onTerrain;
    const saveProjectRef = useRef(saveProjectClick); saveProjectRef.current = saveProjectClick;
    const showHelpRef = useRef(showHelp); showHelpRef.current = showHelp;
    // "Any overlay open" drives Escape priority: close overlays before resetting
    // the rover. Includes the settings popover (its own Escape handler also
    // fires; the duplicate close is harmless) but excludes FPV, which has a
    // dedicated Escape handler for motion-sensitive exit.
    const anyOverlayOpenRef = useRef(false);
    anyOverlayOpenRef.current = !!(swarmOpen || askOpen || teacherOpen || robotLabOpen || memoryOpen || reviewOpen || vibeOpen || blocksOpen || buildOpen || showHelp || realismOpen || demoOpen || settingsOpen);
    const fpvRef = useRef(fpv); fpvRef.current = fpv;
    // World order matches the terrain-switch bar: Ctrl+1..6 maps to these ids.
    const WORLDS_KB = ['city', 'room', 'earth', 'mars', 'underwater', 'space'];
    useEffect(() => {
      const typingIn = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
      const closeAllOverlays = () => {
        setSwarmOpen(false); setAskOpen(false); setTeacherOpen(false);
        setRobotLabOpen(false); setMemoryOpen(false); setReviewOpen(false);
        setVibeOpen(false); setBlocksOpen(false); setBuildOpen(false);
        setShowHelp(false); setRealismOpen(false); setDemoOpen(false);
        setSettingsOpen(false);
      };
      const h = (e) => {
        const cmd = e.metaKey || e.ctrlKey;
        // ---- Run controls ----
        // Ctrl+Enter or F5: Run / Pause the current program.
        if (cmd && e.key === 'Enter') { e.preventDefault(); onRunRef.current(); return; }
        if (e.key === 'F5') { e.preventDefault(); onRunRef.current(); return; }
        // Ctrl+Shift+S or F10: Step one instruction.
        if (cmd && e.shiftKey && (e.key === 'S' || e.key === 's')) { e.preventDefault(); onStepRef.current(); return; }
        if (e.key === 'F10') { e.preventDefault(); onStepRef.current(); return; }
        // Escape: close an open overlay, else reset the rover. A text field gets
        // to keep Escape (it blurs the field); FPV has its own Escape-to-exit.
        if (e.key === 'Escape') {
          if (anyOverlayOpenRef.current) { e.preventDefault(); closeAllOverlays(); return; }
          if (!typingIn(e.target) && !fpvRef.current) { e.preventDefault(); onResetRef.current(); }
          return;
        }
        // Everything below is a Ctrl/Cmd combo (plus the bare '?' help toggle).
        if (cmd) {
          // Ctrl+1..6: switch world (no Shift/Alt so Ctrl+Shift+1 etc. are free).
          if (e.key >= '1' && e.key <= '6' && !e.shiftKey && !e.altKey) {
            const id = WORLDS_KB[Number(e.key) - 1];
            if (id) { e.preventDefault(); onTerrainRef.current(id); }
            return;
          }
          // Ctrl+S: save the project document (Ctrl+Shift+S is Step).
          if (!e.shiftKey && !e.altKey && (e.key === 'S' || e.key === 's')) { e.preventDefault(); saveProjectRef.current(); return; }
          // Ctrl+B: toggle the block coding panel.
          if (!e.shiftKey && !e.altKey && (e.key === 'B' || e.key === 'b')) { e.preventDefault(); setBlocksOpen(function (o) { return !o; }); return; }
          // Ctrl+L: toggle Robot Lab.
          if (!e.shiftKey && !e.altKey && (e.key === 'L' || e.key === 'l')) { e.preventDefault(); setRobotLabOpen(function (o) { return !o; }); return; }
          // Ctrl+M: toggle the Memory panel.
          if (!e.shiftKey && !e.altKey && (e.key === 'M' || e.key === 'm')) { e.preventDefault(); setMemoryOpen(function (o) { return !o; }); return; }
          // Ctrl+/: toggle the help / shortcuts modal.
          if (e.key === '/') { e.preventDefault(); setShowHelp(function (s) { return !s; }); return; }
          // Ctrl+D: toggle 2D / 3D view.
          if (!e.shiftKey && !e.altKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); setView3d(function (v) { return !v; }); return; }
          // Ctrl+F: toggle first-person view (only meaningful in 3D).
          if (!e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); setFpv(function (f) { return !f; }); return; }
        } else if (e.key === '?' && !typingIn(e.target)) {
          e.preventDefault(); setShowHelp(function (s) { return !s; });
        }
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, []);

    // Focus management for the modals. Each is marked aria-modal, which promises
    // assistive tech that focus is confined to the dialog, so honour it: when one
    // opens, move focus into it and trap Tab inside; on close, restore focus to
    // whatever had it before. Keyed on the open-state so it does not run per frame.
    const anyModalOpen = swarmOpen || askOpen || teacherOpen || robotLabOpen || memoryOpen || reviewOpen || vibeOpen || blocksOpen || buildOpen || showHelp || realismOpen || demoOpen;
    useEffect(() => {
      if (!anyModalOpen) return undefined;
      const modal = Array.prototype.slice.call(document.querySelectorAll('.modal[aria-modal="true"]')).pop();
      if (!modal) return undefined;
      const prev = document.activeElement;
      const focusables = () => Array.prototype.slice.call(modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter((el) => !el.disabled && el.offsetParent !== null);
      const f = focusables();
      if (f.length) f[0].focus();
      const onKey = (e) => {
        if (e.key !== 'Tab') return;
        const items = focusables();
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1], a = document.activeElement;
        if (!modal.contains(a)) { e.preventDefault(); first.focus(); return; }
        if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', onKey, true);
      return () => { document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus(); };
      // Keyed on EACH modal's open-state, not a single anyModalOpen boolean: when
      // a second modal opens over an already-open one, the boolean does not change
      // so the effect would not re-run and focus would stay trapped in the now
      // occluded background modal. Depending on every flag re-captures the new
      // frontmost dialog and moves focus into it.
    }, [swarmOpen, askOpen, teacherOpen, robotLabOpen, memoryOpen, reviewOpen, vibeOpen, blocksOpen, buildOpen, showHelp, realismOpen, demoOpen]);

    // Shared vocabulary (app-data.jsx): telemetry renders the SAME labels.
    const statusLabel = (window.KodroStatusLabels || { idle: 'Standby', running: 'Running', paused: 'Paused', done: 'Complete', error: 'Halted' })[runState];
    const chipName = (robotSpec && robotSpec.name) || 'Robot';
    const chipType = (robotSpec && robotSpec.type) || null;
    const chipMass = (robotSpec && robotSpec.mass) || null;

    return (
      <div className="app">
        <a className="skip-link" href="#editor-main">Skip to code editor</a>
        <h1 className="sr-only">Kodro, an offline robot design and simulation studio</h1>
        {/* ---- mission bar ---- */}
        <div className="missionbar" role="banner">
          <div className="brand">
            <div className="brand-mark" dangerouslySetInnerHTML={{ __html: ORBIT_SVG }}></div>
            <div className="brand-text">
              <div className="brand-name">Kodro</div>
              <div className="brand-sub">Robot design studio · Offline</div>
            </div>
          </div>
          <div className="bar-divider"></div>
          <div className="run-controls">
            <button className={'ctrl ' + (runState === 'running' ? '' : 'ctrl-run')} onClick={onRun}>
              {runState === 'running' ? I.pause : I.play}
              {runState === 'running' ? 'Pause' : runState === 'paused' ? 'Resume' : 'Run'}
            </button>
            <button className="ctrl" onClick={onStep} disabled={runState === 'running'}>{I.step}Step</button>
            <button className="ctrl ctrl-stop" onClick={onReset}>{I.reset}Reset</button>
          </div>
          <div className="bar-divider"></div>
          <div className="speed-ctrl">
            <label htmlFor="sim-speed">Sim speed</label>
            <input id="sim-speed" type="range" className="slider" min="0.4" max="3" step="0.1" value={speedMul} onChange={e => setSpeedMul(parseFloat(e.target.value))} aria-label="Simulation speed" aria-valuetext={speedMul + ' times'} />
            <span className="num" style={{ fontSize: 11, color: 'var(--fg-2)', width: 30 }}>{speedMul.toFixed(1)}×</span>
          </div>
          <div className="bar-spacer"></div>
          <div className="bar-status" role="status" aria-live="polite" aria-label={'Status: ' + statusLabel}>
            <span className={'status-dot ' + runState} aria-hidden="true"></span>
            <span>{statusLabel}</span>
          </div>
          <div className="bar-divider"></div>
          {/* Current-robot chip: the designed robot has a visible identity in
              the studio chrome (name, type, mass), and one click opens the
              Robot Lab to change it (product-coherence D3). */}
          <button
            className="robot-chip"
            title="Current robot build. Click to open the Robot Lab"
            aria-label={'Current robot: ' + chipName + (chipType ? ', type ' + chipType : '') + (chipMass ? ', mass ' + chipMass + ' grams' : '') + '. Open Robot Lab'}
            onClick={() => setRobotLabOpen(true)}
          >
            <span className="rc-name">{chipName}</span>
            {(chipType || chipMass) && (
              <span className="rc-meta">{chipType || ''}{chipType && chipMass ? ' · ' : ''}{chipMass ? chipMass + ' g' : ''}</span>
            )}
          </button>
          <button className="icon-btn" title="Robot Lab. Design a custom robot" aria-label="Robot Lab — design a custom robot" onClick={() => setRobotLabOpen(true)}>{KI('lab')}<span className="icon-btn-label">Robot Lab</span></button>
          <button className="icon-btn" title="Memory. What the system learned, and your skill library" aria-label="Memory and skills — what the system learned, and your skill library" onClick={() => setMemoryOpen(true)}>{KI('memory')}<span className="icon-btn-label">Memory</span></button>
          <button className="icon-btn" title="Build a real robot on a budget" aria-label="Build a real robot — design one on a budget" onClick={openBuildReal}>{KI('build')}<span className="icon-btn-label">Build</span></button>
          <button className="icon-btn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts — press question mark to see all shortcuts" onClick={() => setShowHelp(true)}>?<span className="icon-btn-label">Help</span></button>
          <input ref={projectFileRef} type="file" accept=".kodro,.json,application/json" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} onChange={onProjectFilePicked} />
          <div className="settings-wrap">
            <button ref={settingsBtnRef} className="icon-btn" title="Settings" aria-label="Settings — theme, sound, readable text, and teacher tools" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(o => !o)}>{KI('gear')}<span className="icon-btn-label">Settings</span></button>
            {settingsOpen && (
              <div className="settings-pop" role="dialog" aria-label="Settings">
                {/* P7/A1: the Studio/Classroom split. Studio (default) is the
                    professional tool; Classroom brings back pupils, lessons,
                    the teacher dashboard and the novelty themes. */}
                <label className="set-row">
                  <span>Mode</span>
                  <select className="lesson-select" value={mode} onChange={e => setMode(e.target.value)} aria-label="Studio or Classroom mode">
                    <option value="studio">Studio</option>
                    <option value="classroom">Classroom</option>
                  </select>
                </label>
                {classroom && pupils.length > 0 && (
                  <label className="set-row">
                    <span>Pupil</span>
                    <select className="lesson-select" value={activePupilId || ''} onChange={onPupilChange} aria-label="Active pupil">
                      {pupils.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                      <option value="__new__">+ New pupil…</option>
                    </select>
                  </label>
                )}
                <label className="set-row">
                  <span>Theme</span>
                  <select className="lesson-select" value={theme} onChange={e => setTheme(e.target.value)} aria-label="Visual theme">
                    <option value="dark">Mission (dark)</option>
                    <option value="light">Daylight (light)</option>
                    <option value="contrast">High contrast (colour-blind safe)</option>
                    {classroom && <option value="matrix">Matrix</option>}
                    {classroom && <option value="pixel">Pixel</option>}
                    {classroom && <option value="game">Arcade</option>}
                    {classroom && <option value="lego">Brick</option>}
                    {classroom && <option value="chatgpt">Clean</option>}
                    {classroom && <option value="abstract">Abstract</option>}
                    {classroom && <option value="wiki">Wiki / Network</option>}
                  </select>
                </label>
                <button className="set-row set-btn" aria-pressed={!muted} onClick={toggleSound}>
                  <span>Sound</span><span className="set-val">{muted ? 'Off' : 'On'}</span>
                </button>
                <button className="set-row set-btn" aria-pressed={readable} onClick={() => setReadable(v => !v)}>
                  <span>Readable text</span><span className="set-val">{readable ? 'On' : 'Off'}</span>
                </button>
                {/* P7/A10: layout presets beside the persisted drag sizes. */}
                <button className="set-row set-btn" onClick={() => layoutPreset('viewport')}>
                  <span>Layout · Maximize viewport</span><span className="set-val">→</span>
                </button>
                <button className="set-row set-btn" onClick={() => layoutPreset('editor')}>
                  <span>Layout · Focus editor</span><span className="set-val">→</span>
                </button>
                <button className="set-row set-btn" onClick={() => layoutPreset('reset')}>
                  <span>Layout · Reset</span><span className="set-val">→</span>
                </button>
                <button className="set-row set-btn" onClick={saveProjectClick}>
                  <span>Project · Save (.kodro)</span><span className="set-val">&rarr;</span>
                </button>
                <button className="set-row set-btn" onClick={openProjectClick}>
                  <span>Project · Open…</span><span className="set-val">&rarr;</span>
                </button>
                <button className="set-row set-btn" onClick={() => { setSettingsOpen(false); pickPhotoClick(); }}>
                  <span>Photo prop · place("photo")</span><span className="set-val">{photoUrl ? 'Loaded' : 'Pick…'}</span>
                </button>
                {classroom && (
                  <button className="set-row set-btn" onClick={openTeacher}>
                    <span>Teacher dashboard</span><span className="set-val">→</span>
                  </button>
                )}
                {classroom && (
                  <button className="set-row set-btn" onClick={() => { setSettingsOpen(false); exportReportClick(); }}>
                    <span>Export progress report</span><span className="set-val">→</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- workspace ---- */}
        <main id="editor-main" className="workspace" style={{ ['--editor-w']: editorW + 'px', ['--tele-w']: teleW + 'px' }}>
          {/* left column: editor + console */}
          <div className="panel" style={{ gridColumn: 1 }}>
            <div className="editor-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="panel-head">
                <div className="tabs">
                  {Object.keys(EXAMPLES).map(k => (
                    <button key={k} type="button" className={'tab' + (!currentLessonId && activeTab === k ? ' active' : '')} aria-pressed={!currentLessonId && activeTab === k} onClick={() => { setCurrentLessonId(null); setActiveTab(k); }}>{EXAMPLES[k].label}</button>
                  ))}
                </div>
                {classroom && lessons.length > 0 && (
                  <div className="lesson-picker">
                    <label htmlFor="lesson-select" className="eyebrow">Lesson</label>
                    <select
                      id="lesson-select"
                      className="lesson-select"
                      value={currentLessonId || ''}
                      onChange={e => loadLesson(lessons.find(l => l.id === e.target.value))}
                    >
                      <option value="" disabled>Pick a lesson…</option>
                      {lessons.map(l => (
                        <option key={l.id} value={l.id}>{l.id} · {l.title} [{l.keyStage}]</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="panel-actions">
                  <button className="btn-mini btn-vibe" title={aiInfo.available ? 'Code with AI (' + aiInfo.model + ')' : 'Code with AI (needs local Ollama)'} onClick={() => setVibeOpen(true)}>{KI('vibe')}Vibe</button>
                  <button className="btn-mini" title="Build the program from blocks" onClick={() => setBlocksOpen(true)}>{KI('blocks')}Blocks</button>
                  <button className="btn-mini" title={aiInfo.available ? 'A second AI agent reviews your code' : 'A second AI agent reviews your code (needs local Ollama)'} onClick={runReview}>{KI('review')}Review</button>
                  <button className="btn-mini" title="Validate this program across 5 randomised seeds" onClick={runValidation}>{KI('target')}Validate</button>
                  <button className="btn-mini" title="Realism dashboard: how the build drives the simulation" onClick={() => setRealismOpen(true)}>{KI('gauge')}Realism</button>
                  <button className="btn-mini" title="Guided 2 to 3 minute realism demo" onClick={() => setDemoOpen(true)}>{KI('demo')}Demo</button>
                  <button className="btn-mini" title={aiInfo.available ? 'Ask a question, answered from the built-in material' : 'Ask a question, answered from the built-in material (needs local Ollama)'} onClick={() => { setAskOpen(true); setAskData(null); }}>{KI('ask')}Ask</button>
                  <button className="btn-mini" title="Run your program on a swarm of rovers at once" onClick={runSwarm}>{KI('swarm')}Swarm</button>
                </div>
              </div>
              <window.Editor code={code} onChange={onCodeChange} activeLine={activeLine} readOnly={runState === 'running'} />
              {(() => {
                // The hint strip is driven by the SAME availability source the
                // blocks palette and the runtime gate use (KodroCommands), so
                // it can never advertise a command this build refuses: a
                // command whose part is missing renders greyed out with the
                // reason in its tooltip (product-coherence D5). The old static
                // strip also advertised the collect_sample()/drop_sample()
                // print stubs; only real, runnable commands are listed now.
                const gateOk = (g) => !g || !window.KodroCommands || window.KodroCommands.check(robotSpec, g).ok;
                const ACTION_HINTS = [
                  ['move_forward(m)', null], ['move_backward(m)', null], ['turn_left(°)', null], ['turn_right(°)', null],
                  ['set_speed(0–100)', null], ['pen_down/up()', null], ['wait(s)', null], ['scan()', 'scan'],
                  ['led("cyan")', null], ['say("…")', null], ['place("flag")', null],
                ];
                const SENSOR_HINTS = [
                  ['distance()', 'distance'], ['heading()', 'heading'], ['battery()', null],
                  ['obstacle_ahead()', 'distance'], ['gravity()', null], ['temperature()', null],
                ];
                const hint = ([label, g], i) => {
                  const ok = gateOk(g);
                  return (
                    <React.Fragment key={label}>
                      {i > 0 ? ' · ' : null}
                      <b className={ok ? undefined : 'cmd-off'} title={ok ? undefined : 'Not available on this build. Fit the missing part in the Robot Lab.'}>{label}</b>
                    </React.Fragment>
                  );
                };
                return (
                  <div className="api-hint">
                    {ACTION_HINTS.map(hint)}
                    <span className="sep"> · sensors return values: </span>
                    {SENSOR_HINTS.map(hint)}
                  </div>
                );
              })()}
              {(() => {
                if (!classroom) return null;  // lessons are classroom furniture (A1)
                const lesson = lessons.find(l => l.id === currentLessonId);
                if (!lesson) return null;
                return (
                  <section className="lesson-card" aria-label="Current lesson">
                    <div className="lesson-card-head">
                      <span className="lesson-badge">{lesson.keyStage}</span>
                      <span className="lesson-title">{lesson.id} · {lesson.title}</span>
                      {lesson.readingAge ? <span className="lesson-age" title="Reading age">Age {lesson.readingAge}+</span> : null}
                      {lessonVerdict && (
                        <span className={'lesson-verdict ' + (lessonVerdict.passed ? 'pass' : 'fail')}>
                          <span aria-hidden="true">{lessonVerdict.passed ? '✓' : '✗'}</span> {lessonVerdict.passed ? 'Complete' : 'Not yet'} · {lessonVerdict.score}/100
                        </span>
                      )}
                    </div>
                    {lesson.intro ? <p className="lesson-intro">{lesson.intro.trim()}</p> : null}
                    {lesson.glossary && Object.keys(lesson.glossary).length > 0 && (
                      <dl className="lesson-glossary">
                        {Object.keys(lesson.glossary).map(term => (
                          <div key={term} className="gloss-item">
                            <dt>{term}</dt><dd>{lesson.glossary[term]}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {lessonVerdict && !lessonVerdict.passed && lessonVerdict.reasons.length > 0 && (
                      <ul className="lesson-reasons">
                        {lessonVerdict.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}
                    {lessonVerdict && lessonVerdict.hint && lessonVerdict.hint.message && (
                      <p className="lesson-hint">{KI('bulb')} {lessonVerdict.hint.message}</p>
                    )}
                  </section>
                );
              })()}
            </div>
            <div className="resizer-row" role="separator" aria-orientation="horizontal" tabIndex={0} aria-label="Resize console height (arrow up and down)" aria-valuenow={Math.round(consoleH)} aria-valuemin={90} aria-valuemax={420} onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); nudge('console', 16); } else if (e.key === 'ArrowDown') { e.preventDefault(); nudge('console', -16); } }} onPointerDown={e => startDrag('console', e)} style={{ height: 5, cursor: 'row-resize', background: 'transparent', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '0 0', borderTop: '0.5px solid var(--border)' }}></div>
            </div>
            <div className="console" style={{ height: consoleH, flex: 'none' }}>
              <div className="console-head">
                <span className="eyebrow">{runsOpen ? 'Run reports' : 'Console'}</span>
                <div className="ph-spacer" style={{ flex: 1 }}></div>
                <button className={'btn-mini' + (runsOpen ? ' active' : '')} title="Run reports. A structured record of every run; tick two to compare builds" aria-pressed={runsOpen} onClick={() => setRunsOpen(o => !o)}>Runs</button>
                {!runsOpen && <button className="btn-mini" onClick={() => setConsoleLines([{ type: 'sys', text: 'Console cleared.' }])}>Clear</button>}
              </div>
              {runsOpen && (() => {
                // P7/A8: the docked run-report panel. Reads the store fresh on
                // every kodro-runreport tick; two ticked runs render a
                // side-by-side numeric compare.
                void runsTick;
                const runs = window.KodroRunReports ? window.KodroRunReports.list() : [];
                const sel = cmpSel.map(id => runs.find(r => r.id === id)).filter(Boolean);
                const toggleSel = (id) => setCmpSel(cs => cs.indexOf(id) >= 0 ? cs.filter(x => x !== id) : (cs.length >= 2 ? [cs[1], id] : cs.concat([id])));
                const fmtTime = (ts) => { try { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { return ''; } };
                return (
                  <div className="runs-panel" role="region" aria-label="Run reports">
                    {sel.length === 2 && window.KodroRunReports && (
                      <table className="runs-diff">
                        <thead>
                          <tr><th></th><th>{sel[0].robotName || 'A'} · {fmtTime(sel[0].ts)}</th><th>{sel[1].robotName || 'B'} · {fmtTime(sel[1].ts)}</th><th>delta</th></tr>
                        </thead>
                        <tbody>
                          {window.KodroRunReports.diff(sel[0], sel[1]).map((d, i) => (
                            <tr key={i}><td>{d.label}</td><td className="num">{d.a}</td><td className="num">{d.b}</td><td className="num">{d.delta != null ? (d.delta > 0 ? '+' : '') + d.delta : '-'}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {runs.length === 0
                      ? <p className="vibe-status" style={{ padding: '10px 12px' }}>No runs recorded yet. Press Run; every finished, crashed, stalled or flat-battery run leaves a report here.</p>
                      : (
                        <ul className="runs-list">
                          {runs.map(r => (
                            <li key={r.id} className={'run-entry run-' + r.outcome} data-run-entry={r.outcome}>
                              <input type="checkbox" checked={cmpSel.indexOf(r.id) >= 0} onChange={() => toggleSel(r.id)} aria-label={'Select the ' + (r.robotName || 'robot') + ' run for compare'} />
                              <span className={'run-outcome ro-' + r.outcome}>{(r.outcome || '?').toUpperCase()}</span>
                              <span className="run-main">{r.robotName || 'Robot'} · {r.worldName || r.world}{r.detail ? ' · ' + r.detail : ''}</span>
                              <span className="run-stats num">
                                {r.distanceCm != null ? (r.distanceCm / 100).toFixed(1) + ' m' : '-'}
                                {r.batteryUsedPct != null ? ' · ' + r.batteryUsedPct + '% batt' : ''}
                                {r.minProximityCm != null && r.minProximityCm < 600 ? ' · ' + r.minProximityCm + ' cm closest' : ''}
                              </span>
                              <span className="run-pred" title="The design check's prediction before the run">{r.predicted ? 'predicted: ' + r.predicted : ''}</span>
                              <span className="run-time num">{fmtTime(r.ts)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    <div className="runs-foot">
                      <span className="vibe-hint" style={{ flex: 1 }}>Tick two runs to compare builds side by side.</span>
                      <button className="btn-mini" onClick={() => { if (window.KodroRunReports) window.KodroRunReports.clear(); setCmpSel([]); }}>Clear history</button>
                    </div>
                  </div>
                );
              })()}
              {!runsOpen && <div className="console-out" ref={consoleEndRef} role="log" aria-live="polite" aria-label="Program output and lesson feedback">
                {consoleLines.map((l, i) => (
                  <div key={i} className={'cline ' + (l.type === 'err' ? 'err' : l.type === 'ok' ? 'ok' : l.type === 'sys' ? 'sys' : '')}>
                    {l.ts ? <span className="ts">{l.ts}</span> : null}
                    {l.text}
                  </div>
                ))}
              </div>}
              {!runsOpen && <div className="repl-row">
                <span className="repl-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
                <input
                  className="repl-input"
                  type="text"
                  spellCheck="false"
                  placeholder='live terminal. Try move_forward(1) or place("flag")'
                  aria-label="Live terminal: type one Python line and press Enter"
                  value={replLine}
                  onChange={e => setReplLine(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { runReplLine(replLine); setReplHist(replLine); setReplLine(''); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); if (replHistRef.current) setReplLine(replHistRef.current); }
                    else if (e.key === 'Escape') { e.target.blur(); }
                  }}
                />
              </div>}
            </div>
          </div>

          <div className="resizer" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize editor width (arrow left and right)" aria-valuenow={Math.round(editorW)} aria-valuemin={280} aria-valuemax={640} onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); nudge('editor', -16); } else if (e.key === 'ArrowRight') { e.preventDefault(); nudge('editor', 16); } }} onPointerDown={e => startDrag('editor', e)} style={{ gridColumn: 2 }}></div>

          {/* center: viewport */}
          <div className="panel view-panel" style={{ gridColumn: 3 }} onPointerDown={camDrag} onWheel={camWheel}>
            <div className="terrain-switch">
              {['city', 'room', 'earth', 'mars', 'underwater', 'space'].map(id => (
                <button type="button" key={id} className={'terrain-btn' + (terrainId === id ? ' active' : '')} aria-pressed={terrainId === id} onClick={() => onTerrain(id)}>
                  <span className="tdot" style={{ background: TERRAINS[id].dot, boxShadow: terrainId === id ? '0 0 8px ' + TERRAINS[id].dot : 'none' }}></span>
                  {TERRAINS[id].label}
                </button>
              ))}
              {window.SITES && (
                <select
                  className="lesson-select site-select"
                  value={window.SITES[terrainId] ? terrainId : ''}
                  onChange={e => { if (e.target.value) onTerrain(e.target.value); }}
                  aria-label="Real-world mission site"
                  title="Drop the rover at a real place. Real gravity, traction and light"
                >
                  <option value="" disabled>Mission site…</option>
                  {[['earth', 'Earth'], ['underwater', 'Underwater'], ['mars', 'Mars'], ['space', 'Space'], ['room', 'Test bays']].map(([base, label]) => {
                    const ids = Object.keys(window.SITES).filter(id => window.SITES[id].base === base);
                    return ids.length === 0 ? null : (
                      <optgroup key={base} label={label}>
                        {ids.map(id => <option key={id} value={id}>{window.SITES[id].name}</option>)}
                      </optgroup>
                    );
                  })}
                </select>
              )}
              <span className="view-toggle">
                <button type="button" className={'terrain-btn' + (view3d ? ' active' : '')} aria-pressed={view3d} title="Real 3D view" onClick={() => { setView3d(true); setFocus3dKey(k => k + 1); }}>3D</button>
                <button type="button" className={'terrain-btn' + (!view3d ? ' active' : '')} aria-pressed={!view3d} title="Flat 2.5D view" onClick={() => setView3d(false)}>2.5D</button>
                {view3d && (
                  <button type="button" className="terrain-btn" aria-pressed={fpv} title="Switch between orbit and first person" onClick={() => setFpv(f => !f)}>{fpv ? KI('eye') : KI('orbit')}{fpv ? 'First person' : 'Orbit'}</button>
                )}
                {view3d && (
                  <select className="terrain-btn" value={quality} title="Render quality (Low keeps a basic laptop smooth, Cinematic maxes a screenshot)" aria-label="Render quality" style={{ cursor: 'pointer' }}
                    onChange={e => { const v = e.target.value; window.KODRO_QUALITY = v; setQuality(v); try { localStorage.setItem('kodro_quality', v); } catch (err) { void err; } }}>
                    <option value="low">Low</option>
                    <option value="med">Medium</option>
                    <option value="high">High</option>
                    <option value="cinematic">Cinematic</option>
                  </select>
                )}
                {view3d && (
                  <select className="terrain-btn" value={tod} title="Time of day. Drives the sun, the sky and the LIGHT gauge" aria-label="Time of day" style={{ cursor: 'pointer' }}
                    onChange={e => setTod(e.target.value)}>
                    <option value="noon">Noon</option>
                    <option value="dawn">Dawn</option>
                    <option value="dusk">Dusk</option>
                    <option value="night">Night</option>
                  </select>
                )}
                {view3d && (
                  <select className="terrain-btn" value={weather} title="Weather. Dust storm on Mars; rain and snow outdoors on Earth" aria-label="Weather" style={{ cursor: 'pointer' }}
                    onChange={e => setWeather(e.target.value)}>
                    <option value="clear">Clear</option>
                    <option value="storm">Dust storm</option>
                    <option value="rain">Rain</option>
                    <option value="snow">Snow</option>
                  </select>
                )}
              </span>
            </div>
            {view3d
              ? <window.Viewport3D key={'vp3d-' + (terrain && (terrain.siteId || terrain.id)) + '-' + (robotSpec && robotSpec.type) + '-' + ((terrain && terrain.tod) || 'noon') + '-' + ((terrain && terrain.weather) || 'clear') + (quality === 'cinematic' ? '-cine' : '-std')} terrain={terrain} rover={rover} fpv={fpv} robotType={robotSpec && robotSpec.type} quality={quality} focusKey={focus3dKey} onFail={() => { setView3d(false); addConsole('3D is unavailable on this machine — switched to the 2.5D view.', 'sys'); }} />
              : <window.Viewport terrain={terrain} rover={rover} trail={trail} props={props} photoUrl={photoUrl} sensorDist={sensorDist} say={say} crashKey={crashKey} zoom={zoom} showGrid={t.grid} showFx={t.ambientFx} trailColor={trailColor} tilt={cam.tilt} yaw={cam.yaw} onTilt={v => setCam({ tilt: v, yaw: v === 0 ? 0 : -8, zoom: 1 })} />}
            {worldLoading && (
              <div className="world-loading" role="status" aria-live="polite" aria-label={'Loading ' + worldLoading.name}>
                <div className="world-loading-card">
                  <span className="world-loading-spinner" aria-hidden="true"></span>
                  <span>Loading {worldLoading.name}…</span>
                </div>
              </div>
            )}
          </div>

          <div className="resizer" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize telemetry width (arrow left and right)" aria-valuenow={Math.round(teleW)} aria-valuemin={240} aria-valuemax={460} onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); nudge('tele', 16); } else if (e.key === 'ArrowRight') { e.preventDefault(); nudge('tele', -16); } }} onPointerDown={e => startDrag('tele', e)} style={{ gridColumn: 4 }}></div>

          {/* right: telemetry */}
          <div className={'panel tele-panel' + (teleCollapsed ? ' tele-collapsed' : '')} style={{ gridColumn: 5 }}>
            <div className="panel-head">
              <span className="eyebrow">Telemetry</span>
              <div className="ph-spacer" style={{ flex: 1 }}></div>
              {/* The panel is captioned with the robot the user actually
                  built, not a hard-coded callsign (product-coherence D3). */}
              <span className="num" style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{chipName}</span>
              <button type="button" className="tele-toggle" aria-expanded={!teleCollapsed} aria-label={teleCollapsed ? 'Expand telemetry panel' : 'Collapse telemetry panel'} onClick={() => setTeleCollapsed(c => !c)}>{teleCollapsed ? '▸' : '▾'}</button>
            </div>
            <window.Telemetry rover={rover} terrain={terrain} sensorDist={sensorDist} odometer={odo} robot={robotSpec} runState={runState} />
          </div>
        </main>

        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Camera" />
          <window.TweakSlider label="Perspective" value={cam.tilt} min={0} max={70} step={2} unit="°" onChange={v => setCam(c => ({ ...c, tilt: v }))} />
          <window.TweakSlider label="Orbit" value={cam.yaw} min={-45} max={45} step={1} unit="°" onChange={v => setCam(c => ({ ...c, yaw: v }))} />
          <window.TweakSlider label="Zoom" value={cam.zoom} min={0.7} max={1.6} step={0.05} onChange={v => setCam(c => ({ ...c, zoom: v }))} />
          <window.TweakSection label="Scene" />
          <window.TweakToggle label="Reference grid" value={t.grid} onChange={v => setTweak('grid', v)} />
          <window.TweakToggle label="Ambient FX" value={t.ambientFx} onChange={v => setTweak('ambientFx', v)} />
          <window.TweakSection label="Path trace" />
          <window.TweakRadio label="Trail color" value={t.trail} options={['terrain', 'cyan', 'amber']} onChange={v => setTweak('trail', v)} />
        </window.TweaksPanel>

        {swarmOpen && <window.KodroPanels.SwarmModal swarmBusy={swarmBusy} setSwarmOpen={setSwarmOpen} swarmData={swarmData} />}

        {askOpen && <window.KodroPanels.AskModal askBusy={askBusy} setAskOpen={setAskOpen} askQuery={askQuery} setAskQuery={setAskQuery} runAsk={runAsk} askData={askData} />}

        {teacherOpen && <window.KodroPanels.TeacherModal onClose={() => setTeacherOpen(false)} teacherData={teacherData} />}

        {robotLabOpen && RobotLab && (
          <RobotLab onClose={() => setRobotLabOpen(false)} onBuildReal={openBuildReal} />
        )}

        {memoryOpen && <window.KodroPanels.MemoryModal setMemoryOpen={setMemoryOpen} memTick={memTick} code={code} terrain={terrain} robotSpec={robotSpec} currentLessonId={currentLessonId} setLessonBuffers={setLessonBuffers} setPrograms={setPrograms} activeTab={activeTab} applyCode={applyProgramText} />}

        {reviewOpen && <window.KodroPanels.ReviewModal reviewBusy={reviewBusy} setReviewOpen={setReviewOpen} reviewErr={reviewErr} reviewData={reviewData} applyReview={applyReview} />}

        {realismOpen && window.KodroRealism && React.createElement(window.KodroRealism, { onClose: () => setRealismOpen(false), terrain: terrain })}
        {demoOpen && window.KodroDemo && React.createElement(window.KodroDemo, { onClose: () => setDemoOpen(false) })}
        {vibeOpen && <window.KodroPanels.VibeModal setVibeOpen={setVibeOpen} vibeCancelRef={vibeCancelRef} setVibeBusy={setVibeBusy} aiInfo={aiInfo} pickModel={pickModel} vibeMsgs={vibeMsgs} setVibeMsgs={setVibeMsgs} vibeApply={vibeApply} vibeBusy={vibeBusy} vibeLive={vibeLive} vibeEndRef={vibeEndRef} vibeError={vibeError} vibePrompt={vibePrompt} setVibePrompt={setVibePrompt} vibeSend={vibeSend} vibeContext={(window.KodroMemory && window.KodroMemory.lessonFor) ? window.KodroMemory.lessonFor(terrain.id) : null} />}

        {blocksOpen && <window.KodroPanels.BlocksModal setBlocksOpen={setBlocksOpen} BLOCK_DEFS={BLOCK_DEFS} robotSpec={robotSpec} addBlock={addBlock} endBlock={endBlock} blockIndent={blockIndent} setBlockIndent={setBlockIndent} blocks={blocks} setBlocks={setBlocks} moveBlock={moveBlock} removeBlock={removeBlock} insertBlocksCode={insertBlocksCode} />}

        {showHelp && <window.KodroPanels.HelpModal onClose={() => setShowHelp(false)} />}

        {buildOpen && <window.KodroPanels.BuildModal onClose={() => setBuildOpen(false)} buildBudget={buildBudget} setBuildBudget={setBuildBudget} buildGoal={buildGoal} setBuildGoal={setBuildGoal} buildBusy={buildBusy} runBuild={runBuild} buildErr={buildErr} buildPlan={buildPlan} robotSpec={robotSpec} onAdoptParts={adoptPlanParts} />}

        {/* Toast notifications: success / error / info, bottom-right. */}
        <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
          {toasts.map(function (t) {
            return (
              <div key={t.id} className={'toast toast-' + t.kind}>
                {t.text}
                {t.action && (
                  <button
                    className="btn-mini toast-action"
                    onClick={function () {
                      try { t.action.onClick(); } catch (e) { void e; }
                      setToasts(function (ts) { return ts.filter(function (to) { return to.id !== t.id; }); });
                    }}
                  >{t.action.label}</button>
                )}
              </div>
            );
          })}
        </div>

        {!onboarded && window.KodroOnboarding && (
          <window.KodroOnboarding onClose={() => {
            setOnboarded(true);
            try { localStorage.setItem('or_onboarded', '1'); } catch (err) { void err; }
          }} />
        )}
      </div>
    );
  }

  // TWEAK_DEFAULTS and ORBIT_SVG are pure data (see app-data.jsx); pulled off window.
  const TWEAK_DEFAULTS = window.KodroTweakDefaults || {};

  // Kodro brand mark: a circular orbit (the simulated world), a trajectory swept
  // along it, and the robot as the solid node at the head of its path. Monochrome
  // via currentColor so it inherits whatever colour .brand-mark sets (theme-safe).
  const ORBIT_SVG = window.KodroOrbitSvg || '';

  // The 5-track .workspace grid (editor | resizer | viewport | resizer |
  // telemetry) lives in styles.css next to the rest of the layout; the old
  // runtime <style> injection that duplicated it was a maintenance landmine
  // (two competing sources for the same rule) and is gone.

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
