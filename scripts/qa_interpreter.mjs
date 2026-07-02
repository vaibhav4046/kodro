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

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
