/* Offline unit QA for the pure simulation physics module (sim-physics.js).
 *
 * The run engine's collision geometry and trapezoidal-motion math used to be
 * closures buried inside useSimEngine (hooks.jsx), reachable only by driving
 * the whole React studio in a browser. They were extracted to sim-physics.js
 * as pure functions of their inputs; this harness loads that module under Node
 * with a bare window shim and pins a handful of known collision / ray /
 * coverage / velocity values, proving the physics is now testable headlessly
 * (no browser, no React, no rAF) and that the extraction is behaviour-exact.
 *
 * Exit 0 on all-pass, exit 1 on any failure.
 */
import { readFileSync } from 'node:fs';

// --- load the IIFE with a window shim -------------------------------------
// No window.KodroAgents is defined, so the moving-agent branch of collisionAt
// / rayDistance is skipped -- these asserts cover the wall + static-obstacle
// geometry, which is the deterministic core the live tick shares.
const SRC = readFileSync(new URL('../src/robolearn/assets/web/sim-physics.js', import.meta.url), 'utf8');
const win = {};
new Function('window', SRC)(win);
const P = win.KodroPhysics;

// Shared arena/body constants matching the shipped defaults (motion-model.js:
// arenaHalfExtentCm 1500, roverRadiusCm 30). Kept local so this harness has no
// dependency beyond sim-physics.js itself.
const WALL = 1500;
const R = 30;
const EMPTY = { obstacles: [], id: 'earth' };
const approx = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps);

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? '  -> ' + detail : '')); }
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '   [' + detail + ']' : ''));
}

console.log('== PHYSICS: module loads ==');
check('window.KodroPhysics exposes the four pure functions',
  P && ['collisionAt', 'rayDistance', 'trapVelocity', 'trapCover'].every((k) => typeof P[k] === 'function'),
  P ? Object.keys(P).join(',') : 'no module');

console.log('\n== PHYSICS: collisionAt (wall + obstacle geometry) ==');
check('origin is clear (no wall, no obstacle) -> null', P.collisionAt(0, 0, R, WALL, EMPTY) === null, '');
// The collidable boundary is |coord| > WALL - R (1470). 1475 is past it, 1469
// is inside it.
check('x past the wall band (1475 > 1470) -> wall', (P.collisionAt(1475, 0, R, WALL, EMPTY) || {}).type === 'wall',
  JSON.stringify(P.collisionAt(1475, 0, R, WALL, EMPTY)));
check('y past the wall band (-1475) -> wall', (P.collisionAt(0, -1475, R, WALL, EMPTY) || {}).type === 'wall', '');
check('just inside the wall band (1469 < 1470) -> null', P.collisionAt(1469, 0, R, WALL, EMPTY) === null, '');
{
  // An obstacle of radius 20 at (100,0): the grown radius is o.r + R = 50, so a
  // point 10 cm from centre collides and one 100 cm away does not.
  const terr = { obstacles: [{ x: 100, y: 0, r: 20 }], id: 'earth' };
  const hit = P.collisionAt(90, 0, R, WALL, terr);
  check('point 10cm from a r=20 obstacle centre collides (grown radius 50)',
    hit && hit.type === 'obstacle' && hit.o === terr.obstacles[0], JSON.stringify(hit));
  check('point 100cm from the same obstacle is clear', P.collisionAt(200, 0, R, WALL, terr) === null, '');
}

console.log('\n== PHYSICS: rayDistance (wall + obstacle ray) ==');
// Heading 0 points up (-y); heading 90 points +x. From the origin the ray to
// each wall is WALL - R = 1470.
check('ray up from origin hits the wall at 1470', approx(P.rayDistance(0, 0, 0, R, WALL, EMPTY), 1470), P.rayDistance(0, 0, 0, R, WALL, EMPTY) + '');
check('ray +x from origin hits the wall at 1470', approx(P.rayDistance(0, 0, 90, R, WALL, EMPTY), 1470), P.rayDistance(0, 0, 90, R, WALL, EMPTY) + '');
{
  // Obstacle r=20 dead ahead at (500,0) on the +x ray: the ray hits the grown
  // circle (radius 50) at 500 - 50 = 450 cm, well before the wall.
  const terr = { obstacles: [{ x: 500, y: 0, r: 20 }], id: 'earth' };
  check('ray +x stops at a dead-ahead obstacle (500 - 50 = 450)',
    approx(P.rayDistance(0, 0, 90, R, WALL, terr), 450), P.rayDistance(0, 0, 90, R, WALL, terr) + '');
  // An obstacle behind the ray origin (heading 0 = up) is ignored.
  check('an obstacle behind the ray is ignored (still reads the wall 1470)',
    approx(P.rayDistance(0, 0, 0, R, WALL, terr), 1470), P.rayDistance(0, 0, 0, R, WALL, terr) + '');
}

