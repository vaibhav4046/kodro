/* Offline functional QA for the web interpreter + kinematics.
 *
 * Loads the SHIPPED interpreter.js under Node, drives its generator exactly the
 * way app.jsx does (same move/turn/speed formulas, same wall ray for sensors),
 * and asserts every command and every shipped example behaves: terminates,
 * moves when it should, stays in the arena, never throws. No browser, no rAF,
 * so the automation throttle that zeroes rafFired cannot mask anything here.
 */
import { readFileSync, readdirSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/robolearn/assets/web/interpreter.js', import.meta.url), 'utf8');
const MM_SRC = readFileSync(new URL('../src/robolearn/assets/web/motion-model.js', import.meta.url), 'utf8');

// --- load the IIFEs with a window shim ------------------------------------
const win = {};
new Function('window', SRC)(win);
new Function('window', MM_SRC)(win);
const { compile } = win.RoverLang;
const KM = win.KodroMotion;

const WALL = KM.MODEL.arenaHalfExtentCm; // arena half-extent (shared model, E-P1)
// Ray to the arena box along the heading, mirroring app.jsx rayDistance.
function rayToWall(x, y, headingDeg) {
  const a = headingDeg * Math.PI / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  let best = Infinity;
  for (const [d, p, lim] of [[dx, x, WALL], [dy, y, WALL]]) {
    if (d > 1e-9) best = Math.min(best, (lim - p) / d);
    else if (d < -1e-9) best = Math.min(best, (-lim - p) / d);
  }
  return Math.max(0, Math.round(best));
}

// Run one program to completion, applying the real kinematics. Returns a trace.
function run(src) {
  const s = { x: 0, y: 0, heading: 0, speed: 50, battery: 100 };
  const host = {
    sensor(name) {
      switch (name) {
        case 'distance': return rayToWall(s.x, s.y, s.heading);
        case 'heading': return Math.round(((s.heading % 360) + 360) % 360);
        case 'battery': return Math.round(s.battery);
        case 'speed': return Math.round(s.speed);
        case 'x': return Math.round(s.x);
        case 'y': return Math.round(-s.y);
        case 'gravity': return 3.71;
        case 'temperature': return -60;
        case 'light': return 0.5;
        case 'tilt': return 0;
        default: return 0;
      }
    }
  };
  const gen = compile(src).run(host);
  let steps = 0, moves = 0, turns = 0, crashed = false, maxR = 0;
  const HARD_CAP = 2_000_000;
  while (true) {
    let res;
    res = gen.next();                  // throws propagate to caller = test fail
    if (res.done) break;
    if (++steps > HARD_CAP) throw new Error('did not terminate (' + steps + ' steps)');
    const ev = res.value;
    if (ev.type === 'move') {
      moves++;
      const a = s.heading * Math.PI / 180;
      const dirx = Math.sin(a) * ev.dir, diry = -Math.cos(a) * ev.dir;
      const x0 = s.x, y0 = s.y;
      const nx = s.x + dirx * ev.distance, ny = s.y + diry * ev.distance;
      if (Math.abs(nx) > WALL || Math.abs(ny) > WALL) {
        crashed = true;                 // would hit wall: clamp at boundary
        s.x = Math.max(-WALL, Math.min(WALL, nx));
        s.y = Math.max(-WALL, Math.min(WALL, ny));
      } else { s.x = nx; s.y = ny; }
      // Battery via the SHARED motion model (E-P1) at nominal Earth
      // conditions (massFactor 1, traction 1), on the distance actually
      // covered - so battery()-reading programs (Encore) trace honestly.
      s.battery = Math.max(0, s.battery - KM.moveDrainPct(Math.hypot(s.x - x0, s.y - y0), KM.MODEL.gravityEarthMps2, 1, 1));
      maxR = Math.max(maxR, Math.hypot(s.x, s.y));
    } else if (ev.type === 'turn') {
      turns++; s.heading += ev.deg;
      s.battery = Math.max(0, s.battery - KM.turnDrainPct(ev.deg));
    } else if (ev.type === 'speed') {
      s.speed = Math.max(0, Math.min(100, ev.value));
    }
  }
  return { steps, moves, turns, crashed, finalX: Math.round(s.x), finalY: Math.round(s.y), heading: Math.round(((s.heading % 360) + 360) % 360), speed: Math.round(s.speed), maxR: Math.round(maxR), battery: s.battery };
}

// One linear move from origin at heading 0, return |displacement| in cm.
function disp(src) {
  const t = run(src);
  return Math.round(Math.hypot(t.finalX, t.finalY));
}

// Compile + run a program purely to observe whether it raises. Returns the
// error message (string) if it threw, or null if it ran clean. Used by the
// throw-case regressions so a fix that stops raising fails loudly.
function runThrows(src) {
  try {
    const gen = compile(src).run({ sensor: () => 0 });
    let n = 0;
    while (true) { const r = gen.next(); if (r.done) break; if (++n > 1_000_000) break; }
    return null;
  } catch (e) {
    return (e && e.message) || String(e);
  }
}

// Collect a program's print outputs (for value/correctness regressions).
function printsOf(src) {
  const out = [];
  for (const ev of compile(src).run({ sensor: () => 0 })) {
    if (ev.type === 'print') out.push(ev.text);
  }
  return out;
}

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? '  -> ' + detail : '')); }
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '   [' + detail + ']' : ''));
}

