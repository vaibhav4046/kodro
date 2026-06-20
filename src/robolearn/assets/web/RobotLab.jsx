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
  const STORE = 'kodro_robot_v1';

  // ---- parts catalogue. mass is grams; "enables" lists the Python the part unlocks.
  const BOARDS = {
    esp32: { id: 'esp32', name: 'ESP32', mass: 10, note: 'Wi-Fi + Bluetooth, dual core. The hobby default.' },
    microbit: { id: 'microbit', name: 'micro:bit v2', mass: 9, note: 'Classroom friendly, built-in buttons and LEDs.' },
    pico: { id: 'pico', name: 'Raspberry Pi Pico', mass: 6, note: 'Cheap, low power, MicroPython native.' },
    uno: { id: 'uno', name: 'Arduino Uno', mass: 25, note: 'Rugged and forgiving, a classic first board.' },
  };
  const SENSORS = {
    ultrasonic: { id: 'ultrasonic', name: 'Ultrasonic range', mass: 9, enables: 'sensor()  distance ahead', cmd: 'sensor' },
    line: { id: 'line', name: 'Line follower', mass: 6, enables: 'on_line()  follow a track', cmd: 'on_line' },
    imu: { id: 'imu', name: 'IMU (gyro + accel)', mass: 4, enables: 'heading()  stable turns', cmd: 'heading' },
    camera: { id: 'camera', name: 'Camera', mass: 12, enables: 'see()  look for a marker', cmd: 'see' },
    gps: { id: 'gps', name: 'GPS', mass: 8, enables: 'locate()  position outdoors', cmd: 'locate' },
    bumper: { id: 'bumper', name: 'Bumper switch', mass: 5, enables: 'bumped()  contact stop', cmd: 'bumped' },
  };
  const ACTUATORS = {
    motors2: { id: 'motors2', name: '2 DC motors', mass: 120, speed: 1.0, note: 'Two wheels, differential drive.' },
    motors4: { id: 'motors4', name: '4 DC motors', mass: 220, speed: 1.25, note: 'Four wheels, more grip and torque.' },
    servos: { id: 'servos', name: 'Steering servo', mass: 40, speed: 1.1, note: 'Car style front steering.' },
    gripper: { id: 'gripper', name: 'Gripper arm', mass: 90, speed: 0.9, enables: 'grab()  pick things up', cmd: 'grab' },
  };

  const TYPES = {
    rover: {
      id: 'rover', name: 'Rover', emoji: '🛻',
      blurb: 'A wheeled explorer for rough ground. The all rounder.',
      base: { board: 'esp32', sensors: ['ultrasonic', 'imu'], actuators: ['motors4'] },
    },
    car: {
      id: 'car', name: 'Self-driving car', emoji: '🚗',
      blurb: 'A road vehicle. Validate it among pedestrians and traffic.',
      base: { board: 'esp32', sensors: ['ultrasonic', 'camera', 'gps'], actuators: ['motors2', 'servos'] },
    },
    home: {
      id: 'home', name: 'Personal robot', emoji: '🤖',
      blurb: 'A helper that shares space with people indoors.',
      base: { board: 'pico', sensors: ['ultrasonic', 'bumper', 'camera'], actuators: ['motors2', 'gripper'] },
    },
    arm: {
      id: 'arm', name: 'Robotic arm', emoji: '🦾',
      blurb: 'A fixed manipulator. Reach, grab and place.',
      base: { board: 'uno', sensors: ['camera'], actuators: ['gripper'] },
    },
    custom: {
      id: 'custom', name: 'Custom build', emoji: '🔧',
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
    custom: { id: 'city', label: 'Riverside City', why: 'start in the busy city, then try the others.' },
  };

  const CHASSIS_MASS = 380; // grams, frame + battery + wiring, before parts

  // Colour + word for a design-check status, shared by the verdict UI.
  function diagColor(s) { return s === 'fail' ? '#ff6b5e' : s === 'warn' ? '#f5c451' : '#5ce0d8'; }
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
    let mass = CHASSIS_MASS + (BOARDS[spec.board] ? BOARDS[spec.board].mass : 10);
    (spec.sensors || []).forEach(s => { if (SENSORS[s]) mass += SENSORS[s].mass; });
    let speed = 0;
    (spec.actuators || []).forEach(a => { if (ACTUATORS[a]) { mass += ACTUATORS[a].mass; speed = Math.max(speed, ACTUATORS[a].speed || 0); } });
    if (speed === 0) speed = 0.8; // no drive parts: it barely crawls
    const baseline = 900; // grams ~ a typical small rover
    const massFactor = Math.min(1.8, Math.max(0.6, mass / baseline));
    const speedFactor = Math.min(1.45, Math.max(0.7, speed));
    // crude runtime estimate: lighter + fewer parts last longer on one charge
    const runtimeMin = Math.round(60 / massFactor);
    const cmds = [];
    (spec.sensors || []).forEach(s => { if (SENSORS[s] && SENSORS[s].cmd) cmds.push(SENSORS[s].cmd); });
    (spec.actuators || []).forEach(a => { if (ACTUATORS[a] && ACTUATORS[a].cmd) cmds.push(ACTUATORS[a].cmd); });
    return { mass, massFactor, speedFactor, runtimeMin, commands: cmds };
  }

  function load() {
    try { const raw = localStorage.getItem(STORE); if (raw) return JSON.parse(raw); } catch (e) { void e; }
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
    if (!window.KODRO_ROBOT) { const s = load(); window.KODRO_ROBOT = Object.assign({}, s, derive(s)); }
    return window.KODRO_ROBOT;
  };
  // Make sure a default exists from first load so the sim never sees undefined.
  window.getKodroRobot();

  // ---- canonical command registry. ONE source of truth for which commands a
  // build supports, read by the interpreter host, the assistant and the UI, so
  // no panel invents a command the robot cannot actually run. Keys are the
  // runtime command names (including the lesson aliases the interpreter emits);
  // each maps to the part that must be fitted for the command to be available.
  const BASE_COMMANDS = ['move_forward', 'move_backward', 'turn_left', 'turn_right', 'set_speed', 'stop'];
  const COMMAND_PART = {
    distance: 'ultrasonic', read_distance: 'ultrasonic', sensor: 'ultrasonic',
    heading: 'imu', read_heading: 'imu', tilt: 'imu',
    see: 'camera', locate: 'gps', bumped: 'bumper', on_line: 'line', grab: 'gripper',
  };
  // The user-facing command name for each part, used in messages and the UI.
  const PART_COMMAND = {
    ultrasonic: 'read_distance', imu: 'read_heading', camera: 'see',
    gps: 'locate', bumper: 'bumped', line: 'on_line', gripper: 'grab',
  };
  function partLabel(id) { return (SENSORS[id] && SENSORS[id].name) || (ACTUATORS[id] && ACTUATORS[id].name) || id; }
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
        reason: 'This robot has no ' + partLabel(part) + ', so ' + cmdName + '() is not available. Fit a ' + partLabel(part) + ' in the Robot Lab to use it.',
      };
    },
    // The full availability list for the UI cards and the assistant grounding:
    // every base command plus one entry per part-gated command, with reasons.
    availability: function (robot) {
      const out = BASE_COMMANDS.map(function (c) { return { name: c, available: true, requires: null }; });
      Object.keys(PART_COMMAND).forEach(function (part) {
        const cmd = PART_COMMAND[part];
        const r = window.KodroCommands.check(robot, cmd);
        out.push({ name: cmd, available: r.ok, requires: part, partLabel: partLabel(part), reason: r.ok ? null : r.reason });
      });
      return out;
    },
    // A short grounding line for the assistant: the commands it may use and the
    // ones it must refuse because the part is not fitted.
    groundingText: function (robot) {
      const a = window.KodroCommands.availability(robot);
      const ok = a.filter(function (c) { return c.available; }).map(function (c) { return c.name + '()'; });
      const no = a.filter(function (c) { return !c.available; }).map(function (c) { return c.name + '() (needs ' + c.partLabel + ')'; });
      let t = 'Commands this build supports: ' + ok.join(', ') + '.';
      if (no.length) t += ' Not available, do not use and refuse if asked: ' + no.join(', ') + '.';
      return t;
    },
  };

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
    const d = derive(spec);
    const t = TYPES[spec.type] || TYPES.rover;
    const rec = WORLD_FOR[spec.type] || WORLD_FOR.rover;
    // Predictive design check: how this exact build will behave in the world it
    // is recommended for, before a single line of code is run.
    const dTerrain = (window.TERRAINS && window.TERRAINS[rec.id]) || null;
    const report = (window.KodroDiagnostics && dTerrain) ? window.KodroDiagnostics.assess(spec, d, dTerrain) : null;

    function pickType(id) { setSpec(specFromType(id, null)); }
    function toggle(kind, id) {
      setSpec(s => {
        const list = (s[kind] || []).slice();
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1); else list.push(id);
        return Object.assign({}, s, { [kind]: list });
      });
    }
    function onSave() { save(spec); if (props.onClose) props.onClose(); }

    return (
      React.createElement('div', { className: 'modal-backdrop', onClick: () => props.onClose && props.onClose() },
        React.createElement('div', { className: 'modal modal-wide rl-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Robot Lab', onClick: e => e.stopPropagation() },
          React.createElement('div', { className: 'modal-head' },
            React.createElement('span', { className: 'eyebrow' }, '🛠 Robot Lab. Design a robot, then run it in the world'),
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
                    React.createElement('span', { className: 'rl-type-emoji' }, ty.emoji),
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
            // ---- live spec readout
            React.createElement('div', { className: 'rl-spec' },
              React.createElement('div', { className: 'rl-stat' }, React.createElement('b', null, d.mass + ' g'), React.createElement('span', null, 'total mass')),
              React.createElement('div', { className: 'rl-stat' }, React.createElement('b', null, '~' + d.runtimeMin + ' min'), React.createElement('span', null, 'battery / charge')),
              React.createElement('div', { className: 'rl-stat' }, React.createElement('b', null, d.speedFactor.toFixed(2) + '×'), React.createElement('span', null, 'top speed')),
              React.createElement('div', { className: 'rl-stat rl-stat-wide' },
                React.createElement('b', null, d.commands.length ? d.commands.map(c => c + '()').join('  ') : 'move()  turn()  only'),
                React.createElement('span', null, 'commands this build supports')
              )
            ),
            // ---- predictive design check: will this build cope, and why
            report && React.createElement('div', { className: 'rl-section', style: { background: '#0e1622', border: '1.5px solid ' + diagColor(report.overall) + '55', borderRadius: 14, padding: 16 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 } },
                React.createElement('span', { className: 'rl-label', style: { margin: 0 } }, 'Design check'),
                React.createElement('span', { style: { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#06121b', background: diagColor(report.overall), borderRadius: 6, padding: '3px 9px' } }, diagWord(report.overall))
              ),
              React.createElement('p', { className: 'rl-blurb', style: { margin: '2px 0 10px' } }, report.summary),
              React.createElement('div', { style: { display: 'grid', gap: 7 } },
                report.dimensions.map(function (dim) {
                  return React.createElement('div', { key: dim.key, style: { display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45 } },
                    React.createElement('span', { 'aria-hidden': 'true', style: { width: 8, height: 8, borderRadius: '50%', background: diagColor(dim.status), marginTop: 4, flex: '0 0 auto' } }),
                    React.createElement('span', { style: { fontWeight: 650, color: '#dce8f8', flex: '0 0 96px' } }, dim.label),
                    React.createElement('span', { style: { color: '#9fb4d2' } }, dim.reason + (dim.fix ? '  Fix: ' + dim.fix : ''))
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
            React.createElement('button', { className: 'btn-mini', onClick: () => setSpec(specFromType(spec.type, spec.name)) }, 'Reset parts'),
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
    if (/(car|vehicle|self.?driv|autonomous|road|traffic)/.test(t)) type = 'car';
    else if (/(robotic arm|\barm\b|manipulat|pick and place)/.test(t)) type = 'arm';
    else if (/(home|companion|personal|indoor|assistant|helper|house)/.test(t)) type = 'home';
    else if (/(rover|explor|terrain|outdoor|mars|moon|planet|rough)/.test(t)) type = 'rover';
    const spec = specFromType(type, null);
    const sensors = spec.sensors.slice();
    const actuators = spec.actuators.slice();
    function add(list, id) { if (list.indexOf(id) < 0) list.push(id); }
    function drop(list, id) { const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); }
    if (/(camera|vision|\bsee\b|marker|look)/.test(t)) add(sensors, 'camera');
    if (/(ultrasonic|distance|obstacle|avoid|range|sonar)/.test(t)) add(sensors, 'ultrasonic');
    if (/(imu|gyro|balance|tilt|orient|accelerom)/.test(t)) add(sensors, 'imu');
    if (/(gps|location|position|navigat)/.test(t)) add(sensors, 'gps');
    if (/(line follow|follow.?line|\bline\b|track)/.test(t)) add(sensors, 'line');
    if (/(bumper|touch|contact|switch)/.test(t)) add(sensors, 'bumper');
    if (/(gripper|grab|grip|claw|\bpick\b)/.test(t)) add(actuators, 'gripper');
    if (/(four wheel|4 wheel|4wd|four.?motor|all.?wheel)/.test(t)) { add(actuators, 'motors4'); drop(actuators, 'motors2'); }
    if (/(steer|servo|ackermann)/.test(t)) add(actuators, 'servos');
    let board = spec.board;
    if (/arduino|uno/.test(t)) board = 'uno';
    else if (/micro.?bit/.test(t)) board = 'microbit';
    else if (/pico|raspberry/.test(t)) board = 'pico';
    else if (/esp32|\besp\b/.test(t)) board = 'esp32';
    // Validate every field against the catalogue: drop anything unknown.
    const vs = sensors.filter(function (s) { return SENSORS[s]; });
    const va = actuators.filter(function (a) { return ACTUATORS[a]; });
    const vb = BOARDS[board] ? board : 'esp32';
    const name = (TYPES[type] && TYPES[type].name) || 'My Robot';
    return { type: type, name: name, board: vb, sensors: vs, actuators: va };
  }
  RobotLab.fromText = robotFromText;
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
    const spec = robotFromText(text);
    save(spec);
    return { spec: spec, derived: derive(spec), world: (WORLD_FOR[spec.type] || {}) };
  };
  window.KodroRobotFromText = robotFromText;

  window.RobotLab = RobotLab;
})();
