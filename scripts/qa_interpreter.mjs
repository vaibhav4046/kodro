/* Offline functional QA for the web interpreter + kinematics.
 *
 * Loads the SHIPPED interpreter.js under Node, drives its generator exactly the
 * way app.jsx does (same move/turn/speed formulas, same wall ray for sensors),
 * and asserts every command and every shipped example behaves: terminates,
 * moves when it should, stays in the arena, never throws. No browser, no rAF,
 * so the automation throttle that zeroes rafFired cannot mask anything here.
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/robolearn/assets/web/interpreter.js', import.meta.url), 'utf8');

// --- load the IIFE with a window shim -------------------------------------
const win = {};
new Function('window', SRC)(win);
const { compile } = win.RoverLang;

const WALL = 1500;            // arena half-extent in cm, matches the engine
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
      const nx = s.x + dirx * ev.distance, ny = s.y + diry * ev.distance;
      if (Math.abs(nx) > WALL || Math.abs(ny) > WALL) {
        crashed = true;                 // would hit wall: clamp at boundary
        s.x = Math.max(-WALL, Math.min(WALL, nx));
        s.y = Math.max(-WALL, Math.min(WALL, ny));
      } else { s.x = nx; s.y = ny; }
      maxR = Math.max(maxR, Math.hypot(s.x, s.y));
    } else if (ev.type === 'turn') {
      turns++; s.heading += ev.deg;
    } else if (ev.type === 'speed') {
      s.speed = Math.max(0, Math.min(100, ev.value));
    }
  }
  return { steps, moves, turns, crashed, finalX: Math.round(s.x), finalY: Math.round(s.y), heading: Math.round(((s.heading % 360) + 360) % 360), speed: Math.round(s.speed), maxR: Math.round(maxR) };
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
check('found example programs (>= 7)', exampleKeys.length >= 7, exampleKeys.length + ' found');

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