console.log('== UNIT: command semantics ==');
check('bare move_forward(1) == 100cm (1 m)', disp('move_forward(1)') === 100, disp('move_forward(1)') + 'cm');
check('bare move_forward(2) == 200cm (2 m)', disp('move_forward(2)') === 200, disp('move_forward(2)') + 'cm');
check('rover.forward(100) == 100cm', disp('rover.forward(100)') === 100, disp('rover.forward(100)') + 'cm');
check('move_backward(1) == 100cm', disp('move_backward(1)') === 100, disp('move_backward(1)') + 'cm');
check('turn_right(90) -> heading 90', run('turn_right(90)').heading === 90, run('turn_right(90)').heading + 'deg');
check('turn_left(90) -> heading 270', run('turn_left(90)').heading === 270, run('turn_left(90)').heading + 'deg');
check('set_speed(200) clamps to 100', run('set_speed(200)').speed === 100, run('set_speed(200)').speed + '');
check('set_speed(-5) clamps to 0', run('set_speed(-5)').speed === 0, run('set_speed(-5)').speed + '');
check('move_forward(10**400) finite, no hang', Number.isFinite(disp('move_forward(10 ** 400)')), disp('move_forward(10 ** 400)') + 'cm');
// The clamp + non-finite guard explicitly, asserted on the emitted move event
// distance (not displacement, which the arena wall would cap at 1500cm): a huge
// finite arg clamps to the hi bound (40 m -> 4000 cm), and a non-finite arg
// (10**400 -> Infinity) maps to the lo bound (0). A regression in clampNum or
// the non-finite guard fails here.
function moveDist(src) {
  for (const ev of compile(src).run({ sensor: () => 0 })) { if (ev.type === 'move') return ev.distance; }
  return null;
}
check('move_forward(99999) clamps to 4000cm', moveDist('move_forward(99999)') === 4000, moveDist('move_forward(99999)') + 'cm');
check('move_forward(10**400) non-finite -> 0cm', moveDist('move_forward(10 ** 400)') === 0, moveDist('move_forward(10 ** 400)') + 'cm');
check('for-loop runs body 4x (4 moves)', run('for i in range(4):\n    move_forward(1)').moves === 4, run('for i in range(4):\n    move_forward(1)').moves + ' moves');
check('square nets back near origin', (() => { const t = run('for i in range(4):\n    rover.forward(300)\n    rover.turn_right(90)'); return Math.hypot(t.finalX, t.finalY) < 1; })(), '');
check('while loop terminates via guard', run('n = 0\nwhile n < 5:\n    rover.forward(50)\n    n = n + 1').moves === 5, '');
check('sensor distance() reads wall', run('d = rover.distance()\nprint(d)').steps > 0, '');

console.log('\n== UNIT: edge cases ==');
// Negative numbers: move_forward(-1) clamps to 0 (no-op move, not backward)
check('move_forward(-1) distance clamped to 0', moveDist('move_forward(-1)') === 0, moveDist('move_forward(-1)') + 'cm');
check('move_forward(-1) still emits a move event', run('move_forward(-1)').moves === 1, run('move_forward(-1)').moves + ' moves');
check('move_forward(-1) produces no displacement', disp('move_forward(-1)') === 0, disp('move_forward(-1)') + 'cm');
// Zero: move_forward(0) is a no-op move
check('move_forward(0) distance is 0', moveDist('move_forward(0)') === 0, moveDist('move_forward(0)') + 'cm');
check('move_forward(0) produces no displacement', disp('move_forward(0)') === 0, disp('move_forward(0)') + 'cm');
// Float turns: turn_left(45.5) / turn_right(45.5) preserve the fractional degrees
function turnDeg(src) {
  for (const ev of compile(src).run({ sensor: () => 0 })) { if (ev.type === 'turn') return ev.deg; }
  return null;
}
check('turn_left(45.5) emits -45.5 deg', turnDeg('turn_left(45.5)') === -45.5, turnDeg('turn_left(45.5)') + 'deg');
check('turn_right(45.5) emits +45.5 deg', turnDeg('turn_right(45.5)') === 45.5, turnDeg('turn_right(45.5)') + 'deg');
// Nested loops: inner body runs outer*inner times
check('nested loops 3x2 = 6 moves', run('for i in range(3):\n    for j in range(2):\n        move_forward(1)').moves === 6, run('for i in range(3):\n    for j in range(2):\n        move_forward(1)').moves + ' moves');
// Break in nested loop exits only the innermost loop
check('break exits only innermost loop (3 moves)', run('for i in range(3):\n    for j in range(3):\n        if j == 1:\n            break\n        move_forward(1)').moves === 3, run('for i in range(3):\n    for j in range(3):\n        if j == 1:\n            break\n        move_forward(1)').moves + ' moves');
// Continue skips the rest of one iteration
check('continue skips one iteration (4 moves)', run('for i in range(5):\n    if i == 2:\n        continue\n    move_forward(1)').moves === 4, run('for i in range(5):\n    if i == 2:\n        continue\n    move_forward(1)').moves + ' moves');
// Empty function body with pass
check('def foo(): pass runs clean', runThrows('def foo():\n    pass\nfoo()') === null, runThrows('def foo():\n    pass\nfoo()'));
// Function with return used in an expression
check('function return 5 printed', printsOf('def foo():\n    return 5\nprint(foo())')[0] === '5', printsOf('def foo():\n    return 5\nprint(foo())')[0]);
check('function return used in expression', printsOf('def double(n):\n    return n * 2\nprint(double(21))')[0] === '42', printsOf('def double(n):\n    return n * 2\nprint(double(21))')[0]);
// String concatenation
check('string concat "hello"+" "+"world"', printsOf('print("hello" + " " + "world")')[0] === 'hello world', printsOf('print("hello" + " " + "world")')[0]);
// List indexing via [] is not supported (parseTrailers only handles . and ())
check('[1,2,3][0] raises (no [] indexing)', runThrows('print([1,2,3][0])') !== null, runThrows('print([1,2,3][0])'));
// Math builtins
check('abs(-5) == 5', printsOf('print(abs(-5))')[0] === '5', printsOf('print(abs(-5))')[0]);
check('round(3.7) == 4', printsOf('print(round(3.7))')[0] === '4', printsOf('print(round(3.7))')[0]);
check('max(1, 2) == 2', printsOf('print(max(1, 2))')[0] === '2', printsOf('print(max(1, 2))')[0]);
check('min(3, 1) == 1', printsOf('print(min(3, 1))')[0] === '1', printsOf('print(min(3, 1))')[0]);
check('sqrt(16) == 4', printsOf('print(sqrt(16))')[0] === '4', printsOf('print(sqrt(16))')[0]);
// Boolean expressions
check('True and False -> False', printsOf('print(True and False)')[0] === 'False', printsOf('print(True and False)')[0]);
check('True or False -> True', printsOf('print(True or False)')[0] === 'True', printsOf('print(True or False)')[0]);
check('not True -> False', printsOf('print(not True)')[0] === 'False', printsOf('print(not True)')[0]);
// Comparison chains (beyond the existing parity-fix regressions)
check('chain 1 < 2 < 2 -> False', printsOf('print(1 < 2 < 2)')[0] === 'False', printsOf('print(1 < 2 < 2)')[0]);
check('chain 5 > 3 > 1 -> True', printsOf('print(5 > 3 > 1)')[0] === 'True', printsOf('print(5 > 3 > 1)')[0]);
check('chain 3 > 2 > 1 > 0 -> True (4-op)', printsOf('print(3 > 2 > 1 > 0)')[0] === 'True', printsOf('print(3 > 2 > 1 > 0)')[0]);
// While with complex (and) condition
check('while x<10 and y>0 stops at x=5 y=0', printsOf('x = 0\ny = 5\nwhile x < 10 and y > 0:\n    x = x + 1\n    y = y - 1\nprint(x, y)')[0] === '5 0', printsOf('x = 0\ny = 5\nwhile x < 10 and y > 0:\n    x = x + 1\n    y = y - 1\nprint(x, y)')[0]);

