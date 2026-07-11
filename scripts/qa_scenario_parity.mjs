/* Regression: the scenario validator collides / senses against the ROVER BODY
 * (obstacle radius + rover radius R), matching the live sim (sim-physics.js
 * collisionAt / rayDistance use o.r + R). Before the 2026-07-11 fix the
 * validator treated the robot as a dimensionless point (o.r only), so a program
 * grazing an obstacle within R cm validated clean yet crashed on the live run.
 *
 *   node scripts/qa_scenario_parity.mjs      # exits non-zero on any failure
 */
import { readFileSync } from 'node:fs';

const dir = new URL('../src/robolearn/assets/web/', import.meta.url);
const win = { addEventListener() {}, dispatchEvent() {}, CustomEvent: function () {}, Date: Date };
for (const f of ['motion-model.js', 'sim-physics.js', 'interpreter.js', 'scenario.js'.replace('scenario.js', 'scenario.jsx')]) {
  new Function('window', readFileSync(new URL(f, dir), 'utf8'))(win);
}
const R = win.KodroMotion.MODEL.roverRadiusCm;   // 30
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass += 1; else { fail += 1; console.error('FAIL  ' + m); } };

// Obstacle at (60, -300) r=40. A straight northward drive from the origin passes
// its centre at lateral distance 60 cm: OUTSIDE o.r (40) but INSIDE o.r+R (70),
// i.e. the body clips it though a point path would miss.
const scenario = {
  scenarioId: 'parity-graze', name: 'graze', environmentPreset: 'earth',
  startPose: { x: 0, y: 0, heading: 0 }, goalPose: { x: 0, y: -600, r: 120 },
  obstacles: [{ x: 60, y: -300, r: 40 }],
  terrainMaterial: 'regolith',
  randomizationConfig: { friction: [1, 1], massTol: 0, sensorNoise: 0, obstacleJitter: 0 },
};
// Drive straight past it (no sensing): 6 x 1 m forward.
const src = 'for i in range(6):\n    move_forward(1)\n';
const gateRobot = { sensors: ['ultrasonic', 'imu'], actuators: [], massFactor: 1 };

const res = win.KodroScenario.runOnce(src, scenario, 1, gateRobot);
ok(res && res.ok, 'validator ran the graze scenario (' + (res && res.error ? res.error : 'ok') + ')');
ok(res && res.collisions >= 1, 'body grazing at 60 cm lateral now registers a collision (got ' + (res && res.collisions) + '); a point path would report 0');

// Cross-check against the live sim's own collision geometry at the closest point
// (0, -300): distance to obstacle centre = 60, which is < o.r + R (70).
const terrain = { id: 'earth', obstacles: scenario.obstacles };
const hit = win.KodroPhysics.collisionAt(0, -300, R, win.KodroMotion.MODEL.arenaHalfExtentCm, terrain);
ok(hit && hit.type === 'obstacle', 'sim-physics.collisionAt agrees the body collides at the same point (got ' + (hit ? hit.type : 'none') + ')');

// And the point-only distance (60) is OUTSIDE the bare radius (40): proof the
// gap is exactly the body-vs-point regime this fix closes.
ok(60 > 40 && 60 < 40 + R, 'the graze lies in the body-vs-point band (40 < 60 < 70)');

console.log((fail ? 'FAIL' : 'PASS') + '  scenario collision parity: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
