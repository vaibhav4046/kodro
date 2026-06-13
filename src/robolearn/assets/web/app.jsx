/* ============================================================================
   ORBITAL ROVER — App (runtime + UI wiring)
   ========================================================================== */
(function () {
  const { useState, useRef, useEffect, useCallback } = React;
  const TERRAINS = window.TERRAINS;
  const WALL = TERRAINS.WALL;
  const R = 30; // rover collision radius (cm)
  // Live check (re-evaluated per move) so toggling the OS setting takes effect.
  const PREFERS_REDUCED_MOTION = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  // ---------------- example programs ----------------
  const EXAMPLES = {
    basecamp: {
      label: 'basecamp.py',
      code: `# BASE CAMP - your code BUILDS the world.
# place(kind) plants a prop right where the rover stands:
# "flag", "beacon", "person", "tree", "rock", "crate".
set_speed(80)
pen_down()
say("Building base camp")

# Mark the centre of camp with a beacon.
place("beacon")

# Drive a square and drop a crate at every corner.
for corner in range(4):
    move_forward(2)
    place("crate")
    turn_right(90)

# Plant a flag line out front.
turn_right(45)
for i in range(3):
    move_forward(1.2)
    place("flag")

# The crew arrives.
move_forward(1.5)
place("person")
turn_left(90)
move_forward(1)
place("person")

# A bit of landscaping.
turn_left(135)
move_forward(2.5)
place("tree")
move_forward(1)
place("rock")

led("green")
say("Camp ready!")
print("Base camp built: 1 beacon, 4 crates, 3 flags, 2 crew, 1 tree, 1 rock")`
    },
    autopilot: {
      label: 'autopilot.py',
      code: `# AUTOPILOT - the rover drives itself, like a self-driving car.
# Every step it reads its lidar. It ONLY moves forward when the way
# is clear, so it can never hit a boulder OR the arena wall. When
# something looms it scans, probes left + right, and steers toward
# the side with more room. Pure sense-think-act. Press Run and watch.
rover.set_speed(72)
rover.pen_down()
rover.led("cyan")
rover.say("Autopilot engaged")

legs = 0
dodges = 0
scans = 0
steps = 0

# Self-drive: it only moves forward when the lidar says the way is clear,
# so it can never hit a boulder OR the arena wall. Whenever something looms
# it scans, probes left + right, and steers toward the side with more room -
# so it roams the whole field, dodging as it goes. Always terminates.
while legs < 60 and steps < 220:
    steps = steps + 1
    ahead = rover.distance()

    if ahead < 150:
        # Boulder or wall ahead: scan, sense both sides, steer clear.
        rover.led("amber")
        rover.scan()
        scans = scans + 1
        rover.turn_left(60)
        left = rover.distance()
        rover.turn_right(120)
        right = rover.distance()
        if left > right:
            rover.turn_left(150)
        else:
            rover.turn_left(25)
        dodges = dodges + 1
        rover.led("cyan")
    else:
        rover.forward(40)
        legs = legs + 1

rover.led("green")
rover.say("Area mapped")
print("Legs driven:", legs)
print("Boulders dodged:", dodges)
print("Lidar scans:", scans)`
    },
    drive: {
      label: 'starter.py',
      code: `# Welcome to Orbital Rover.
# Edit freely, then press Run. The API is listed below.
rover.set_speed(60)
rover.pen_down()

rover.forward(200)
rover.turn_left(90)
rover.forward(140)
rover.say("Hello, terrain")`
    },
    square: {
      label: 'square.py',
      code: `# A for-loop draws a square. Change the 4 or the 300.
rover.pen_down()
rover.set_speed(75)

for side in range(4):
    rover.forward(300)
    rover.turn_right(90)

print("Square complete.")`
    },
    spiral: {
      label: 'spiral.py',
      code: `# Variables + loops make an expanding spiral.
rover.pen_down()
rover.set_speed(85)

step = 40
for i in range(20):
    rover.forward(step)
    rover.turn_right(42)
    step = step + 20

print("Drew", i + 1, "segments.")`
    },
    avoid: {
      label: 'avoid.py',
      code: `# Obstacle avoidance: read the lidar, branch with if/else.
rover.set_speed(80)
rover.pen_down()

trips = 0
while trips < 30:
    front = rover.distance()
    if front < 150:
        rover.turn_right(55)
    else:
        rover.forward(80)
    trips = trips + 1

print("Finished after", trips, "moves.")`
    },
    survey: {
      label: 'survey.py',
      code: `# Sensors + conditionals: profile the environment.
rover.led("amber")
rover.scan()

g = rover.gravity()
t = rover.temperature()
print("Gravity:", g, "m/s^2")
print("Temperature:", t, "C")

if g < 4:
    print("Low gravity. Momentum carries far.")
else:
    print("Standard footing.")

rover.led("green")
rover.forward(240)
rover.say("Survey done")`
    }
  };

  const LED_COLORS = { red: '#d06a6a', amber: '#e0b45c', green: '#7cc49b', cyan: '#5ce0d8', blue: '#aeb8e8', white: '#f5f0e4', off: null };

  // ---------------- icons ----------------
  const I = {
    play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
    pause: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>,
    step: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5v14M9 12h11M16 7l5 5-5 5" /></svg>,
    reset: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12a8 8 0 108-8M4 12V6M4 12h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  };

  function App() {
    const [terrainId, setTerrainId] = useState(() => localStorage.getItem('or_terrain') || 'mars');
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('or_tab') || 'autopilot');
    const [programs, setPrograms] = useState(() => {
      try { const s = JSON.parse(localStorage.getItem('or_programs')); if (s) return s; } catch (e) {}
      const o = {}; Object.keys(EXAMPLES).forEach(k => o[k] = EXAMPLES[k].code); return o;
    });
    const [runState, setRunState] = useState('idle');
    const [activeLine, setActiveLine] = useState(0);
    const [consoleLines, setConsoleLines] = useState([{ type: 'sys', text: 'Orbital Rover ready. Press Run to deploy.' }]);
    const [speedMul, setSpeedMul] = useState(1);
    const [say, setSay] = useState('');
    const [crashKey, setCrashKey] = useState(0);
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const [cam, setCam] = useState({ tilt: 46, yaw: -8, zoom: 1 });
    const zoom = cam.zoom;
    const trailColor = t.trail === 'cyan' ? '#5ce0d8' : t.trail === 'amber' ? '#e0b45c' : t.trail === 'white' ? '#f5f0e4' : null;

    // terrainId may be a base terrain OR a real-world mission site id.
    const terrain = window.resolveSite ? window.resolveSite(terrainId) : TERRAINS[terrainId];

    // live rover state (authoritative for sensors/animation)
    const startState = () => ({ x: 0, y: 0, heading: 0, speed: 50, battery: 100, moving: false, led: null, scanning: false, penDown: false });
    const live = useRef(startState());
    const [rover, setRover] = useState(() => ({ ...live.current }));
    const trailRef = useRef([]);            // array of segments; each = [{x,y}]
    const [trail, setTrail] = useState([]);
    const odoRef = useRef(0);
    const [odo, setOdo] = useState(0);
    const sensorRef = useRef(600);
    const [sensorDist, setSensorDist] = useState(600);

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
      : programs[activeTab];
    // Dyslexia-friendly / larger reading text toggle (QA re-score rank 4).
    const [readable, setReadable] = useState(() => localStorage.getItem('or_readable') === '1');
    const [muted, setMuted] = useState(() => localStorage.getItem('or_muted') === '1');
    // Visual theme. 'dark' is the default mission-control look; the rest are
    // full repaints driven by [data-theme] CSS variable swaps in styles.css.
    const [theme, setTheme] = useState(() => localStorage.getItem('or_theme') || 'dark');
    const [showHelp, setShowHelp] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Budget robot builder (local AI hardware guide for a real-world rover).
    const [buildOpen, setBuildOpen] = useState(false);
    const [buildBudget, setBuildBudget] = useState('30');
    const [buildGoal, setBuildGoal] = useState('');
    const [buildBusy, setBuildBusy] = useState(false);
    const [buildPlan, setBuildPlan] = useState(null);
    const [buildErr, setBuildErr] = useState(null);
    async function runBuild() {
      if (buildBusy) return;
      const usd = Math.max(1, Math.min(100000, parseFloat(buildBudget) || 30));
      setBuildBusy(true); setBuildErr(null);
      try {
        if (!window.RoboLearn || !window.RoboLearn.isAvailable()) { setBuildErr('The robot builder needs the desktop app with local AI.'); }
        else {
          const r = await window.RoboLearn.budgetBuild(usd, buildGoal);
          if (r && r.ok) setBuildPlan(r);
          else setBuildErr((r && r.reason) || 'Could not build a plan.');
        }
      } catch (e) { setBuildErr(String(e)); }
      setBuildBusy(false);
    }
    // Click-away + Escape close the settings popover.
    useEffect(() => {
      if (!settingsOpen) return undefined;
      const close = (e) => { if (!e.target.closest || !e.target.closest('.settings-wrap')) setSettingsOpen(false); };
      const key = (e) => { if (e.key === 'Escape') setSettingsOpen(false); };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', key);
      return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
    }, [settingsOpen]);

    // --- AI vibe coding (local Ollama: Qwen/Gemma; graceful when absent) ---
    const [aiInfo, setAiInfo] = useState({ available: false, model: null });
    const [vibeOpen, setVibeOpen] = useState(false);
    // Second-agent code review (propose-then-critique on the local model).
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewData, setReviewData] = useState(null);
    const [reviewErr, setReviewErr] = useState(null);
    const [vibePrompt, setVibePrompt] = useState('');
    const [vibeBusy, setVibeBusy] = useState(false);
    const [vibeError, setVibeError] = useState(null);
    // The pywebview bridge injects asynchronously AFTER React mounts, so a
    // one-shot check at mount races it and can leave the panel "offline"
    // forever. Poll briefly at mount, and re-check every time the panel is
    // opened -- so starting Ollama later lights it up without a restart.
    function refreshAiStatus() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.aiStatus().then(s => { if (s) setAiInfo(s); }).catch(() => {});
    }
    useEffect(() => {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (window.RoboLearn && window.RoboLearn.isAvailable()) { refreshAiStatus(); clearInterval(t); }
        else if (tries > 20) clearInterval(t);
      }, 500);
      return () => clearInterval(t);
    }, []);
    useEffect(() => { if (vibeOpen) refreshAiStatus(); }, [vibeOpen]);
    // Chat thread: [{role:'user'|'ai', kind:'text'|'code', text}]
    const [vibeMsgs, setVibeMsgs] = useState([]);
    const [micBusy, setMicBusy] = useState(false);
    const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('or_voice') || 'female');
    useEffect(() => { try { localStorage.setItem('or_voice', voiceGender); } catch (e) { void e; } }, [voiceGender]);
    const vibeEndRef = useRef(null);
    useEffect(() => { if (vibeEndRef.current) vibeEndRef.current.scrollIntoView({ block: 'end' }); }, [vibeMsgs, vibeBusy]);

    // Streamed reply: start a job, poll ~4x/s, and show the model's text live
    // in the thread while it thinks (the response feels instant instead of a
    // long opaque spinner).
    const [vibeLive, setVibeLive] = useState('');
    async function vibeSend() {
      const text = vibePrompt.trim();
      if (vibeBusy || !text) return;
      const next = [...vibeMsgs, { role: 'user', kind: 'text', text }];
      setVibeMsgs(next); setVibePrompt(''); setVibeBusy(true); setVibeError(null); setVibeLive('');
      try {
        const history = next.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));
        const start = await window.RoboLearn.aiChatStart(history, currentLessonIdRef.current);
        if (!start || !start.ok) { setVibeError((start && start.reason) || 'AI unavailable.'); setVibeBusy(false); return; }
        let r = null;
        for (;;) {
          await new Promise(res => setTimeout(res, 250));
          const p = await window.RoboLearn.aiChatPoll(start.jobId);
          if (!p || !p.ok) { r = p; break; }
          if (p.done) { r = p; break; }
          setVibeLive(p.text || '');
        }
        setVibeLive('');
        if (r && r.ok && r.type === 'question') {
          setVibeMsgs(m => [...m, { role: 'ai', kind: 'text', text: r.text }]);
          if (!muted) window.RoboLearn.speak(r.text, voiceGender);
        } else if (r && r.ok && r.type === 'code') {
          setVibeMsgs(m => [...m, { role: 'ai', kind: 'code', text: r.code, model: r.model }]);
        } else {
          setVibeError((r && r.reason) || 'Generation failed.');
        }
      } catch (e) { setVibeError(String(e)); }
      setVibeBusy(false);
    }

    function vibeApply(code, model) {
      setVibeOpen(false);
      addConsole('AI (' + (model || aiInfo.model) + ') wrote a program. Read it, then press Run.', 'sys');
      typewriteCode(code);
    }

    async function runReview() {
      if (reviewBusy) return;
      const src = (code || '').trim();
      if (!src) { setReviewErr('Write some code first, then ask for a review.'); setReviewOpen(true); return; }
      setReviewOpen(true); setReviewBusy(true); setReviewErr(null); setReviewData(null);
      try {
        const r = await window.RoboLearn.aiReviewCode(src, currentLessonId || null);
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
      }
    }

    async function vibeMic() {
      if (micBusy) return;
      setMicBusy(true); setVibeError(null);
      try {
        const r = await window.RoboLearn.listen(6);
        if (r && r.ok) setVibePrompt(p => (p ? p + ' ' : '') + r.text);
        else setVibeError((r && r.reason) || 'Voice input failed.');
      } catch (e) { setVibeError(String(e)); }
      setMicBusy(false);
    }

    // Typewriter: animate code into the active editor buffer like live typing.
    const typeRef = useRef(null);
    function typewriteCode(codeText) {
      if (typeRef.current) { clearInterval(typeRef.current); typeRef.current = null; }
      const lessonId = currentLessonIdRef.current;
      const setCode = (v) => {
        if (lessonId) setLessonBuffers(b => ({ ...b, [lessonId]: v }));
        else setPrograms(p => ({ ...p, [activeTab]: v }));
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

    // --- Scratch-style blocks mode -----------------------------------------
    const BLOCK_DEFS = [
      { k: 'forward', label: 'move forward', unit: 'm', val: 2, code: v => 'move_forward(' + v + ')', color: 'var(--cyan)' },
      { k: 'back', label: 'move backward', unit: 'm', val: 1, code: v => 'move_backward(' + v + ')', color: 'var(--cyan)' },
      { k: 'left', label: 'turn left', unit: '°', val: 90, code: v => 'turn_left(' + v + ')', color: 'var(--warning)' },
      { k: 'right', label: 'turn right', unit: '°', val: 90, code: v => 'turn_right(' + v + ')', color: 'var(--warning)' },
      { k: 'beep', label: 'beep', code: () => 'beep(1)', color: 'var(--brass)' },
      { k: 'say', label: 'say hello', code: () => 'say("hello")', color: 'var(--brass)' },
      { k: 'led', label: 'LED cyan', code: () => 'led("cyan")', color: 'var(--brass)' },
      { k: 'scan', label: 'scan', code: () => 'scan()', color: 'var(--success)' },
      { k: 'collect', label: 'collect sample', code: () => 'collect_sample()', color: 'var(--success)' },
      { k: 'repeat', label: 'repeat', unit: '×', val: 4, container: true, code: v => 'for i in range(' + v + '):', color: 'var(--mars)' },
      { k: 'ifobs', label: 'if obstacle ahead', container: true, code: () => 'if obstacle_ahead():', color: 'var(--mars)' },
    ];
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
    function toggleSound() {
      setMuted(m => { const next = !m; if (window.RLSound) window.RLSound.setMuted(next); return next; });
    }
    useEffect(() => {
      document.body.classList.toggle('a11y-readable', readable);
      try { localStorage.setItem('or_readable', readable ? '1' : '0'); } catch (e) { void e; }
    }, [readable]);
    const currentLessonIdRef = useRef(null);
    useEffect(() => { currentLessonIdRef.current = currentLessonId; }, [currentLessonId]);
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
        if (r.passed) { sfx('pass'); celebrate(); } else { sfx('fail'); }
        const tag = r.passed ? 'ok' : 'err';
        setConsoleLines(l => {
          const lines = [...l, { type: tag, text: (r.passed ? '✓ PASS' : '✗ NOT YET') + '  Score: ' + r.score + '/100' }];
          if (!r.passed && Array.isArray(r.reasons)) r.reasons.forEach(reason => lines.push({ type: 'err', text: '  · ' + reason }));
          if (r.hint && r.hint.message) lines.push({ type: 'sys', text: '💡 Hint: ' + r.hint.message });
          if (Array.isArray(r.achievements)) r.achievements.forEach(a => lines.push({ type: 'ok', text: (a.icon || '🏅') + ' Achievement unlocked: ' + a.title }));
          if (r.recommended && r.recommended.id) lines.push({ type: 'sys', text: '👉 Recommended next: ' + r.recommended.id + ' — ' + r.recommended.title });
          return lines;
        });
      } catch (err) {
        setConsoleLines(l => [...l, { type: 'err', text: 'Bridge error: ' + err }]);
      }
    }

    // `token` is a monotonic run id: every reset/start/resume bumps it, so a
    // stale pump loop or a pending start setTimeout that fires after a Reset is
    // ignored. `advancing` is a synchronous single-flight latch so two advance()
    // calls can never overlap (a pump step racing a manual Step). `startTimer`
    // and `abortTimer` hold the deferred-start / abort-clear handles so any new
    // control action can cancel them. Together these fix the Run/Step/Reset
    // mash races (QA adv5).
    const ctrl = useRef({ running: false, abort: false, advancing: false, token: 0, startTimer: null, abortTimer: null });
    const genRef = useRef(null);
    const sayTimer = useRef(null);

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

    const sync = () => { setRover({ ...live.current }); };
    const pushTrailPoint = () => {
      if (!live.current.penDown) return;
      const segs = trailRef.current;
      if (!segs.length) return;
      const seg = segs[segs.length - 1];
      const last = seg[seg.length - 1];
      const x = live.current.x, y = live.current.y;
      // Decimate (skip points <6cm from the last) + cap, so a long run can't
      // grow the trail unboundedly or rebuild a huge SVG path each frame
      // (QA re-score rank 8 performance).
      if (last && Math.abs(x - last.x) < 6 && Math.abs(y - last.y) < 6) return;
      if (seg.length > 1500) return;
      seg.push({ x, y });
    };

    function addConsole(text, type) {
      const ts = new Date();
      const hh = String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0') + ':' + String(ts.getSeconds()).padStart(2, '0');
      setConsoleLines(l => [...l, { type: type || 'out', text, ts: hh }]);
    }

    // Fire a synthesised sound cue (no-op if sound.js absent or muted).
    function sfx(kind) { try { if (window.RLSound) window.RLSound.play(kind); } catch (e) { void e; } }

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
    function collisionAt(x, y) {
      if (Math.abs(x) > WALL - R || Math.abs(y) > WALL - R) return { type: 'wall' };
      for (const o of terrain.obstacles) {
        if (Math.hypot(o.x - x, o.y - y) < o.r + R) return { type: 'obstacle', o };
      }
      return null;
    }
    function rayDistance(x, y, headingDeg) {
      const a = headingDeg * Math.PI / 180;
      const dx = Math.sin(a), dy = -Math.cos(a);
      let best = Infinity;
      // walls (square at ±(WALL-R))
      const lim = WALL - R;
      if (dx > 1e-6) best = Math.min(best, (lim - x) / dx);
      if (dx < -1e-6) best = Math.min(best, (-lim - x) / dx);
      if (dy > 1e-6) best = Math.min(best, (lim - y) / dy);
      if (dy < -1e-6) best = Math.min(best, (-lim - y) / dy);
      // obstacles (ray-circle)
      for (const o of terrain.obstacles) {
        const ox = o.x - x, oy = o.y - y;
        const tca = ox * dx + oy * dy;
        if (tca < 0) continue;
        const d2 = ox * ox + oy * oy - tca * tca;
        const rr = (o.r + R) * (o.r + R);
        if (d2 > rr) continue;
        const t = tca - Math.sqrt(rr - d2);
        if (t > 0) best = Math.min(best, t);
      }
      return Math.max(0, best);
    }
    const host = {
      sensor(name, args) {
        const s = live.current;
        switch (name) {
          case 'distance': { const d = Math.round(rayDistance(s.x, s.y, s.heading)); sensorRef.current = d; setSensorDist(d); return d; }
          case 'heading': return Math.round(((s.heading % 360) + 360) % 360);
          case 'battery': return Math.round(s.battery);
          case 'speed': return Math.round(s.speed);
          case 'x': return Math.round(s.x);
          case 'y': return Math.round(-s.y);
          case 'tilt': return Math.round((Math.sin(s.x * 0.01) * 6 + Math.cos(s.y * 0.013) * 5) * 10) / 10;
          case 'temperature': return terrain.env.temp;
          case 'gravity': return terrain.env.gravity;
          case 'light': return terrain.env.light;
          case 'ground': return terrain.id;
          default: return 0;
        }
      }
    };

    // ---------- animation primitives ----------
    // Driven by setTimeout (not rAF) so logic still advances when the iframe is
    // backgrounded; ~16ms cadence gives ~60fps while visible.
    function frames(durationMs, onFrame) {
      return new Promise(resolve => {
        // Respect prefers-reduced-motion: snap straight to the final position
        // (p=1) with no interpolation, so the rover teleports rather than
        // animating (WCAG 2.3.3, vestibular safety).
        if (PREFERS_REDUCED_MOTION()) {
          // Snap with NO animation, but still sample the swept path so a
          // boulder/wall mid-route halts the rover instead of being tunnelled
          // through (the collision check lives in onFrame). QA rank 4.
          for (const p of [0.25, 0.5, 0.75, 1]) { if (onFrame(p)) break; }
          resolve('done'); return;
        }
        const start = performance.now();
        const tick = () => {
          if (ctrl.current.abort) { resolve('abort'); return; }
          // Non-finite / <=0 duration completes immediately (p=1); this guards
          // against a pathological value wedging the loop at p=0 forever.
          const p = window.RoverLang.frameProgress(performance.now() - start, durationMs);
          const stop = onFrame(p);
          if (p >= 1 || stop) { resolve('done'); return; }
          setTimeout(tick, 16);
        };
        tick();
      });
    }
    const delay = (ms) => new Promise(res => {
      if (ms <= 0) return res();
      const start = performance.now();
      const tick = () => { if (ctrl.current.abort || performance.now() - start >= ms) res(); else setTimeout(tick, 16); };
      setTimeout(tick, 16);
    });

    async function animateMove(ev) {
      const s = live.current;
      const myToken = ctrl.current.token;  // run epoch captured at move start
      const a = s.heading * Math.PI / 180;
      const dirx = Math.sin(a) * ev.dir, diry = -Math.cos(a) * ev.dir;
      const total = ev.distance;
      const x0 = s.x, y0 = s.y;
      const sp = Math.max(8, s.speed);
      // 0.32s per (cm/speed); lower-traction terrain drives a little slower.
      const dur = (total / sp) * 1000 * 0.32 / (terrain.traction * speedMulRef.current);
      // Real physics: heavier worlds drain the battery faster, lighter worlds
      // less (Moon ~0.58x Earth) -- pupils can measure the difference.
      const gFac = 0.5 + 0.5 * ((terrain.env.gravity || 9.81) / 9.81);
      s.moving = true;
      // new trail segment if pen down
      if (s.penDown) { trailRef.current.push([{ x: x0, y: y0 }]); setTrail([...trailRef.current]); }
      // Battery drains smoothly across the move (was a no-op: subtracted 0).
      const b0 = s.battery;
      const drainFull = total * 0.011 * gFac / terrain.traction;
      let crashed = false;
      await frames(dur, (p) => {
        const nx = x0 + dirx * total * p;
        const ny = y0 + diry * total * p;
        const hit = collisionAt(nx, ny);
        if (hit) {
          crashed = hit;
          return true; // stop frame loop, keep last safe pos
        }
        s.x = nx; s.y = ny;
        s.battery = Math.max(0, b0 - drainFull * p);
        pushTrailPoint();
        setSensorDist(Math.round(rayDistance(s.x, s.y, s.heading)));
        sync();
        return false;
      });
      // A Reset/restart while this move was animating bumps the token: bail
      // before touching the shared odometer or halting, so a stale in-flight
      // move can't corrupt the fresh run (phantom odometer add, or a spurious
      // 'error' state stomped over the Reset the user just pressed).
      if (ctrl.current.token !== myToken) { s.moving = false; return false; }
      // Settle battery on the distance actually travelled (handles a crash
      // that stopped the move early), relative to the pre-move level b0.
      const travelled = Math.hypot(s.x - x0, s.y - y0);
      s.battery = Math.max(0, b0 - travelled * 0.011 * gFac / terrain.traction);
      odoRef.current += travelled; setOdo(odoRef.current);
      s.moving = false; sync();
      if (crashed) {
        setCrashKey(k => k + 1);
        const what = crashed.type === 'wall' ? 'arena boundary' : terrain.obstacleLabel.toLowerCase();
        sfx('crash');
        addConsole('Collision with ' + what + ' at (' + Math.round(s.x) + ', ' + Math.round(-s.y) + '). Rover halted.', 'err');
        haltProgram('error');
        return false;
      }
      return true;
    }

    async function animateTurn(ev) {
      const s = live.current;
      const myToken = ctrl.current.token;  // run epoch captured at turn start
      const h0 = s.heading;
      const dur = (Math.abs(ev.deg) / 180) * 650 / speedMulRef.current;
      s.moving = true;
      await frames(dur, (p) => { s.heading = h0 + ev.deg * p; setSensorDist(Math.round(rayDistance(s.x, s.y, s.heading))); sync(); return false; });
      if (ctrl.current.token !== myToken) { s.moving = false; return false; }  // superseded by Reset/restart
      s.heading = h0 + ev.deg; s.moving = false;
      s.battery = Math.max(0, s.battery - Math.abs(ev.deg) * 0.004);
      sync();
      return true;
    }

    // speedMul ref so animation reads latest
    const speedMulRef = useRef(1);
    useEffect(() => { speedMulRef.current = speedMul; }, [speedMul]);

    function showSay(text) {
      setSay(text);
      if (sayTimer.current) clearTimeout(sayTimer.current);
      sayTimer.current = setTimeout(() => setSay(''), 2200);
    }

    // ---------- one interpreter step ----------
    // `advancing` is a synchronous re-entrancy latch: a pump iteration and a
    // manual Step (or two Steps) must never drive the same generator at once,
    // or they double-consume gen.next() and run overlapping animations that
    // stomp live.current. The latch wraps the whole body (incl. the awaited
    // animation) so the next driver bails until this one settles.
    async function advance(stepMode) {
      if (ctrl.current.advancing) return false;
      ctrl.current.advancing = true;
      try {
        const gen = genRef.current;
        if (!gen) return false;
        let res;
        try { res = gen.next(); }
        catch (e) { handleRuntimeError(e); return false; }
        if (res.done) { finishProgram(); return false; }
        const ev = res.value;
        if (ev.line) setActiveLine(ev.line);
        switch (ev.type) {
          case 'step': await delay(stepMode ? 0 : 70 / speedMulRef.current); break;
          case 'print': addConsole(ev.text, 'out'); await delay(stepMode ? 0 : 90 / speedMulRef.current); break;
          case 'move': sfx('move'); return await animateMove(ev);
          case 'turn': sfx('turn'); return await animateTurn(ev);
          case 'speed': live.current.speed = Math.max(0, Math.min(100, ev.value)); sync(); break;
          case 'wait': await delay(ev.seconds * 1000 / speedMulRef.current); break;
          case 'pen':
            live.current.penDown = ev.down;
            if (ev.down) { trailRef.current.push([{ x: live.current.x, y: live.current.y }]); setTrail([...trailRef.current]); }
            break;
          case 'halt': live.current.moving = false; sync(); break;
          case 'led': sfx('led'); live.current.led = (ev.color in LED_COLORS) ? LED_COLORS[ev.color] : terrain.accent; sync(); break;
          case 'say':
            sfx('say');
            // Rover speaks aloud with the OS's offline TTS voice (Windows
            // SAPI via the bridge); silent in browser preview or when muted.
            if (window.RoboLearn && window.RoboLearn.isAvailable()
                && (!window.RLSound || !window.RLSound.isMuted())) {
              window.RoboLearn.speak(ev.text, voiceGender);
            }
            showSay(ev.text); await delay(stepMode ? 0 : 200 / speedMulRef.current); break;
          case 'place': {
            const px = ev.x !== undefined ? ev.x : live.current.x;
            const py = ev.y !== undefined ? ev.y : live.current.y;
            sfx('led');
            setProps(p => p.length >= 80 ? p : [...p, { kind: ev.kind, x: px, y: py, id: p.length }]);
            await delay(stepMode ? 0 : 160 / speedMulRef.current);
            break;
          }
          case 'clear_props': setProps([]); break;
          case 'scan':
            sfx('scan');
            live.current.scanning = true; sync();
            addConsole('Scanning. Nearest obstacle ' + Math.round(rayDistance(live.current.x, live.current.y, live.current.heading)) + ' cm ahead.', 'sys');
            await delay(1000 / speedMulRef.current);
            live.current.scanning = false; sync();
            break;
        }
        return true;
      } finally {
        ctrl.current.advancing = false;
      }
    }

    function handleRuntimeError(e) {
      const msg = (e && e.message) ? e.message : String(e);
      const line = e && e.line;
      if (line) setActiveLine(line);
      addConsole((line ? 'Line ' + line + ': ' : '') + msg, 'err');
      haltProgram('error');
    }
    function finishProgram() {
      ctrl.current.running = false;
      genRef.current = null;
      live.current.moving = false; sync();
      setRunState('done');
      if (replRef.current) { replRef.current = false; return; }  // terminal line: stay quiet
      addConsole('Program finished.', 'ok');
      // RoboLearn: if a lesson is loaded, grade the Run via the Python engine.
      gradeWithBridge(code);
    }

    // Live terminal: run ONE line immediately against the current world --
    // like a real Python REPL, without resetting the rover or grading.
    const replRef = useRef(false);
    function runReplLine(line) {
      const src = (line || '').trim();
      if (!src) return;
      if (window.RLSound) window.RLSound.resume();
      addConsole('>>> ' + src, 'sys');
      if (ctrl.current.running || ctrl.current.advancing) {
        addConsole('The program is still running - press Pause or Reset first.', 'err');
        return;
      }
      let gen;
      try { gen = window.RoverLang.compile(src).run(host); }
      catch (e) { addConsole(String((e && e.message) || e), 'err'); return; }
      replRef.current = true;
      genRef.current = gen;
      ctrl.current.token++;
      const myToken = ctrl.current.token;
      ctrl.current.abort = false; ctrl.current.running = true;
      setRunState('running');
      pumpLoop(myToken);
    }
    function haltProgram(state) {
      ctrl.current.running = false; ctrl.current.abort = false;
      genRef.current = null;
      live.current.moving = false; sync();
      setRunState(state || 'idle');
    }

    // ---------- compile + start ----------
    function compileFresh() {
      try {
        const interp = window.RoverLang.compile(code);
        genRef.current = interp.run(host);
        return true;
      } catch (e) {
        handleRuntimeError(e);
        genRef.current = null;
        return false;
      }
    }
    // Cancel any deferred start / abort-clear left over from a prior control
    // action so a queued Run can't fire after a Reset (the stale-callback race).
    function clearPending() {
      if (ctrl.current.startTimer) { clearTimeout(ctrl.current.startTimer); ctrl.current.startTimer = null; }
      if (ctrl.current.abortTimer) { clearTimeout(ctrl.current.abortTimer); ctrl.current.abortTimer = null; }
    }
    function resetRover(clearConsole) {
      clearPending();
      ctrl.current.abort = true;
      ctrl.current.running = false;
      ctrl.current.advancing = false;  // abandon any in-flight advance latch
      ctrl.current.token++;  // invalidate any in-flight pump / pending start
      live.current = startState();
      trailRef.current = []; setTrail([]);
      setProps([]);
      odoRef.current = 0; setOdo(0);
      sensorRef.current = 600; setSensorDist(600);
      setActiveLine(0);
      setSay('');
      sync();
      genRef.current = null;
      ctrl.current.abortTimer = setTimeout(() => { ctrl.current.abort = false; ctrl.current.abortTimer = null; }, 30);
      if (clearConsole) setConsoleLines([{ type: 'sys', text: 'Reset. Rover at origin.' }]);
    }

    async function pumpLoop(myToken) {
      while (ctrl.current.running && ctrl.current.token === myToken) {
        const cont = await advance(false);
        if (!cont) break;
      }
      if (ctrl.current.token !== myToken) return;  // superseded by a reset/restart/resume
      // The loop only exits with running=false. finish/halt null the generator
      // (and already set 'done'/'error'); a Reset bumps the token (returned just
      // above). So a still-live generator here means the user pressed Pause.
      // Do NOT also gate on runStateRef === 'running': the 'running' commit can
      // lag behind a fast Pause, which would drop the pause transition and then
      // wedge the UI in a phantom 'running' with no pump driving it.
      if (!ctrl.current.running && genRef.current) {
        setRunState('paused');
      }
    }

    function onRun() {
      // Resume the AudioContext here, inside the click gesture (browsers block
      // audio that starts outside a user gesture).
      if (window.RLSound) window.RLSound.resume();
      // Pause: gate on the synchronous ref, not the (stale until re-render)
      // runState closure, so a Run pressed right after a resume still pauses.
      if (ctrl.current.running) {
        ctrl.current.running = false;
        return;
      }
      // start fresh or resume
      if (runState === 'idle' || runState === 'done' || runState === 'error') {
        resetRover(false);
        const myToken = ctrl.current.token;  // captured after reset's bump
        // reset clears abort after 30ms; compile after
        ctrl.current.startTimer = setTimeout(() => {
          ctrl.current.startTimer = null;
          if (ctrl.current.token !== myToken) return;  // a Reset landed first
          if (!compileFresh()) return;
          ctrl.current.abort = false; ctrl.current.running = true;
          setRunState('running');
          addConsole('Deployed on ' + terrain.name + '.', 'sys');
          pumpLoop(myToken);
        }, 50);
      } else if (runState === 'paused') {
        // `runState` is a lagging closure: after a Reset/finish nulled the
        // generator it can still read 'paused' for a frame. Only a live
        // generator is actually resumable — resuming a null gen would spin a
        // pump that exits instantly yet leaves running=true, wedging the UI in
        // a phantom 'running'. genRef is the synchronous truth.
        if (!genRef.current) return;
        if (ctrl.current.running || ctrl.current.advancing) return;  // already running / mid-step
        ctrl.current.token++;  // new pump epoch: orphan any prior pump
        const myToken = ctrl.current.token;
        ctrl.current.abort = false; ctrl.current.running = true;
        setRunState('running');
        pumpLoop(myToken);
      }
    }

    function onStep() {
      // A Step while a pump is live pauses it (same as Run), gated on the
      // synchronous ref so it works in the gap before runState commits.
      if (ctrl.current.running) { ctrl.current.running = false; return; }
      if (ctrl.current.advancing) return;  // a step/animation is in flight: ignore
      if (runState === 'idle' || runState === 'done' || runState === 'error') {
        resetRover(false);
        const myToken = ctrl.current.token;
        ctrl.current.startTimer = setTimeout(() => {
          ctrl.current.startTimer = null;
          if (ctrl.current.token !== myToken) return;
          if (!compileFresh()) return;
          ctrl.current.abort = false;
          setRunState('paused');
          addConsole('Stepping through on ' + terrain.name + '.', 'sys');
          advance(true);
        }, 50);
      } else if (runState === 'paused') {
        if (!genRef.current) return;  // stale 'paused' after a Reset/finish: nothing to step
        ctrl.current.abort = false;
        advance(true);
      }
    }

    function onReset() { resetRover(true); setRunState('idle'); }

    function onTerrain(id) {
      if (id === terrainId) return;
      resetRover(false);
      setTerrainId(id);
      setRunState('idle');
      setLessonVerdict(null);  // verdict was graded on the lesson's own world
      setConsoleLines([{ type: 'sys', text: 'Switched to ' + TERRAINS[id].name + '. ' + TERRAINS[id].coord }]);
    }

    function onCodeChange(v) {
      if (currentLessonId) setLessonBuffers(b => ({ ...b, [currentLessonId]: v }));  // per-lesson buffer
      else setPrograms(p => ({ ...p, [activeTab]: v })); // edit the example tab
    }

    async function exportReportClick() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
        setConsoleLines(l => [...l, { type: 'warn', text: 'Report export needs the desktop app.' }]);
        return;
      }
      try {
        const r = await window.RoboLearn.exportReport();
        if (r && r.ok) {
          setConsoleLines(l => [...l, { type: 'ok', text: 'Progress report saved: ' + r.path }]);
        } else {
          setConsoleLines(l => [...l, { type: 'err', text: 'Report export failed: ' + ((r && r.reason) || 'unknown') }]);
        }
      } catch (e) {
        setConsoleLines(l => [...l, { type: 'err', text: 'Report export error: ' + e }]);
      }
    }

    // apply terrain accent to CSS var
    useEffect(() => {
      document.documentElement.style.setProperty('--terrain', terrain.accent);
    }, [terrainId]);

    // ---------- layout resizers ----------
    const [editorW, setEditorW] = useState(404);
    const [teleW, setTeleW] = useState(318);
    const [consoleH, setConsoleH] = useState(184);
    function startDrag(kind, e) {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const w0 = editorW, t0 = teleW, c0 = consoleH;
      const move = (ev) => {
        if (kind === 'editor') setEditorW(Math.max(280, Math.min(640, w0 + (ev.clientX - sx))));
        else if (kind === 'tele') setTeleW(Math.max(240, Math.min(460, t0 - (ev.clientX - sx))));
        else if (kind === 'console') setConsoleH(Math.max(90, Math.min(420, c0 - (ev.clientY - sy))));
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      document.body.style.cursor = kind === 'console' ? 'row-resize' : 'col-resize';
    }

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
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      document.body.style.cursor = 'grabbing';
    }
    function camWheel(e) {
      setCam(c => ({ ...c, zoom: Math.max(0.7, Math.min(1.7, c.zoom - e.deltaY * 0.0012)) }));
    }

    // keyboard shortcuts
    useEffect(() => {
      const typingIn = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
      const h = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onRun(); }
        else if (e.key === 'F10') { e.preventDefault(); onStep(); }
        else if (e.key === 'Escape' && showHelp) { setShowHelp(false); }
        else if (e.key === '?' && !typingIn(e.target)) { e.preventDefault(); setShowHelp(s => !s); }
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    });

    const statusLabel = { idle: 'Standby', running: 'Running', paused: 'Stepping', done: 'Complete', error: 'Halted' }[runState];

    return (
      <div className="app">
        <a className="skip-link" href="#editor-main">Skip to code editor</a>
        <h1 className="sr-only">RoboLearn — Orbital Rover Python coding simulator</h1>
        {/* ---- mission bar ---- */}
        <div className="missionbar" role="banner">
          <div className="brand">
            <div className="brand-mark" dangerouslySetInnerHTML={{ __html: ORBIT_SVG }}></div>
            <div className="brand-text">
              <div className="brand-name">Orbital Rover</div>
              <div className="brand-sub">Rover Simulator · v1.0</div>
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
            <label>Sim speed</label>
            <input type="range" className="slider" min="0.4" max="3" step="0.1" value={speedMul} onChange={e => setSpeedMul(parseFloat(e.target.value))} />
            <span className="num" style={{ fontSize: 11, color: 'var(--fg-2)', width: 30 }}>{speedMul.toFixed(1)}×</span>
          </div>
          <div className="bar-spacer"></div>
          <div className="bar-status" role="status" aria-live="polite" aria-label={'Status: ' + statusLabel}>
            <span className={'status-dot ' + runState} aria-hidden="true"></span>
            <span>{statusLabel}</span>
          </div>
          <div className="bar-divider"></div>
          <button className="icon-btn" title="Build a real robot on a budget" aria-label="Build a real robot" onClick={() => setBuildOpen(true)}>🤖</button>
          <button className="icon-btn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setShowHelp(true)}>?</button>
          <div className="settings-wrap">
            <button className="icon-btn" title="Settings" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(o => !o)}>⚙</button>
            {settingsOpen && (
              <div className="settings-pop" role="menu" aria-label="Settings">
                {pupils.length > 0 && (
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
                    <option value="matrix">Matrix</option>
                    <option value="pixel">Pixel</option>
                    <option value="game">Arcade</option>
                    <option value="lego">Brick</option>
                    <option value="chatgpt">Clean</option>
                    <option value="abstract">Abstract</option>
                    <option value="wiki">Wiki / Network</option>
                  </select>
                </label>
                <button className="set-row set-btn" role="menuitem" aria-pressed={!muted} onClick={toggleSound}>
                  <span>Sound</span><span className="set-val">{muted ? 'Off' : 'On'}</span>
                </button>
                <button className="set-row set-btn" role="menuitem" aria-pressed={readable} onClick={() => setReadable(v => !v)}>
                  <span>Readable text</span><span className="set-val">{readable ? 'On' : 'Off'}</span>
                </button>
                <button className="set-row set-btn" role="menuitem" onClick={() => setVoiceGender(v => v === 'female' ? 'male' : 'female')}>
                  <span>Voice</span><span className="set-val">{voiceGender === 'female' ? 'Female' : 'Male'}</span>
                </button>
                <button className="set-row set-btn" role="menuitem" onClick={() => { setSettingsOpen(false); pickPhotoClick(); }}>
                  <span>Photo prop — place("photo")</span><span className="set-val">{photoUrl ? 'Loaded' : 'Pick…'}</span>
                </button>
                <button className="set-row set-btn" role="menuitem" onClick={() => { setSettingsOpen(false); exportReportClick(); }}>
                  <span>Export progress report</span><span className="set-val">→</span>
                </button>
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
                {lessons.length > 0 && (
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
                <button className="btn-mini btn-vibe" title={aiInfo.available ? 'Code with AI (' + aiInfo.model + ')' : 'Code with AI (needs local Ollama)'} onClick={() => setVibeOpen(true)}>✨ Vibe</button>
                <button className="btn-mini" title="Build the program from blocks" onClick={() => setBlocksOpen(true)}>🧩 Blocks</button>
                <button className="btn-mini" title="A second AI agent reviews your code" onClick={runReview}>🔎 Review</button>
              </div>
              <window.Editor code={code} onChange={onCodeChange} activeLine={activeLine} readOnly={runState === 'running'} />
              <div className="api-hint">
                <b>move_forward(m)</b> · <b>move_backward(m)</b> · <b>turn_left(°)</b> · <b>turn_right(°)</b> · <b>set_speed(0–100)</b> · <b>pen_down/up()</b> · <b>scan()</b> · <b>led("cyan")</b> · <b>say("…")</b> · <b>collect_sample()</b> · <b>place("flag")</b>
                <span className="sep"> — sensors return values: </span><b>distance()</b> · <b>heading()</b> · <b>battery()</b> · <b>obstacle_ahead()</b> · <b>gravity()</b> · <b>temperature()</b>
              </div>
              {(() => {
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
                          {lessonVerdict.passed ? '✓ Complete' : '✗ Not yet'} · {lessonVerdict.score}/100
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
                      <p className="lesson-hint">💡 {lessonVerdict.hint.message}</p>
                    )}
                  </section>
                );
              })()}
            </div>
            <div className="resizer-row" onPointerDown={e => startDrag('console', e)} style={{ height: 5, cursor: 'row-resize', background: 'transparent', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '0 0', borderTop: '0.5px solid var(--border)' }}></div>
            </div>
            <div className="console" style={{ height: consoleH, flex: 'none' }}>
              <div className="console-head">
                <span className="eyebrow">Console</span>
                <div className="ph-spacer" style={{ flex: 1 }}></div>
                <button className="btn-mini" onClick={() => setConsoleLines([{ type: 'sys', text: 'Console cleared.' }])}>Clear</button>
              </div>
              <div className="console-out" ref={consoleEndRef} role="log" aria-live="polite" aria-label="Program output and lesson feedback">
                {consoleLines.map((l, i) => (
                  <div key={i} role={l.type === 'err' ? 'alert' : undefined} className={'cline ' + (l.type === 'err' ? 'err' : l.type === 'ok' ? 'ok' : l.type === 'sys' ? 'sys' : '')}>
                    {l.ts ? <span className="ts">{l.ts}</span> : null}
                    {l.text}
                  </div>
                ))}
              </div>
              <div className="repl-row">
                <span className="repl-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
                <input
                  className="repl-input"
                  type="text"
                  spellCheck="false"
                  placeholder='live terminal — try move_forward(1) or place("flag")'
                  aria-label="Live terminal: type one Python line and press Enter"
                  value={replLine}
                  onChange={e => setReplLine(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { runReplLine(replLine); setReplHist(replLine); setReplLine(''); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); if (replHistRef.current) setReplLine(replHistRef.current); }
                    else if (e.key === 'Escape') { e.target.blur(); }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="resizer" onPointerDown={e => startDrag('editor', e)} style={{ gridColumn: 2 }}></div>

          {/* center: viewport */}
          <div className="panel view-panel" style={{ gridColumn: 3 }} onPointerDown={camDrag} onWheel={camWheel}>
            <div className="terrain-switch">
              {['earth', 'mars', 'underwater', 'space'].map(id => (
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
                  title="Drop the rover at a real place — real gravity, traction and light"
                >
                  <option value="" disabled>🌍 Mission site…</option>
                  {Object.keys(window.SITES).map(id => (
                    <option key={id} value={id}>{window.SITES[id].name}</option>
                  ))}
                </select>
              )}
            </div>
            <window.Viewport terrain={terrain} rover={rover} trail={trail} props={props} photoUrl={photoUrl} sensorDist={sensorDist} say={say} crashKey={crashKey} zoom={zoom} showGrid={t.grid} showFx={t.ambientFx} trailColor={trailColor} tilt={cam.tilt} yaw={cam.yaw} onTilt={v => setCam({ tilt: v, yaw: v === 0 ? 0 : -8, zoom: 1 })} />
          </div>

          <div className="resizer" onPointerDown={e => startDrag('tele', e)} style={{ gridColumn: 4 }}></div>

          {/* right: telemetry */}
          <div className="panel tele-panel" style={{ gridColumn: 5 }}>
            <div className="panel-head">
              <span className="eyebrow">Telemetry</span>
              <div className="ph-spacer" style={{ flex: 1 }}></div>
              <span className="num" style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.1em' }}>OQ-ROVER-04</span>
            </div>
            <window.Telemetry rover={rover} terrain={terrain} sensorDist={sensorDist} odometer={odo} />
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

        {reviewOpen && (
          <div className="modal-backdrop" onClick={() => !reviewBusy && setReviewOpen(false)}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="AI code review" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <span className="eyebrow">🔎 Code review — a second AI agent checks your work</span>
                <button className="btn-mini" aria-label="Close" onClick={() => setReviewOpen(false)}>✕</button>
              </div>
              <div className="review-body">
                {reviewBusy && <p className="vibe-status">A reviewer agent is reading your code on this machine…</p>}
                {reviewErr && <p className="vibe-error" role="alert">{reviewErr}</p>}
                {reviewData && !reviewBusy && (
                  <div>
                    <p className="vibe-status">Reviewer: <b>{reviewData.model}</b> · runs entirely offline.</p>
                    {reviewData.issues && reviewData.issues.length > 0 ? (
                      <ul className="review-issues">
                        {reviewData.issues.map((it, i) => <li key={i}>{it}</li>)}
                      </ul>
                    ) : (
                      <p className="review-clean">No problems spotted. Nice work.</p>
                    )}
                    {reviewData.revised && reviewData.code && (
                      <div className="review-rewrite">
                        <span className="eyebrow">Suggested rewrite (checked to run safely)</span>
                        <pre className="vibe-code">{reviewData.code}</pre>
                        <div className="vibe-code-actions">
                          <button className="ctrl ctrl-run" onClick={applyReview}>✓ Apply to editor</button>
                          <button className="btn-mini" onClick={() => setReviewOpen(false)}>Keep mine</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {vibeOpen && (
          <div className="modal-backdrop" onClick={() => !vibeBusy && setVibeOpen(false)}>
            <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Code with AI" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <span className="eyebrow">✨ Vibe coding — describe it, the AI writes it</span>
                <button className="btn-mini" aria-label="Close" onClick={() => setVibeOpen(false)}>✕</button>
              </div>
              {aiInfo.available ? (
                <div className="vibe-body">
                  <p className="vibe-status">Local model: <b>{aiInfo.model}</b> · runs entirely on this machine, nothing leaves it.</p>
                  <div className="vibe-thread" role="log" aria-live="polite" aria-label="AI conversation">
                    {vibeMsgs.length === 0 && (
                      <p className="vibe-empty">Chat with the AI like a coding partner. It may ask a question first — e.g. try <i>"explore the field"</i> or <i>"draw a star"</i>.</p>
                    )}
                    {vibeMsgs.map((m, i) => m.kind === 'code' ? (
                      <div key={i} className="vibe-msg ai code">
                        <pre className="vibe-code">{m.text}</pre>
                        <div className="vibe-code-actions">
                          <button className="ctrl ctrl-run" onClick={() => vibeApply(m.text, m.model)}>✓ Apply to editor</button>
                          <button className="btn-mini" onClick={() => { setVibeMsgs(ms => [...ms, { role: 'user', kind: 'text', text: '(discarded — try again)' }]); }}>Discard</button>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className={'vibe-msg ' + m.role}><span>{m.text}</span></div>
                    ))}
                    {vibeBusy && (
                      <div className="vibe-msg ai thinking">
                        {vibeLive ? <pre className="vibe-live">{vibeLive}</pre> : <span>Thinking…</span>}
                      </div>
                    )}
                    <div ref={vibeEndRef}></div>
                  </div>
                  {vibeError && <p className="vibe-error" role="alert">{vibeError}</p>}
                  <div className="vibe-inputrow">
                    <button className="icon-btn" title="Speak your request (offline)" aria-label="Voice input" disabled={micBusy} onClick={vibeMic}>{micBusy ? '…' : '🎤'}</button>
                    <textarea
                      className="vibe-input"
                      rows={2}
                      placeholder='Say what the rover should do — the AI may ask you a question back'
                      value={vibePrompt}
                      onChange={e => setVibePrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); vibeSend(); } }}
                      aria-label="Describe what the rover should do"
                      autoFocus
                    />
                    <button className="ctrl ctrl-run" disabled={vibeBusy || !vibePrompt.trim()} onClick={vibeSend}>Send</button>
                  </div>
                  <span className="vibe-hint">Apply types the code into the editor — nothing runs until you press Run.</span>
                </div>
              ) : (
                <div className="vibe-body">
                  <p className="vibe-status">AI is offline. Vibe coding uses a <b>local</b> model (no cloud, no account):</p>
                  <ol className="vibe-steps">
                    <li>Install Ollama from ollama.com (free, offline after install)</li>
                    <li>Run: <code>ollama pull qwen2.5-coder:3b</code> (or <code>gemma3</code>)</li>
                    <li>Reopen RoboLearn — this panel lights up automatically</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {blocksOpen && (
          <div className="modal-backdrop" onClick={() => setBlocksOpen(false)}>
            <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Block coding" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <span className="eyebrow">🧩 Blocks — click blocks to build, then turn them into Python</span>
                <button className="btn-mini" aria-label="Close" onClick={() => setBlocksOpen(false)}>✕</button>
              </div>
              <div className="blocks-palette">
                {BLOCK_DEFS.map(d => (
                  <button key={d.k} className="block-chip" style={{ borderColor: d.color }} onClick={() => addBlock(d)}>
                    {d.label}{d.unit ? ' ' + d.val + d.unit : ''}
                  </button>
                ))}
                <button className="block-chip block-end" onClick={endBlock} disabled={blockIndent === 0}>↤ end block</button>
              </div>
              <div className="blocks-program" aria-label="Your program">
                {blocks.length === 0 && <p className="vibe-hint">Click blocks above — they stack here like Scratch.</p>}
                {blocks.map((b, i) => (
                  <div key={i} className="block-row" style={{ marginLeft: (b.indent * 22) + 'px', borderLeftColor: b.color }}>
                    <span>{b.label}</span>
                    {b.val !== undefined && (
                      <input
                        type="number" className="block-num" value={b.val} min={1} max={b.unit === '°' ? 360 : 20}
                        aria-label={b.label + ' amount'}
                        onChange={e => { const v = Number(e.target.value) || 1; setBlocks(bs => bs.map((x, j) => j === i ? { ...x, val: v } : x)); }}
                      />
                    )}
                    {b.unit && <span className="vibe-hint">{b.unit}</span>}
                    <button className="btn-mini" aria-label={'remove ' + b.label} onClick={() => removeBlock(i)}>✕</button>
                  </div>
                ))}
              </div>
              <div className="vibe-actions">
                <button className="btn-mini" disabled={!blocks.length} onClick={() => { setBlocks([]); setBlockIndent(0); }}>Clear</button>
                <span className="vibe-hint" style={{ flex: 1 }}>Turns into real Python — watch it type itself into the editor.</span>
                <button className="ctrl ctrl-run" disabled={!blocks.length} onClick={insertBlocksCode}>Insert code →</button>
              </div>
            </div>
          </div>
        )}

        {showHelp && (
          <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <span className="eyebrow">Keyboard shortcuts</span>
                <button className="btn-mini" aria-label="Close" onClick={() => setShowHelp(false)}>✕</button>
              </div>
              <dl className="shortcut-list">
                <div><dt><kbd>Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>Run / Pause the program</dd></div>
                <div><dt><kbd>F10</kbd></dt><dd>Step one instruction</dd></div>
                <div><dt><kbd>Tab</kbd></dt><dd>Indent (in the editor)</dd></div>
                <div><dt><kbd>Shift</kbd>+<kbd>Tab</kbd></dt><dd>Dedent (in the editor)</dd></div>
                <div><dt><kbd>Enter</kbd></dt><dd>Auto-indent the next line</dd></div>
                <div><dt><kbd>Esc</kbd></dt><dd>Leave the editor / close this</dd></div>
                <div><dt><kbd>?</kbd></dt><dd>Show this help</dd></div>
              </dl>
            </div>
          </div>
        )}

        {buildOpen && (
          <div className="modal-backdrop" onClick={() => setBuildOpen(false)}>
            <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Build a real robot" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <span className="eyebrow">🤖 Build a real robot — what your budget can buy</span>
                <button className="btn-mini" aria-label="Close" onClick={() => setBuildOpen(false)}>✕</button>
              </div>
              <div className="build-body">
                <p className="vibe-status">Type a budget and the local AI plans a real rover you can build and program, mapping what you learned here onto real hardware. Nothing is ordered; this runs offline.</p>
                <div className="build-input">
                  <label>Budget (US$)
                    <input type="number" min="1" max="100000" value={buildBudget} onChange={e => setBuildBudget(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runBuild(); }} />
                  </label>
                  <label className="grow">Goal (optional)
                    <input type="text" placeholder='e.g. "avoid walls and follow a line"' value={buildGoal} onChange={e => setBuildGoal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runBuild(); }} />
                  </label>
                  <button className="ctrl ctrl-run" disabled={buildBusy} onClick={runBuild}>{buildBusy ? 'Planning…' : 'Generate'}</button>
                </div>
                {buildErr && <p className="vibe-error" role="alert">{buildErr}</p>}
                {buildPlan && (
                  <div className="build-plan">
                    <div className="build-head">
                      <div>
                        <h3 style={{ margin: '0 0 2px' }}>{buildPlan.tier}</h3>
                        <p style={{ margin: 0, color: 'var(--fg-2)', fontSize: 12 }}>{buildPlan.summary}</p>
                      </div>
                      <div className={'build-cost' + (buildPlan.total <= buildPlan.budget ? ' ok' : ' over')}>
                        ${Math.round(buildPlan.total)} <span>of ${buildPlan.budget}</span>
                      </div>
                    </div>
                    <window.RoverSchematic parts={buildPlan.parts} />
                    <div className="build-cols">
                      <div>
                        <div className="eyebrow">Parts</div>
                        <table className="build-table">
                          <tbody>
                            {buildPlan.parts.map((p, i) => (
                              <tr key={i}><td>{p.name}</td><td className="role">{p.role}</td><td className="cost">${p.cost}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <div className="eyebrow">Build steps</div>
                        <ol className="build-steps">{buildPlan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                        {buildPlan.maps && buildPlan.maps.length > 0 && (
                          <>
                            <div className="eyebrow" style={{ marginTop: 8 }}>From RoboLearn to hardware</div>
                            <dl className="build-maps">
                              {buildPlan.maps.map((m, i) => <div key={i}><dt>{m.robolearn}</dt><dd>{m.hardware}</dd></div>)}
                            </dl>
                          </>
                        )}
                      </div>
                    </div>
                    {buildPlan.fallback && <p className="build-note">A standard plan is shown because the model could not tailor one within this budget.</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const TWEAK_DEFAULTS = { zoom: 1, tilt: 46, grid: true, ambientFx: true, trail: 'terrain' };

  const ORBIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <ellipse cx="32" cy="32" rx="28" ry="11" stroke="currentColor" stroke-width="2" transform="rotate(-22 32 32)" opacity="0.7"></ellipse>
    <ellipse cx="32" cy="32" rx="28" ry="11" stroke="currentColor" stroke-width="2" transform="rotate(22 32 32)" opacity="0.4"></ellipse>
    <circle cx="32" cy="32" r="4" fill="currentColor"></circle>
  </svg>`;

  // adjust grid columns to include resizer tracks
  const style = document.createElement('style');
  style.textContent = '.workspace{grid-template-columns:var(--editor-w) 5px 1fr 5px var(--tele-w);}';
  document.head.appendChild(style);

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