console.log('\n== PYTHON-FIDELITY REGRESSIONS (8 fixes) ==');
// Fix 1: chained comparison a<b<c is Python-associative (one AND of compares),
// not left-associative. The old code returned wrong booleans.
check('chain 3<2<1 -> False', printsOf('print(3 < 2 < 1)')[0] === 'False', printsOf('print(3 < 2 < 1)')[0]);
check('chain 5<3<10 -> False', printsOf('print(5 < 3 < 10)')[0] === 'False', printsOf('print(5 < 3 < 10)')[0]);
check('chain 0==0==0 -> True', printsOf('print(0 == 0 == 0)')[0] === 'True', printsOf('print(0 == 0 == 0)')[0]);
check('chain 1<2<3 -> True', printsOf('print(1 < 2 < 3)')[0] === 'True', printsOf('print(1 < 2 < 3)')[0]);
check('chain 90<h<270 picks right branch', printsOf('h = 180\nif 90 < h < 270:\n    print("yes")\nelse:\n    print("no")')[0] === 'yes', '');

// Fix 2: division / floor-division / modulo by zero raise (Python ZeroDivisionError).
check('1 / 0 raises division by zero', (runThrows('print(1 / 0)') || '').includes('division by zero'), runThrows('print(1 / 0)'));
check('7 // 0 raises division by zero', (runThrows('print(7 // 0)') || '').includes('division by zero'), runThrows('print(7 // 0)'));
check('5 % 0 raises division by zero', (runThrows('print(5 % 0)') || '').includes('division by zero'), runThrows('print(5 % 0)'));

// Fix 3: round() uses banker's rounding (round half to even).
check('round(0.5) -> 0', printsOf('print(round(0.5))')[0] === '0', printsOf('print(round(0.5))')[0]);
check('round(2.5) -> 2', printsOf('print(round(2.5))')[0] === '2', printsOf('print(round(2.5))')[0]);
check('round(2.5)+round(3.5) -> 6', printsOf('print(round(2.5) + round(3.5))')[0] === '6', printsOf('print(round(2.5) + round(3.5))')[0]);
check('round(0.125, 2) -> 0.12', printsOf('print(round(0.125, 2))')[0] === '0.12', printsOf('print(round(0.125, 2))')[0]);
check('round(3.5) -> 4', printsOf('print(round(3.5))')[0] === '4', printsOf('print(round(3.5))')[0]);

// Fix 4: print of a non-integer float shows the full double repr, not 6 digits.
check('print(1/3) == full double repr', printsOf('print(1 / 3)')[0] === '0.3333333333333333', printsOf('print(1 / 3)')[0]);

// Fix 5: range() rejects float args/steps (TypeError) and a zero step (ValueError).
check('range(2.5) raises float-not-int', (runThrows('for i in range(2.5):\n    print(i)') || '').includes('float'), runThrows('for i in range(2.5):\n    print(i)'));
check('range(0,5,0.5) raises float-not-int', (runThrows('for i in range(0, 5, 0.5):\n    print(i)') || '').includes('float'), runThrows('for i in range(0, 5, 0.5):\n    print(i)'));
check('range(0,5,0) raises zero-step', (runThrows('for i in range(0, 5, 0):\n    print(i)') || '').includes('must not be zero'), runThrows('for i in range(0, 5, 0):\n    print(i)'));

// Fix 6: int()/float() of a non-numeric string raise a value-error diagnostic.
check("int('abc') raises", runThrows("print(int('abc'))") !== null, runThrows("print(int('abc'))"));
check("int('3.5') raises", runThrows("print(int('3.5'))") !== null, runThrows("print(int('3.5'))"));
check("float('abc') raises", runThrows("print(float('abc'))") !== null, runThrows("print(float('abc'))"));

// Fix 7: a number literal with two dots (1.2.3) is rejected, not silently 1.2.
check('1.2.3 raises invalid number literal', (runThrows('print(1.2.3)') || '').includes('invalid number literal'), runThrows('print(1.2.3)'));

// Fix 8: for/while ... else gives an accurate diagnostic, not "else without if".
check('for-else accurate diagnostic', (runThrows('for i in range(3):\n    print(i)\nelse:\n    print("x")') || '').includes('loop-else is not supported'), runThrows('for i in range(3):\n    print(i)\nelse:\n    print("x")'));
check('while-else accurate diagnostic', (runThrows('while False:\n    print(1)\nelse:\n    print(2)') || '').includes('loop-else is not supported'), runThrows('while False:\n    print(1)\nelse:\n    print(2)'));

console.log('\n== GOLDEN TRACES (E-P2: shared motion model pins) ==');
// Pinned end-state values through the SHARED motion model. Deliberately
// perturbing any constant (drain, arena, turn cost) fails these exact
// numbers; the Python twin pins the same values in test_golden_traces.py.
{
  const sq = run('for i in range(4):\n    move_forward(3)\n    turn_right(90)');
  check('golden square: returns to origin', Math.hypot(sq.finalX, sq.finalY) < 1, '(' + sq.finalX + ',' + sq.finalY + ')');
  check('golden square: battery 85.36 (12m + 360deg on shared constants)',
    Math.abs(sq.battery - 85.36) < 1e-9, sq.battery + '%');
  const line = run('set_speed(80)\nmove_forward(2)');
  check('golden 2m line: battery 97.8', Math.abs(line.battery - 97.8) < 1e-9, line.battery + '%');
  const turns = run('turn_left(45)\nturn_right(135)');
  check('golden turns: battery 99.28, heading 90', Math.abs(turns.battery - 99.28) < 1e-9 && turns.heading === 90,
    turns.battery + '% @' + turns.heading + 'deg');
  check('model anchor: 3.125 m/s at set_speed(100)', KM.MODEL.baseSpeedCmPerS === 312.5, KM.MODEL.baseSpeedCmPerS + ' cm/s');
  check('model duration: 100cm at speed 100 takes 320ms',
    KM.moveDurationMs(100, KM.effectiveSpeedUnits(100, 1, 1), 1, 1) === 320,
    KM.moveDurationMs(100, KM.effectiveSpeedUnits(100, 1, 1), 1, 1) + 'ms');
  // E-A5: an underpowered physical build STALLS with a named torque gap
  // ("needs X N*m, has Y N*m") instead of the catalogue crawl multiplier.
  const weak = KM.physStallVerdict(KM.physStallForceN(0.02, 1, 5), 5, 1, 9.81, 1, 5);
  check('stall verdict: 0.02 N*m motor under 5 kg stalls with a torque gap',
    weak.stalled && weak.neededNm > weak.hasNm && weak.hasNm > 0,
    'needs ' + weak.neededNm.toFixed(2) + ' N*m, has ' + weak.hasNm.toFixed(2));
  const strong = KM.physStallVerdict(KM.physStallForceN(0.35, 2, 3.25), 1.2, 1, 9.81, 2, 3.25);
  check('stall verdict: the reference rover does NOT stall on nominal ground',
    !strong.stalled, 'mobility ' + strong.mobility.toFixed(2));
}

