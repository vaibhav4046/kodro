/* Robot Lab -- design a custom robot, then validate it in the world.
 *
 * The reframed core of Kodro: a user picks a robot archetype (rover, self
 * driving car, personal robot, arm or a bare microcontroller build), fits it
 * with real hobby parts (an ESP32 or micro:bit board, sensors, actuators),
 * names it, and saves it. The chosen specification is NOT cosmetic -- it
 * drives the simulation: total mass changes how fast the battery drains, the
 * motor choice sets the top speed, and the fitted sensors decide which Python
 * commands the robot actually supports. This file is self contained and
 * exposes itself on window like every other module in the bundle.
 *
 *   window.RobotLab          -- the React panel component
 *   window.getKodroRobot()   -- the saved spec + derived sim factors
 */
(function () {
  // v2 store carries the optional KRS physical block (SI0); a v1 save (plain
  // catalogue spec) is read unchanged through the migration in load().
  const STORE = 'kodro_robot_v2';
  const STORE_V1 = 'kodro_robot_v1';

  // ---- parts catalogue. mass is grams; "enables" lists the Python the part unlocks.
  const BOARDS = {
    esp32: { id: 'esp32', name: 'ESP32', mass: 10, note: 'Wi-Fi + Bluetooth, dual core. The hobby default.' },
    microbit: { id: 'microbit', name: 'micro:bit v2', mass: 9, note: 'Classroom friendly, built-in buttons and LEDs.' },
    pico: { id: 'pico', name: 'Raspberry Pi Pico', mass: 6, note: 'Cheap, low power, MicroPython native.' },
    uno: { id: 'uno', name: 'Arduino Uno', mass: 25, note: 'Rugged and forgiving, a classic first board.' },
  };
  // `cmd` is the runnable, GATED command a part adds. Only parts whose command
  // is actually implemented in the interpreter carry one: the ultrasonic range
  // (distance()) and the IMU (heading()). The other parts are real fitted
  // hardware that change the build's mass and behaviour, but their command
  // bindings (vision, positioning, contact, line, gripper) are not implemented
  // yet, so they advertise no callable command rather than a phantom one that
  // would fail with a confusing error. See docs/known-limitations.md.
  const SENSORS = {
    ultrasonic: { id: 'ultrasonic', name: 'Ultrasonic range', mass: 9, enables: 'distance()  range ahead', cmd: 'distance' },
    line: { id: 'line', name: 'Line follower', mass: 6, enables: 'line tracking (fitted; adds mass)' },
    imu: { id: 'imu', name: 'IMU (gyro + accel)', mass: 4, enables: 'heading()  stable turns', cmd: 'heading' },
    camera: { id: 'camera', name: 'Camera', mass: 12, enables: 'computer vision (fitted; adds mass)' },
    gps: { id: 'gps', name: 'GPS', mass: 8, enables: 'positioning (fitted; adds mass)' },
    bumper: { id: 'bumper', name: 'Bumper switch', mass: 5, enables: 'contact bumper (fitted; adds mass)' },
  };
  const ACTUATORS = {
    motors2: { id: 'motors2', name: '2 DC motors', mass: 120, speed: 1.0, note: 'Two wheels, differential drive.' },
    motors4: { id: 'motors4', name: '4 DC motors', mass: 220, speed: 1.25, note: 'Four wheels, more grip and torque.' },
    servos: { id: 'servos', name: 'Steering servo', mass: 40, speed: 1.1, note: 'Car style front steering.' },
    gripper: { id: 'gripper', name: 'Gripper arm', mass: 90, speed: 0.9, enables: 'manipulator (fitted; adds reach and mass)' },
  };

  const TYPES = {
    rover: {
      id: 'rover', name: 'Rover', icon: 'rover',
      blurb: 'A wheeled explorer for rough ground. The all rounder.',
      base: { board: 'esp32', sensors: ['ultrasonic', 'imu'], actuators: ['motors4'] },
    },
    car: {
      id: 'car', name: 'Self-driving car', icon: 'car',
      blurb: 'A road vehicle. Validate it among pedestrians and traffic.',
      base: { board: 'esp32', sensors: ['ultrasonic', 'camera', 'gps'], actuators: ['motors2', 'servos'] },
    },
    home: {
      id: 'home', name: 'Personal robot', icon: 'home',
      blurb: 'A helper that shares space with people indoors.',
      base: { board: 'pico', sensors: ['ultrasonic', 'bumper', 'camera'], actuators: ['motors2', 'gripper'] },
    },
    arm: {
      id: 'arm', name: 'Robotic arm', icon: 'arm',
      blurb: 'A fixed manipulator. Reach, grab and place.',
      base: { board: 'uno', sensors: ['camera'], actuators: ['gripper'] },
    },
    custom: {
      id: 'custom', name: 'Custom build', icon: 'custom',
      blurb: 'Start bare and fit exactly the parts you want.',
      base: { board: 'esp32', sensors: [], actuators: ['motors2'] },
    },
  };

  // Which world a build should be validated in first, and why. This is the
  // assistant reasoning about the robot: a road vehicle belongs among traffic,
  // a home robot in a room, an explorer on open terrain.
  const WORLD_FOR = {
    rover: { id: 'earth', label: 'Open terrain', why: 'an explorer is tested on rough open ground first.' },
    car: { id: 'city', label: 'Riverside City', why: 'a road vehicle must cope with traffic and pedestrians.' },
    home: { id: 'room', label: 'Living Room', why: 'a companion robot shares an indoor space with people and furniture.' },
    arm: { id: 'room', label: 'Living Room', why: 'a fixed manipulator works at a table indoors.' },
    custom: { id: 'earth', label: 'Open terrain', why: 'start on safe open ground, then try the city and the others.' },
  };

  const CHASSIS_MASS = 380; // grams, frame + battery + wiring, before parts

  // Colour + word for a design-check status, shared by the verdict UI.
  function diagColor(s) { return s === 'fail' ? 'var(--danger)' : s === 'warn' ? 'var(--warning)' : 'var(--cyan)'; }
  function diagWord(s) { return s === 'fail' ? "WON'T COPE" : s === 'warn' ? 'WATCH' : 'READY'; }

  function defaultSpec() {
    const t = TYPES.rover;
    return { type: 'rover', name: 'My Rover', board: t.base.board, sensors: t.base.sensors.slice(), actuators: t.base.actuators.slice() };
  }

  function specFromType(typeId, prevName) {
    const t = TYPES[typeId] || TYPES.rover;
    return { type: typeId, name: prevName || (t.name), board: t.base.board, sensors: t.base.sensors.slice(), actuators: t.base.actuators.slice() };
  }

  // ---- derive the numbers the simulation cares about from a spec.
  function derive(spec) {
    // Tolerate a spec whose list fields are the wrong type (a corrupted or
    // hand-edited .kodro persisted before the project-loader guard existed): a
    // non-array actuators/sensors must not throw at module init and brick every
    // reload with "forEach is not a function".
    const sensors = Array.isArray(spec.sensors) ? spec.sensors : [];
    const actuators = Array.isArray(spec.actuators) ? spec.actuators : [];
    let mass = CHASSIS_MASS + (BOARDS[spec.board] ? BOARDS[spec.board].mass : (spec.boardMassG || 10));
    sensors.forEach(s => { if (SENSORS[s]) mass += SENSORS[s].mass; });
    let speed = 0;
    actuators.forEach(a => { if (ACTUATORS[a]) { mass += ACTUATORS[a].mass; speed = Math.max(speed, ACTUATORS[a].speed || 0); } });
    if (speed === 0) speed = 0.8; // no drive parts: it barely crawls
    // Catalogue bounds live in the SHARED motion model (E-P1) so the sim, the
    // Lab and the Python twin read the same numbers; values are unchanged.
    const M = (window.KodroMotion && window.KodroMotion.MODEL) || {};
    const baseline = M.massBaselineG || 900; // grams ~ a typical small rover
    const massFactor = Math.min(M.catMassFactorHi || 1.8, Math.max(M.catMassFactorLo || 0.6, mass / baseline));
    const speedFactor = Math.min(M.catSpeedFactorHi || 1.45, Math.max(M.catSpeedFactorLo || 0.7, speed));
    // crude runtime estimate: lighter + fewer parts last longer on one charge
    const runtimeMin = Math.round(60 / massFactor);
    const cmds = [];
    sensors.forEach(s => { if (SENSORS[s] && SENSORS[s].cmd) cmds.push(SENSORS[s].cmd); });
    actuators.forEach(a => { if (ACTUATORS[a] && ACTUATORS[a].cmd) cmds.push(ACTUATORS[a].cmd); });
    const out = { mass, massFactor, speedFactor, runtimeMin, commands: cmds };
    // SI2: an imported KRS spec's physical block overrides the catalogue
    // proxies with measured numbers (top speed from rpm and wheel radius,
    // energy-true battery, real mass). Catalogue builds return exactly the
    // block above - byte-identical to the pre-SI2 behaviour.
    if (spec.physical && window.KodroSpecSchema) {
      // derive() runs on the BOOT path (getKodroRobot() at module init), so a
      // corrupt physical block must degrade to the catalogue proxies above,
      // never throw: a throw here bricks the studio until localStorage is
      // cleared. The block is schema-validated on import and project-load,
      // but localStorage can still hold anything a user (or old bug) wrote.
      try {
        const ph = window.KodroSpecSchema.deriveFromPhysical(spec, out);
        if (ph) {
          out.phys = ph;
          if (ph.massKg !== undefined) out.mass = Math.round(ph.massKg * 1000);
          if (ph.massFactor !== undefined) out.massFactor = ph.massFactor;
          if (ph.speedFactor !== undefined) out.speedFactor = ph.speedFactor;
          if (ph.runtimeMin !== undefined) out.runtimeMin = ph.runtimeMin;
        }
      } catch (e) {
        try { console.warn('Kodro: corrupt physical block ignored (catalogue numbers used):', e && e.message); } catch (e2) { void e2; }
      }
    }
    return out;
  }

  function load() {
    try {
      // v2 first; fall back to a v1 save (same catalogue shape, no physical
      // block) so an existing build survives the upgrade untouched.
      const raw = localStorage.getItem(STORE) || localStorage.getItem(STORE_V1);
      if (raw) {
        const s = JSON.parse(raw);
        // Floor: a saved build with no sensors cannot run the obstacle-avoidance
        // demos and confuses first-time users ("ultrasonic needed"). Give every
        // build at least an ultrasonic + IMU so it can sense and the default
        // autopilot just works on first Run; it stays editable in the Robot Lab.
        // An imported KRS build is exempt: its sensor list is a deliberate
        // measurement, and faking parts onto it would betray the import.
        if (s && !s.physical && (!Array.isArray(s.sensors) || s.sensors.length === 0)) s.sensors = ['ultrasonic', 'imu'];
        return s;
      }
    } catch (e) { void e; }
    return defaultSpec();
  }

  function save(spec) {
    try { localStorage.setItem(STORE, JSON.stringify(spec)); } catch (e) { void e; }
    const d = derive(spec);
    const rec = WORLD_FOR[spec.type] || {};
    window.KODRO_ROBOT = Object.assign({}, spec, d, { world: rec.id });
    try { window.dispatchEvent(new CustomEvent('kodro-robot', { detail: window.KODRO_ROBOT })); } catch (e) { void e; }
  }

  // Public accessor for the simulation (battery, speed, sensor gating).
  window.getKodroRobot = function () {
    if (!window.KODRO_ROBOT) { const s = load(); window.KODRO_ROBOT = Object.assign({}, s, derive(s), { world: (WORLD_FOR[s.type] || {}).id }); }
    return window.KODRO_ROBOT;
  };
  // Make sure a default exists from first load so the sim never sees undefined.
  window.getKodroRobot();

  // Resolve a possibly-PARTIAL robot event detail into a full spec + derived
  // numbers. RobotLab.save dispatches complete specs, but other dispatchers
  // (the capture harness sends { type } only) must not leave the studio with
  // a half-spec whose missing sensor list reads as "no parts fitted". An
  // EXPLICIT sensors/actuators array is honoured as-is (a fixture may be
  // deliberately bare); absent fields fall back to the archetype's default
  // build, exactly what picking that archetype in the Lab would give.
  window.resolveKodroRobot = function (detail) {
    const d = detail || {};
    if (Array.isArray(d.sensors) && Array.isArray(d.actuators) && d.massFactor) return d; // already full
    const base = specFromType(d.type || 'rover', d.name);
    const spec = Object.assign({}, base, d);
    if (!Array.isArray(spec.sensors)) spec.sensors = base.sensors;
    if (!Array.isArray(spec.actuators)) spec.actuators = base.actuators;
    const rec = WORLD_FOR[spec.type] || {};
    return Object.assign({}, spec, derive(spec), { world: d.world || rec.id });
  };

  // ---- canonical command registry. ONE source of truth for which commands a
  // build supports, read by the interpreter host, the assistant and the UI, so
  // no panel invents a command the robot cannot actually run. Keys are the
  // runtime command names (including the lesson aliases the interpreter emits);
  // each maps to the part that must be fitted for the command to be available.
  const BASE_COMMANDS = ['move_forward', 'move_backward', 'turn_left', 'turn_right', 'set_speed', 'stop'];
  // The commands that translate the robot's BASE across the arena. A fixed-base
  // arm (a pedestal manipulator) has no drive, so it must refuse these rather
  // than silently sliding its pedestal around (A13, bugs D4). Kept separate
  // from BASE_COMMANDS so set_speed()/stop() stay available on an arm (they are
  // harmless no-ops) and only the four locomotion verbs are gated.
  const DRIVE_COMMANDS = { move_forward: 1, move_backward: 1, turn_left: 1, turn_right: 1 };
  // The drive actuators that make a build mobile. An arm archetype fits only a
  // gripper, so it has none of these and cannot drive.
  const DRIVE_ACTUATORS = ['motors2', 'motors4', 'servos'];
  // Only commands the interpreter actually implements are gated, keyed by the
  // internal name host.sensor receives (after the lesson-alias mapping). The
  // camera/gps/bumper/line/gripper commands are not implemented, so they are
  // not listed (they would never reach this gate) and are not advertised.
  const COMMAND_PART = {
    distance: 'ultrasonic', read_distance: 'ultrasonic', scan: 'ultrasonic',
    heading: 'imu', read_heading: 'imu', tilt: 'imu',
  };
  // The user-facing command name for each part that HAS a working command,
  // used in messages, the availability list and the assistant grounding.
  const PART_COMMAND = {
    ultrasonic: 'distance', imu: 'heading',
  };
  function partLabel(id) { return (SENSORS[id] && SENSORS[id].name) || (ACTUATORS[id] && ACTUATORS[id].name) || id; }
  // "a"/"an" by leading vowel sound, so refusals read "an IMU"/"an Ultrasonic"
  // rather than "a IMU". Covers the part labels in the catalogue (vowel-letter
  // heuristic is correct for IMU, Ultrasonic, Arm, Camera, Gripper, LiDAR).
  function article(label) { return /^[aeiou]/i.test(String(label || '')) ? 'an' : 'a'; }
  function fittedParts(robot) {
    if (!robot) return null; // no build context (e.g. headless QA): do not gate
    return [].concat(robot.sensors || [], robot.actuators || []);
  }
  window.KodroCommands = {
    COMMAND_PART: COMMAND_PART,
    // {ok} for an always-available command, else {ok:false, part, label, reason}.
    check: function (robot, cmdName) {
      const part = COMMAND_PART[cmdName];
      if (!part) return { ok: true };
      const fitted = fittedParts(robot);
      if (fitted === null || fitted.indexOf(part) >= 0) return { ok: true, part: part };
      return {
        ok: false, part: part, label: partLabel(part),
        reason: 'This robot has no ' + partLabel(part) + ', so ' + cmdName + '() is not available. Fit ' + article(partLabel(part)) + ' ' + partLabel(part) + ' in the Robot Lab to use it.',
      };
    },
    // Drive honesty (A13, bugs D4): a fixed-base arm cannot translate its
    // pedestal, so the four locomotion verbs are refused for an arm build
    // rather than quietly driving 3.4 m across the room. Returns {ok:true} for
    // any command that is not a drive verb, or for a build that actually has a
    // drive actuator fitted; else {ok:false, reason}. Enforced by the live
    // run-pump (hooks.jsx) and the scenario validator (scenario.jsx), which
    // refuse the verb so no motion event is produced. The lesson grader does
    // NOT call driveCheck directly; it grades the events the run produced, so a
    // refused arm records no drive and therefore still cannot satisfy a driving
    // lesson it never physically performed.
    driveCheck: function (robot, cmdName) {
      if (!DRIVE_COMMANDS[cmdName]) return { ok: true };
      if (!robot) return { ok: true }; // no build context (headless QA): do not gate
      const fitted = fittedParts(robot) || [];
      const hasDrive = DRIVE_ACTUATORS.some(function (a) { return fitted.indexOf(a) >= 0; });
      if (hasDrive) return { ok: true };
      if (robot.type === 'arm') {
        return {
          ok: false, type: 'arm',
          reason: 'This is a fixed-base arm; it cannot drive. It works in place. ' + cmdName + '() is not available on a pedestal manipulator.',
        };
      }
      // A non-arm build that somehow has no drive part still cannot move; say
      // so plainly instead of animating a slide with no motor behind it.
      return {
        ok: false, type: robot.type || '',
        reason: 'This build has no drive actuator, so ' + cmdName + '() cannot move it. Fit motors or servos in the Robot Lab to drive.',
      };
    },
    // The full availability list for the UI cards and the assistant grounding:
    // every base command plus one entry per part-gated command, with reasons.
    availability: function (robot) {
      const out = BASE_COMMANDS.map(function (c) {
        // A fixed-base arm cannot run the four locomotion verbs; mark them
        // unavailable here too so the UI cards, the block palette and the
        // assistant grounding all agree with what the run will actually do.
        const dr = window.KodroCommands.driveCheck(robot, c);
        return { name: c, available: dr.ok, requires: dr.ok ? null : 'drive', reason: dr.ok ? null : dr.reason };
      });
      Object.keys(PART_COMMAND).forEach(function (part) {
        const cmd = PART_COMMAND[part];
        const r = window.KodroCommands.check(robot, cmd);
        out.push({ name: cmd, available: r.ok, requires: part, partLabel: partLabel(part), reason: r.ok ? null : r.reason });
      });
      return out;
    },
    // A short grounding line for the assistant: the commands it may use and the
    // ones it must refuse because the part or drive is not fitted.
    groundingText: function (robot) {
      const a = window.KodroCommands.availability(robot);
      const ok = a.filter(function (c) { return c.available; }).map(function (c) { return c.name + '()'; });
      const no = a.filter(function (c) { return !c.available; }).map(function (c) {
        return c.name + '() (needs ' + (c.partLabel || (c.requires === 'drive' ? 'a drive; this is a fixed-base build' : 'a missing part')) + ')';
      });
      let t = 'Commands this build supports: ' + ok.join(', ') + '.';
      if (no.length) t += ' Not available, do not use and refuse if asked: ' + no.join(', ') + '.';
      return t;
    },
  };

  // SI4: per-stat fidelity badge. Tier names come from the schema module so
  // the Lab, the Realism dashboard and the report annex say the same words.
  const TIER_LABEL = { honoured: 'HONOURED', approximated: 'APPROXIMATED', notSimulated: 'NOT SIMULATED' };
  const TIER_TITLE = {
    honoured: 'Honoured exactly by the simulation',
    approximated: 'Approximated: first-order model, honest error bars',
    notSimulated: 'Not simulated: reported only, never driven',
  };
  function Badge(tier) {
    return React.createElement('span', { className: 'fid-badge fid-' + tier, title: TIER_TITLE[tier] }, TIER_LABEL[tier]);
  }

  function Chip(props) {
    const on = props.on;
    return (
      React.createElement('button', {
        type: 'button',
        className: 'rl-chip' + (on ? ' rl-chip-on' : ''),
        onClick: props.onClick,
        'aria-pressed': on,
      },
        React.createElement('span', { className: 'rl-chip-name' }, props.label),
        props.sub ? React.createElement('span', { className: 'rl-chip-sub' }, props.sub) : null
      )
    );
  }

  function RobotLab(props) {
    const [spec, setSpec] = React.useState(load);
    // SI1: import feedback. {errors:[], warnings:[]} after an Import spec, so
    // a clamped field is a VISIBLE per-field diff, never a silent fix-up.
    const [importIssues, setImportIssues] = React.useState(null);
    const fileRef = React.useRef(null);
    const d = derive(spec);
    const t = TYPES[spec.type] || TYPES.rover;
    const rec = WORLD_FOR[spec.type] || WORLD_FOR.rover;
    // Predictive design check: how this exact build will behave in the world it
    // is recommended for, before a single line of code is run.
    const dTerrain = (window.TERRAINS && window.TERRAINS[rec.id]) || null;
    const report = (window.KodroDiagnostics && dTerrain) ? window.KodroDiagnostics.assess(spec, d, dTerrain) : null;

    function pickType(id) { setSpec(specFromType(id, null)); setImportIssues(null); }
    function toggle(kind, id) {
      setSpec(s => {
        const list = (s[kind] || []).slice();
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1); else list.push(id);
        return Object.assign({}, s, { [kind]: list });
      });
    }
    function onSave() { save(spec); if (props.onClose) props.onClose(); }

    // ---- SI1: KRS import/export -----------------------------------------
    function applyImportText(text) {
      const r = window.KodroSpecSchema
        ? window.KodroSpecSchema.validate(text)
        : { ok: false, errors: ['Spec schema unavailable.'], warnings: [] };
      setImportIssues({ errors: r.errors || [], warnings: r.warnings || [] });
      if (r.ok) setSpec(r.spec);
      return r;
    }
    async function onImportClick() {
      // Desktop: native file dialog through the bridge (pick_photo pattern);
      // browser preview: the hidden file input below.
      if (window.RoboLearn && window.RoboLearn.isAvailable() && window.RoboLearn.importRobotSpec) {
        try {
          const r = await window.RoboLearn.importRobotSpec();
          if (r && r.ok) applyImportText(r.text);
          else if (r && r.reason && r.reason !== 'cancelled') setImportIssues({ errors: [r.reason], warnings: [] });
        } catch (e) { setImportIssues({ errors: [String(e)], warnings: [] }); }
        return;
      }
      if (fileRef.current) fileRef.current.click();
    }
    function onFilePicked(e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (f.size > 262144) { setImportIssues({ errors: ['Spec file is larger than 256 KB.'], warnings: [] }); return; }
      const rd = new FileReader();
      rd.onload = function () { applyImportText(String(rd.result)); };
      rd.readAsText(f);
    }
    function specFileName(suffix) {
      // Unicode-aware slug so a non-ASCII robot name (CJK, Cyrillic, accented
      // Latin) is preserved in the download filename instead of collapsing to the
      // generic 'robot' and colliding with every other non-Latin-named export.
      return ((spec.name || 'robot').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'robot') + suffix;
    }
    function downloadText(text, fname, mime) {
      const blob = new Blob([text], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }
    function toast(text, kind) {
      try { window.dispatchEvent(new CustomEvent('kodro-toast', { detail: { text: text, kind: kind || 'info' } })); } catch (e) { void e; }
    }
    async function onExportClick() {
      if (!window.KodroSpecSchema) return;
      const json = window.KodroSpecSchema.exportKrs(spec, Object.assign({}, d, { phys: d.phys }));
      const fname = specFileName('.kodro.json');
      if (window.RoboLearn && window.RoboLearn.isAvailable() && window.RoboLearn.exportRobotSpec) {
        const r = await window.RoboLearn.exportRobotSpec(json, fname);
        toast(r && r.ok ? 'Spec saved: ' + r.path : 'Spec export ' + ((r && r.reason) || 'failed'), r && r.ok ? 'ok' : 'info');
        return;
      }
      downloadText(json, fname, 'application/json');
      toast('Spec downloaded: ' + fname, 'ok');
    }
    // JS mirror of interop/urdf_io.build_urdf_from_spec, so a BROWSER build
    // (no Python bridge) can still download a URDF. Same KRS JSON input the
    // desktop bridge (BridgeAPI.export_urdf) consumes, so both emit the same
    // diff-drive, plain-primitive document. Returns null for a wheel-less
    // build (an arm is not a diff-drive body).
    function urdfFromKrs(data) {
      const name = String((data && data.name) || 'kodro_robot').replace(/[^0-9A-Za-z_]+/g, '_').replace(/^_+|_+$/g, '') || 'kodro_robot';
      const derived = (data && data.derived) || {};
      let massKg = data && data.massKg;
      if (massKg == null) massKg = derived.massG ? derived.massG / 1000 : 0.9;
      const drive = (data && data.drive) || {};
      const wheelCount = drive.motorCount != null ? Math.max(0, drive.motorCount | 0) : 2;
      if (wheelCount < 2) return null;
      const wheelR = drive.wheelRadiusCm ? drive.wheelRadiusCm / 100 : 0.05;
      const cL = 0.4, cW = 0.3, cH = 0.15;
      let wheelMass = Math.round(0.05 * massKg * 1e6) / 1e6;
      let chassisMass = Math.round((massKg - wheelCount * wheelMass) * 1e6) / 1e6;
      if (chassisMass <= 0) { chassisMass = massKg * 0.5; wheelMass = massKg * 0.5 / wheelCount; }
      // Match the Python generator's rounding: masses/offsets at 6dp, inertias
      // at 9dp. The two are NUMERICALLY equivalent (same masses, geometry and
      // inertia to full precision); they are NOT byte-identical because JS and
      // Python format floats differently (2.05e-05 vs 0.0000205), so this pair
      // is not hash-gated like the motion model. Both emit valid URDF a ROS
      // toolchain reads the same way.
      const r6 = v => Math.round(v * 1e6) / 1e6;
      const r9 = v => Math.round(v * 1e9) / 1e9;
      const boxI = (m, x, y, z) => [r9(m * (y * y + z * z) / 12), r9(m * (x * x + z * z) / 12), r9(m * (x * x + y * y) / 12)];
      const cylI = (m, rad, len) => { const lat = r9(m * (3 * rad * rad + len * len) / 12); return [lat, lat, r9(m * rad * rad / 2)]; };
      const wlen = r6(wheelR * 0.4);
      const [ixx, iyy, izz] = boxI(chassisMass, cL, cW, cH);
      const [wixx, wiyy, wizz] = cylI(wheelMass, wheelR, wlen);
      const parts = [
        '<robot name="' + name + '">',
        '  <link name="base_link">',
        '    <inertial>', '      <mass value="' + chassisMass + '"/>',
        '      <inertia ixx="' + ixx + '" ixy="0" ixz="0" iyy="' + iyy + '" iyz="0" izz="' + izz + '"/>', '    </inertial>',
        '    <visual><geometry><box size="' + cL + ' ' + cW + ' ' + cH + '"/></geometry></visual>',
        '    <collision><geometry><box size="' + cL + ' ' + cW + ' ' + cH + '"/></geometry></collision>',
        '  </link>',
      ];
      const halfW = cW / 2, pairCount = Math.max(1, Math.ceil(wheelCount / 2));
      for (let i = 0; i < wheelCount; i++) {
        const side = i % 2 === 0 ? 1 : -1, rank = Math.floor(i / 2);
        const xOff = r6(pairCount > 1 ? (cL * 0.6) * (rank / Math.max(1, pairCount - 1) - 0.5) : 0);
        const yOff = r6(side * (halfW + wlen / 2)), axleZ = -cH / 2;
        parts.push(
          '  <link name="wheel_' + i + '_link">',
          '    <inertial><mass value="' + wheelMass + '"/>',
          '      <inertia ixx="' + wixx + '" ixy="0" ixz="0" iyy="' + wiyy + '" iyz="0" izz="' + wizz + '"/></inertial>',
          '    <visual><geometry><cylinder radius="' + wheelR + '" length="' + wlen + '"/></geometry></visual>',
          '    <collision><geometry><cylinder radius="' + wheelR + '" length="' + wlen + '"/></geometry></collision>',
          '  </link>',
          '  <joint name="wheel_' + i + '_joint" type="continuous">',
          '    <parent link="base_link"/>', '    <child link="wheel_' + i + '_link"/>',
          '    <origin xyz="' + xOff + ' ' + yOff + ' ' + axleZ + '" rpy="-1.5707963 0 0"/>',
          '    <axis xyz="0 0 1"/>', '  </joint>');
      }
      parts.push('</robot>');
      return parts.join('\n') + '\n';
    }
    // One-click "graduate to ROS / Webots / Gazebo": export the build as URDF.
    async function onUrdfClick() {
      if (!window.KodroSpecSchema) return;
      const json = window.KodroSpecSchema.exportKrs(spec, Object.assign({}, d, { phys: d.phys }));
      const fname = specFileName('.urdf');
      if (window.RoboLearn && window.RoboLearn.isAvailable() && window.RoboLearn.exportUrdf) {
        const r = await window.RoboLearn.exportUrdf(json, fname);
        toast(r && r.ok ? 'URDF saved: ' + r.path : 'URDF export ' + ((r && r.reason) || 'failed'), r && r.ok ? 'ok' : 'info');
        return;
      }
      let urdf = null;
      try { urdf = urdfFromKrs(JSON.parse(json)); } catch (e) { void e; }
      if (!urdf) { toast('URDF export is for wheeled (drivable) builds; this build has no wheels.', 'info'); return; }
      downloadText(urdf, fname, 'application/xml');
      toast('URDF downloaded: ' + fname, 'ok');
    }
    // SI3: generate and save the "your robot as simulated" report.
    async function onReportClick() {
      if (!window.KodroVerify) return;
      const robotNow = Object.assign({}, spec, d, { phys: d.phys });
      const rep = window.KodroVerify.report(robotNow, dTerrain);
      const html = window.KodroVerify.toHtml(rep);
      const fname = specFileName('-verification.html');
      if (window.RoboLearn && window.RoboLearn.isAvailable() && window.RoboLearn.saveVerificationReport) {
        const r = await window.RoboLearn.saveVerificationReport(html, fname);
        toast(r && r.ok ? 'Verification report saved: ' + r.path : 'Report ' + ((r && r.reason) || 'failed'), r && r.ok ? 'ok' : 'info');
        return;
      }
      downloadText(html, fname, 'text/html');
      toast('Verification report downloaded: ' + fname, 'ok');
    }

    return (
      React.createElement('div', { className: 'modal-backdrop', onClick: () => props.onClose && props.onClose() },
        React.createElement('div', { className: 'modal modal-wide rl-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Robot Lab', onClick: e => e.stopPropagation() },
          React.createElement('div', { className: 'modal-head' },
            React.createElement('span', { className: 'eyebrow' }, window.KodroIcons ? window.KodroIcons.el('lab') : null, 'Robot Lab. Design a robot, then run it in the world'),
            React.createElement('button', { className: 'btn-mini', 'aria-label': 'Close', onClick: () => props.onClose && props.onClose() }, '✕')
          ),
          React.createElement('div', { className: 'rl-body' },
            // ---- choose archetype
            React.createElement('div', { className: 'rl-section' },
              React.createElement('div', { className: 'rl-label' }, '1 · Pick a robot'),
              React.createElement('div', { className: 'rl-types' },
                Object.keys(TYPES).map(id => {
                  const ty = TYPES[id];
                  return React.createElement('button', {
                    key: id, type: 'button',
                    className: 'rl-type' + (spec.type === id ? ' rl-type-on' : ''),
                    onClick: () => pickType(id), 'aria-pressed': spec.type === id,
                  },
                    React.createElement('span', { className: 'rl-type-ic', 'aria-hidden': 'true' }, window.KodroIcons ? window.KodroIcons.el(ty.icon) : null),
                    React.createElement('span', { className: 'rl-type-name' }, ty.name)
                  );
                })
              ),
              React.createElement('p', { className: 'rl-blurb' }, t.blurb)
            ),
            // ---- name + board
            React.createElement('div', { className: 'rl-section rl-row2' },
              React.createElement('label', { className: 'rl-field' },
                React.createElement('span', { className: 'rl-label' }, 'Name'),
                React.createElement('input', {
                  className: 'rl-input', value: spec.name, maxLength: 28,
                  onChange: e => setSpec(s => Object.assign({}, s, { name: e.target.value })),
                })
              ),
              React.createElement('label', { className: 'rl-field' },
                React.createElement('span', { className: 'rl-label' }, 'Controller board'),
                React.createElement('select', {
                  className: 'rl-input', value: spec.board,
                  onChange: e => setSpec(s => Object.assign({}, s, { board: e.target.value })),
                },
                  Object.keys(BOARDS).map(id => React.createElement('option', { key: id, value: id }, BOARDS[id].name))
                )
              )
            ),
            React.createElement('p', { className: 'rl-note' }, BOARDS[spec.board] ? BOARDS[spec.board].note : ''),
            // ---- sensors
            React.createElement('div', { className: 'rl-section' },
              React.createElement('div', { className: 'rl-label' }, '2 · Sensors. Each unlocks a command'),
              React.createElement('div', { className: 'rl-chips' },
                Object.keys(SENSORS).map(id => React.createElement(Chip, {
                  key: id, on: (spec.sensors || []).indexOf(id) >= 0,
                  label: SENSORS[id].name, sub: SENSORS[id].enables,
                  onClick: () => toggle('sensors', id),
                }))
              )
            ),
            // ---- actuators
            React.createElement('div', { className: 'rl-section' },
              React.createElement('div', { className: 'rl-label' }, '3 · Drive & actuators'),
              React.createElement('div', { className: 'rl-chips' },
                Object.keys(ACTUATORS).map(id => React.createElement(Chip, {
                  key: id, on: (spec.actuators || []).indexOf(id) >= 0,
                  label: ACTUATORS[id].name, sub: ACTUATORS[id].enables || ((ACTUATORS[id].speed || 1) + '× speed'),
                  onClick: () => toggle('actuators', id),
                }))
              )
            ),
            // ---- live spec readout (every stat carries its SI4 fidelity badge)
            React.createElement('div', { className: 'rl-spec' },
              React.createElement('div', { className: 'rl-stat' }, React.createElement('b', null, d.mass + ' g'), React.createElement('span', null, 'total mass ', Badge('honoured'))),
              React.createElement('div', { className: 'rl-stat' }, React.createElement('b', null, '~' + d.runtimeMin + ' min'), React.createElement('span', null, 'battery / charge ', Badge('approximated'))),
              React.createElement('div', { className: 'rl-stat' }, React.createElement('b', null, d.phys && d.phys.vMaxSimCmPerS !== undefined ? (d.phys.vMaxSimCmPerS / 100).toFixed(2) + ' m/s' : d.speedFactor.toFixed(2) + '×'), React.createElement('span', null, 'top speed (no-load) ', Badge((d.phys && d.phys.badges && d.phys.badges.topSpeed) || 'honoured'))),
              React.createElement('div', { className: 'rl-stat rl-stat-wide' },
                React.createElement('b', null, d.commands.length ? d.commands.map(c => c + '()').join('  ') : 'move()  turn()  only'),
                React.createElement('span', null, 'commands this build supports ', Badge('honoured'))
              )
            ),
            // ---- SI1: measured-build banner for an imported KRS spec
            spec.physical && d.phys && React.createElement('div', { className: 'rl-measured', 'data-spec-import': 'measured' },
              React.createElement('div', { className: 'rl-measured-head' },
                React.createElement('span', { className: 'rl-label', style: { margin: 0 } }, 'Measured build - imported spec drives the sim; each stat carries its own fidelity badge')
              ),
              React.createElement('div', { className: 'rl-measured-grid' },
                React.createElement('span', null, 'Mass ', React.createElement('b', null, d.phys.massKg !== undefined ? d.phys.massKg + ' kg' : '-')),
                React.createElement('span', null, 'Top speed (no-load) ', React.createElement('b', null, d.phys.vMaxCmPerS !== undefined ? (d.phys.vMaxCmPerS / 100).toFixed(2) + ' m/s' : 'catalogue')),
                React.createElement('span', null, 'Runtime ', React.createElement('b', null, d.phys.runtimeMin !== undefined ? '~' + d.phys.runtimeMin + ' min' : 'catalogue')),
                React.createElement('span', null, 'Body ', React.createElement('b', null, d.phys.collisionRadiusCm !== undefined ? Math.round(d.phys.collisionRadiusCm * 2) + ' cm circle' : '60 cm default')),
                React.createElement('span', null, 'Sensor ', React.createElement('b', null, d.phys.sensor ? '+' + d.phys.sensor.fwdCm + ' cm fwd, ' + d.phys.sensor.rangeCm + ' cm range' : 'none imported')),
                d.phys.maxSlopeDeg !== undefined ? React.createElement('span', null, 'Max grade (static est.) ', React.createElement('b', null, d.phys.maxSlopeDeg + '°'), ' ', Badge('notSimulated')) : null
              ),
              (d.phys.warnings && d.phys.warnings.length) ? React.createElement('ul', { className: 'rl-issues rl-issues-warn' },
                d.phys.warnings.map(function (w, i) { return React.createElement('li', { key: i }, w); })
              ) : null
            ),
            // ---- SI1: per-field import diff (clamps are visible, never silent)
            importIssues && (importIssues.errors.length > 0 || importIssues.warnings.length > 0) ? React.createElement('div', { className: 'rl-import-report', role: 'status' },
              importIssues.errors.length > 0 ? React.createElement('div', null,
                React.createElement('div', { className: 'rl-label', style: { color: 'var(--danger)' } }, 'Import rejected - fix these fields'),
                React.createElement('ul', { className: 'rl-issues rl-issues-err' }, importIssues.errors.map(function (e2, i) { return React.createElement('li', { key: i }, e2); }))
              ) : React.createElement('div', null,
                React.createElement('div', { className: 'rl-label' }, 'Imported with adjustments'),
                React.createElement('ul', { className: 'rl-issues rl-issues-warn' }, importIssues.warnings.map(function (w, i) { return React.createElement('li', { key: i }, w); }))
              )
            ) : null,
            // ---- predictive design check: will this build cope, and why
            report && React.createElement('div', { className: 'rl-section', style: { background: 'var(--navy-2)', border: '1.5px solid color-mix(in srgb, ' + diagColor(report.overall) + ' 33%, transparent)', borderRadius: 14, padding: 16 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 } },
                React.createElement('span', { className: 'rl-label', style: { margin: 0 } }, 'Design check'),
                React.createElement('span', { style: { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--void)', background: diagColor(report.overall), borderRadius: 6, padding: '3px 9px' } }, diagWord(report.overall))
              ),
              React.createElement('p', { className: 'rl-blurb', style: { margin: '2px 0 10px' } }, report.summary),
              React.createElement('div', { style: { display: 'grid', gap: 7 } },
                report.dimensions.map(function (dim) {
                  return React.createElement('div', { key: dim.key, style: { display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45 } },
                    React.createElement('span', { 'aria-hidden': 'true', style: { width: 8, height: 8, borderRadius: '50%', background: diagColor(dim.status), marginTop: 4, flex: '0 0 auto' } }),
                    React.createElement('span', { style: { fontWeight: 650, color: 'var(--fg-1)', flex: '0 0 96px' } }, dim.label),
                    React.createElement('span', { style: { color: 'var(--fg-2)' } }, dim.reason + (dim.fix ? '  Fix: ' + dim.fix : ''))
                  );
                })
              )
            ),
            // ---- the assistant recommends where to validate this robot first
            React.createElement('div', { className: 'rl-rec' },
              React.createElement('span', { className: 'rl-rec-tag' }, 'Best tested in'),
              React.createElement('b', null, rec.label),
              React.createElement('span', { className: 'rl-rec-why' }, rec.why)
            )
          ),
          React.createElement('div', { className: 'rl-foot' },
            React.createElement('button', { className: 'btn-mini', onClick: () => { setSpec(specFromType(spec.type, spec.name)); setImportIssues(null); } }, 'Reset parts'),
            // SI1: import a real robot's KRS JSON / export this build's spec.
            React.createElement('button', { className: 'btn-mini', 'data-spec-import': 'button', title: 'Import a KRS robot spec (JSON): real motor, battery, body and sensor numbers drive the sim', onClick: onImportClick }, 'Import spec'),
            React.createElement('button', { className: 'btn-mini', title: 'Export this build as a KRS spec plus its derived numbers', onClick: onExportClick }, 'Export spec'),
            React.createElement('button', { className: 'btn-mini', title: 'Export a URDF to open this build in ROS, RViz, Webots or Gazebo', onClick: onUrdfClick }, 'Export URDF'),
            React.createElement('button', { className: 'btn-mini', title: 'Save the verification report: your robot as simulated, predictions plus measured evidence', onClick: onReportClick }, 'Verification report'),
            // A6: price THIS build as real hardware (opens the budget planner
            // seeded with the active spec), merging the two build features.
            props.onBuildReal ? React.createElement('button', { className: 'btn-mini', title: 'Price this build as real hardware within a budget', onClick: function () { props.onBuildReal(); } }, 'Build real') : null,
            React.createElement('input', { ref: fileRef, type: 'file', accept: '.json,application/json', style: { display: 'none' }, 'aria-hidden': 'true', tabIndex: -1, onChange: onFilePicked }),
            React.createElement('button', { className: 'ctrl ctrl-run', onClick: onSave }, '✓ Build & test in ' + rec.label)
          )
        )
      )
    );
  }

  // Statics so other modules (e.g. onboarding) can reuse the canonical robot
  // catalogue and world-recommendation logic instead of duplicating it.
  RobotLab.TYPES = TYPES;
  RobotLab.WORLD_FOR = WORLD_FOR;
  RobotLab.selectType = function (typeId) {
    const spec = specFromType(typeId);
    save(spec);
    return spec;
  };

  // Honest copy shown when a free-text description carried no recognisable
  // robot signal: we default to a general rover rather than force a bogus match
  // on an accidental substring, and say so plainly.
  const NL_FALLBACK_NOTE = 'I could not map that to specific parts, so I built a general rover you can customise in the Robot Lab.';

  // ---- onboarding agent: natural language -> a validated RobotSpec ----------
  // The starting-page agent maps a spoken or typed description onto the SAME
  // parts catalogue, so it can only ever produce a buildable robot. It never
  // emits executable code; the output is data, validated field by field against
  // the catalogue, with anything unknown dropped. This is the deterministic
  // path; a local model may rephrase the prompt first, but this mapper has the
  // final word on what parts the robot actually gets.
  function robotFromText(text) {
    const t = String(text || '').toLowerCase();
    let type = 'rover';
    // `understood` tracks whether the text carried ANY recognisable robot
    // signal (a type, part, sensor or board keyword). If nothing matches -- a
    // name or nonsense like "carl johnson in gta" -- we still return a sensible
    // default rover, but flag it so the caller can be honest that it guessed a
    // general build instead of silently pretending it understood.
    let understood = false;
    // Keyword tokens must match on a word boundary, not as an accidental
    // substring: "car" must fire on "a car" / "car robot" but NOT on "carl".
    // The same guard protects "road" (which used to fire inside "broad").
    if (/\bcars?\b|vehicle|self.?driv|autonomous|\broad\b|traffic/.test(t)) { type = 'car'; understood = true; }
    else if (/robotic arm|\barm\b|manipulat|pick and place/.test(t)) { type = 'arm'; understood = true; }
    else if (/home|companion|personal|indoor|assistant|helper|house/.test(t)) { type = 'home'; understood = true; }
    else if (/rover|explor|terrain|outdoor|mars|moon|planet|rough/.test(t)) { type = 'rover'; understood = true; }
    const spec = specFromType(type, null);
    const sensors = spec.sensors.slice();
    const actuators = spec.actuators.slice();
    function add(list, id) { if (list.indexOf(id) < 0) list.push(id); }
    function drop(list, id) { const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); }
    if (/camera|vision|\bsee\b|marker|look/.test(t)) { add(sensors, 'camera'); understood = true; }
    if (/ultrasonic|distance|obstacle|avoid|range|sonar/.test(t)) { add(sensors, 'ultrasonic'); understood = true; }
    if (/imu|gyro|balance|tilt|orient|accelerom/.test(t)) { add(sensors, 'imu'); understood = true; }
    if (/gps|location|position|navigat/.test(t)) { add(sensors, 'gps'); understood = true; }
    if (/line follow|follow.?line|\bline\b|track/.test(t)) { add(sensors, 'line'); understood = true; }
    if (/bumper|touch|contact|switch/.test(t)) { add(sensors, 'bumper'); understood = true; }
    if (/gripper|grab|grip|claw|\bpick\b/.test(t)) { add(actuators, 'gripper'); understood = true; }
    if (/four wheel|4 wheel|4wd|four.?motor|all.?wheel/.test(t)) { add(actuators, 'motors4'); drop(actuators, 'motors2'); understood = true; }
    if (/steer|servo|ackermann/.test(t)) { add(actuators, 'servos'); understood = true; }
    let board = spec.board;
    if (/arduino|uno/.test(t)) { board = 'uno'; understood = true; }
    else if (/micro.?bit/.test(t)) { board = 'microbit'; understood = true; }
    else if (/pico|raspberry/.test(t)) { board = 'pico'; understood = true; }
    else if (/esp32|\besp\b/.test(t)) { board = 'esp32'; understood = true; }
    // Validate every field against the catalogue: drop anything unknown.
    const vs = sensors.filter(function (s) { return SENSORS[s]; });
    const va = actuators.filter(function (a) { return ACTUATORS[a]; });
    const vb = BOARDS[board] ? board : 'esp32';
    const name = (TYPES[type] && TYPES[type].name) || 'My Robot';
    return { type: type, name: name, board: vb, sensors: vs, actuators: va, understood: understood };
  }
  RobotLab.fromText = robotFromText;
  // Canonical honest copy for the not-understood case, exposed so a consumer can
  // render the same wording buildFromText returns in its `note` field.
  RobotLab.NL_FALLBACK_NOTE = NL_FALLBACK_NOTE;
  // Apply an arbitrary spec, validated against the catalogue and saved. Used by
  // the guided demo to add or remove a part and show the command registry react.
  RobotLab.applySpec = function (spec) {
    const vs = (spec.sensors || []).filter(function (s) { return SENSORS[s]; });
    const va = (spec.actuators || []).filter(function (a) { return ACTUATORS[a]; });
    const vb = BOARDS[spec.board] ? spec.board : 'esp32';
    const vt = TYPES[spec.type] ? spec.type : 'rover';
    const clean = { type: vt, name: spec.name || 'My Robot', board: vb, sensors: vs, actuators: va };
    save(clean);
    return { spec: clean, derived: derive(clean), world: (WORLD_FOR[clean.type] || {}) };
  };
  RobotLab.buildFromText = function (text) {
    const parsed = robotFromText(text);
    // Keep the persisted RobotSpec clean: `understood` is mapping metadata for
    // the caller's UI, not a part of the robot, so it rides in the envelope and
    // never lands in localStorage or the sim's KODRO_ROBOT.
    const spec = { type: parsed.type, name: parsed.name, board: parsed.board, sensors: parsed.sensors, actuators: parsed.actuators };
    save(spec);
    // `note` is a ready-to-display honest line for the not-understood case, so
    // any consumer (onboarding agent, plan-parts adopt) can surface it with a
    // single render instead of silently shipping a guessed build.
    const note = parsed.understood ? null : NL_FALLBACK_NOTE;
    return { spec: spec, derived: derive(spec), world: (WORLD_FOR[spec.type] || {}), understood: parsed.understood, note: note };
  };
  // SI1: apply a KRS spec from raw JSON text - the SAME validate-then-save
  // path the Lab's Import button drives after reading the file, exposed so
  // the QA harness (and the demo) can exercise import end to end without a
  // native file dialog. Returns the validator result.
  RobotLab.importSpecText = function (text) {
    const r = window.KodroSpecSchema
      ? window.KodroSpecSchema.validate(text)
      : { ok: false, errors: ['Spec schema unavailable.'], warnings: [] };
    if (r.ok) save(r.spec);
    return r;
  };
  window.KodroRobotFromText = robotFromText;

  window.RobotLab = RobotLab;
})();
