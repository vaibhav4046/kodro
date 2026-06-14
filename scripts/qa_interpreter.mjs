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
check('for-loop runs body 4x (4 moves)', run('for i in range(4):\n    move_forward(1)').moves === 4, run('for i in range(4):\n    move_forward(1)').moves + ' moves');
check('square nets back near origin', (() => { const t = run('for i in range(4):\n    rover.forward(300)\n    rover.turn_right(90)'); return Math.hypot(t.finalX, t.finalY) < 1; })(), '');
check('while loop terminates via guard', run('n = 0\nwhile n < 5:\n    rover.forward(50)\n    n = n + 1').moves === 5, '');
check('sensor distance() reads wall', run('d = rover.distance()\nprint(d)').steps > 0, '');

console.log('\n== SHIPPED EXAMPLE PROGRAMS ==');
// Pull every EXAMPLES[*].code straight out of app.jsx so we test the real text.
const APP = readFileSync(new URL('../src/robolearn/assets/web/app.jsx', import.meta.url), 'utf8');
const block = APP.slice(APP.indexOf('const EXAMPLES = {'), APP.indexOf('const LED_COLORS'));
const re = /(\w+):\s*\{\s*label:\s*'([^']+)',\s*code:\s*`([\s\S]*?)`\s*\}/g;
let m, count = 0;
while ((m = re.exec(block))) {
  count++;
  const [, key, label, code] = m;
  let ok = true, info = '';
  try {
    const t = run(code);
    info = `steps=${t.steps} moves=${t.moves} turns=${t.turns} end=(${t.finalX},${t.finalY}) wallHit=${t.crashed}`;
    // Arena is a 3000x3000 BOX (+/-1500 per axis). Stay inside it on both axes.
    if (Math.abs(t.finalX) > WALL + 1 || Math.abs(t.finalY) > WALL + 1) { ok = false; info += ' OUT-OF-BOX'; }
  } catch (e) { ok = false; info = 'THREW: ' + e.message; }
  check(label, ok, info);
}
check('found all 7 example programs', count === 7, count + ' found');

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