console.log('\n== KRS SPEC SCHEMA (SI0) + PHYSICAL MAPPING (SI2) ==');
{
  const SS_SRC = readFileSync(new URL('../src/robolearn/assets/web/specschema.js', import.meta.url), 'utf8');
  new Function('window', SS_SRC)(win);
  const SS = win.KodroSpecSchema;
  const REF = JSON.parse(readFileSync(new URL('../tests/fixtures/krs_reference_rover.json', import.meta.url), 'utf8'));

  // Valid spec round-trips: validate -> export -> validate again, physical
  // fields intact and no errors either way.
  const v1 = SS.validate(JSON.stringify(REF));
  check('reference KRS validates clean', v1.ok && v1.errors.length === 0, v1.errors.join('; '));
  check('reference KRS keeps its physical block',
    !!(v1.spec.physical && v1.spec.physical.massKg === 1.2 && v1.spec.physical.drive.motor.noLoadRpm === 300),
    JSON.stringify(v1.spec.physical || {}).slice(0, 60));
  const exported = SS.exportKrs(v1.spec, { mass: 1200, massFactor: 1.33, speedFactor: 0.33, runtimeMin: 180 });
  const v2 = SS.validate(exported);
  check('exported KRS re-validates (round-trip)', v2.ok && v2.spec.physical.massKg === 1.2,
    v2.errors.join('; ') || 'ok');
  check('export ignores the derived block on re-import',
    v2.warnings.some((w) => w.indexOf('derived') >= 0), v2.warnings.join(' | ').slice(0, 80));

  // Clamp-with-warning inside the 2x envelope; reject beyond it, naming the field.
  const warned = SS.validate(JSON.stringify(Object.assign({}, REF, { massKg: 80 }))); // hi 50, 2x = 100
  check('massKg 80 clamps to 50 with a warning', warned.ok
    && warned.spec.physical.massKg === 50
    && warned.warnings.some((w) => w.indexOf('massKg') >= 0), warned.warnings.join(' | ').slice(0, 80));
  const rejected = SS.validate(JSON.stringify(Object.assign({}, REF, { massKg: 500 }))); // > 2x hi
  check('massKg 500 rejects with a named-field error', !rejected.ok
    && rejected.errors.some((e) => e.indexOf('massKg') >= 0), rejected.errors.join(' | ').slice(0, 80));

  // v1 catalogue save (plain parts spec, no physical fields) imports unchanged.
  const v1Save = { name: 'My Rover', type: 'rover', board: 'esp32', sensors: ['ultrasonic', 'imu'], actuators: ['motors4'] };
  const mig = SS.validate(JSON.stringify(v1Save));
  check('v1 catalogue save migrates unchanged (no physical block)', mig.ok
    && !mig.spec.physical && mig.spec.sensors.join(',') === 'ultrasonic,imu'
    && mig.spec.actuators.join(',') === 'motors4', JSON.stringify(mig.spec).slice(0, 80));

  // Unknown keys are dropped with a warning, never imported silently.
  const junk = SS.validate(JSON.stringify(Object.assign({}, REF, { turboBoost: 9000 })));
  check('unknown keys dropped with a warning', junk.ok
    && junk.warnings.some((w) => w.indexOf('turboBoost') >= 0), junk.warnings.join(' | ').slice(0, 80));

  // SI2 golden: the reference spec's derived top speed matches the closed
  // form v = rpm/60 * 2*pi*r within tolerance, and lands inside the
  // simulable band so it is HONOURED (not clamped).
  const ph = SS.deriveFromPhysical(v1.spec, { mass: 1200, massFactor: 1.33, speedFactor: 1.25, runtimeMin: 45 });
  const vExpect = (300 / 60) * 2 * Math.PI * 3.25; // 102.1 cm/s
  check('derived top speed matches closed form (1.02 m/s)', Math.abs(ph.vMaxCmPerS - vExpect) < 1e-9, ph.vMaxCmPerS.toFixed(2) + ' cm/s');
  check('top speed inside the simulable band (HONOURED, not clamped)',
    Math.abs(ph.vMaxSimCmPerS - ph.vMaxCmPerS) < 0.5, 'sim ' + ph.vMaxSimCmPerS.toFixed(2));
  check('physical mass drives massFactor (1.2 kg -> 1.33)', Math.abs(ph.massFactor - 1200 / 900) < 1e-9, String(ph.massFactor));
  check('energy-true runtime derived from the pack', ph.runtimeMin > 60 && ph.runtimeMin < 600, ph.runtimeMin + ' min');
  check('sensor mount honoured (fwd 10cm, range 400cm)',
    ph.sensor && ph.sensor.fwdCm === 10 && ph.sensor.rangeCm === 400, JSON.stringify(ph.sensor));
  check('collision radius from body footprint (hypot(25,18)/2)',
    Math.abs(ph.collisionRadiusCm - Math.round(Math.hypot(25, 18) / 2 * 10) / 10) < 1e-9, ph.collisionRadiusCm + ' cm');
  check('declared-vs-derived within 20 percent (no discrepancy flag)',
    !ph.warnings.some((w) => w.indexOf('disagrees') >= 0), ph.warnings.join(' | ').slice(0, 80));

  // SI3: the verification report for the fixture spec. The derived block
  // must carry the motor-derived top speed; with a recorded run present the
  // measured block must state the mean speed AND its ratio to the derived
  // top ("your robot as simulated", cross-checked against evidence).
  const VF_SRC = readFileSync(new URL('../src/robolearn/assets/web/verify.jsx', import.meta.url), 'utf8');
  new Function('window', VF_SRC)(win);
  win.KODRO_LAST_RUN = { distanceCm: 340, wallMs: 4000, battery: 96, speedMul: 1 };
  const robotNow = Object.assign({}, v1.spec, {
    massFactor: ph.massFactor, speedFactor: ph.speedFactor, runtimeMin: ph.runtimeMin, phys: ph,
  });
  const rep = win.KodroVerify.report(robotNow, { name: 'Open terrain', traction: 1, env: { gravity: 9.81 } });
  const html = win.KodroVerify.toHtml(rep);
  check('verification report states the derived top speed (1.02 m/s)',
    html.indexOf('1.02 m/s') >= 0, '');
  check('verification report measured block: 3.4 m in 4 s = 0.85 m/s mean',
    html.indexOf('0.85 m/s') >= 0 && html.indexOf('3.4 m') >= 0, '');
  check('verification report cross-checks measured vs derived (ratio stated)',
    !!(rep.empirical.agreement && Math.abs(rep.empirical.agreement.ratio - 0.85 / 1.02) < 0.01),
    rep.empirical.agreement ? 'ratio ' + rep.empirical.agreement.ratio : 'no agreement block');
  check('verification report carries all three fidelity tiers',
    html.indexOf('HONOURED') >= 0 && html.indexOf('APPROXIMATED') >= 0 && html.indexOf('NOT SIMULATED') >= 0, '');
  delete win.KODRO_LAST_RUN;
}

