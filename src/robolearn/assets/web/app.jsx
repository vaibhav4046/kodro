/* ============================================================================
   ORBITAL ROVER — App (runtime + UI wiring)
   ========================================================================== */
(function () {
  const { useState, useRef, useEffect, useCallback } = React;
  const TERRAINS = window.TERRAINS;
  const WALL = TERRAINS.WALL;
  const R = 30; // rover collision radius (cm)

  // ---------------- example programs ----------------
  const EXAMPLES = {
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
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('or_tab') || 'square');
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

    const terrain = TERRAINS[terrainId];
    const code = programs[activeTab];

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
    const [lessons, setLessons] = useState([]);
    const [currentLessonId, setCurrentLessonId] = useState(null);
    const [lessonVerdict, setLessonVerdict] = useState(null);  // {passed,score,reasons,hint}
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
      setPrograms(p => ({ ...p, [activeTab]: lesson.starterCode || '' }));
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
        const tag = r.passed ? 'ok' : 'err';
        setConsoleLines(l => {
          const lines = [...l, { type: tag, text: (r.passed ? '✓ PASS' : '✗ NOT YET') + '  Score: ' + r.score + '/100' }];
          if (!r.passed && Array.isArray(r.reasons)) r.reasons.forEach(reason => lines.push({ type: 'err', text: '  · ' + reason }));
          if (r.hint && r.hint.message) lines.push({ type: 'sys', text: '💡 Hint: ' + r.hint.message });
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
    useEffect(() => { localStorage.setItem('or_tab', activeTab); }, [activeTab]);
    useEffect(() => { try { localStorage.setItem('or_programs', JSON.stringify(programs)); } catch (e) {} }, [programs]);

    const sync = () => { setRover({ ...live.current }); };
    const pushTrailPoint = () => {
      if (!live.current.penDown) return;
      const segs = trailRef.current;
      if (!segs.length) return;
      segs[segs.length - 1].push({ x: live.current.x, y: live.current.y });
    };

    function addConsole(text, type) {
      const ts = new Date();
      const hh = String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0') + ':' + String(ts.getSeconds()).padStart(2, '0');
      setConsoleLines(l => [...l, { type: type || 'out', text, ts: hh }]);
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
      const a = s.heading * Math.PI / 180;
      const dirx = Math.sin(a) * ev.dir, diry = -Math.cos(a) * ev.dir;
      const total = ev.distance;
      const x0 = s.x, y0 = s.y;
      const sp = Math.max(8, s.speed);
      // 0.32s per (cm/speed); lower-traction terrain drives a little slower.
      const dur = (total / sp) * 1000 * 0.32 / (terrain.traction * speedMulRef.current);
      s.moving = true;
      // new trail segment if pen down
      if (s.penDown) { trailRef.current.push([{ x: x0, y: y0 }]); setTrail([...trailRef.current]); }
      // Battery drains smoothly across the move (was a no-op: subtracted 0).
      const b0 = s.battery;
      const drainFull = total * 0.011 / terrain.traction;
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
      // Settle battery on the distance actually travelled (handles a crash
      // that stopped the move early), relative to the pre-move level b0.
      const travelled = Math.hypot(s.x - x0, s.y - y0);
      s.battery = Math.max(0, b0 - travelled * 0.011 / terrain.traction);
      odoRef.current += travelled; setOdo(odoRef.current);
      s.moving = false; sync();
      if (crashed) {
        setCrashKey(k => k + 1);
        const what = crashed.type === 'wall' ? 'arena boundary' : terrain.obstacleLabel.toLowerCase();
        addConsole('Collision with ' + what + ' at (' + Math.round(s.x) + ', ' + Math.round(-s.y) + '). Rover halted.', 'err');
        haltProgram('error');
        return false;
      }
      return true;
    }

    async function animateTurn(ev) {
      const s = live.current;
      const h0 = s.heading;
      const dur = (Math.abs(ev.deg) / 180) * 650 / speedMulRef.current;
      s.moving = true;
      await frames(dur, (p) => { s.heading = h0 + ev.deg * p; setSensorDist(Math.round(rayDistance(s.x, s.y, s.heading))); sync(); return false; });
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
          case 'move': return await animateMove(ev);
          case 'turn': return await animateTurn(ev);
          case 'speed': live.current.speed = Math.max(0, Math.min(100, ev.value)); sync(); break;
          case 'wait': await delay(ev.seconds * 1000 / speedMulRef.current); break;
          case 'pen':
            live.current.penDown = ev.down;
            if (ev.down) { trailRef.current.push([{ x: live.current.x, y: live.current.y }]); setTrail([...trailRef.current]); }
            break;
          case 'halt': live.current.moving = false; sync(); break;
          case 'led': live.current.led = (ev.color in LED_COLORS) ? LED_COLORS[ev.color] : terrain.accent; sync(); break;
          case 'say': showSay(ev.text); await delay(stepMode ? 0 : 200 / speedMulRef.current); break;
          case 'scan':
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
      addConsole('Program finished.', 'ok');
      // RoboLearn: if a lesson is loaded, grade the Run via the Python engine.
      gradeWithBridge(code);
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
      // Only a user-pressed Pause should land here as 'paused': the loop stopped
      // with the generator still live (genRef set) while the UI still reads
      // 'running'. A finish/halt nulls genRef and has already set 'done'/'error',
      // so the genRef guard stops a stale pump from resurrecting a dead run.
      if (!ctrl.current.running && genRef.current && runStateRef.current === 'running') {
        setRunState('paused');
      }
    }
    const runStateRef = useRef('idle');
    useEffect(() => { runStateRef.current = runState; }, [runState]);

    function onRun() {
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
      setPrograms(p => ({ ...p, [activeTab]: v }));
      if (runState !== 'idle') { /* keep state; user can re-run */ }
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
      const h = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onRun(); }
        else if (e.key === 'F10') { e.preventDefault(); onStep(); }
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
        </div>

        {/* ---- workspace ---- */}
        <main id="editor-main" className="workspace" style={{ ['--editor-w']: editorW + 'px', ['--tele-w']: teleW + 'px' }}>
          {/* left column: editor + console */}
          <div className="panel" style={{ gridColumn: 1 }}>
            <div className="editor-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="panel-head">
                <div className="tabs">
                  {Object.keys(EXAMPLES).map(k => (
                    <button key={k} type="button" className={'tab' + (activeTab === k ? ' active' : '')} aria-pressed={activeTab === k} onClick={() => setActiveTab(k)}>{EXAMPLES[k].label}</button>
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
              </div>
              <window.Editor code={code} onChange={onCodeChange} activeLine={activeLine} readOnly={runState === 'running'} />
              <div className="api-hint">
                <b>move_forward(m)</b> · <b>move_backward(m)</b> · <b>turn_left(°)</b> · <b>turn_right(°)</b> · <b>set_speed(0–100)</b> · <b>pen_down/up()</b> · <b>scan()</b> · <b>led("cyan")</b> · <b>say("…")</b> · <b>collect_sample()</b>
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
                      {lessonVerdict && (
                        <span className={'lesson-verdict ' + (lessonVerdict.passed ? 'pass' : 'fail')}>
                          {lessonVerdict.passed ? '✓ Complete' : '✗ Not yet'} · {lessonVerdict.score}/100
                        </span>
                      )}
                    </div>
                    {lesson.intro ? <p className="lesson-intro">{lesson.intro.trim()}</p> : null}
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
            </div>
            <window.Viewport terrain={terrain} rover={rover} trail={trail} sensorDist={sensorDist} say={say} crashKey={crashKey} zoom={zoom} showGrid={t.grid} showFx={t.ambientFx} trailColor={trailColor} tilt={cam.tilt} yaw={cam.yaw} onTilt={v => setCam({ tilt: v, yaw: v === 0 ? 0 : -8, zoom: 1 })} />
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
