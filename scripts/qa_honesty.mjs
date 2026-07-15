/* Honesty regression gate (judge round 1). The product stakes its credibility
 * on honest, consistent numbers and fidelity tiers, so this pins the fixes that
 * a careless future edit could silently undo:
 *
 *  - the design check and the verification report must derive a catalogue
 *    build's stopping distance from the SAME physics (d = v^2/2*mu*g on the
 *    baseSpeed*speedFactor anchor), so they never print two numbers for one
 *    build;
 *  - a catalogue top speed is a proxy, so it is badged APPROXIMATED, never
 *    HONOURED, and never shown as a bare unitless multiplier dressed up as a
 *    speed;
 *  - no surface promises "honest error bars" (no uncertainty range exists) or
 *    that a run will "perform cleanly" (the check judges the build, not the
 *    program);
 *  - AI-estimated part prices are labelled as estimates, not quoted as fact.
 *
 * The physics half runs the REAL shipped motion model; the rest are source
 * assertions over the shipped web modules, which fail loudly if a fix is
 * reverted.
 *
 *   node scripts/qa_honesty.mjs   # exits non-zero on any failed assertion
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..', 'src', 'robolearn', 'assets', 'web');
const read = (f) => readFileSync(path.join(WEB, f), 'utf8');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass += 1; } else { fail += 1; console.error('FAIL  ' + msg); } }
function near(a, b, msg) { ok(Math.abs(a - b) < 1e-6, msg + ' (got ' + a + ', want ' + b + ')'); }

// 1. Load the real motion model and confirm both consumers share one formula.
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(read('motion-model.js'), ctx, { filename: 'motion-model.js' });
const KM = ctx.window.KodroMotion;
ok(KM && typeof KM.physStoppingDistanceCm === 'function', 'motion model exposes physStoppingDistanceCm');
const M = KM.MODEL;
const traction = 0.98, gravity = 9.81;
for (const sf of [0.7, 1.0, 1.25, 1.45]) {
  const vCat = M.baseSpeedCmPerS * sf;
  const stop = KM.physStoppingDistanceCm(vCat, traction, gravity);
  const expect = ((vCat / 100) ** 2) / (2 * M.brakeMu * traction * gravity) * 100;
  near(stop, expect, 'catalogue stop at sf=' + sf + ' follows d = v^2/2*mu*g');
}

// 2. The design check (diagnostics) catalogue path uses the SAME anchor as the
//    report (verify), so the two surfaces agree for a catalogue build.
const diag = read('diagnostics.jsx');
const verify = read('verify.jsx');
ok(/physStoppingDistanceCm\(\s*[\s\S]*?baseSpeedCmPerS\s*\*\s*speedFactor/.test(diag),
  'diagnostics catalogue stop uses physStoppingDistanceCm on baseSpeedCmPerS*speedFactor');
ok(/physStoppingDistanceCm\(vCmPerS/.test(verify) && /baseSpeedCmPerS\s*\*\s*speedFac/.test(verify),
  'verify catalogue stop uses physStoppingDistanceCm on baseSpeedCmPerS*speedFac');

// 3. Catalogue top speed is APPROXIMATED, never a defaulted HONOURED.
const lab = read('RobotLab.jsx');
ok(/badges\.topSpeed\)\s*\|\|\s*'approximated'/.test(lab),
  'RobotLab catalogue top-speed badge defaults to approximated, not honoured');
ok(!/badges\.topSpeed\)\s*\|\|\s*'honoured'/.test(lab),
  'RobotLab no longer defaults the top-speed badge to honoured');

// 4. No overpromising honesty phrases anywhere in the shipped web source.
const SHIPPED = ['RobotLab.jsx', 'verify.jsx', 'diagnostics.jsx', 'realism.jsx', 'panels.jsx', 'app.jsx'];
for (const f of SHIPPED) {
  const src = read(f);
  ok(!/honest error bars/i.test(src), f + ' does not promise "honest error bars"');
  ok(!/perform cleanly/i.test(src), f + ' does not promise a run will "perform cleanly"');
}

// 5. Realism top speed is not a bare unitless multiplier labelled as a speed.
const realism = read('realism.jsx');
ok(/vMaxSimCmPerS/.test(realism) && /vs a standard rover/.test(realism),
  'realism shows measured m/s when available, else a labelled relative factor');

// 6. AI-estimated part prices are labelled as estimates, not quoted as fact.
const panels = read('panels.jsx');
ok(/rough AI estimates/i.test(panels), 'budget planner labels prices as rough AI estimates');

// 7. The verification report's MEASURED mean speed must normalise out the
//    cosmetic sim-speed slider (playback compresses wall time by speedMul), so
//    the slider can never inflate the measured evidence (judge round 7).
ok(/wallMs\s*\*\s*\(?\s*lastRun\.speedMul/.test(verify),
  'verify measured speed multiplies wall time back out by speedMul');
ok(!/\(lastRun\.distanceCm\s*\/\s*100\)\s*\/\s*\(lastRun\.wallMs\s*\/\s*1000\)/.test(verify),
  'verify no longer divides distance by the raw (playback-compressed) wallMs');

// 8. Underwater/space verdicts must not overclaim (judge round 8): the sites'
//    defining hazards (depth pressure, vacuum) are unmodelled, so (a) the
//    fidelity disclosure must say so, and (b) a clean run there must scope its
//    verdict instead of the blanket "the design held up". Behavioural: run the
//    REAL assess/afterRun on an underwater terrain and read the verdict text.
const spectext = read('specschema.js');
ok(/notSimulated:\s*\[[\s\S]*?buoyancy[\s\S]*?depth pressure[\s\S]*?vacuum[\s\S]*?\]/.test(spectext),
  'fidelity disclosure lists water/buoyancy/depth-pressure/vacuum as NOT SIMULATED');
{
  vm.runInContext(read('diagnostics.jsx'), ctx, { filename: 'diagnostics.jsx' });
  const KD = ctx.window.KodroDiagnostics;
  ok(KD && typeof KD.afterRun === 'function', 'diagnostics exposes afterRun for the behavioural check');
  const spec = { sensors: ['ultrasonic', 'imu'], actuators: ['motors4'], type: 'rover' };
  const derived = { massFactor: 0.7, speedFactor: 1.25, runtimeMin: 87 };
  const cleanRun = { outcome: 'done', commands: 10, distanceCm: 800, minProximityCm: 100 };
  const deep = KD.afterRun(KD.assess(spec, derived,
    { name: 'Abyssal', traction: 0.66, env: { gravity: 9.81, pressureLabel: 'DEPTH', pressure: 3800 } }), cleanRun);
  ok(!/design held up\./.test(deep.text) && /not simulated/.test(deep.text),
    'underwater clean-run verdict is scoped, not a blanket "design held up" (got: ' + deep.text.slice(0, 90) + ')');
  // A slow build passes cleanly on the Moon (low gravity stretches stopping
  // distance, so the fast build below lands on the warn branch instead).
  const slow = { massFactor: 0.7, speedFactor: 0.7, runtimeMin: 87 };
  const lunar = { name: 'Lunar', traction: 1.18, env: { gravity: 1.62, pressureLabel: 'VACUUM', pressure: 0 } };
  const vac = KD.afterRun(KD.assess(spec, slow, lunar), cleanRun);
  ok(/vacuum/.test(vac.text) && /not simulated/.test(vac.text),
    'space clean-run verdict names the unsimulated vacuum hazard (got: ' + vac.text.slice(0, 90) + ')');
  const vacWarn = KD.afterRun(KD.assess(spec, derived, lunar), cleanRun);
  ok(/not simulated/.test(vacWarn.text),
    'space warn-run verdict also carries the unsimulated-hazard note');
  const land = KD.afterRun(KD.assess(spec, derived,
    { name: 'Riverside City', traction: 0.98, env: { gravity: 9.81 } }), cleanRun);
  ok(/design held up\./.test(land.text) && !/not simulated/.test(land.text),
    'land clean-run verdict is unchanged (no spurious hazard note)');
}

console.log((fail === 0 ? 'PASS' : 'FAIL') + '  honesty: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