console.log('\n== PHYSICS HONESTY: SLOW-BUILD SPEED BADGE (H1) ==');
{
  const SS = win.KodroSpecSchema;
  const REF = JSON.parse(readFileSync(new URL('../tests/fixtures/krs_reference_rover.json', import.meta.url), 'utf8'));
  // A 60-rpm / 3.0-cm educational rover has a real top speed of ~0.19 m/s,
  // FAR below the simulable floor (0.3 * 3.125 = 0.9375 m/s). The old code
  // clamped it UP, simulated it ~5x too fast, and STILL stamped it
  // 'honoured' with copy saying it "exceeds the simulable band" (it is
  // BELOW). The fix must: (a) badge it 'approximated', never 'honoured',
  // because the sim runs a different value; and (b) tell the truth in the
  // warning - below the floor, simulated FASTER - with no wrong-direction
  // word ("exceeds"/"above").
  const slowSpec = {
    physical: {
      massKg: 1.0,
      drive: { kind: 'differential', wheelRadiusCm: 3.0, motorCount: 2, motor: { noLoadRpm: 60, stallTorqueNm: 0.35 } },
    },
  };
  const slow = SS.deriveFromPhysical(slowSpec, { mass: 1000, massFactor: 1.1, speedFactor: 1, runtimeMin: 60 });
  const realMps = slow.vMaxCmPerS / 100;
  const simMps = slow.vMaxSimCmPerS / 100;
  check('slow build real top speed ~0.19 m/s (below the 0.9375 m/s floor)',
    Math.abs(realMps - 0.188) < 0.01 && realMps < 0.9375, realMps.toFixed(3) + ' m/s real');
  check('slow build IS clamped UP and simulated faster (~0.94 m/s)',
    simMps > realMps && Math.abs(simMps - 0.9375) < 0.01, simMps.toFixed(3) + ' m/s sim');
  check('H1: slow build is NOT badged honoured (sim runs a different value)',
    slow.badges.topSpeed === 'approximated', 'badge=' + slow.badges.topSpeed);
  const slowWarn = (slow.warnings || []).find((w) => /top speed/i.test(w)) || '';
  check('H1: warning tells the truth - below the floor, simulated FASTER',
    /below the simulable floor/i.test(slowWarn) && /faster/i.test(slowWarn), slowWarn);
  check('H1: warning never uses the wrong-direction words exceeds/above',
    slowWarn.length > 0 && !/exceed/i.test(slowWarn) && !/above/i.test(slowWarn), slowWarn);

  // A build INSIDE the band stays honoured (the reference rover, 1.02 m/s),
  // and a fast build ABOVE the ceiling drops to approximated with the
  // opposite (slower) copy - proving the direction word is not hard-coded.
  const refPh = SS.deriveFromPhysical(SS.validate(JSON.stringify(REF)).spec, { mass: 1200, massFactor: 1.33, speedFactor: 1.25, runtimeMin: 45 });
  check('H1: an in-band build stays honoured (reference rover 1.02 m/s)',
    refPh.badges.topSpeed === 'honoured' && Math.abs(refPh.vMaxSimCmPerS - refPh.vMaxCmPerS) < 0.5,
    'badge=' + refPh.badges.topSpeed);
  const fastSpec = { physical: { massKg: 1.0, drive: { kind: 'differential', wheelRadiusCm: 6.0, motorCount: 2, motor: { noLoadRpm: 2000, stallTorqueNm: 0.5 } } } };
  const fast = SS.deriveFromPhysical(fastSpec, { mass: 1000, massFactor: 1.1, speedFactor: 1, runtimeMin: 60 });
  const fastWarn = (fast.warnings || []).find((w) => /top speed/i.test(w)) || '';
  check('H1: a fast build above the ceiling is approximated and simulated SLOWER',
    fast.badges.topSpeed === 'approximated' && /above the simulable ceiling/i.test(fastWarn) && /slower/i.test(fastWarn), fastWarn);
}

