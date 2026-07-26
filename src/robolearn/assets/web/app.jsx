/* ============================================================================
   KODRO — App (runtime + UI wiring)
   ========================================================================== */
(function () {
  const { useState, useRef, useEffect, useMemo } = React;
  const TERRAINS = window.TERRAINS;
  const WALL = TERRAINS.WALL;
  const RobotLab = window.RobotLab;
  const R_DEFAULT = 30; // rover collision radius (cm) for catalogue builds
  // Persist something the PUPIL made, and say so when it does not land.
  //
  // The stores that hold progress and run reports already announce a failed
  // write (see the kodro-storage-failed listener below), but the pupil's own
  // code buffers and lesson results were still written with an empty catch --
  // the one category where a silent loss costs them work they typed. UI
  // preferences deliberately keep swallowing: losing a theme is cosmetic and
  // warning about it would bury the message that matters.
  //
  // Warned once per key: these run on every edit, so an out-of-space device
  // would otherwise raise a toast on every keystroke. The flag clears as soon
  // as a write succeeds, so a later failure is reported again.
  const _storageWarned = Object.create(null);
  function persistWork(key, value, label) {
    try {
      localStorage.setItem(key, value);
      delete _storageWarned[key];
      return true;
    } catch (e) {
      void e;
      if (!_storageWarned[key]) {
        _storageWarned[key] = true;
        try {
          window.dispatchEvent(new CustomEvent('kodro-storage-failed', { detail: { what: label } }));
        } catch (err) { void err; }
      }
      return false;
    }
  }
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

  // localStorage can throw (DOM storage disabled / opaque origin in an embedded
  // WebView); a read in a useState initialiser must never abort the first
  // render, so route every getItem through this guarded helper.
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }

  // A run is evidence for a robot configuration, not merely for a display
  // name. Build a deterministic fingerprint from every persisted input that
  // can affect catalogue or measured-spec behaviour. Sorting object keys makes
  // equivalent imported JSON produce the same key even when its property order
  // differs; array order stays intact because physical sensor placement can be
  // positional evidence rather than a set.
  function stableRunValue(value) {
    if (Array.isArray(value)) return value.map(stableRunValue);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).sort().forEach(function (key) { out[key] = stableRunValue(value[key]); });
      return out;
    }
    return value;
  }
  function runRobotKey(spec) {
    const s = spec || {};
    try {
      // PHYSICAL identity only. The kodroSpec version stamp is deliberately
      // excluded: it is storage metadata that load()-side migration adds and
      // a fresh Lab pick lacks, and including it split physically identical
      // builds into different fingerprints (a build's own evidence was then
      // dropped as "another robot's").
      return JSON.stringify(stableRunValue({
        type: s.type || '',
        board: s.board || '',
        boardMassG: s.boardMassG != null ? s.boardMassG : null,
        sensors: s.sensors || [],
        actuators: s.actuators || [],
        physical: s.physical || null,
      }));
    } catch (e) { return ''; }
  }
  // Shared with verify.jsx and realism.jsx so every surface that presents a
  // stored validation applies the SAME "this exact build produced it" rule.
  window.KodroRunRobotKey = runRobotKey;

  // ---------------- drive-capability helpers (shared) ----------------
  // ONE definition of "can this build drive?" and "does this tab's starter
  // drive?", used by BOTH the activeTab initialiser (reload path) and the
  // kodro-robot handler (fresh pick) so the two can never disagree about when
  // to rescue a fixed-base build off a drive starter it physically cannot run.
  //
  // A build can drive only if it fits a locomotion actuator; this mirrors
  // RobotLab's DRIVE_ACTUATORS. A fixed-base arm fits only a gripper, so it
  // cannot drive and every move_forward/turn starter refuses on the first Run.
  const DRIVE_ACTUATORS = ['motors2', 'motors4', 'servos'];
  function canDrive(robot) {
    const acts = (robot && robot.actuators) || [];
    return DRIVE_ACTUATORS.some((a) => acts.indexOf(a) >= 0);
  }
  // A tab "needs drive" when its starter program calls one of the four
  // locomotion verbs; read straight off the starter source so the set stays
  // correct as examples are added (the systems-check starter uses none, so it
  // runs clean on any build). An unknown tab is treated as not needing drive.
  function tabNeedsDrive(tabKey) {
    const ex = EXAMPLES[tabKey];
    const code = (ex && ex.code) || '';
    return /\b(?:move_forward|move_backward|turn_left|turn_right)\s*\(/.test(code);
  }

  function App() {
    const [terrainId, setTerrainId] = useState(() => {
      const saved = lsGet('or_terrain');
      if (saved) return saved;
      // Fresh load: open in the world recommended for the current build. The
      // default rover recommends Riverside City, the flagship proving ground,
      // so the first thing a new user sees is the one world with everything
      // moving in it.
      try { const rb = window.getKodroRobot && window.getKodroRobot(); if (rb && rb.world) return rb.world; } catch (e) { void e; }
      return 'city';
    });
    const [activeTab, setActiveTab] = useState(() => {
      const saved = lsGet('or_tab');
      if (saved) {
        // Re-validate the persisted tab against the SAVED build. or_tab is
        // written on first mount (a fresh session lands on 'drive'), so a user
        // who later switched to a fixed-base build would otherwise be pinned to
        // a drive starter that refuses on every Run -- the fresh-load rescue
        // below is short-circuited by this saved value. If the saved tab's
        // starter drives but the current build cannot, fall to the sensor-free
        // systems-check starter, which runs clean on any build.
        try {
          const rb = window.getKodroRobot && window.getKodroRobot();
          if (rb && !canDrive(rb) && tabNeedsDrive(saved)) return 'systems';
        } catch (e) { void e; }
        return saved;
      }
      // Fresh load: show a starter the CURRENT build can actually run on the
      // first press of Run. Wheeled builds get the drive patrol; a fixed-base
      // build with no drive actuator (e.g. the arm) gets the sensor-free
      // systems-check starter, which uses only lights/sound/speech/battery and
      // runs clean on every build instead of an honest but discouraging "this
      // arm cannot drive" refusal on the very first run.
      try {
        const rb = window.getKodroRobot && window.getKodroRobot();
        if (rb && !canDrive(rb)) return 'systems';
      } catch (e) { void e; }
      return 'drive';
    });
    const [programs, setPrograms] = useState(() => {
      try { const s = JSON.parse(localStorage.getItem('or_programs')); if (s) return s; } catch (e) {}
      const o = {}; Object.keys(EXAMPLES).forEach(k => o[k] = EXAMPLES[k].code); return o;
    });
    const [runState, setRunState] = useState('idle');
    const [activeLine, setActiveLine] = useState(0);
    // Notification plumbing (the program-output console + the transient toasts)
    // extracted VERBATIM to window.KodroHooks.useConsoleToast (hooks.jsx); it is
    // fully self-contained (no external inputs). App threads setConsoleLines /
    // addConsole / showToast into the other hooks and the sim engine and reads
    // consoleLines / toasts / consoleEndRef in the JSX, so all come back here.
    const { consoleLines, setConsoleLines, addConsole, consoleEndRef, toasts, setToasts, showToast } =
      (window.KodroHooks && window.KodroHooks.useConsoleToast)
        ? window.KodroHooks.useConsoleToast()
        : { consoleLines: [], setConsoleLines: function () {}, addConsole: function () {}, consoleEndRef: { current: null }, toasts: [], setToasts: function () {}, showToast: function () {} };
    const [speedMul, setSpeedMul] = useState(1);
    const [say, setSay] = useState('');
    const [crashKey, setCrashKey] = useState(0);
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    // Interactive 3D camera (pose + drag/wheel handlers) extracted to
    // window.KodroHooks.useCamera (hooks.jsx); cam + setCam are consumed by the
    // Viewport and the tweak sliders below, so they come back from the hook.
    const { cam, setCam, camDrag, camWheel } = (window.KodroHooks && window.KodroHooks.useCamera)
      ? window.KodroHooks.useCamera()
      : { cam: { tilt: 46, yaw: -8, zoom: 1 }, setCam: function () {}, camDrag: function () {}, camWheel: function () {} };
    // Real WebGL 3D viewport (Three.js) with third-person orbit / first-person.
    const [view3d, setView3d] = useState(() => lsGet('or_view3d') !== '0');
    // First person was removed (round-3 user feedback: 2D + 3D only). The
    // constant keeps Viewport3D's prop wiring inert without a UI path to it.
    const fpv = false;
    useEffect(() => { try { localStorage.setItem('or_view3d', view3d ? '1' : '0'); } catch (e) { void e; } }, [view3d]);
    // Declared before the agent effect below, whose dependency array reads it
    // during render: a `const` further down the component is still in its
    // temporal dead zone at that point and threw ReferenceError.
    const [currentLessonId, setCurrentLessonId] = useState(null);
    // Spin up the moving-agent simulation for the current world (city traffic
    // and pedestrians); both viewports and the collision test read from it.
    useEffect(() => {
      if (window.KodroAgents) {
        window.KodroAgents.build(currentLessonId ? 'none' : terrainId);
        // Reduced-motion: build the agents so they still exist for collision and
        // are drawn once, but stop the sim loop so pedestrians and traffic do not
        // animate (WCAG 2.3.3). Freezing the sim keeps the display and the
        // collision test consistent (both see the same static layout).
        if (PREFERS_REDUCED_MOTION()) window.KodroAgents.stop();
      }
      return () => { if (window.KodroAgents) window.KodroAgents.stop(); };
      // Deliberately keyed on terrainId ALONE. Adding currentLessonId here made
      // the effect tear down and rebuild the agent sim on lesson entry and
      // exit, which changed traffic state mid-flow and made two replays of the
      // same recorded run disagree. Lesson entry and exit call
      // setAgentsForLesson() directly instead, so free play keeps the exact
      // rebuild cadence it always had.
    }, [terrainId]);
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
    // OPP-6: the custom world regenerates in place when its seed/density/
    // traction controls change (KodroCustomWorld.set fires kodro-customworld),
    // so the tick joins the memo deps below.
    const [customTick, setCustomTick] = useState(0);
    useEffect(() => {
      const on = () => setCustomTick(t => t + 1);
      window.addEventListener('kodro-customworld', on);
      return () => window.removeEventListener('kodro-customworld', on);
    }, []);
    const terrain = useMemo(() => {
      const baseTerrain = window.resolveSite ? window.resolveSite(terrainId) : TERRAINS[terrainId];
      return (window.KodroWorldFX && window.KodroWorldFX.applyTod)
        ? window.KodroWorldFX.applyTod(baseTerrain, tod, weather) : baseTerrain;
    }, [terrainId, tod, weather, customTick]);

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

    // Kodro bridge: lessons (from Python), currently-loaded lesson id,
    // pupil + verdict + hint after a graded Run. The React app stays
    // unchanged when there's no bridge (browser preview).
    // World props placed by pupil code via place(): flags, beacons, people...
    const [props, setProps] = useState([]);
    // A pupil-chosen local image, shown in the world by place("photo").
    const [photoUrl, setPhotoUrl] = useState(null);
    async function pickPhotoClick() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
        // Desktop-only capture. Give an immediate, visible, honest response (a
        // toast) rather than only a console line that scrolls away, matching the
        // Swarm/Teacher desktop-only pattern. We invent no photo.
        const msg = 'Photo props need the desktop app. In the browser you can still design, program, and run your robot.';
        showToast(msg, 'info');
        addConsole(msg, 'info');
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
    // The loaded lesson's own arena, in the lesson's metre space: what the
    // grader marks against. Held in a ref because the sim engine reads it
    // mid-run without wanting a re-render. Null in free play.
    const lessonWorldRef = useRef(null);
    // Rebuild the lesson arena from the shipped lesson data and show it. The
    // grader's world lives in KodroLessonGrader.LESSON_DATA, which is the same
    // table generated from the lesson YAMLs, so seeding from it guarantees the
    // pupil sees exactly the arena they are marked in.
    function seedLessonWorld(lessonId) {
      const G = window.KodroLessonGrader;
      const entry = G && G.LESSON_DATA ? G.LESSON_DATA[lessonId] : null;
      if (!entry || !entry.world) { lessonWorldRef.current = null; setProps([]); return; }
      const w = entry.world;
      lessonWorldRef.current = {
        base: w.base || [0, 0],
        samples: (w.samples || []).map((p, i) => ({ id: 'ls' + i, x: p[0], y: p[1], collected: false })),
        obstacles: (w.obstacles || []).map((o) => ({ x: o.x, y: o.y, r: o.r })),
        width: w.width, height: w.height,
      };
      // Draw it. The props layer already billboards these kinds in both the
      // 2.5D and 3D viewports, so the sample patches and the lesson's rocks
      // become things the pupil can actually see and drive to. Sim space is
      // centimetres with y inverted relative to the lesson's metre space.
      setProps(lessonMarks(lessonWorldRef.current));
    }
    // A lesson is graded in its own arena: only its samples and obstacles.
    // Roaming traffic and pedestrians exist in NO lesson world, so a pupil
    // could be stopped by "another robot" the grader had never heard of, which
    // is how lesson 1 showed a visible crash and still ticked "Do not hit
    // anything" for 100/100. Swapping the agent world keeps both viewports and
    // the collision test reading the same layout the grader marks.
    function setAgentsForLesson(inLesson) {
      try {
        if (window.KodroAgents) window.KodroAgents.build(inLesson ? 'none' : terrainId);
      } catch (e) { void e; }
    }
    // Lesson metres -> live sim centimetres. The exact inverse of the mapping
    // lessonApi uses in hooks.jsx: the live origin is the lesson base, and the
    // two engines' axes differ (live heading 0 travels -y, the grader's +x), so
    //   x_sim = -(y_lesson - base_y) * 100
    //   y_sim = -(x_lesson - base_x) * 100
    // Keeping both directions in one derivation is why this lives in a single
    // function that the seed path and the per-run reset both call.
    function lessonMarks(lw) {
      if (!lw) return [];
      const toSim = (lx, ly) => ({ x: -(ly - lw.base[1]) * 100, y: -(lx - lw.base[0]) * 100 });
      const marks = [];
      lw.samples.filter((s) => !s.collected).forEach((s) => {
        marks.push({ kind: 'flag', ...toSim(s.x, s.y), lessonSampleId: s.id });
      });
      lw.obstacles.forEach((o, i) => {
        marks.push({ kind: 'rock', ...toSim(o.x, o.y), lessonObstacleId: 'lo' + i });
      });
      return marks;
    }
    // Leaving a lesson drops its arena, so free play does not inherit the
    // lesson's flags and rocks.
    function clearLessonWorld() {
      lessonWorldRef.current = null;
      setProps([]);
      setAgentsForLesson(false);
    }
    // Lessons keep their OWN editable buffer so loading one never clobbers the
    // example tabs (autopilot.py etc.); the editor shows it while a lesson is
    // active (QA re-score rank 11).
    const [lessonBuffers, setLessonBuffers] = useState(() => {
      // Hydrate from storage so in-progress lesson edits survive a refresh,
      // navigation or quit (only example-tab code was persisted before).
      try { return JSON.parse(lsGet('or_lesson_buffers')) || {}; } catch (e) { return {}; }
    });  // per-lesson editable code
    // A compact local index of the latest result for each lesson. The grader
    // remains authoritative; this is only the learner-facing resume/progress
    // view used by the lesson library. It is stored on this device alongside
    // the editable lesson buffers and never leaves the machine. On desktop,
    // where several pupils can share one machine, the index is stored PER
    // PUPIL: the library must never show one learner another learner's
    // completions as their own. The browser edition keeps one device-wide
    // record and says so ("Learning as: this device").
    const [lessonResults, setLessonResults] = useState(() => {
      try { return JSON.parse(lsGet('or_lesson_results')) || {}; } catch (e) { return {}; }
    });
    const lessonResultsPupilRef = useRef(null);
    useEffect(() => {
      if (!activePupilId) return;
      lessonResultsPupilRef.current = activePupilId;
      let stored = null;
      try { stored = JSON.parse(lsGet('or_lesson_results__' + activePupilId)); } catch (e) { stored = null; }
      setLessonResults(stored || {});
    }, [activePupilId]);
    // Upgrade path, run ONCE per device and only from a fresh pupil LIST (not
    // the activePupilId render, whose closure can hold a stale one-element
    // list while a second pupil is being created): results recorded before
    // per-pupil scoping live under the device-wide key, and with exactly ONE
    // known pupil the ownership is unambiguous, so seed that pupil's record
    // from it. An empty stamped record ("{}") counts as absent, because every
    // pre-migration session wrote one. With several pupils the combined
    // record cannot be attributed to any one learner and stays untouched.
    useEffect(() => {
      if (pupils.length !== 1) return;
      try {
        if (localStorage.getItem('or_lesson_results_migrated')) return;
        const pupilId = pupils[0].id;
        const key = 'or_lesson_results__' + pupilId;
        let existing = null;
        try { existing = JSON.parse(lsGet(key)); } catch (e) { existing = null; }
        if (existing && Object.keys(existing).length) { localStorage.setItem('or_lesson_results_migrated', '1'); return; }
        let legacy = null;
        try { legacy = JSON.parse(lsGet('or_lesson_results')); } catch (e) { legacy = null; }
        if (!legacy || !Object.keys(legacy).length) { localStorage.setItem('or_lesson_results_migrated', '1'); return; }
        localStorage.setItem(key, JSON.stringify(legacy));
        localStorage.setItem('or_lesson_results_migrated', '1');
        if (lessonResultsPupilRef.current === pupilId) setLessonResults(legacy);
      } catch (e) { void e; }
    }, [pupils]);
    const [lessonVerdict, setLessonVerdict] = useState(null);  // {passed,score,reasons,hint}
    // Learner scaffolding: how many consecutive fails on this lesson (drives
    // the "the app noticed you are stuck" nudge) and how many extra hints the
    // pupil has revealed from the lesson's hint bank (progressive help).
    const [lessonAttempts, setLessonAttempts] = useState(0);
    const [extraHints, setExtraHints] = useState(0);
    // The editor's current source: a lesson's own buffer when one is loaded,
    // otherwise the active example tab. (Declared AFTER the state above to
    // avoid a temporal-dead-zone ReferenceError.)
    const code = currentLessonId
      ? (lessonBuffers[currentLessonId] !== undefined ? lessonBuffers[currentLessonId] : '')
      // Never hand the editor undefined (it would .split(undefined) and crash):
      // if activeTab is somehow not a known example key, fall back to basecamp.
      : (programs[activeTab] !== undefined ? programs[activeTab] : (programs.drive || ''));
    // Dyslexia-friendly / larger reading text toggle (QA re-score rank 4).
    const [readable, setReadable] = useState(() => lsGet('or_readable') === '1');
    // Sound is OFF by default (the synthesised ambience/sfx were intrusive); a
    // user opts in via Settings > Sound, which persists or_muted="0".
    const [muted, setMuted] = useState(() => lsGet('or_muted') !== '0');
    // Visual theme. 'dark' is the default mission-control look; the rest are
    // full repaints driven by [data-theme] CSS variable swaps in styles.css.
    const [theme, setTheme] = useState(() => lsGet('or_theme') || 'dark');
    // P7/A1 mode split: 'studio' is the professional validation tool; the
    // Classroom toggle brings back pupils, lessons, the teacher dashboard,
    // achievements/confetti and the novelty themes. One product, two registers,
    // with the maker profile as the default identity.
    const [mode, setMode] = useState(() => { try { return localStorage.getItem('kodro_mode') || 'studio'; } catch (e) { return 'studio'; } });
    const classroom = mode === 'classroom';
    // Progressive disclosure is the default. "Simple" keeps the complete
    // product reachable while presenting one primary decision at a time;
    // "Expert" restores the permanently visible instruments and shortcuts.
    const [experience, setExperience] = useState(() => {
      try { return localStorage.getItem('kodro_experience') === 'expert' ? 'expert' : 'simple'; } catch (e) { return 'simple'; }
    });
    const simpleExperience = experience !== 'expert';
    const [lessonHubOpen, setLessonHubOpen] = useState(false);
    const [lessonBrowseAll, setLessonBrowseAll] = useState(false);
    function openLessonLibrary() {
      if (!classroom) setMode('classroom');
      setActiveStage('prove');
      setLessonBrowseAll(false);
      setLessonHubOpen(true);
      setSettingsOpen(false);
      setMoreToolsOpen(false);
    }
    // On a phone the lesson picker sits below the world panel, so tapping the
    // Lessons button produced no visible change (judge round 9): bring the
    // picker on screen when classroom mode opens. block:'nearest' is a no-op
    // when it is already visible, so desktop is unaffected.
    useEffect(() => {
      if (!classroom) return;
      const t = setTimeout(() => {
        const el = document.querySelector('.lesson-picker');
        if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { void e; } }
      }, 80);
      return () => clearTimeout(t);
    }, [classroom]);
    useEffect(() => {
      try { localStorage.setItem('kodro_mode', mode); } catch (e) { void e; }
      if (mode !== 'classroom') {
        // Leaving Classroom: the novelty themes and any loaded lesson are
        // classroom furniture, so the studio returns to the core theme set
        // and the plain example tabs (A5).
        setTheme(t => (t === 'dark' || t === 'light' || t === 'contrast') ? t : 'dark');
        setCurrentLessonId(null); clearLessonWorld();
      }
    }, [mode]);
    useEffect(() => {
      try { localStorage.setItem('kodro_experience', experience); } catch (e) { void e; }
    }, [experience]);
    const [showHelp, setShowHelp] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [moreToolsOpen, setMoreToolsOpen] = useState(false);
    // (Toast state + showToast now live in useConsoleToast, destructured above.)
    // Brief "Loading {world}..." overlay shown while the 3D scene rebuilds on a
    // world switch, so the viewport does not flash empty for a frame.
    const [worldLoading, setWorldLoading] = useState(null);
    // Mobile telemetry: collapsed by default under 768px; toggle expands it.
    const [teleCollapsed, setTeleCollapsed] = useState(() => { try { return window.innerWidth <= 768; } catch (e) { return false; } });
    const [evidenceOpen, setEvidenceOpen] = useState(() => {
      try { return localStorage.getItem('kodro_experience') === 'expert'; } catch (e) { return false; }
    });
    const [runToolsOpen, setRunToolsOpen] = useState(false);
    useEffect(() => {
      if (experience === 'expert') {
        setEvidenceOpen(true);
        setRunToolsOpen(false);
      }
    }, [experience]);
    // First-run onboarding / landing flow (shown once, remembered, skippable).
    const [onboarded, setOnboarded] = useState(() => lsGet('or_onboarded') === '1');
    // Home is the front door (see home.jsx). It opens itself on a first visit
    // and is reopenable from the top bar afterwards.
    const [homeOpen, setHomeOpen] = useState(false);
    function closeHome() {
      setHomeOpen(false);
      if (!onboarded) {
        setOnboarded(true);
        try { localStorage.setItem('or_onboarded', '1'); } catch (err) { void err; }
      }
    }
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
    // A write that could not land must SAY so. The stores used to swallow a
    // full or blocked localStorage, so a pupil saw a pass verdict and a run
    // report while nothing was actually recorded.
    useEffect(() => {
      const onFail = (e) => {
        const what = (e && e.detail && e.detail.what) || 'your work';
        showToast('Could not save ' + what + ': storage is full or blocked. Free up space, or export the project to keep it.', 'err');
      };
      window.addEventListener('kodro-storage-failed', onFail);
      return () => window.removeEventListener('kodro-storage-failed', onFail);
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
        robotKey: runRobotKey(robotSpec),
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
        // OPP-2: the exact program and the seed that drove this run's PRNG,
        // so the report's Replay button can re-drive it deterministically.
        // Both come from stamps the sim writes at compile time (hooks.jsx
        // compileFresh); reading the `code` closure here would record a stale
        // buffer when the report fires through a long-lived pump-loop closure.
        seed: window.KODRO_RUN_SEED != null ? window.KODRO_RUN_SEED : null,
        source: window.KODRO_RUN_SOURCE != null ? window.KODRO_RUN_SOURCE : code,
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

    // Secondary capabilities stay reachable without competing with the three
    // project decisions. The global More Tools popover uses the same keyboard,
    // click-away and focus-restoration behaviour as Settings.
    const moreToolsBtnRef = useRef(null);
    useEffect(() => {
      if (!moreToolsOpen) return undefined;
      const pop = document.querySelector('.more-tools-pop');
      const first = pop && pop.querySelector('button, [tabindex]');
      if (first) first.focus();
      const close = (e) => { if (!e.target.closest || !e.target.closest('.more-tools-wrap')) setMoreToolsOpen(false); };
      const key = (e) => {
        if (e.key === 'Escape') { setMoreToolsOpen(false); return; }
        // role=menu carries the ARIA menu keyboard contract: Arrow keys move
        // between items, Home/End jump to the ends (WAI-ARIA APG menu pattern).
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
        const menu = document.querySelector('.more-tools-pop');
        if (!menu || !menu.contains(document.activeElement)) return;
        const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
        if (!items.length) return;
        e.preventDefault();
        const at = items.indexOf(document.activeElement);
        const next = e.key === 'Home' ? 0
          : e.key === 'End' ? items.length - 1
          : e.key === 'ArrowDown' ? (at + 1) % items.length
          : (at - 1 + items.length) % items.length;
        items[next].focus();
      };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', key);
      return () => {
        document.removeEventListener('pointerdown', close);
        document.removeEventListener('keydown', key);
        if (moreToolsBtnRef.current) moreToolsBtnRef.current.focus();
      };
    }, [moreToolsOpen]);

    // The Simple-mode run tools (Step/Reset/Validate behind "More") are a
    // popover like Settings and More Tools, so they close the same way:
    // click-away, Escape (via the global overlay-first Escape rule), focus
    // moved in on open and restored to the toggle on close (WCAG 2.4.3).
    const runMoreBtnRef = useRef(null);
    useEffect(() => {
      if (!runToolsOpen) return undefined;
      const pop = document.querySelector('.run-secondary');
      const first = pop && pop.querySelector('button:not([disabled])');
      if (first) first.focus();
      const close = (e) => { if (!e.target.closest || !e.target.closest('.run-controls')) setRunToolsOpen(false); };
      document.addEventListener('pointerdown', close);
      return () => {
        document.removeEventListener('pointerdown', close);
        if (runMoreBtnRef.current) runMoreBtnRef.current.focus();
      };
    }, [runToolsOpen]);

    // currentLessonId ref: the vibe streamed job is scoped to the lesson open
    // when it started, so useVibeChat (below) reads this ref. Created here
    // (ahead of useVibeChat) and kept in lockstep with the currentLessonId
    // state; usage sites further down are unchanged.
    const currentLessonIdRef = useRef(null);
    useEffect(() => { currentLessonIdRef.current = currentLessonId; }, [currentLessonId]);
    // Programmatic editor writes + one-click Revert (typewriteCode /
    // applyProgramText / revert snapshot) extracted VERBATIM to
    // window.KodroHooks.useEditorApply (hooks.jsx). Called here (ahead of
    // useReview/useBlocks, which take typewriteCode) with the live buffers,
    // programs, current-lesson ref, active tab, showToast/addConsole and the
    // reduced-motion probe threaded in. typewriteCode/applyProgramText come back
    // for the consumers below and the Memory panel's applyCode.
    const { typewriteCode, applyProgramText } = (window.KodroHooks && window.KodroHooks.useEditorApply)
      ? window.KodroHooks.useEditorApply({
          lessonBuffers, programs, setLessonBuffers, setPrograms,
          currentLessonIdRef, activeTab, showToast, addConsole,
          prefersReducedMotion: PREFERS_REDUCED_MOTION,
        })
      : { typewriteCode: function () {}, applyProgramText: function () {} };
    // --- AI vibe coding chat (prompt + thread + streamed poll loop) ----------
    // Extracted VERBATIM to window.KodroHooks.useVibeChat (hooks.jsx): owns
    // vibeOpen + the vibe-chat state/refs and the streamed vibeSend poll loop.
    // Its only external inputs are the live world (terrain) and the current
    // lesson ref. vibeApply stays in App (it bridges to the editor, like the
    // other apply paths). vibeOpen is fed to useAiStatus and the modal wiring.
    const {
      vibeOpen, setVibeOpen, vibePrompt, setVibePrompt, vibeBusy, setVibeBusy,
      vibeError, setVibeError, vibeMsgs, setVibeMsgs, vibeEndRef, vibeLive,
      setVibeLive, vibeCancelRef, vibeSend, vibeClear,
    } = (window.KodroHooks && window.KodroHooks.useVibeChat)
      // onTerrain is destructured from useSimEngine further down, so defer the
      // reference to call time (an eager shorthand here would hit the TDZ).
      ? window.KodroHooks.useVibeChat({ terrain, currentLessonIdRef, dispatchWorldAction, onTerrain: (id) => onTerrain(id) })
      : {
        vibeOpen: false, setVibeOpen: function () {}, vibePrompt: '', setVibePrompt: function () {},
        vibeBusy: false, setVibeBusy: function () {}, vibeError: null, setVibeError: function () {},
        vibeMsgs: [], setVibeMsgs: function () {}, vibeEndRef: { current: null }, vibeLive: '',
        setVibeLive: function () {}, vibeCancelRef: { current: false }, vibeSend: function () {},
        vibeClear: function () {},
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
    const [quality, setQuality] = useState(() => {
      try {
        const saved = localStorage.getItem('kodro_quality');
        if (saved) return saved;
        // First run: pick a tier the device can actually hold. Starting every
        // machine at 'high' (shadows + 1.5x pixel ratio) is why first
        // impressions felt slow on mid laptops; deviceMemory/cores are coarse
        // hints but catch exactly those machines. The runtime frame monitor
        // can still step down further, and the user can pick any tier.
        const mem = (navigator && navigator.deviceMemory) || 8;
        const cores = (navigator && navigator.hardwareConcurrency) || 8;
        const cpuTier = (mem <= 2 || cores <= 2) ? 'low' : ((mem <= 4 || cores <= 4) ? 'med' : 'high');
        // deviceMemory and hardwareConcurrency describe the CPU and RAM, never
        // the GPU, so a box with plenty of both but only software GL (a VM, a
        // remote session, a missing driver) still landed on 'high' and crawled
        // until the frame monitor reacted seconds later. Ask what actually
        // rasterises the pixels. recommendedTier only ever lowers cpuTier.
        if (window.KodroGpuCaps && window.KodroGpuCaps.detect) {
          const caps = window.KodroGpuCaps.detect();
          try { window.KODRO_GPU_CAPS = caps; } catch (err) { void err; }
          return window.KodroGpuCaps.recommendedTier(cpuTier, caps);
        }
        return cpuTier;
      } catch (e) { return 'high'; }
    });
    // Lessons carry UK Key Stage codes; parents and pupils outside that system
    // read ages, so the UI shows ages and keeps the code as the tooltip.
    const AGE_FOR = { KS1: 'Ages 5-7', KS2: 'Ages 7-11', KS3: 'Ages 11-14', KS4: 'Ages 14-16' };
    if (typeof window !== 'undefined') window.KODRO_QUALITY = quality;
    // Bumped each time the user explicitly opens the 3D view, so the canvas can
    // take focus (keyboard orbit) without stealing focus on the initial load.
    const [focus3dKey, setFocus3dKey] = useState(0);
    // Bumped when the GPU hands the context back after a reset (lid close,
    // sleep, driver recovery). The scene graph cannot be rebuilt safely from
    // inside the lost context, so the viewport is remounted against a fresh
    // one instead of leaving the learner staring at a dead panel.
    const [glEpoch, setGlEpoch] = useState(0);
    useEffect(() => {
      const onRestored = () => setGlEpoch((n) => n + 1);
      window.addEventListener('kodro-webgl-restored', onRestored);
      return () => window.removeEventListener('kodro-webgl-restored', onRestored);
    }, []);
    // Robot Lab: design a custom robot whose spec drives the simulation.
    const [robotLabOpen, setRobotLabOpen] = useState(false);
    // One product, three decisions. This first redesign layer keeps the proven
    // handlers intact while giving every capability a stable place in the
    // journey: design the robot, prove it in scenarios, then prepare a build.
    const [activeStage, setActiveStage] = useState('prove');
    // A compile error from the last 5-seed attempt, shown inline in the
    // cockpit where the console does not exist.
    const [proveError, setProveError] = useState(null);
    const [proveReport, setProveReport] = useState(() => {
      try {
        const reports = window.KodroMemory && window.KodroMemory.scenarioReports ? window.KodroMemory.scenarioReports() : [];
        return reports[0] || null;
      } catch (e) { return null; }
    });
    // Simple mode opens on a test plan, not a wall of source code. The editor
    // is still one deliberate action away and Expert mode remains unchanged.
    // Keep this session-local: returning to the product should begin with the
    // purpose and evidence of the test, not whichever advanced surface happened
    // to be open last time.
    const [simpleCodeOpen, setSimpleCodeOpen] = useState(false);
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
        // Keep the active tab runnable for the freshly chosen build. A build
        // with NO drive actuator (a fixed-base arm) cannot run ANY drive
        // starter, so move it to the systems-check tab -- the fix for the arm's
        // guaranteed first-Run error. A wheeled build that is sitting on that
        // rescue tab is returned to the drive patrol; and if it merely cannot
        // range (no ultrasonic), a distance-based starter (autopilot/avoid) is
        // swapped for the plain drive patrol so the first Run still works.
        try {
          if (!canDrive(full)) {
            setActiveTab('systems');
          } else {
            const canRange = !window.KodroCommands || window.KodroCommands.check(full, 'distance').ok;
            setActiveTab((t) => {
              if (t === 'systems') return 'drive';
              if (!canRange && (t === 'autopilot' || t === 'avoid')) return 'drive';
              return t;
            });
          }
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
      addConsole('Validating across 5 randomised seeds in "' + scn.name + '" on ' + (terrain.name || terrain.id) + ' (friction, mass, sensor noise, obstacle placement, start delay and starting battery vary)...', 'sys');
      const rep = window.KodroScenario.run(code, scn, 5, {
        robotKey: runRobotKey(robotSpec),
        robotName: (robotSpec && robotSpec.name) || '',
      });
      const a = rep.aggregate;
      // A compile error in the program is a code mistake, not a 0% behaviour
      // result: surface it as an error and do not show a misleading pass rate
      // (scenario.run also skips persisting the junk all-zero report).
      // The report is NOT adopted in this case: an all-compile-fail run still
      // carries a full aggregate (passed:false, 0/5, 0 collisions, 0% battery)
      // and a manifest with verdict 'fail', all of which satisfy the cockpit's
      // evidence gate. Adopting it painted a red FAIL with fabricated
      // 0-metrics for a program that never executed a single step. Clear any
      // previous verdict instead, so the panel honestly reads NOT RUN.
      if (a.compileError) {
        setProveReport(null);
        addConsole('Validation could not run: ' + a.compileError + ' Fix the code and try again.', 'err');
        // The console is not mounted in the simple cockpit, so a console-only
        // error is invisible exactly where novices hit it. Toast + inline
        // state carry it to every experience.
        // Stamped with the program it describes, so it self-invalidates the
        // moment the program changes (edit, or a different test's starter).
        // A stale "fix your syntax error" on a program the user already fixed
        // is exactly the loop this message exists to end.
        setProveError({
          message: a.compileError,
          hash: (window.KodroScenario.codeHash ? window.KodroScenario.codeHash(code) : null),
        });
        showToast('Could not run the proof: ' + a.compileError, 'err');
        return;
      }
      setProveError(null);
      setProveReport(rep);
      addConsole('Validation: success ' + Math.round((a.successRate || 0) * 100) + '% (' + a.successCount + '/' + a.seeds + '), mean collisions ' + a.meanCollisions + ', mean time ' + (a.meanTimeToGoal != null ? a.meanTimeToGoal + ' steps' : 'n/a') + ', mean battery ' + a.meanBattery + '%, mean score ' + a.meanScore + '. Saved.', (a.passed ? 'ok' : 'warn'));
      // "0%" without context reads as a broken product when the program simply
      // never drove to the goal. Say exactly what 0% measures, and point at
      // the marker the viewport now draws (product-coherence D1).
      if ((a.successRate || 0) === 0) {
        addConsole('0% success means the program never reached the goal marker (the cyan beacon ring drawn in the viewport). It is a mission result, not a crash count.', 'sys');
      }
      setRealismOpen(true);
    }

    function downloadProveManifest() {
      if (!proveReport || !proveReport.manifest) return;
      const payload = JSON.stringify(proveReport.manifest, null, 2) + '\n';
      const blob = new Blob([payload], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (proveReport.manifest.contractId || 'kodro-proof') + '-manifest.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      showToast('Evidence manifest downloaded', 'ok');
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

    // Short human description of a freshly built robot for the chat's action line.
    function describeSpec(spec) {
      if (!spec) return 'a robot';
      const n = (spec.sensors || []).length;
      let s = 'a ' + (spec.type || 'robot');
      if (n) s += ' with ' + n + ' sensor' + (n === 1 ? '' : 's');
      return s;
    }

    // Chat that acts on the world: when a Vibe message is a clear command to
    // BUILD a robot or MOVE to a place (decided by the conservative
    // KodroChatIntent parser -- questions and "make THE rover faster" never
    // fire), actually do it and return a one-line summary for the thread. Runs
    // even with no AI model available, so the build/move works offline; the
    // model still gets called afterwards to write code for the new robot.
    function dispatchWorldAction(text) {
      if (!window.KodroChatIntent) return null;
      const intent = window.KodroChatIntent.parse(text);
      if (!intent || !intent.isCommand) return null;
      const parts = [];
      if (intent.build && window.RobotLab && window.RobotLab.buildFromText) {
        const r = window.RobotLab.buildFromText(text); // builds + commits (fires kodro-robot)
        if (r && r.understood) parts.push('Built ' + describeSpec(r.spec) + '.');
        else parts.push('Built a general rover — I could not tell a specific robot from that, so say "rover", "car" or "arm" to be exact.');
      }
      if (intent.world && typeof onTerrain === 'function') {
        onTerrain(intent.world.id); // explicit world wins over buildFromText's type-coarse auto-switch
        parts.push('Moved to ' + intent.world.label + '.');
      }
      if (!parts.length) return null;
      return { message: parts.join(' ') };
    }

    // runReview / applyReview moved to window.KodroHooks.useReview (hooks.jsx).

    // Agent swarm: run the program on a fleet of rovers, draw their trails.
    // Extracted VERBATIM to window.KodroHooks.useSwarm (hooks.jsx); its external
    // inputs are the live editor code, the current lesson id and addConsole.
    const { swarmOpen, setSwarmOpen, swarmBusy, swarmData, runSwarm } = (window.KodroHooks && window.KodroHooks.useSwarm)
      ? window.KodroHooks.useSwarm({ code, currentLessonId, addConsole })
      : { swarmOpen: false, setSwarmOpen: function () {}, swarmBusy: false, swarmData: null, runSwarm: function () {} };

    // (Typewriter / snapshot-Revert / applyProgramText now live in
    // useEditorApply, destructured above; its own unmount effect clears the
    // typewriter interval, so only the say-bubble timer cleanup stays here.)

    // If the app ever unmounts, clear the say-bubble timer so no stray timer
    // fires against a torn-down tree. (sayTimer is declared below; this cleanup
    // closure only runs at unmount, after init.)
    useEffect(() => () => {
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
      moveBlock, canMoveBlock, insertBlocksCode,
    } = (window.KodroHooks && window.KodroHooks.useBlocks)
      ? window.KodroHooks.useBlocks({ sfx, addConsole, typewriteCode })
      : {
        BLOCK_DEFS: window.KodroBlockDefs || [],
        blocksOpen: false, setBlocksOpen: () => {}, blocks: [], setBlocks: () => {},
        blockIndent: 0, setBlockIndent: () => {}, addBlock: () => {}, endBlock: () => {},
        removeBlock: () => {}, moveBlock: () => {}, canMoveBlock: () => false, insertBlocksCode: () => {},
      };
    function toggleSound() {
      setMuted(m => { const next = !m; if (window.RLSound) window.RLSound.setMuted(next); return next; });
    }
    useEffect(() => {
      document.body.classList.toggle('a11y-readable', readable);
      try { localStorage.setItem('or_readable', readable ? '1' : '0'); } catch (e) { void e; }
    }, [readable]);
    useEffect(() => {
      // Load lessons in BOTH desktop (pywebview) and browser (static) mode:
      // listLessons() now fetches the shipped lessons.json when the Python
      // bridge is absent and degrades to [] on failure, so this is safe without
      // the isAvailable() gate. (Submit also works in both modes now: the
      // bridge routes it to the JS lesson grader when pywebview is absent.)
      if (!window.RoboLearn) return;
      window.RoboLearn.listLessons().then(ls => { if (Array.isArray(ls)) setLessons(ls); });
    }, []);
    function loadLesson(lesson) {
      if (!lesson) return;
      setActiveStage('prove');
      setLessonHubOpen(false);
      setCurrentLessonId(lesson.id);
      setLessonVerdict(null);
      setLessonAttempts(0);
      setExtraHints(0);
      // Render the rover on the SAME world it is graded against. Without this
      // the viewport could show a persisted Mars while the grader ran the
      // lesson's real terrain, so a pass looked like it happened elsewhere.
      if (lesson.terrain && TERRAINS[lesson.terrain]) setTerrainId(lesson.terrain);
      // ...and show the lesson's actual arena inside it. The terrain sets the
      // scenery; this puts the flag, the sample patches and the lesson's rocks
      // on screen, and arms the live sensors to read them (see lessonApi in
      // hooks.jsx). Previously these existed only inside the grader, so a pupil
      // drove around an empty world and was marked on things they never saw.
      seedLessonWorld(lesson.id);
      setAgentsForLesson(true);
      // The terrain swap is deliberate but it used to be silent, which is what
      // made switching lessons feel like the app changing under you. Say it.
      const worldName = (TERRAINS[lesson.terrain] && TERRAINS[lesson.terrain].name) || lesson.terrain;
      if (worldName) showToast('Lesson opened. This one runs in ' + worldName + '.', 'sys');
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
      // Submit works in BOTH modes: the bridge routes to the Python engine
      // under pywebview and to the JS lesson grader (lesson-grader.jsx) in
      // the static browser build, so the classroom register is live on the
      // hosted site too. Both paths return the same response shape, so the
      // verdict panel below renders identically.
      if (!window.RoboLearn) return;
      const lessonId = currentLessonIdRef.current;
      if (!lessonId) return;
      // Identity captured BEFORE the async grade: if the teacher switches
      // pupil while the grade is in flight, the resolved result must not be
      // filed under (or displayed as) the new pupil's record.
      const pupilAtSubmit = lessonResultsPupilRef.current;
      try {
        const r = await window.RoboLearn.submitAttempt(lessonId, source, null);
        if (!r) return;
        if (lessonResultsPupilRef.current !== pupilAtSubmit) {
          // File the late result under the pupil who EARNED it (matching the
          // backend, which graded while they were still active), never under
          // the pupil the teacher has since switched to. The console line
          // states what ACTUALLY happened: a grader error still surfaces its
          // reason, and a skipped or failed write is never reported as filed.
          if (r.ok === false) {
            setConsoleLines(l => [...l, { type: 'err', text: 'Grader: ' + (r.reason || 'unknown error') + ' (the pupil changed while this attempt was being graded; nothing was recorded).' }]);
            return;
          }
          let lateFiled = false;
          if (pupilAtSubmit) {
            try {
              const lateKey = 'or_lesson_results__' + pupilAtSubmit;
              let lateIndex = null;
              try { lateIndex = JSON.parse(lsGet(lateKey)); } catch (err) { lateIndex = null; }
              lateIndex = lateIndex || {};
              lateIndex[lessonId] = {
                passed: !!r.passed,
                score: Number.isFinite(Number(r.score)) ? Number(r.score) : 0,
                attempts: ((lateIndex[lessonId] && lateIndex[lessonId].attempts) || 0) + 1,
                updatedAt: Date.now(),
              };
              localStorage.setItem(lateKey, JSON.stringify(lateIndex));
              lateFiled = true;
            } catch (err) { void err; }
          }
          setConsoleLines(l => [...l, { type: 'sys', text: lateFiled
            ? 'A graded attempt finished after the pupil changed; it was recorded under the previous pupil.'
            : 'A graded attempt finished after the pupil changed; it was not recorded under the new pupil.' }]);
          return;
        }
        if (r.ok === false) { setConsoleLines(l => [...l, { type: 'err', text: 'Grader: ' + (r.reason || 'unknown error') }]); return; }
        // Persist the verdict in a panel that survives Reset (QA #3).
        setLessonVerdict({ passed: !!r.passed, score: r.score, reasons: r.reasons || [], hint: r.hint || null });
        setLessonResults(prev => ({
          ...prev,
          [lessonId]: {
            passed: !!r.passed,
            score: Number.isFinite(Number(r.score)) ? Number(r.score) : 0,
            attempts: ((prev[lessonId] && prev[lessonId].attempts) || 0) + 1,
            updatedAt: Date.now(),
          },
        }));
        // Browser mode has no Python store, so keep an on-device class register
        // (pupil-store.js) with the same EMA rule. Desktop persists via Python,
        // so only record here in the browser. A graded attempt (r.ok !== false
        // already returned above) moves the concept EMA on both pass and fail,
        // mirroring the desktop update_on_submission path.
        if (window.RoboLearn.isAvailable && !window.RoboLearn.isAvailable() && window.KodroPupilStore) {
          const gradedLesson = lessons.find(l => l && l.id === lessonId);
          const concepts = gradedLesson && Array.isArray(gradedLesson.concepts) ? gradedLesson.concepts : [];
          if (concepts.length) window.KodroPupilStore.record(concepts, !!r.passed);
        }
        // Confetti is a classroom register; the studio celebrates with the
        // verdict chip and the pass tone only (A1).
        if (r.passed) { sfx('pass'); if (classroom) celebrate(); } else { sfx('fail'); }
        // Stuck detection: on the second consecutive fail, reveal the lesson's
        // second hint automatically and say so, instead of repeating hint one
        // forever. Attempts reset on pass and on switching lesson.
        if (r.passed) {
          setLessonAttempts(0);
        } else {
          setLessonAttempts(a => {
            const n = a + 1;
            if (n === 2) {
              setExtraHints(x => Math.max(x, 1));
              setConsoleLines(l => [...l, { type: 'sys', text: 'Still stuck? I have opened another hint in the lesson card. The Ask button can also explain this error.' }]);
            }
            return n;
          });
        }
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

    // (consoleEndRef + its auto-scroll effect now live in useConsoleToast.)

    // persist
    useEffect(() => { try { localStorage.setItem('or_terrain', terrainId); } catch (e) { void e; } }, [terrainId]);
    useEffect(() => {
      try { localStorage.setItem('or_theme', theme); } catch (e) { void e; }
      const root = document.documentElement;
      if (theme && theme !== 'dark') root.setAttribute('data-theme', theme);
      else root.removeAttribute('data-theme');
    }, [theme]);
    useEffect(() => { try { localStorage.setItem('or_tab', activeTab); } catch (e) { void e; } }, [activeTab]);
    useEffect(() => { persistWork('or_programs', JSON.stringify(programs), 'your programs'); }, [programs]);
    useEffect(() => { persistWork('or_lesson_buffers', JSON.stringify(lessonBuffers), 'your lesson code'); }, [lessonBuffers]);
    // Mirror the live editor buffer so surfaces rendered outside App (the
    // Robot Lab's exported verification report) can apply the SAME
    // "this program produced it" rule the cockpit and realism panel use.
    useEffect(() => { try { window.KODRO_LIVE_CODE = code; } catch (e) { void e; } }, [code]);
    useEffect(() => {
      // Persist under the identity whose data this is (stamped at reload time),
      // so a pupil switch can never file one learner's results under another.
      const key = lessonResultsPupilRef.current ? 'or_lesson_results__' + lessonResultsPupilRef.current : 'or_lesson_results';
      persistWork(key, JSON.stringify(lessonResults), 'your lesson results');
    }, [lessonResults]);


    // (addConsole now lives in useConsoleToast, destructured near the top.)

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
    const { onRun, onStep, onReset, onTerrain, runReplLine, onCodeChange, exportReportClick, queueReplaySeed } =
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
            lessonWorldRef, lessonMarks,
          })
        : { onRun: function () {}, onStep: function () {}, onReset: function () {}, onTerrain: function () {}, runReplLine: function () {}, onCodeChange: function () {}, exportReportClick: function () {}, queueReplaySeed: function () {} };

    // OPP-2 Replay: re-drive a recorded run exactly. Restores the report's
    // world and program, arms the sim with the recorded seed, then runs. The
    // short defer lets the world switch and editor write settle first. Reports
    // saved before replay support (no seed/source) cannot be replayed.
    function replayRun(r) {
      if (!r || r.seed == null || !r.source) return;
      const here = terrain.siteId || terrain.id;
      if (r.world && r.world !== here) onTerrain(r.world);
      applyProgramText(r.source);
      queueReplaySeed(r.seed);
      // The robot is the FOURTH determinant of a run (mass and speed factors
      // scale every move, drain comes from the pack, and fitted parts gate
      // move/turn/scan), and the Runs panel deliberately lists every build's
      // history so runs can be compared. Replay restores world, program and
      // seed but cannot restore the build, so the determinism claim only
      // holds when the current build IS the recorded one. Say which case
      // this is instead of asserting an exact match that may be false.
      const sameBuild = !!(r.robotKey && r.robotKey === runRobotKey(robotSpec));
      if (sameBuild) {
        addConsole('Replay: same robot, program, world and seed ' + r.seed + '. Outcome should match the recorded run exactly.', 'sys');
      } else {
        addConsole('Replay: same program, world and seed ' + r.seed + ', but the current build is NOT the one that produced this run'
          + (r.robotName ? ' (recorded on "' + r.robotName + '")' : '')
          + '. The robot changes movement, battery and which commands work, so the outcome can legitimately differ.', 'warn');
      }
      setTimeout(() => onRun(), 350);
    }

    // apply terrain accent to CSS var
    useEffect(() => {
      document.documentElement.style.setProperty('--terrain', terrain.accent);
    }, [terrainId]);

    // ---------- layout resizers ----------
    const { editorW, teleW, consoleH, startDrag, nudge, preset: layoutPreset } = (window.KodroHooks && window.KodroHooks.useResizers) ? window.KodroHooks.useResizers() : { editorW: 404, teleW: 318, consoleH: 184, startDrag: function () {}, nudge: function () {}, preset: function () {} };

    // interactive camera: camDrag (orbit) + camWheel (zoom) now come from
    // window.KodroHooks.useCamera (destructured with cam/setCam above).

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
    // Below 1181px the Simple-mode evidence panel is a fixed DRAWER (an
    // overlay), so Escape must close it before resetting the rover. At wider
    // widths it is a grid column, where Escape-to-close would be surprising.
    // The breakpoint is STATE tracked through a matchMedia listener, not a
    // render-time snapshot: resizing across 1180px with evidence open must
    // retarget Escape immediately, or it resets the rover under an open
    // drawer (narrowing) or closes the desktop column (widening).
    const [narrowViewport, setNarrowViewport] = useState(() =>
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1180px)').matches);
    useEffect(() => {
      if (typeof window.matchMedia !== 'function') return undefined;
      const mql = window.matchMedia('(max-width: 1180px)');
      const onChange = (e) => setNarrowViewport(e.matches);
      if (mql.addEventListener) mql.addEventListener('change', onChange);
      else if (mql.addListener) mql.addListener(onChange);
      return () => {
        if (mql.removeEventListener) mql.removeEventListener('change', onChange);
        else if (mql.removeListener) mql.removeListener(onChange);
      };
    }, []);
    const evidenceDrawerActive = simpleExperience && evidenceOpen && narrowViewport;
    const evidenceDrawerRef = useRef(false);
    evidenceDrawerRef.current = evidenceDrawerActive;
    anyOverlayOpenRef.current = !!(swarmOpen || askOpen || teacherOpen || robotLabOpen || memoryOpen || reviewOpen || vibeOpen || blocksOpen || buildOpen || showHelp || realismOpen || demoOpen || lessonHubOpen || settingsOpen || moreToolsOpen || runToolsOpen || evidenceDrawerActive);
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
        setLessonHubOpen(false);
        setSettingsOpen(false);
        setMoreToolsOpen(false);
        setRunToolsOpen(false);
        if (evidenceDrawerRef.current) setEvidenceOpen(false);
        setActiveStage('prove');
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
          if (!e.shiftKey && !e.altKey && (e.key === 'L' || e.key === 'l')) { e.preventDefault(); setRobotLabOpen(function (o) { const next = !o; setActiveStage(next ? 'design' : 'prove'); return next; }); return; }
          // Ctrl+M: toggle the Memory panel.
          if (!e.shiftKey && !e.altKey && (e.key === 'M' || e.key === 'm')) { e.preventDefault(); setMemoryOpen(function (o) { return !o; }); return; }
          // Ctrl+/: toggle the help / shortcuts modal.
          if (e.key === '/') { e.preventDefault(); setShowHelp(function (s) { return !s; }); return; }
          // Ctrl+D: toggle 2D / 3D view.
          if (!e.shiftKey && !e.altKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); setView3d(function (v) { return !v; }); return; }
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
    const anyModalOpen = swarmOpen || askOpen || teacherOpen || robotLabOpen || memoryOpen || reviewOpen || vibeOpen || blocksOpen || buildOpen || showHelp || realismOpen || demoOpen || lessonHubOpen;
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
    }, [swarmOpen, askOpen, teacherOpen, robotLabOpen, memoryOpen, reviewOpen, vibeOpen, blocksOpen, buildOpen, showHelp, realismOpen, demoOpen, lessonHubOpen]);

    // Shared vocabulary (app-data.jsx): telemetry renders the SAME labels.
    const statusLabel = (window.KodroStatusLabels || { idle: 'Standby', running: 'Running', paused: 'Paused', done: 'Complete', error: 'Halted' })[runState];
    const chipName = (robotSpec && robotSpec.name) || 'Robot';
    const chipType = (robotSpec && robotSpec.type) || null;
    const chipMass = (robotSpec && robotSpec.mass) || null;

    // Static web build: the RoboLearn bridge is present but pywebview is not, so
    // isAvailable() is false. The budget planner and the photo picker are
    // desktop-only (bridge.js has no browser path), so the controls that trigger
    // them say so up front instead of inviting an action that cannot finish here.
    const browserMode = !!(window.RoboLearn && window.RoboLearn.isAvailable && !window.RoboLearn.isAvailable());

    function goStage(stage) {
      setActiveStage(stage);
      setSettingsOpen(false);
      setMoreToolsOpen(false);
      if (stage === 'design') {
        setBuildOpen(false);
        setRobotLabOpen(true);
        return;
      }
      if (stage === 'build') {
        setRobotLabOpen(false);
        openBuildReal();
        return;
      }
      setRobotLabOpen(false);
      setBuildOpen(false);
      setLessonHubOpen(false);
      if (stage === 'prove') {
        // An open lesson IS prove-stage work: navigating here must not silently
        // discard it. Leaving a lesson stays an explicit act (the lesson picker
        // or the library), never a side effect of the stage nav.
        if (simpleExperience && !currentLessonId) setSimpleCodeOpen(false);
      }
      setTimeout(function () {
        const main = document.getElementById('editor-main');
        if (main && main.focus) main.focus({ preventScroll: true });
      }, 0);
    }

    const BUILD_PART_NAMES = {
      esp32: 'ESP32 development board', uno: 'Arduino Uno compatible board', pico: 'Raspberry Pi Pico', microbit: 'BBC micro:bit',
      ultrasonic: 'Ultrasonic distance sensor', camera: 'Camera module', imu: 'IMU / orientation sensor', gps: 'GPS receiver', line: 'Line sensor array', bumper: 'Bumper switch',
      motors2: 'Two geared drive motors', motors4: 'Four geared drive motors', servos: 'Steering servos', gripper: 'Servo gripper',
    };
    const BUILD_BODY_NAMES = { rover: 'Wheeled rover chassis', car: 'Steered vehicle chassis', arm: 'Fixed robotic arm base', home: 'Indoor companion chassis' };
    const buildPartIds = [robotSpec && robotSpec.board].concat((robotSpec && robotSpec.sensors) || [], (robotSpec && robotSpec.actuators) || []).filter(Boolean);
    const browserBuildParts = [{ id: 'body', name: BUILD_BODY_NAMES[(robotSpec && robotSpec.type) || 'rover'] || 'Robot chassis', role: 'Structure for this concept' }].concat(buildPartIds.map(function (id) {
      return { id: id, name: BUILD_PART_NAMES[id] || String(id).replace(/[_-]+/g, ' '), role: id === (robotSpec && robotSpec.board) ? 'Controller selected in Design' : 'Capability selected in Design' };
    }));
    const simpleRobotKey = runRobotKey(robotSpec);
    // Build-stage evidence counts only runs produced by THIS design: runs from
    // other robot configurations are history, not proof for this concept.
    const browserRuns = (window.KodroRunReports ? window.KodroRunReports.list() : []).filter(function (r) {
      return r && r.robotKey && r.robotKey === simpleRobotKey;
    });
    const browserRunCount = browserRuns.length;
    // A result belongs to the visible plan only when it was produced by this
    // exact robot configuration, in this world, from this exact source. A
    // legacy report without a configuration key remains available in history
    // but cannot be presented as proof for the plan currently on screen.
    const simpleLatestRun = browserRuns.find(function (r) {
      return r && r.world === terrainId && r.robotName === chipName
        && r.robotKey && r.robotKey === simpleRobotKey && r.source === code;
    }) || null;
    const showSimpleCockpit = simpleExperience && activeStage === 'prove' && !simpleCodeOpen && !currentLessonId;
    const planScenario = window.KodroScenario && window.KodroScenario.defaultFor ? window.KodroScenario.defaultFor(terrain && terrain.id) : null;
    // Same rule as simpleLatestRun six lines up: a proof counts for the plan on
    // screen only when THIS robot configuration produced it. A legacy report
    // without a fingerprint stays in history but is never presented as current.
    // The compile error is shown only while it still describes the program on
    // screen; any edit or test change shifts the hash and retires it.
    const liveProveError = (proveError && proveError.message
      && window.KodroScenario && window.KodroScenario.codeHash
      && proveError.hash === window.KodroScenario.codeHash(code))
      ? proveError.message : null;
    const planProveReport = proveReport && proveReport.manifest && planScenario
      && proveReport.manifest.contractId === planScenario.scenarioId
      && window.KodroScenario.codeHash && proveReport.manifest.controllerHash === window.KodroScenario.codeHash(code)
      && proveReport.robotKey && proveReport.robotKey === simpleRobotKey
      ? proveReport : null;
    const SIMPLE_PROGRAM_NAMES = {
      basecamp: 'Build a base camp', autopilot: 'Avoid obstacles automatically', drive: 'Explore the world',
      systems: 'Check every fitted system', square: 'Drive a precise square', spiral: 'Draw an expanding spiral',
      avoid: 'Sense and avoid hazards', encore: 'Perform a movement routine', searchlight: 'Search the area',
      gauntlet: 'Complete an obstacle course', survey: 'Survey and mark the site',
    };
    const SIMPLE_OUTCOME_NAMES = { done: 'Test completed', crash: 'Collision detected', flat: 'Battery depleted', stalled: 'Robot stalled', error: 'Program stopped' };
    const simpleOutcomeLabel = simpleLatestRun ? (SIMPLE_OUTCOME_NAMES[simpleLatestRun.outcome] || 'Test recorded') : '';
    const simpleRunActive = runState === 'running' || runState === 'paused';
    let simpleAssessment = null;
    try {
      const derived = window.getKodroRobot ? window.getKodroRobot() : {};
      if (window.KodroDiagnostics) simpleAssessment = window.KodroDiagnostics.assess(robotSpec, derived, terrain);
    } catch (e) { void e; }
    // Stored prose can outlive a product correction. Recompute the current
    // coaching sentence from the immutable structured measurements so copy and
    // safety disclosures migrate immediately after an update.
    let simpleLatestVerdict = '';
    try {
      if (simpleLatestRun && simpleAssessment && window.KodroDiagnostics) {
        const refreshed = window.KodroDiagnostics.afterRun(simpleAssessment, simpleLatestRun);
        simpleLatestVerdict = (refreshed && refreshed.text) || '';
      }
    } catch (e) { void e; }
    // Spoken summary of a settled run.
    //
    // Every region that carried real run information could be unmounted at
    // once: the console (role=log) only exists in the expert layout and is
    // replaced by the Runs panel, and the telemetry live region is display:none
    // in the default simple experience. That left a blind learner pressing Run
    // and hearing an outcome word with no measurement behind it -- the whole
    // feedback loop this product teaches. This region is mounted unconditionally
    // so it survives every panel toggle, and it must already be in the DOM
    // before its text changes or the first run would not announce at all.
    //
    // Built from the same expressions the visible result panel renders, so the
    // spoken numbers cannot drift from the shown ones. Recomputed only when a
    // run settles, never per frame, so it does not chatter mid-run.
    const runAnnouncement = useMemo(() => {
      if (runState === 'running' || runState === 'paused' || !simpleLatestRun) return '';
      const r = simpleLatestRun;
      const dist = r.distanceCm != null ? 'travelled ' + (r.distanceCm / 100).toFixed(1) + ' metres' : 'distance not recorded';
      const batt = r.batteryUsedPct != null ? r.batteryUsedPct + ' percent battery used' : 'battery not recorded';
      const prox = r.minProximityCm != null ? 'closest obstacle ' + r.minProximityCm + ' centimetres' : 'nothing came close';
      const where = (r.robotName || 'Robot') + ' in ' + (r.worldName || r.world || 'the selected world');
      // Several of these parts already end in a full stop (the coaching verdict
      // is a written sentence), so strip trailing punctuation before joining or
      // a screen reader reads "add sensing.. travelled 2.7 metres".
      const parts = [simpleOutcomeLabel, simpleLatestVerdict || r.detail || '', dist, batt, prox, where]
        .map((p) => String(p || '').trim().replace(/[.\s]+$/, ''))
        .filter(Boolean);
      return parts.join('. ') + '.';
    }, [runState, simpleLatestRun, simpleOutcomeLabel, simpleLatestVerdict]);
    function downloadPrototypeBrief() {
      const esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; }); };
      const runs = browserRuns.slice(0, 12);
      const rows = browserBuildParts.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.role) + '</td><td>Verify exact voltage, current, dimensions and connector before buying</td></tr>'; }).join('');
      const runRows = runs.length ? runs.map(function (r) { return '<tr><td>' + esc(r.worldName || r.world || '') + '</td><td>' + esc(r.outcome || '') + '</td><td>' + esc(r.distanceCm != null ? (r.distanceCm / 100).toFixed(1) + ' m' : 'not recorded') + '</td><td>' + esc(r.predicted || '') + '</td></tr>'; }).join('') : '<tr><td colspan="4">No completed runs recorded for this exact design on this device.</td></tr>';
      const html = '<!doctype html><html><head><meta charset="utf-8"><title>Kodro prototype brief</title><style>body{font:16px/1.5 system-ui;max-width:980px;margin:40px auto;padding:0 24px;color:#172033}h1,h2{color:#10233f}table{width:100%;border-collapse:collapse;margin:12px 0 26px}th,td{border:1px solid #ccd3dd;padding:9px;text-align:left;vertical-align:top}.notice{background:#fff7dd;border-left:5px solid #cf9a22;padding:14px}small{color:#526173}</style></head><body>' +
        '<h1>Kodro prototype brief: ' + esc(chipName) + '</h1><p><b>Generated:</b> ' + esc(new Date().toISOString()) + '<br><b>Concept:</b> ' + esc((robotSpec && robotSpec.type) || 'robot') + '<br><b>Scenario currently open:</b> ' + esc(terrain.name || terrain.id) + '</p>' +
        '<div class="notice"><b>This is a pre-build concept brief, not a certified wiring plan or purchasing recommendation.</b> Kodro has not verified supplier stock, live price, logic levels, current limits, battery safety or mechanical fit. Check original manufacturer datasheets and have a competent adult or engineer review the electrical design before power is applied.</div>' +
        '<h2>Concept bill of materials</h2><table><thead><tr><th>Design requirement</th><th>Why it is present</th><th>Before purchase</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<h2>Recorded simulation evidence</h2><table><thead><tr><th>Scenario</th><th>Outcome</th><th>Distance</th><th>Pre-run prediction</th></tr></thead><tbody>' + runRows + '</tbody></table>' +
        '<h2>Safe prototype sequence</h2><ol><li>Choose exact parts from original datasheets, then check supply voltage, logic voltage, stall current, driver limits and connector pinout.</li><li>Confirm chassis dimensions, wheel clearance, payload and battery restraint before assembly.</li><li>Power the controller separately first. Test each sensor, then the motor driver with wheels raised and an accessible power disconnect.</li><li>Measure speed, current draw, wheel slip and sensor error on the physical prototype. Enter measured values into a KRS specification and repeat the Kodro scenarios.</li></ol>' +
        '<h2>Evidence boundary</h2><p>Kodro reduces uncertainty before a first prototype. It does not certify real-world performance or safety. Simulation results apply only to the variables marked honoured or approximated in the verification report; unmodelled hazards remain untested.</p><small>Created locally in your browser. No order was placed and no supplier was contacted.</small></body></html>';
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (chipName || 'robot').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-prototype-brief.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      showToast('Prototype brief downloaded', 'ok');
    }

    return (
      <div className="app" data-stage={activeStage} data-experience={experience} data-simple-view={showSimpleCockpit ? 'plan' : 'code'} data-evidence={evidenceOpen ? 'open' : 'closed'} data-obstacles={(terrain.obstacles || []).length} data-active-world={(terrain.siteId || terrain.id) || ''}>
        <a className="skip-link" href="#editor-main">{simpleExperience ? 'Skip to test workspace' : 'Skip to code editor'}</a>
        <h1 className="sr-only">Kodro, an offline robot design and simulation studio</h1>
        {/* ---- mission bar ---- */}
        <div className="missionbar" role="banner">
          {/* The brand is the way home. Clicking a product's logo to get back to
              the start is the one navigation every user already knows, and it
              is what makes the front door somewhere you can return to. */}
          <button type="button" className="brand brand-home" onClick={() => setHomeOpen(true)} aria-label="Home, choose lessons, robot design or free play">
            <div className="brand-mark" dangerouslySetInnerHTML={{ __html: ORBIT_SVG }}></div>
            <div className="brand-text">
              <div className="brand-name">Kodro</div>
              <div className="brand-sub">Test robot designs before you build them</div>
            </div>
          </button>
          <div className="bar-divider"></div>
          <nav className="stage-nav" aria-label="Robot project stages">
            <button type="button" className={'stage-link' + (activeStage === 'design' ? ' active' : '')} aria-label={'1 Design, current robot ' + chipName} aria-current={activeStage === 'design' ? 'step' : undefined} onClick={() => goStage('design')}>
              <span className="stage-count">1</span><span><b>Design</b><small>{chipName}</small></span>
            </button>
            <button type="button" className={'stage-link' + (activeStage === 'prove' ? ' active' : '')} aria-label={'2 Prove in ' + (terrain.name || 'the current scenario')} aria-current={activeStage === 'prove' ? 'step' : undefined} onClick={() => goStage('prove')}>
              <span className="stage-count">2</span><span><b>Prove</b><small>{terrain.name || 'Scenario'}</small></span>
            </button>
            <button type="button" className={'stage-link' + (activeStage === 'build' ? ' active' : '')} aria-label="3 Build a prototype pack" aria-current={activeStage === 'build' ? 'step' : undefined} onClick={() => goStage('build')}>
              <span className="stage-count">3</span><span><b>Build</b><small>Prototype pack</small></span>
            </button>
          </nav>
          <div className="bar-divider"></div>
          <div className="run-controls">
            {!showSimpleCockpit && (
              <button className={'ctrl global-run ' + (runState === 'running' ? '' : 'ctrl-run')} onClick={() => { setRunToolsOpen(false); onRun(); }}>
                {runState === 'running' ? I.pause : I.play}
                {runState === 'running' ? 'Pause' : runState === 'paused' ? 'Resume' : 'Run'}
              </button>
            )}
            <button type="button" ref={runMoreBtnRef} className="ctrl run-more-toggle" aria-expanded={runToolsOpen} onClick={() => setRunToolsOpen(o => !o)}>More</button>
            <div className={'run-secondary' + (runToolsOpen ? ' is-open' : '')} role={simpleExperience ? 'group' : undefined} aria-label={simpleExperience ? 'More run tools' : undefined}>
            <button className="ctrl" onClick={() => { setRunToolsOpen(false); onStep(); }} disabled={runState === 'running'}>{I.step}Step</button>
            <button className="ctrl ctrl-stop" onClick={() => { setRunToolsOpen(false); onReset(); }}>{I.reset}Reset</button>
            {/* Validate lives in the main run bar, next to Run, because it is a
                run-family action (it drives the program across 5 seeds) and a
                real user reported they could not find it when it was buried as
                one of eight dim, uppercase micro-buttons in the editor header
                that wrapped onto a second row (color:var(--fg-3), 44% opacity).
                Here it is a full-contrast, clearly-labelled .ctrl the eye lands
                on beside Run/Step/Reset. The title is preserved VERBATIM because
                the cap.html modal-coverage driver opens it via
                clickTitleStartsWith('Validate this program across 5 randomised
                seeds'); qa_ui's modal-validate assert depends on that string. */}
            <button className="ctrl" title="Validate this program across 5 randomised seeds" onClick={() => { setRunToolsOpen(false); runValidation(); }}>{KI('target')}Validate</button>
            </div>
          </div>
          <div className="bar-spacer"></div>
          <div className="bar-status" role="status" aria-live="polite" aria-label={'Status: ' + statusLabel}>
            <span className={'status-dot ' + runState} aria-hidden="true"></span>
            <span>{statusLabel}</span>
          </div>
          <button type="button" className={'icon-btn evidence-toggle' + (evidenceOpen ? ' active' : '')} title={evidenceOpen ? 'Hide evidence' : 'Show evidence'} aria-label={evidenceOpen ? 'Hide evidence' : 'Show evidence'} aria-expanded={evidenceOpen} aria-controls="kodro-evidence-panel" onClick={() => setEvidenceOpen(v => !v)}>{KI('report')}<span className="icon-btn-label">Evidence</span></button>
          <div className="bar-divider"></div>
          <div className="more-tools-wrap">
            <button ref={moreToolsBtnRef} className="icon-btn more-tools-trigger" title="More tools" aria-label="More tools" aria-haspopup="menu" aria-expanded={moreToolsOpen} onClick={() => { setSettingsOpen(false); setMoreToolsOpen(o => !o); }}>{KI('blocks')}<span className="icon-btn-label">More Tools</span></button>
            {moreToolsOpen && (
              <div className="more-tools-pop" role="menu" aria-label="More tools">
                <span className="more-tools-heading">Learn and review</span>
                <button className="set-row set-btn" role="menuitem" aria-label="Lessons, browse guided robotics missions" onClick={openLessonLibrary}><span>{KI('report')}Lessons</span><span className="set-val">&rarr;</span></button>
                <button className="set-row set-btn" role="menuitem" aria-label="Teacher progress dashboard" onClick={() => { setMoreToolsOpen(false); if (!classroom) setMode('classroom'); openTeacher(); }}><span>{KI('gauge')}Teacher progress</span><span className="set-val">&rarr;</span></button>
                <button className="set-row set-btn" role="menuitem" title={aiInfo.available ? 'A second AI agent reviews your code' : 'A second AI agent reviews your code (needs a local model or a cloud key)'} onClick={() => { setMoreToolsOpen(false); runReview(); }}><span>{KI('review')}Review program</span><span className="set-val">&rarr;</span></button>
                <span className="more-tools-heading">Create and inspect</span>
                <button className="set-row set-btn" role="menuitem" title="Build the program from blocks" onClick={() => { setMoreToolsOpen(false); setBlocksOpen(true); }}><span>{KI('blocks')}Build with blocks</span><span className="set-val">&rarr;</span></button>
                <button className="set-row set-btn" role="menuitem" title="Realism dashboard: how the build drives the simulation" onClick={() => { setMoreToolsOpen(false); setRealismOpen(true); }}><span>{KI('gauge')}Simulation limits</span><span className="set-val">&rarr;</span></button>
                <button className="set-row set-btn" role="menuitem" aria-label="Open project history, memory and skills" onClick={() => { setMoreToolsOpen(false); setMemoryOpen(true); }}><span>{KI('memory')}Project history</span><span className="set-val">&rarr;</span></button>
                <button className="set-row set-btn" role="menuitem" title="Guided 2 to 3 minute realism demo" onClick={() => { setMoreToolsOpen(false); setDemoOpen(true); }}><span>{KI('demo')}Guided demo</span><span className="set-val">&rarr;</span></button>
                <button className="set-row set-btn" role="menuitem" aria-label="Open keyboard shortcuts" onClick={() => { setMoreToolsOpen(false); setShowHelp(true); }}><span>Keyboard shortcuts</span><span className="set-val">?</span></button>
              </div>
            )}
          </div>
          <button className="icon-btn btn-vibe companion-btn" title={aiInfo.available ? 'Open Companion (' + aiInfo.model + ')' : 'Open Companion. Direct robot and world actions work without a model.'} aria-label="Open Kodro Companion" onClick={() => setVibeOpen(true)}>{KI('vibe')}<span className="icon-btn-label">Companion</span><span className={'companion-dot' + (aiInfo.available ? ' ready' : '')} aria-hidden="true"></span></button>
          <input ref={projectFileRef} type="file" accept=".kodro,.json,application/json" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} onChange={onProjectFilePicked} />
          <div className="settings-wrap">
            <button ref={settingsBtnRef} className="icon-btn" title="Settings" aria-label="Settings for theme, sound and readable text" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => { setMoreToolsOpen(false); setSettingsOpen(o => !o); }}>{KI('gear')}<span className="icon-btn-label">Settings</span></button>
            {settingsOpen && (
              <div className="settings-pop" role="dialog" aria-label="Settings">
                <label className="set-row">
                  <span>Interface</span>
                  <select className="lesson-select" value={experience} onChange={e => setExperience(e.target.value === 'expert' ? 'expert' : 'simple')} aria-label="Interface complexity">
                    <option value="simple">Simple</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>
                {/* P7/A1: the Studio/Classroom split. Studio (default) is the
                    professional tool; Classroom brings back pupils, lessons,
                    the teacher dashboard and the novelty themes. */}
                <label className="set-row">
                  <span>Mode</span>
                  <select className="lesson-select" value={mode} onChange={e => { const next = e.target.value; setMode(next); if (next === 'classroom') setLessonHubOpen(true); }} aria-label="Studio or Classroom mode">
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
                  <span>Photo prop · place("photo")</span><span className="set-val">{browserMode ? 'Desktop app' : (photoUrl ? 'Loaded' : 'Pick…')}</span>
                </button>
                <button className="set-row set-btn" aria-label="Open project history, memory and skills" onClick={() => { setSettingsOpen(false); setMemoryOpen(true); }}>
                  <span>Project history · runs, memory and skills</span><span className="set-val">&rarr;</span>
                </button>
                <button className="set-row set-btn" aria-label="Open keyboard shortcuts" onClick={() => { setSettingsOpen(false); setShowHelp(true); }}>
                  <span>Help · keyboard shortcuts</span><span className="set-val">?</span>
                </button>
                {/* F6: the Tweaks panel (camera perspective/orbit/zoom, scene
                    toggles, trail colour) listens for the edit-mode handshake
                    but no host ever sent it, so it was dead UI. This row is
                    the real trigger. */}
                <button className="set-row set-btn" onClick={() => { setSettingsOpen(false); try { window.postMessage({ type: '__activate_edit_mode' }, '*'); } catch (e) { void e; } }}>
                  <span>Scene tweaks · camera + trail</span><span className="set-val">→</span>
                </button>
                {/* OPP-6: runtime custom world. Changing a control switches to
                    (or regenerates) the custom world immediately; nothing is
                    persisted in v1. */}
                {window.KodroCustomWorld && (() => {
                  const cw = window.KodroCustomWorld.get();
                  const applyCw = (p) => { window.KodroCustomWorld.set(p); if (terrainId !== 'custom') onTerrain('custom'); };
                  return (
                    <React.Fragment>
                      <label className="set-row">
                        <span>Custom world · seed</span>
                        <select className="lesson-select" value={String(cw.seed)} aria-label="Custom world seed" onChange={e => applyCw({ seed: +e.target.value })}>
                          {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>seed {s}</option>)}
                        </select>
                      </label>
                      <label className="set-row">
                        <span>Custom world · obstacles</span>
                        <select className="lesson-select" value={cw.density} aria-label="Custom world obstacle density" onChange={e => applyCw({ density: e.target.value })}>
                          <option value="sparse">sparse</option>
                          <option value="normal">normal</option>
                          <option value="dense">dense</option>
                        </select>
                      </label>
                      <label className="set-row">
                        <span>Custom world · traction</span>
                        <select className="lesson-select" value={String(cw.traction)} aria-label="Custom world traction" onChange={e => applyCw({ traction: +e.target.value })}>
                          <option value="0.5">slippery (0.5)</option>
                          <option value="0.75">loose (0.75)</option>
                          <option value="1">standard (1.0)</option>
                        </select>
                      </label>
                      <button className="set-row set-btn" onClick={() => { setSettingsOpen(false); onTerrain('custom'); }}>
                        <span>Custom world · open</span><span className="set-val">→</span>
                      </button>
                    </React.Fragment>
                  );
                })()}
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
        <main id="editor-main" tabIndex={-1} className="workspace" style={{ ['--editor-w']: editorW + 'px', ['--tele-w']: teleW + 'px' }}>
          {/* Always mounted, outside every panel toggle: see runAnnouncement.
              .sr-only is clip-based, not display:none, so it stays in the
              accessibility tree while taking no visual space. */}
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{runAnnouncement}</div>
          {/* left column: editor + console */}
          <div className="panel" style={{ gridColumn: 1 }}>
            {showSimpleCockpit && (
              <section className="simple-cockpit" aria-label="Robot test plan">
                <header className="simple-cockpit-head">
                  <span className="simple-step">Step 2 of 3</span>
                  <h2>Prove your robot</h2>
                  <p>Choose one test, run it in the world, then use the result to improve the design.</p>
                </header>

                <div className="simple-setup" aria-label="Current test setup">
                  <div className="simple-setup-row">
                    <span><b>Robot</b><small>The design being tested</small></span>
                    <button type="button" className="simple-setup-action" onClick={() => goStage('design')}>
                      <strong>{chipName}</strong><em>Edit</em>
                    </button>
                  </div>
                  <label className="simple-setup-row">
                    <span><b>World</b><small>The conditions around it</small></span>
                    <select className="simple-setup-select" value={terrainId} onChange={e => onTerrain(e.target.value)} aria-label="Choose the test world">
                      <optgroup label="Core worlds">
                        {['city', 'room', 'earth', 'mars', 'underwater', 'space'].map(id => <option key={id} value={id}>{TERRAINS[id].label}</option>)}
                      </optgroup>
                      {window.SITES && [['earth', 'Earth sites'], ['underwater', 'Underwater sites'], ['mars', 'Mars sites'], ['space', 'Space sites'], ['room', 'Test bays']].map(([base, label]) => {
                        const ids = Object.keys(window.SITES).filter(id => window.SITES[id].base === base);
                        return ids.length === 0 ? null : <optgroup key={base} label={label}>{ids.map(id => <option key={id} value={id}>{window.SITES[id].name}</option>)}</optgroup>;
                      })}
                      {terrainId === 'custom' && <option value="custom">Custom world</option>}
                    </select>
                  </label>
                  <label className="simple-setup-row">
                    <span><b>Test</b><small>What the robot will do</small></span>
                    <select className="simple-setup-select" value={activeTab} onChange={e => { setCurrentLessonId(null); clearLessonWorld(); setActiveTab(e.target.value); }} aria-label="Choose the robot test">
                      {Object.keys(EXAMPLES).map(k => <option key={k} value={k}>{SIMPLE_PROGRAM_NAMES[k] || EXAMPLES[k].label}</option>)}
                    </select>
                  </label>
                </div>

                <section className={'simple-proof' + (planProveReport && planProveReport.aggregate ? (planProveReport.aggregate.passed ? ' proof-pass' : ' proof-fail') : '')} aria-label="Deterministic proof">
                  <div className="simple-proof-head">
                    <span>
                      <b>Deterministic evidence</b>
                      <small>Five fixed seeds vary traction, mass, sensor noise, obstacle position, start delay and battery.</small>
                    </span>
                    {planProveReport && planProveReport.aggregate
                      ? <strong>{planProveReport.aggregate.passed ? 'PASS' : 'FAIL'}</strong>
                      : <strong>NOT RUN</strong>}
                  </div>
                  {planProveReport && planProveReport.aggregate ? (
                    <React.Fragment>
                      <div className="simple-proof-metrics">
                        <span><b>{planProveReport.aggregate.successCount}/{planProveReport.aggregate.seeds}</b> goals reached</span>
                        <span><b>{planProveReport.aggregate.meanCollisions}</b> mean collisions</span>
                        <span><b>{planProveReport.aggregate.meanBattery}%</b> mean battery used</span>
                      </div>
                      <p className="simple-proof-regression">
                        Regression: {planProveReport.regression && planProveReport.regression.status === 'same' ? 'matches the previous run byte for byte' : planProveReport.regression && planProveReport.regression.status === 'changed' ? 'changed in ' + planProveReport.regression.changed.join(', ') : 'no matching baseline yet'}.
                      </p>
                    </React.Fragment>
                  ) : liveProveError ? (
                    <p className="simple-proof-error"><b>The proof could not run.</b> {liveProveError} Fix the program with Edit program, then try again.</p>
                  ) : <p>No multi-seed evidence has been recorded for this session.</p>}
                  <p className="simple-proof-boundary">Kinematic simulation evidence only. It does not validate or certify physical performance or safety.</p>
                  <div className="simple-proof-actions">
                    <button type="button" className="ctrl ctrl-run" onClick={runValidation}>Run 5-seed proof</button>
                    {planProveReport && planProveReport.manifest && <button type="button" onClick={downloadProveManifest}>Download manifest</button>}
                    {planProveReport && <button type="button" onClick={() => setRealismOpen(true)}>Inspect limits</button>}
                  </div>
                </section>

                {!simpleLatestRun && !simpleRunActive && <section className={'simple-readiness tone-' + ((simpleAssessment && simpleAssessment.overall) || 'unknown')} aria-label="Pre-run design check">
                  <div className="simple-readiness-title">
                    <span>Before the run</span>
                    <strong>{simpleAssessment ? (simpleAssessment.overall === 'pass' ? 'Ready' : simpleAssessment.overall === 'warn' ? 'Check' : 'Fix first') : 'Not checked'}</strong>
                  </div>
                  <p>{simpleAssessment ? simpleAssessment.summary : chipName + ' is ready for a first simulated test.'}</p>
                  {simpleAssessment && simpleAssessment.topFix ? <p className="simple-fix"><b>Best next change:</b> {simpleAssessment.topFix}</p> : null}
                  {simpleAssessment && simpleAssessment.numbers && simpleAssessment.numbers.unsimHazard ? <p className="simple-limit"><b>Not modelled:</b> {simpleAssessment.numbers.unsimHazard}.</p> : null}
                </section>}

                <div className="simple-primary-actions">
                  <button type="button" className="ctrl ctrl-run simple-run" onClick={onRun}>
                    {runState === 'running' ? I.pause : I.play}
                    {runState === 'running' ? 'Pause test' : runState === 'paused' ? 'Resume test' : 'Run this test'}
                  </button>
                  <button type="button" className="ctrl simple-edit" onClick={() => setSimpleCodeOpen(true)}>Edit program</button>
                </div>
                {(simpleRunActive || simpleLatestRun) && <section className={'simple-result' + (simpleLatestRun ? ' has-result tone-' + simpleLatestRun.outcome : '')} aria-label="Latest test result">
                  <div className="simple-result-head">
                    <span>{runState === 'running' ? 'Test in progress' : runState === 'paused' ? 'Test paused' : 'Latest result'}</span>
                    <strong>{runState === 'running' ? 'Running now' : runState === 'paused' ? 'Paused' : simpleOutcomeLabel}</strong>
                  </div>
                  {runState === 'running' ? (
                    <p>Watch the world. Kodro is recording movement, battery use and the closest obstacle.</p>
                  ) : runState === 'paused' ? (
                    <p>The test is paused. Resume when you are ready; the current position and measurements are preserved.</p>
                  ) : (
                    <React.Fragment>
                      <p>{simpleLatestVerdict || simpleLatestRun.detail || 'The run finished and its measurements were saved.'}</p>
                      <div className="simple-result-stats">
                        <span><b>{simpleLatestRun.distanceCm != null ? (simpleLatestRun.distanceCm / 100).toFixed(1) + ' m' : 'Not recorded'}</b><small>distance</small></span>
                        <span><b>{simpleLatestRun.batteryUsedPct != null ? simpleLatestRun.batteryUsedPct + '%' : 'Not recorded'}</b><small>battery used</small></span>
                        <span><b>{simpleLatestRun.minProximityCm != null ? simpleLatestRun.minProximityCm + ' cm' : 'Clear'}</b><small>closest obstacle</small></span>
                      </div>
                      <small className="simple-result-context">{simpleLatestRun.robotName || 'Robot'} in {simpleLatestRun.worldName || simpleLatestRun.world || 'the selected world'}</small>
                    </React.Fragment>
                  )}
                  <div className="simple-result-actions">
                    {simpleLatestRun && <button type="button" onClick={() => { setSimpleCodeOpen(true); setRunsOpen(true); }}>View all runs</button>}
                    <button type="button" onClick={() => setEvidenceOpen(true)}>Open evidence</button>
                  </div>
                </section>}
                <button type="button" className="simple-companion-action" onClick={() => setVibeOpen(true)}>
                  <span>{KI('vibe')}<b>Build it with Companion</b></span>
                  <small>{aiInfo.available ? 'Local AI is ready to change the robot or program with you.' : 'Direct robot and world commands work offline without a model.'}</small>
                </button>
              </section>
            )}
            {!showSimpleCockpit && (
              <React.Fragment>
            <div className="editor-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="panel-head">
                <label className="simple-program-picker">
                  <span className="eyebrow">Program</span>
                  <select className="lesson-select" value={currentLessonId ? '' : activeTab} onChange={e => { setCurrentLessonId(null); clearLessonWorld(); setActiveStage('prove'); setActiveTab(e.target.value); }} aria-label="Choose an example program">
                    <option value="" disabled>Lesson program</option>
                    {Object.keys(EXAMPLES).map(k => <option key={k} value={k}>{EXAMPLES[k].label}</option>)}
                  </select>
                </label>
                <div className="tabs">
                  {Object.keys(EXAMPLES).map(k => (
                    <button key={k} type="button" className={'tab' + (!currentLessonId && activeTab === k ? ' active' : '')} aria-pressed={!currentLessonId && activeTab === k} onClick={() => { setCurrentLessonId(null); clearLessonWorld(); setActiveTab(k); }}>{EXAMPLES[k].label}</button>
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
                        <option key={l.id} value={l.id}>{l.id} · {l.title} [{AGE_FOR[l.keyStage] || l.keyStage}]</option>
                      ))}
                    </select>
                    <button type="button" className="btn-mini lesson-browse" onClick={() => setLessonHubOpen(true)}>Browse</button>
                  </div>
                )}
                <div className="panel-actions">
                  {simpleExperience && simpleCodeOpen && <button className="btn-mini simple-back-plan" onClick={() => { setRunsOpen(false); setSimpleCodeOpen(false); }}>Back to test plan</button>}
                  {!simpleExperience && <button className="btn-mini" title="Build the program from blocks" onClick={() => setBlocksOpen(true)}>{KI('blocks')}Blocks</button>}
                  {!simpleExperience && <button className="btn-mini" title="Realism dashboard: how the build drives the simulation" onClick={() => setRealismOpen(true)}>{KI('gauge')}Simulation limits</button>}
                  <details className="editor-tools">
                    <summary className="btn-mini">Program tools</summary>
                    <div className="editor-tools-menu">
                      {simpleExperience && <button className="set-row set-btn" title="Build the program from blocks" onClick={() => setBlocksOpen(true)}><span>{KI('blocks')}Build with blocks</span><span className="set-val">&rarr;</span></button>}
                      {simpleExperience && <button className="set-row set-btn" title="Realism dashboard: how the build drives the simulation" onClick={() => setRealismOpen(true)}><span>{KI('gauge')}Simulation limits</span><span className="set-val">&rarr;</span></button>}
                      <button className="set-row set-btn" title={aiInfo.available ? 'A second AI agent reviews your code' : 'A second AI agent reviews your code (needs a local model or a cloud key)'} onClick={runReview}><span>{KI('review')}Review program</span><span className="set-val">&rarr;</span></button>
                      <button className="set-row set-btn" title="Guided 2 to 3 minute realism demo" onClick={() => setDemoOpen(true)}><span>{KI('demo')}Guided demo</span><span className="set-val">&rarr;</span></button>
                      <button className="set-row set-btn" title={aiInfo.available ? 'Ask a question, answered from the built-in material' : 'Ask a question, answered from the built-in material (needs a local model or a cloud key)'} onClick={() => { setAskOpen(true); setAskData(null); }}><span>{KI('ask')}Ask from lessons</span><span className="set-val">&rarr;</span></button>
                      {!browserMode && <button className="set-row set-btn" title="Run your program on a swarm of rovers at once" onClick={runSwarm}><span>{KI('swarm')}Run a swarm</span><span className="set-val">&rarr;</span></button>}
                    </div>
                  </details>
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
                // Studio keeps the screen quiet (round-3 feedback: fewer
                // words); learners in classroom mode keep the command strip.
                if (!classroom) return null;
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
                // Goal checklist + progressive hints, powered by the grader's
                // own per-lesson data (criteria + the full hint bank), so the
                // card promises exactly what the grader will check.
                const G = window.KodroLessonGrader;
                const ldata = (G && G.LESSON_DATA && G.LESSON_DATA[lesson.id]) || null;
                const goals = (ldata && ldata.criteria) || [];
                const hintBank = (ldata && ldata.hints && ldata.hints.onFailure) || [];
                const lessonFailed = !!(lessonVerdict && !lessonVerdict.passed);
                const hintsShownByVerdict = (lessonFailed && lessonVerdict.hint && lessonVerdict.hint.message) ? 1 : 0;
                const revealedHints = hintBank.slice(hintsShownByVerdict, hintsShownByVerdict + extraHints);
                const moreHintsLeft = hintsShownByVerdict + extraHints < hintBank.length;
                const nextLesson = (lessonVerdict && lessonVerdict.passed)
                  ? lessons[lessons.findIndex(l => l.id === lesson.id) + 1] || null
                  : null;
                return (
                  <section className="lesson-card" aria-label="Current lesson">
                    <div className="lesson-card-head">
                      <span className="lesson-badge" title={lesson.keyStage}>{AGE_FOR[lesson.keyStage] || lesson.keyStage}</span>
                      <span className="lesson-title">{lesson.id} · {lesson.title}</span>
                      {lesson.readingAge ? <span className="lesson-age" title="Reading age">Age {lesson.readingAge}+</span> : null}
                      {lessonVerdict && (
                        <span className={'lesson-verdict ' + (lessonVerdict.passed ? 'pass' : 'fail')}>
                          <span aria-hidden="true">{lessonVerdict.passed ? '✓' : '✗'}</span> {lessonVerdict.passed ? 'Complete' : 'Not yet'} · {lessonVerdict.score}/100
                        </span>
                      )}
                    </div>
                    {lesson.intro ? <p className="lesson-intro">{lesson.intro.trim()}</p> : null}
                    {goals.length > 0 && (
                      <ul className="lesson-goals" aria-label="Lesson goals">
                        {goals.map((c, i) => {
                          const st = !lessonVerdict ? 'todo' : (G.criterionFailedIn(c, lessonVerdict.reasons) ? 'fail' : 'done');
                          return (
                            <li key={i} className={'goal ' + st}>
                              <span className="goal-mark" aria-hidden="true">{st === 'done' ? '✓' : st === 'fail' ? '✗' : ''}</span>
                              {G.describeCriterion(c)}
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
                    {revealedHints.map((h, i) => (
                      <p key={'xh' + i} className="lesson-hint">{KI('bulb')} {h}</p>
                    ))}
                    {(moreHintsLeft || lessonFailed || nextLesson) && (
                      <div className="lesson-actions">
                        {moreHintsLeft && (
                          <button className="btn-mini lesson-hint-more" onClick={() => setExtraHints(x => x + 1)}>
                            {hintsShownByVerdict + extraHints === 0 ? 'Need a hint?' : 'Need another hint?'}
                          </button>
                        )}
                        {lessonFailed && lessonVerdict.reasons.length > 0 && (
                          <button className="btn-mini lesson-ask-why"
                            onClick={() => {
                              setAskQuery('In the lesson "' + lesson.title + '": ' + lessonVerdict.reasons[0] + ' Why did this happen and what should I try?');
                              setAskOpen(true);
                            }}>Ask why this failed</button>
                        )}
                        {nextLesson && (
                          <button className="ctrl ctrl-run lesson-next" onClick={() => loadLesson(nextLesson)}>
                            Next lesson: {nextLesson.title}
                          </button>
                        )}
                      </div>
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
                <span className="eyebrow" role="heading" aria-level="2">{runsOpen ? 'Run reports' : 'Console'}</span>
                <div className="ph-spacer" style={{ flex: 1 }}></div>
                <button className={'btn-mini' + (runsOpen ? ' active' : '')} title="Run reports. A structured record of every run; tick two to compare them" aria-pressed={runsOpen} onClick={() => setRunsOpen(o => !o)}>Runs</button>
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
                const fmtTimeFull = (ts) => { try { const d = new Date(ts); return fmtTime(ts) + ':' + String(d.getSeconds()).padStart(2, '0'); } catch (e) { return ''; } };
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
                    {/* A delta is only a BUILD comparison when the robot is the
                        only thing that differs. The panel invites the reader to
                        compare builds, so it must say when the program or the
                        world also changed, rather than leaving them invisible. */}
                    {sel.length === 2 && (() => {
                      // Three states per input, never two: same, different, or
                      // UNKNOWN. Reports written before fingerprints and replay
                      // support carry no robotKey and no source, and an absent
                      // record cannot prove either sameness or difference.
                      // Collapsing unknown into "different" invented the exact
                      // causal claim these rounds have been removing.
                      const cmp = (a, b) => (a == null || b == null || a === '' || b === '') ? 'unknown' : (a === b ? 'same' : 'different');
                      const parts = [
                        { name: 'robot', state: cmp(sel[0].robotKey, sel[1].robotKey) },
                        { name: 'program', state: cmp(sel[0].source, sel[1].source) },
                        { name: 'world', state: cmp(sel[0].world, sel[1].world) },
                      ];
                      const differs = parts.filter(p => p.state === 'different').map(p => p.name);
                      const unknown = parts.filter(p => p.state === 'unknown').map(p => p.name);
                      const list = (xs) => xs.length === 1 ? xs[0] : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
                      let msg;
                      if (differs.length === 0 && unknown.length === 0) msg = 'Same robot, program and world: this delta is run-to-run variation.';
                      else if (differs.length === 1 && unknown.length === 0) msg = 'These runs differ only in ' + differs[0] + ', so the delta is attributable to the ' + differs[0] + '.';
                      else if (differs.length > 1 && unknown.length === 0) msg = 'These runs differ in ' + list(differs) + ', so the delta cannot be attributed to any one of them.';
                      else msg = (differs.length ? 'These runs differ in ' + list(differs) + ', and the ' : 'The ')
                        + list(unknown) + (unknown.length === 1 ? ' behind' : ' behind')
                        + ' at least one run was not recorded, so this delta cannot be attributed with confidence.';
                      return (
                        <p className={'runs-compare-scope' + (differs.length > 1 || unknown.length ? ' mixed' : '')}>{msg}</p>
                      );
                    })()}
                    {runs.length === 0
                      ? <p className="vibe-status" style={{ padding: '10px 12px' }}>No runs recorded yet. Press Run; every finished, crashed, stalled or flat-battery run leaves a report here.</p>
                      : (
                        <ul className="runs-list">
                          {runs.map(r => (
                            <li key={r.id} className={'run-entry run-' + r.outcome} data-run-entry={r.outcome}>
                              <input type="checkbox" checked={cmpSel.indexOf(r.id) >= 0} onChange={() => toggleSel(r.id)} aria-label={'Select the ' + (r.robotName || 'robot') + ' ' + (r.outcome || '') + ' run in ' + (r.worldName || r.world || 'the world') + ' at ' + fmtTimeFull(r.ts) + ' for compare'} />
                              <span className={'run-outcome ro-' + r.outcome}>{(r.outcome || '?').toUpperCase()}</span>
                              <span className="run-main">{r.robotName || 'Robot'} · {r.worldName || r.world}{r.detail ? ' · ' + r.detail : ''}</span>
                              <span className="run-stats num">
                                {r.distanceCm != null ? (r.distanceCm / 100).toFixed(1) + ' m' : '-'}
                                {r.batteryUsedPct != null ? ' · ' + r.batteryUsedPct + '% batt' : ''}
                                {r.minProximityCm != null && r.minProximityCm < 600 ? ' · ' + r.minProximityCm + ' cm closest' : ''}
                              </span>
                              <span className="run-pred" title="The design check's prediction before the run">{r.predicted ? 'predicted: ' + r.predicted : ''}</span>
                              {r.seed != null && r.source
                                ? <button className="btn-mini" data-replay title="Re-run this exact program in its world with its recorded seed. The robot is not restored, so a run recorded on a different build can differ." onClick={() => replayRun(r)}>Replay</button>
                                : <span className="run-pred" title="Recorded before replay support, so the program and seed were not saved">no replay</span>}
                              <span className="run-time num">{fmtTime(r.ts)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    <div className="runs-foot">
                      <span className="vibe-hint" style={{ flex: 1 }}>Tick two runs to compare them side by side. Kodro says which inputs differ.</span>
                      <button className="btn-mini" onClick={() => { if (window.KodroRunReports) window.KodroRunReports.clear(); setCmpSel([]); }}>Clear history</button>
                    </div>
                  </div>
                );
              })()}
              {!runsOpen && <div className="console-out" ref={consoleEndRef} role="log" aria-live="polite" aria-label="Program output and lesson feedback">
                {consoleLines.length > 300 && <div className="cline sys">… {consoleLines.length - 300} earlier lines (Reset clears the console)</div>}
                {consoleLines.slice(-300).map((l, i) => (
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
              </React.Fragment>
            )}
          </div>

          <div className="resizer" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize editor width (arrow left and right)" aria-valuenow={Math.round(editorW)} aria-valuemin={280} aria-valuemax={640} onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); nudge('editor', -16); } else if (e.key === 'ArrowRight') { e.preventDefault(); nudge('editor', 16); } }} onPointerDown={e => startDrag('editor', e)} style={{ gridColumn: 2 }}></div>

          {/* center: viewport */}
          <div className="panel view-panel" style={{ gridColumn: 3 }} onPointerDown={camDrag} onWheel={camWheel}>
            <div className="terrain-switch">
              <div className="world-pick-row">
                <label className="world-picker">
                  <span>World</span>
                  <select className="lesson-select site-select world-select" value={terrainId} onChange={e => onTerrain(e.target.value)} aria-label="World or real-world mission site">
                    <optgroup label="Core worlds">
                      {['city', 'room', 'earth', 'mars', 'underwater', 'space'].map(id => <option key={id} value={id}>{TERRAINS[id].label}</option>)}
                    </optgroup>
                    {window.SITES && [['earth', 'Earth sites'], ['underwater', 'Underwater sites'], ['mars', 'Mars sites'], ['space', 'Space sites'], ['room', 'Test bays']].map(([base, label]) => {
                      const ids = Object.keys(window.SITES).filter(id => window.SITES[id].base === base);
                      return ids.length === 0 ? null : <optgroup key={base} label={label}>{ids.map(id => <option key={id} value={id}>{window.SITES[id].name}</option>)}</optgroup>;
                    })}
                    {terrainId === 'custom' && <option value="custom">Custom world</option>}
                  </select>
                </label>
                <span className="view-toggle">
                  <button type="button" className={'terrain-btn' + (view3d ? ' active' : '')} aria-pressed={view3d} title="Real 3D view" onClick={() => { setView3d(true); setFocus3dKey(k => k + 1); }}>3D</button>
                  <button type="button" className={'terrain-btn' + (!view3d ? ' active' : '')} aria-pressed={!view3d} title="Flat top-down view" onClick={() => setView3d(false)}>2D</button>
                </span>
                <details className="test-conditions">
                  <summary className="terrain-btn">Test conditions</summary>
                  <div className="test-conditions-menu">
                    <div className="speed-ctrl world-speed">
                      <label htmlFor="sim-speed">Sim speed</label>
                      <input id="sim-speed" type="range" className="slider" min="0.4" max="3" step="0.1" value={speedMul} onChange={e => setSpeedMul(parseFloat(e.target.value))} aria-label="Sim speed" aria-valuetext={speedMul + ' times'} />
                      <span className="num">{speedMul.toFixed(1)}×</span>
                    </div>
                    {view3d && <label><span>Render quality</span><select className="terrain-btn" value={quality} aria-label="Render quality" onChange={e => { const v = e.target.value; window.KODRO_QUALITY = v; setQuality(v); try { localStorage.setItem('kodro_quality', v); } catch (err) { void err; } }}><option value="low">Low</option><option value="med">Medium</option><option value="high">High</option><option value="cinematic">Cinematic</option></select></label>}
                    {view3d && <label><span>Time of day</span><select className="terrain-btn" value={tod} aria-label="Time of day" onChange={e => setTod(e.target.value)}><option value="noon">Noon</option><option value="dawn">Dawn</option><option value="dusk">Dusk</option><option value="night">Night</option></select></label>}
                    {view3d && <label><span>Weather</span><select className="terrain-btn" value={weather} aria-label="Weather" onChange={e => setWeather(e.target.value)}><option value="clear">Clear</option><option value="storm">Dust storm</option><option value="rain">Rain</option><option value="snow">Snow</option></select></label>}
                  </div>
                </details>
              </div>
            </div>
            {view3d
              ? <window.Viewport3D key={'vp3d-' + (terrain && (terrain.siteId || terrain.id)) + '-' + (robotSpec && robotSpec.type) + '-' + ((terrain && terrain.tod) || 'noon') + '-' + ((terrain && terrain.weather) || 'clear') + (quality === 'cinematic' ? '-cine' : '-std') + '-gl' + glEpoch} terrain={terrain} rover={rover} fpv={fpv} robotType={robotSpec && robotSpec.type} quality={quality} focusKey={focus3dKey} onFail={() => { setView3d(false); addConsole('3D is unavailable on this machine — switched to the flat view.', 'sys'); }} />
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

          <div className="resizer tele-resizer" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize telemetry width (arrow left and right)" aria-valuenow={Math.round(teleW)} aria-valuemin={240} aria-valuemax={460} onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); nudge('tele', 16); } else if (e.key === 'ArrowRight') { e.preventDefault(); nudge('tele', -16); } }} onPointerDown={e => startDrag('tele', e)} style={{ gridColumn: 4 }}></div>

          {/* right: telemetry */}
          <div id="kodro-evidence-panel" className={'panel tele-panel' + (teleCollapsed ? ' tele-collapsed' : '')} style={{ gridColumn: 5 }}>
            <div className="panel-head">
              <span className="eyebrow" role="heading" aria-level="2">Evidence</span>
              <div className="ph-spacer" style={{ flex: 1 }}></div>
              {/* The panel is captioned with the robot the user actually
                  built, not a hard-coded callsign (product-coherence D3). */}
              <span className="num" style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{chipName}</span>
              <button type="button" className="tele-toggle" aria-expanded={!teleCollapsed} aria-label={teleCollapsed ? 'Expand telemetry panel' : 'Collapse telemetry panel'} onClick={() => setTeleCollapsed(c => !c)}>{teleCollapsed ? '▸' : '▾'}</button>
              <button type="button" className="tele-close" aria-label="Close the evidence panel" onClick={() => setEvidenceOpen(false)}>✕</button>
            </div>
            <window.Telemetry rover={rover} terrain={terrain} sensorDist={sensorDist} odometer={odo} robot={robotSpec} runState={runState} view3d={view3d} />
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

        {lessonHubOpen && (
          <div className="modal-backdrop lesson-hub-backdrop" onClick={() => setLessonHubOpen(false)}>
            <div className="modal lesson-hub-modal" role="dialog" aria-modal="true" aria-label="Lesson library" onClick={e => e.stopPropagation()}>
              <div className="lesson-hub-head">
                <div>
                  <span className="eyebrow">Classroom · learn by making the robot move</span>
                  <h2>Choose your next mission</h2>
                  <p>Each lesson gives you a starter program, a real simulated world, clear goals and feedback after every run.</p>
                </div>
                <button className="btn-mini lesson-hub-close" aria-label="Close lesson library" onClick={() => { setLessonHubOpen(false); if (!currentLessonId) setActiveStage('prove'); }}>✕</button>
              </div>
              <div className="lesson-hub-summary" role="group" aria-label="Lesson progress summary">
                <div className="lesson-summary-card">
                  <span className="lesson-summary-value">{Object.keys(lessonResults).filter(id => lessonResults[id] && lessonResults[id].passed).length}</span>
                  <span>completed</span>
                </div>
                <div className="lesson-summary-card">
                  <span className="lesson-summary-value">{lessons.length}</span>
                  <span>missions</span>
                </div>
                <div className="lesson-summary-card lesson-summary-wide">
                  <span className="lesson-summary-label">Learning as</span>
                  <strong>{browserMode ? 'This device' : ((pupils.find(p => p.id === activePupilId) || {}).displayName || 'Current pupil')}</strong>
                </div>
                <button className="btn-mini lesson-teacher-link" onClick={() => { setLessonHubOpen(false); openTeacher(); }}>View progress</button>
              </div>
              <div className={'lesson-hub-scroll' + (simpleExperience && !lessonBrowseAll ? ' lesson-hub-focused' : '')}>
                {lessons.length === 0 && <p className="lesson-hub-loading">Loading the offline lesson library…</p>}
                {simpleExperience && !lessonBrowseAll && lessons.length > 0 ? (() => {
                  const lesson = lessons.find(l => !(lessonResults[l.id] && lessonResults[l.id].passed)) || lessons[0];
                  const result = lessonResults[lesson.id];
                  return (
                    <section className="lesson-recommended" aria-labelledby="recommended-lesson-title">
                      <span className="lesson-stage-code">Recommended next</span>
                      <h3 id="recommended-lesson-title">{lesson.title}</h3>
                      <p>{(lesson.intro || 'Program the robot and test your solution in the simulated world.').trim()}</p>
                      <div className="lesson-recommended-meta">
                        <span>{AGE_FOR[lesson.keyStage] || lesson.keyStage}</span>
                        <span>{(lesson.terrain || 'earth').replace(/^./, c => c.toUpperCase())} world</span>
                        {lesson.readingAge ? <span>Reading age {lesson.readingAge}+</span> : null}
                      </div>
                      <button type="button" className="ctrl ctrl-run lesson-recommended-start" aria-label={'Open recommended lesson: ' + lesson.title} onClick={() => loadLesson(lesson)}>
                        {result && result.passed ? 'Review lesson' : 'Start lesson'}
                      </button>
                      <button type="button" className="btn-mini lesson-browse-all" onClick={() => setLessonBrowseAll(true)}>Browse all {lessons.length} missions</button>
                    </section>
                  );
                })() : ['KS1', 'KS2', 'KS3', 'KS4'].map(stage => {
                  const stageLessons = lessons.filter(l => l.keyStage === stage);
                  if (stageLessons.length === 0) return null;
                  const stageDone = stageLessons.filter(l => lessonResults[l.id] && lessonResults[l.id].passed).length;
                  return (
                    <section className="lesson-stage" key={stage} aria-labelledby={'lesson-stage-' + stage}>
                      <div className="lesson-stage-head">
                        <div>
                          <span className="lesson-stage-code">{stage}</span>
                          <h3 id={'lesson-stage-' + stage}>{AGE_FOR[stage] || stage}</h3>
                        </div>
                        <span>{stageDone} of {stageLessons.length} complete</span>
                      </div>
                      <div className="lesson-grid">
                        {stageLessons.map((lesson, index) => {
                          const result = lessonResults[lesson.id];
                          const isCurrent = currentLessonId === lesson.id;
                          return (
                            <button type="button" key={lesson.id}
                              className={'lesson-tile' + (isCurrent ? ' current' : '') + (result && result.passed ? ' complete' : '')}
                              aria-label={(result && result.passed ? 'Completed lesson: ' : result ? 'Continue lesson: ' : 'Open lesson: ') + lesson.title
                                + (result ? ', ' + (result.passed ? 'passed' : 'not passed yet') + ', latest score ' + result.score + ' out of 100, ' + result.attempts + (result.attempts === 1 ? ' attempt' : ' attempts') : '')}
                              onClick={() => loadLesson(lesson)}>
                              <span className="lesson-tile-number">{String(index + 1).padStart(2, '0')}</span>
                              <span className="lesson-tile-copy">
                                <strong>{lesson.title}</strong>
                                <span>{(lesson.intro || 'Program the robot and test your solution in the simulated world.').trim()}</span>
                                <small>{(lesson.terrain || 'earth').replace(/^./, c => c.toUpperCase())} world{lesson.readingAge ? ' · Reading age ' + lesson.readingAge + '+' : ''}</small>
                              </span>
                              <span className={'lesson-tile-status' + (result && result.passed ? ' done' : '')}>
                                {result ? (result.passed ? '✓ Complete' : 'Not yet · ' + result.score + '/100') : 'Start'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
              <div className="lesson-hub-foot">
                <span>{KI('shield')} Progress is calculated only from graded attempts saved on this device.</span>
                <button className="btn-mini" onClick={() => { setLessonHubOpen(false); setMode('studio'); setActiveStage('prove'); }}>Return to Studio</button>
              </div>
            </div>
          </div>
        )}

        {robotLabOpen && RobotLab && (
          <RobotLab onClose={() => { setRobotLabOpen(false); setActiveStage('prove'); }} onBuildReal={() => goStage('build')} />
        )}

        {memoryOpen && <window.KodroPanels.MemoryModal setMemoryOpen={setMemoryOpen} memTick={memTick} code={code} terrain={terrain} robotSpec={robotSpec} currentLessonId={currentLessonId} setLessonBuffers={setLessonBuffers} setPrograms={setPrograms} activeTab={activeTab} applyCode={applyProgramText} />}

        {reviewOpen && <window.KodroPanels.ReviewModal reviewBusy={reviewBusy} setReviewOpen={setReviewOpen} reviewErr={reviewErr} reviewData={reviewData} applyReview={applyReview} />}

        {realismOpen && window.KodroRealism && React.createElement(window.KodroRealism, { onClose: () => setRealismOpen(false), terrain: terrain, code: code })}
        {demoOpen && window.KodroDemo && React.createElement(window.KodroDemo, { onClose: () => setDemoOpen(false) })}
        {vibeOpen && <window.KodroPanels.VibeModal setVibeOpen={setVibeOpen} vibeCancelRef={vibeCancelRef} setVibeBusy={setVibeBusy} aiInfo={aiInfo} pickModel={pickModel} refreshAiStatus={refreshAiStatus} vibeMsgs={vibeMsgs} setVibeMsgs={setVibeMsgs} vibeApply={vibeApply} vibeBusy={vibeBusy} vibeLive={vibeLive} vibeEndRef={vibeEndRef} vibeError={vibeError} vibePrompt={vibePrompt} setVibePrompt={setVibePrompt} vibeSend={vibeSend} vibeClear={vibeClear} vibeContext={(window.KodroMemory && window.KodroMemory.lessonFor) ? window.KodroMemory.lessonFor(terrain.id) : null} onExplain={() => { setVibeOpen(false); setAskData(null); setAskOpen(true); }} onReview={() => { setVibeOpen(false); runReview(); }} />}

        {blocksOpen && <window.KodroPanels.BlocksModal setBlocksOpen={setBlocksOpen} BLOCK_DEFS={BLOCK_DEFS} robotSpec={robotSpec} addBlock={addBlock} endBlock={endBlock} blockIndent={blockIndent} setBlockIndent={setBlockIndent} blocks={blocks} setBlocks={setBlocks} moveBlock={moveBlock} canMoveBlock={canMoveBlock} removeBlock={removeBlock} insertBlocksCode={insertBlocksCode} classroom={classroom} />}

        {showHelp && <window.KodroPanels.HelpModal onClose={() => setShowHelp(false)} />}

        {/* One evidence-bounded Build surface in desktop and browser. The older
            local-model budget/price planner remains a compatibility API only;
            it is not a purchasing surface because it has no live supplier,
            compatibility or electrical-safety evidence. */}
        {buildOpen && (
            <div className="modal-backdrop" onClick={() => { setBuildOpen(false); setActiveStage('prove'); }}>
              <div className="modal modal-wide browser-build-modal" role="dialog" aria-modal="true" aria-label="Build a real robot" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                  <span className="eyebrow" role="heading" aria-level="2">{KI('build')}Build · prepare a responsible first prototype</span>
                  <button className="btn-mini" aria-label="Close" onClick={() => { setBuildOpen(false); setActiveStage('prove'); }}>✕</button>
                </div>
                <div className="build-body browser-build-body">
                  <div className="browser-build-intro">
                    <div>
                      <span className="eyebrow">Active design</span>
                      <h2>{chipName}</h2>
                      <p>Kodro can prepare a concept bill of materials and simulation record here in the free browser app. It will not invent live prices, electrical compatibility or a safe wiring plan.</p>
                    </div>
                    <button className="ctrl ctrl-run" onClick={downloadPrototypeBrief}>Download prototype brief</button>
                  </div>
                  <div className="build-readiness" aria-label="Prototype brief readiness">
                    <div><strong>{browserBuildParts.length}</strong><span>design requirements captured</span></div>
                    <div><strong>{browserRunCount}</strong><span>runs recorded for this exact design</span></div>
                    <div><strong>4</strong><span>checks required before power-on</span></div>
                  </div>
                  <div className="browser-build-grid">
                    <section>
                      <div className="eyebrow">Concept bill of materials</div>
                      <table className="build-table browser-bom">
                        <thead><tr><th scope="col">Requirement</th><th scope="col">Evidence</th></tr></thead>
                        <tbody>{browserBuildParts.map(function (p) { return <tr key={p.id}><td>{p.name}</td><td className="role">{p.role}</td></tr>; })}</tbody>
                      </table>
                      <p className="build-note">These are design requirements from your active Kodro robot, not supplier-selected products. Exact voltage, current, dimensions, logic levels, connectors, stock and price are not verified.</p>
                    </section>
                    <section className="build-boundary">
                      <div className="eyebrow">Evidence boundary</div>
                      <div className="build-evidence-row is-known"><b>Verified by Kodro</b><span>Selected controller and capabilities, command availability, saved run outcomes and the simulator's disclosed first-order calculations.</span></div>
                      <div className="build-evidence-row is-suggested"><b>Ready to export</b><span>A local HTML brief containing this concept, recent run evidence, uncertainty and a safe prototype sequence.</span></div>
                      <div className="build-evidence-row is-unverified"><b>Verify before purchasing</b><span>Motor driver current, battery chemistry and protection, voltage and logic compatibility, wiring, mechanical fit, price, stock and supplier quality.</span></div>
                      <div className="browser-build-actions">
                        <button className="btn-mini" onClick={() => goStage('design')}>Back to Design</button>
                        <button className="btn-mini" onClick={() => goStage('prove')}>Run more tests</button>
                      </div>
                    </section>
                  </div>
                   <p className="browser-build-desktop">Optional local AI can explain the design and help draft programs. Purchasing advice remains unavailable until Kodro has source-backed supplier research and deterministic electrical checks.</p>
                </div>
              </div>
            </div>
          )}

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

        {/* The front door. Shown automatically on a first visit and reopenable
            from the Home control, so it is somewhere you can go back to rather
            than a wizard you dismiss once. It answers what this is, what to
            press first, and what you could make, then offers three doors. */}
        {(homeOpen || !onboarded) && window.KodroHome && (
          <window.KodroHome
            canClose={onboarded}
            onClose={() => setHomeOpen(false)}
            onLessons={() => { closeHome(); openLessonLibrary(); }}
            onDesign={() => { closeHome(); goStage('design'); }}
            onFreePlay={() => { closeHome(); setMode('studio'); setCurrentLessonId(null); clearLessonWorld(); goStage('prove'); }}
          />
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