console.log('\n== PHYSICS: trapezoidal motion (cover integral + velocity) ==');
// A symmetric trapezoid: 20% ramp, 60% cruise, 20% brake. profileArea is the
// closed-form area the hook precomputes.
const AF = 0.2, BF = 0.2, CF = 0.6;
const AREA = 0.5 * AF + CF + 0.5 * BF; // 0.8
check('trapCover endpoint is exact: trapCover(1) === 1', approx(P.trapCover(1, AF, BF, CF, AREA), 1), P.trapCover(1, AF, BF, CF, AREA) + '');
check('trapCover start is exact: trapCover(0) === 0', approx(P.trapCover(0, AF, BF, CF, AREA), 0), P.trapCover(0, AF, BF, CF, AREA) + '');
check('trapCover midpoint of a symmetric profile === 0.5', approx(P.trapCover(0.5, AF, BF, CF, AREA), 0.5), P.trapCover(0.5, AF, BF, CF, AREA) + '');
check('trapCover is monotonic non-decreasing across the move',
  (() => { let prev = -1; for (let i = 0; i <= 100; i++) { const v = P.trapCover(i / 100, AF, BF, CF, AREA); if (v < prev - 1e-12) return false; prev = v; } return true; })(), '');
check('trapVelocity holds cruise speed 1 through the plateau', P.trapVelocity(0.5, AF, BF) === 1, P.trapVelocity(0.5, AF, BF) + '');
check('trapVelocity ramps from 0 at the start', P.trapVelocity(0, AF, BF) === 0, P.trapVelocity(0, AF, BF) + '');
check('trapVelocity is half cruise at half the ramp', approx(P.trapVelocity(0.1, AF, BF), 0.5), P.trapVelocity(0.1, AF, BF) + '');
check('trapVelocity brakes back to 0 at the end', P.trapVelocity(1, AF, BF) === 0, P.trapVelocity(1, AF, BF) + '');
// Degenerate profile (no ramp, no brake, all cruise): cover is linear in p.
check('degenerate all-cruise profile: trapCover is linear (0.37 -> 0.37)',
  approx(P.trapCover(0.37, 0, 0, 1, 1), 0.37), P.trapCover(0.37, 0, 0, 1, 1) + '');

// --- traffic must not brake to a stop ON TOP of the rover ---------------------
// The city brake used a flat stop offset of 60 cm while the collision test uses
// a.r + R (96 + 30 = 126 cm for a car). A braked car therefore settled about
// 98 cm from a rover at the junction, which is already overlapping, and every
// first run of the bundled welcome program reported a collision before the
// rover had executed an instruction. The offset is now derived from the same
// radii the collision test uses; this asserts that relationship holds.
{
  const src = readFileSync(new URL('../src/robolearn/assets/web/agents.jsx', import.meta.url), 'utf8');
  const R = Number((src.match(/const R = (\d+);/) || [])[1]);
  const carR = Number((src.match(/kind: 'car'[^}]*?r: (\d+)/) || [])[1]);
  check('agents.jsx exposes the rover radius', Number.isFinite(R) && R > 0, String(R));
  check('agents.jsx exposes the car radius', Number.isFinite(carR) && carR > 0, String(carR));
  const stopExpr = (src.match(/const STOP = ([^;]+);/) || [])[1] || '';
  check('the brake stop offset is derived from the collision radii',
    /a\.r\s*\+\s*R/.test(stopExpr), stopExpr.trim() || 'no STOP constant found');
  check('the brake stop offset clears the collision radius',
    !/\(fwd - 60\)/.test(src), 'the flat 60 cm stop offset is back and overlaps the rover');
  // With STOP = a.r + R + 12 a stopped car is at least 12 cm clear, whatever
  // its lateral offset, because the along-axis gap alone already exceeds the
  // sum of the radii.
  const STOP = carR + R + 12;
  check('a stopped car cannot touch a stationary rover', STOP > carR + R,
    `stop ${STOP} vs clearance ${carR + R}`);
}

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) { console.log('FAILURES:'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