console.log('\n== PHYSICS HONESTY: DESIGN CHECK vs TICK AGREE (H2) ==');
{
  // Load the Design Check (diagnostics.jsx is a plain IIFE despite the
  // extension - no JSX/React on the honesty path). It must judge an imported
  // build's mobility with the SAME force-ratio model the live tick drives it
  // with (app.jsx:1015-1017 uses KodroMotion.physMobility / physStallVerdict),
  // so the predictive verdict can never contradict what happens on screen.
  const DIAG_SRC = readFileSync(new URL('../src/robolearn/assets/web/diagnostics.jsx', import.meta.url), 'utf8');
  new Function('window', DIAG_SRC)(win);
  const SS = win.KodroSpecSchema;
  const D = win.KodroDiagnostics;
  const KMv = win.KodroMotion;
  const REF = JSON.parse(readFileSync(new URL('../tests/fixtures/krs_reference_rover.json', import.meta.url), 'utf8'));

  // The shipped Reference Rover, as getKodroRobot() assembles it: spec fields
  // plus the derived block (massFactor, speedFactor, phys).
  const spec = SS.validate(JSON.stringify(REF)).spec;
  const ph = SS.deriveFromPhysical(spec, { mass: 1200, massFactor: 1.33, speedFactor: 1.25, runtimeMin: 45 });
  const derived = {
    mass: 1200, massFactor: ph.massFactor, speedFactor: ph.speedFactor,
    runtimeMin: ph.runtimeMin, phys: ph,
  };
  // The public robot shape the design check receives (spec + derived merged,
  // exactly like RobotLab.save / getKodroRobot).
  const robot = Object.assign({}, spec, derived);

  for (const t of [
    { name: 'Riverside City', traction: 0.85, env: { gravity: 9.81 } },
    { name: 'Open terrain', traction: 1.0, env: { gravity: 9.81 } },
    { name: 'Low-traction sand', traction: 0.55, env: { gravity: 9.81 } },
  ]) {
    // Design Check mobility verdict (predictive).
    const rep = D.assess(spec, robot, t);
    const mobDim = rep.dimensions.find((d) => d.key === 'mobility');
    const predictStall = mobDim.status === 'fail';
    // Live tick mobility verdict (what actually drives the rover).
    const sv = KMv.physStallVerdict(ph.stallForceN, ph.massKg, t.traction, t.env.gravity, ph.motorCount || 2, ph.wheelRadiusCm || 3.25);
    const tickStall = sv.stalled;
    check('H2: Design Check and tick agree on ' + t.name + ' (both ' + (tickStall ? 'STALL' : 'DRIVE') + ')',
      predictStall === tickStall,
      'designCheck=' + (predictStall ? 'FAIL' : mobDim.status) + ' mob=' + rep.numbers.mobility + ' vs tickStalled=' + tickStall + ' tickMob=' + sv.mobility.toFixed(2));
  }

  // The exact defect the review reproduced: on the shipped Reference Rover the
  // old catalogue-proxy mobility was ~0.18-0.24 (FAIL) while the tick's
  // force-ratio was ~1.35-1.79 (drives fine). Assert the design check now
  // reports the force-ratio value (well above the 0.45 stall band), not the
  // proxy, so it PASSES in agreement with the tick.
  const repCity = D.assess(spec, robot, { name: 'Riverside City', traction: 0.85, env: { gravity: 9.81 } });
  const mobCity = repCity.dimensions.find((d) => d.key === 'mobility');
  check('H2: reference-rover Design Check now uses the force-ratio (mob > 1.0, PASS)',
    repCity.numbers.mobility > 1.0 && mobCity.status === 'pass',
    'mobility=' + repCity.numbers.mobility + ' status=' + mobCity.status);
}

console.log('\n== SHIPPED EXAMPLE PROGRAMS ==');
// Load the REAL EXAMPLES object the same way interpreter.js is loaded: app-data.jsx
// is a plain IIFE that exposes window.KodroExamples (no JSX, no React in the data
// path), so evaluating it via new Function('window', src) gives us the exact
// shipped example strings -- no brittle JSX scraping that can silently drop one.
const APP = readFileSync(new URL('../src/robolearn/assets/web/app-data.jsx', import.meta.url), 'utf8');
const dataWin = {};
new Function('window', APP)(dataWin);
const EXAMPLES = dataWin.KodroExamples || {};
const exampleKeys = Object.keys(EXAMPLES);

// Independent cross-check: count `code:` backtick literals in the raw source and
// fail loudly if the parsed object count disagrees, so a future refactor that
// breaks loading cannot silently shrink the example coverage.
const literalCount = (APP.match(/\bcode:\s*`/g) || []).length;
check('parsed example count matches code: literals', exampleKeys.length === literalCount,
  exampleKeys.length + ' parsed vs ' + literalCount + ' literals');

for (const key of exampleKeys) {
  const ex = EXAMPLES[key];
  const label = (ex && ex.label) || key;
  const code = ex && ex.code;
  let ok = true, info = '';
  if (typeof code !== 'string') {
    ok = false; info = 'NO CODE STRING';
  } else {
    try {
      const t = run(code);
      info = `steps=${t.steps} moves=${t.moves} turns=${t.turns} end=(${t.finalX},${t.finalY}) wallHit=${t.crashed}`;
      // Arena is a 3000x3000 BOX (+/-1500 per axis). Stay inside it on both axes.
      if (Math.abs(t.finalX) > WALL + 1 || Math.abs(t.finalY) > WALL + 1) { ok = false; info += ' OUT-OF-BOX'; }
    } catch (e) { ok = false; info = 'THREW: ' + e.message; }
  }
  check(label, ok, info);
}
check('found example programs (>= 10, incl. Encore/Searchlight/Gauntlet)', exampleKeys.length >= 10, exampleKeys.length + ' found');

// S1: the Encore flagship pins its own behaviour: it must end back on the
// start mark (the choreography is closed turtle geometry), spend a real but
// survivable share of the pack, and actually perform (moves + turns + beeps).
{
  const enc = EXAMPLES.encore && EXAMPLES.encore.code;
  check('encore tab ships', typeof enc === 'string' && enc.length > 2000, enc ? enc.length + ' chars' : 'missing');
  if (typeof enc === 'string') {
    const t = run(enc);
    check('encore ends back on the start mark', Math.hypot(t.finalX, t.finalY) < 1,
      '(' + t.finalX + ',' + t.finalY + ')');
    check('encore battery lands in the showcase band (30-70% remaining)',
      t.battery >= 30 && t.battery <= 70, t.battery.toFixed(1) + '% remaining');
    check('encore performs (>= 15 moves, >= 30 turns)', t.moves >= 15 && t.turns >= 30,
      t.moves + ' moves, ' + t.turns + ' turns');
    // The beep event (S3): Encore's drumline must yield real beep events.
    let beeps = 0;
    for (const ev of compile(enc).run({ sensor: () => 100 })) { if (ev.type === 'beep') beeps++; }
    check('encore drumline yields real beep events (S3)', beeps >= 10, beeps + ' beeps');
  }
}

// S4: Searchlight is the product MISSION - a sensor-guarded, battery-managed
// survey that returns to base. It must run clean, guard every move so it never
// hits a wall (the run()'s distance sensor reads the wall, so a guarded
// program stays inside), return to the start mark, and end battery-BOUND in
// the 10-25% band (the debrief's honest ending), having really moved and
// really scanned/flagged (place events).
{
  const sl = EXAMPLES.searchlight && EXAMPLES.searchlight.code;
  check('searchlight tab ships', typeof sl === 'string' && sl.length > 2000, sl ? sl.length + ' chars' : 'missing');
  if (typeof sl === 'string') {
    const t = run(sl);
    check('searchlight runs clean, never hits a wall', !t.crashed && t.maxR <= WALL, 'maxR=' + t.maxR + ' crashed=' + t.crashed);
    check('searchlight returns to base (near the start mark)', Math.hypot(t.finalX, t.finalY) < 5,
      '(' + t.finalX + ',' + t.finalY + ')');
    check('searchlight ends battery-bound in the 10-25% band', t.battery >= 10 && t.battery <= 25,
      t.battery.toFixed(1) + '% remaining');
    check('searchlight actually surveys (>= 30 moves)', t.moves >= 30, t.moves + ' moves');
    // Scan stations drop flags: place events prove the survey did real work.
    // A clear-lane host (distance = full range, battery high) lets every
    // guarded move through so the survey reaches its scan stations.
    let places = 0;
    for (const ev of compile(sl).run({ sensor: (n) => n === 'distance' ? 1500 : (n === 'battery' ? 100 : 0) })) {
      if (ev.type === 'place') places++;
    }
    check('searchlight drops flag markers at scan stations', places >= 4, places + ' flags placed');
  }
}

// S5: Gauntlet is the CAPABILITY reference - complex pen geometry plus the
// full language surface. It must run clean, draw its figures inside the arena,
// return the pen to the start mark, complete on a full pack with reserve (its
// battery checkpoints keep it from halting mid-figure), and prove the surface
// with the right printed outputs (banker's rounding, a recursion trace, a
// list built by concatenation).
{
  const gl = EXAMPLES.gauntlet && EXAMPLES.gauntlet.code;
  check('gauntlet tab ships', typeof gl === 'string' && gl.length > 2000, gl ? gl.length + ' chars' : 'missing');
  if (typeof gl === 'string') {
    const t = run(gl);
    check('gauntlet runs clean, geometry stays inside the arena', !t.crashed && t.maxR <= WALL,
      'maxR=' + t.maxR + ' crashed=' + t.crashed);
    check('gauntlet returns the pen to the start mark', Math.hypot(t.finalX, t.finalY) < 5,
      '(' + t.finalX + ',' + t.finalY + ')');
    check('gauntlet completes on a full pack with reserve (> 8% left)', t.battery > 8,
      t.battery.toFixed(1) + '% remaining');
    check('gauntlet draws its figures (>= 40 moves, >= 60 turns)', t.moves >= 40 && t.turns >= 60,
      t.moves + ' moves, ' + t.turns + ' turns');
    const out = printsOf(gl);
    const joined = out.join('\n');
    check('gauntlet math gym prints banker rounding (0.5->0, 2.5->2, 3.5->4)',
      /round\(0\.5\) = 0.*round\(2\.5\) = 2.*round\(3\.5\) = 4/.test(joined), '');
    check('gauntlet control-flow gym prints the recursion lift-off', joined.indexOf('lift-off') >= 0, '');
    check('gauntlet list workout prints the squares list [1, 4, 9, 16, 25]',
      joined.indexOf('[1, 4, 9, 16, 25]') >= 0, '');
  }
}

console.log('\n== ARM HONESTY (PERFECTION_PLAN P7/A13, bugs D4) ==');
// A fixed-base arm cannot drive: KodroCommands.driveCheck (the ONE source of
// truth the live run and the grader both read) must refuse the four
// locomotion verbs for an arm build while a rover sails through. Load the
// KodroCommands registry from RobotLab.jsx with a React/window shim so the
// module body runs and registers window.KodroCommands.
{
  const RL_SRC = readFileSync(new URL('../src/robolearn/assets/web/RobotLab.jsx', import.meta.url), 'utf8');
  const shimReact = {
    createElement: () => null, Fragment: 'Fragment',
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useRef: () => ({ current: null }), useEffect: () => {},
  };
  const shimLs = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  new Function('window', 'React', 'localStorage', 'document', RL_SRC)(win, shimReact, shimLs, { createElement: () => ({}) });
  const KC = win.KodroCommands;
  const arm = { type: 'arm', sensors: ['camera'], actuators: ['gripper'] };
  const rover = { type: 'rover', sensors: ['ultrasonic', 'imu'], actuators: ['motors4'] };
  check('KodroCommands.driveCheck exists', KC && typeof KC.driveCheck === 'function', '');
  check('arm refuses move_forward', KC.driveCheck(arm, 'move_forward').ok === false,
    KC.driveCheck(arm, 'move_forward').reason || '');
  check('arm refusal names the fixed-base arm',
    /fixed-base arm/i.test(KC.driveCheck(arm, 'move_forward').reason || ''),
    KC.driveCheck(arm, 'move_forward').reason || '');
  check('arm refuses all four locomotion verbs',
    ['move_forward', 'move_backward', 'turn_left', 'turn_right'].every((c) => !KC.driveCheck(arm, c).ok), '');
  check('rover drives (move_forward + turn_left ok)',
    KC.driveCheck(rover, 'move_forward').ok && KC.driveCheck(rover, 'turn_left').ok, '');
  check('set_speed is not a drive verb (allowed on an arm)', KC.driveCheck(arm, 'set_speed').ok === true, '');
  check('arm availability marks the four verbs unavailable',
    ['move_forward', 'move_backward', 'turn_left', 'turn_right']
      .every((c) => !KC.availability(arm).find((e) => e.name === c).available), '');
  check('rover availability keeps move_forward available',
    KC.availability(rover).find((e) => e.name === 'move_forward').available === true, '');
}

console.log('\n== BEEP EVENT (S3) ==');
// beep() emits a real beep event (wired to SFX in the studio), never the old
// "beep" console spam; the times argument clamps 0..16 like the Python API.
{
  const evs = [...compile('beep(3)').run({ sensor: () => 0 })];
  const b = evs.find((e) => e.type === 'beep');
  check('beep(3) yields a beep event, not a print', !!b && !evs.some((e) => e.type === 'print'),
    JSON.stringify(evs[0]));
  check('beep(3) carries times=3', !!b && b.times === 3, b && String(b.times));
  const b99 = [...compile('beep(99)').run({ sensor: () => 0 })].find((e) => e.type === 'beep');
  check('beep(99) clamps to 16 (Python API clamp)', !!b99 && b99.times === 16, b99 && String(b99.times));
  const b0 = [...compile('beep()').run({ sensor: () => 0 })].find((e) => e.type === 'beep');
  check('beep() defaults to one beep', !!b0 && b0.times === 1, b0 && String(b0.times));
}
// ONE dialect (product-coherence D4): every shipped example uses the bare
// metre-based API. rover.* remains a runtime compatibility alias, but no
// first-party program may teach it.
const legacyDialect = exampleKeys.filter((k) => /\brover\s*\./.test(EXAMPLES[k].code || ''));
check('every shipped example uses the canonical bare dialect',
  legacyDialect.length === 0, legacyDialect.length ? 'legacy rover.* in: ' + legacyDialect.join(', ') : 'all bare');

console.log('\n== INTERPRETER DIAGNOSTICS (bugs D7/D8) ==');
// A malformed def must name the real problem (the parameter list), and a
// non-ASCII identifier must name the actual rule, not a bare "unexpected
// character". Both messages are pinned so they cannot silently regress.
check('def with bad params names the parameter list',
  (runThrows('def go(x y):\n    pass\ngo(1)') || '').includes('invalid parameter list'),
  runThrows('def go(x y):\n    pass\ngo(1)'));
check('broken def header gets a def-shaped diagnostic',
  (runThrows('def go(:\n    pass') || '').includes('Invalid def'),
  runThrows('def go(:\n    pass'));
check('unicode identifier rejection names the ASCII rule',
  (runThrows('café = 1') || '').includes('ASCII'),
  runThrows('café = 1'));

console.log('\n== DESIGN-CHECK COMMAND HONESTY (product-coherence D6) ==');
// Every command the design check's user-facing strings mention must exist in
// the interpreter. grab()/see() were recommended fixes for commands that do
// not exist; this scan fails if any phantom command creeps back in.
// Strip full-line comments first: an apostrophe inside a comment would let
// the string matcher pair comment text into a phantom "string".
const DIAG = readFileSync(new URL('../src/robolearn/assets/web/diagnostics.jsx', import.meta.url), 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
const KNOWN_COMMANDS = new Set([
  'move_forward', 'move_backward', 'turn_left', 'turn_right', 'set_speed', 'stop', 'wait', 'sleep',
  'pen_down', 'pen_up', 'scan', 'led', 'say', 'beep', 'log', 'print', 'place', 'clear_props',
  'distance', 'heading', 'battery', 'speed', 'tilt', 'temperature', 'gravity', 'light', 'ground', 'x', 'y',
  'read_distance', 'read_heading', 'read_battery', 'read_colour',
  'obstacle_ahead', 'sample_detected', 'at_base', 'collect_sample', 'drop_sample',
]);
const diagStrings = DIAG.match(/'(?:[^'\\]|\\.)*'/g) || [];
const phantomCmds = [];
for (const s of diagStrings) {
  for (const mm of s.matchAll(/\b([a-z_][a-z0-9_]*)\(\)/g)) {
    if (!KNOWN_COMMANDS.has(mm[1])) phantomCmds.push(mm[1] + '()');
  }
}
check('diagnostics name only commands the interpreter implements',
  phantomCmds.length === 0, phantomCmds.length ? 'phantom: ' + phantomCmds.join(', ') : 'none');

console.log('\n== BROWSER AI FACADE (bugs D3: review must surface its notes) ==');
// ai-web.jsx is plain JS despite the extension. Evaluate it against the same
// window that already holds RoverLang, with fetch/localStorage mocked, so the
// browser review path can be exercised fully offline with a canned model
// reply. Asserts the review carries at least one issue note alongside a
// rewrite (the old facade always reported "No problems spotted").
const AIWEB = readFileSync(new URL('../src/robolearn/assets/web/ai-web.jsx', import.meta.url), 'utf8');
const lsStub = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
async function mockFetch(url) {
  const u = String(url);
  if (u.includes('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'test-coder' }] }) };
  if (u.includes('/api/generate')) {
    return { ok: true, json: async () => ({ response: '```python\nfor i in range(4):\n    move_forward(2)\n    turn_right(90)\n```\nTightened the repeated moves into one loop.' }) };
  }
  throw new Error('unexpected fetch ' + u);
}
new Function('window', 'fetch', 'localStorage', AIWEB)(win, mockFetch, lsStub);
const review = await win.KodroAI.reviewCode('move_forward(2)\nturn_right(90)\nmove_forward(2)\nturn_right(90)\n');
check('browser review returns ok with a rewrite', !!(review && review.ok && review.revised),
  review ? (review.reason || 'revised=' + review.revised) : 'no result');
check('browser review carries at least one issue note',
  !!(review && Array.isArray(review.issues) && review.issues.length >= 1),
  review && review.issues ? review.issues.join(' | ').slice(0, 90) : 'no issues array');

console.log('\n== BRAND STRING HYGIENE (product-coherence D13) ==');
// User-visible strings say Kodro. Exempt by design: the window.RoboLearn API
// object name (pywebview registers it) and or_*/kodro_* storage keys.
const BRIDGE_SRC = readFileSync(new URL('../src/robolearn/assets/web/bridge.js', import.meta.url), 'utf8');
check('bridge console lines carry no legacy brand',
  !/console\.(warn|error|log)\([^)]*RoboLearn/.test(BRIDGE_SRC), '');
const WEB_FILES = ['app.jsx', 'app-data.jsx', 'styles.css', 'Telemetry.jsx', 'terrains.jsx', 'Viewport.jsx', 'Viewport3D.jsx', 'Editor.jsx', 'Rover.jsx', 'panels.jsx', 'interpreter.js', 'bridge.js'];
const branded = [];
for (const f of WEB_FILES) {
  const src = readFileSync(new URL('../src/robolearn/assets/web/' + f, import.meta.url), 'utf8');
  if (/orbital rover/i.test(src)) branded.push(f);
}
check('no "Orbital Rover" brand string in web sources', branded.length === 0, branded.join(', ') || 'clean');

console.log('\n== ICON HYGIENE (PERFECTION_PLAN P7/A2) ==');
// The chrome's icon system is the procedural SVG sprite (icons.jsx), never
// emoji. Scan every shipped UI source for emoji-block codepoints; a small
// allowlist keeps the deliberate typographic glyphs that are not emoji
// (check/cross marks, plain arrows, the end-block return arrow, wide plus).
const EMOJI_ALLOW = new Set(['✓', '✕', '✗', '←', '↑', '→', '↓', '↤', '＋']);
const EMOJI_RE = /[←-⇿⌀-⏿☀-➿⬀-⯿️\u{1F000}-\u{1FAFF}]/gu;
const CHROME_FILES = readdirSync(new URL('../src/robolearn/assets/web/', import.meta.url))
  .filter((f) => (f.endsWith('.jsx') || f.endsWith('.js')) && f !== 'bundle.js' && f !== 'harness_bundle.js');
const emojiHits = [];
for (const f of CHROME_FILES) {
  const src = readFileSync(new URL('../src/robolearn/assets/web/' + f, import.meta.url), 'utf8');
  const hits = (src.match(EMOJI_RE) || []).filter((ch) => !EMOJI_ALLOW.has(ch));
  if (hits.length) emojiHits.push(f + ' (' + Array.from(new Set(hits)).join(' ') + ')');
}
check('zero emoji glyphs in UI chrome source (SVG icon sprite only)', emojiHits.length === 0, emojiHits.join('; ') || 'clean');

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
