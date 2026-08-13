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

// 2. The design check (diagnostics) and the verification report (verify) must
//    print the SAME stopping distance for one build, and it must be the
//    throttled approach speed the live tick actually cruises at (mobMul x
//    traction), NOT the un-throttled top speed -- otherwise a low-traction
//    world gets a stop inflated ~2-4x that WARNs when the run never crashes.
//    Behavioural, not a source regex: the earlier regex pinned the exact
//    un-throttled formula and so pinned the very bug (design check said 266cm
//    on Europa while the report still said 1065). Load both surfaces into the
//    motion-model context and compare their real output across worlds.
const diag = read('diagnostics.jsx');
const verify = read('verify.jsx');
vm.runInContext(diag, ctx, { filename: 'diagnostics.jsx' });
vm.runInContext(verify, ctx, { filename: 'verify.jsx' });
const D = ctx.window.KodroDiagnostics;
const V = ctx.window.KodroVerify;
ok(D && typeof D.assess === 'function' && V && typeof V.report === 'function',
  'diagnostics.assess and verify.report both load headlessly');
{
  const spec = { type: 'rover', board: 'esp32', sensors: ['ultrasonic', 'imu'], actuators: ['motors4'] };
  const derived = { massFactor: 0.692, speedFactor: 1.0, gripFactor: 1.4, mass: 623, commands: ['distance', 'heading'] };
  const robot = Object.assign({}, spec, derived);
  // Europa (traction 0.5) is the world where the un-throttled bug inflated the
  // stop the most; earth (traction 1.0) is the no-throttle control.
  for (const [name, tr, g] of [['europa', 0.5, 1.31], ['mars', 0.6, 3.71], ['earth', 1.0, 9.81]]) {
    const terrain = { id: name, name, traction: tr, env: { gravity: g } };
    const dcStop = D.assess(spec, derived, terrain).numbers.stoppingCm;
    const rep = V.report(robot, terrain);
    const stopRow = rep.rows.find((r) => r.label === 'Stopping distance');
    const repStop = Math.round(parseFloat(stopRow.value) * 100);
    // Both must equal the tick's throttled physics: catalogue cruise is
    // baseSpeedCmPerS * speedFactor * mobMul(=1 for catalogue) * traction.
    const vTick = M.baseSpeedCmPerS * derived.speedFactor * tr;
    const tickStop = Math.round(KM.physStoppingDistanceCm(vTick, tr, g));
    ok(Math.abs(dcStop - repStop) <= 1, name + ': design check and report print the same stop (' + dcStop + ' vs ' + repStop + ')');
    ok(Math.abs(dcStop - tickStop) <= 1, name + ': stop matches the tick throttled approach (' + dcStop + ' vs ' + tickStop + ')');
  }

  // A LOW-MOBILITY build on a low-traction world where mobMul actually drops
  // below 1: the design check and report must throttle the approach speed by
  // mobMul exactly as the tick does, or the stop reads ~2x too wide. The
  // high-mobility rover above never triggers this (mob is high, mobMul=1), so
  // this case is what pins the catalogue-mobMul fix.
  {
    const lowSpec = { type: 'car', board: 'esp32', sensors: ['ultrasonic'], actuators: ['motors2', 'servos'] };
    const lowDerived = { massFactor: 0.643, speedFactor: 1.0, gripFactor: 1.0, mass: 900, commands: ['distance'] };
    const lowRobot = Object.assign({}, lowSpec, lowDerived);
    const ice = { id: 'ice', name: 'ice', traction: 0.45, env: { gravity: 9.81 } };
    const mob = KM.mobilityScore(1.0, 0.643, 0.45);
    const mobMul = KM.mobilityMultiplier(true, mob);
    ok(mobMul < 1, 'low-mobility car on ice actually throttles (mobMul ' + mobMul + ' < 1)');
    const vTickLow = M.baseSpeedCmPerS * 1.0 * mobMul * 0.45;
    const tickLow = Math.round(KM.physStoppingDistanceCm(vTickLow, 0.45, 9.81));
    const dcLow = D.assess(lowSpec, lowDerived, ice).numbers.stoppingCm;
    const repRow = V.report(lowRobot, ice).rows.find((r) => r.label === 'Stopping distance');
    const repLow = Math.round(parseFloat(repRow.value) * 100);
    ok(Math.abs(dcLow - tickLow) <= 1, 'low-mobility stop matches the mobMul-throttled tick (' + dcLow + ' vs ' + tickLow + ')');
    ok(Math.abs(dcLow - repLow) <= 1, 'low-mobility design check and report agree (' + dcLow + ' vs ' + repLow + ')');
  }

  // 2b. A MEASURED build's Endurance range is per-world (drains at the world's
  //     gravity/traction) and equals the enforced sim, so the design-check
  //     'here' figure agrees with the Realism 'here' row and never shows a
  //     fixed Earth-nominal on every world. Behavioural: assert it VARIES
  //     across worlds and matches 1/physDrainPctPerCm at each.
  const mSpec = { type: 'rover', board: 'esp32', sensors: ['ultrasonic', 'imu'], actuators: ['motors4'] };
  const mPhys = { drainPctPerCmNominal: 7.9775e-5, massKg: 1.0, energyWh: 13.024, vMaxSimCmPerS: 95.79 };
  const mDerived = { massFactor: 0.692, speedFactor: 1.0, gripFactor: 1.4, mass: 1000, phys: mPhys, commands: ['distance'] };
  const endRange = (g, tr) => {
    const a = D.assess(mSpec, mDerived, { id: 'w', name: 'w', traction: tr, env: { gravity: g } });
    const p = a.dimensions.find((d) => d.key === 'power');
    return parseInt((p.reason.match(/(\d+) m of driving/) || [])[1], 10);
  };
  const rEarth = endRange(9.81, 1.0);
  const rUnder = endRange(9.81, 0.66);
  const tickUnder = Math.round(1 / KM.physDrainPctPerCm(1.0, 13.024, 95.79 * 0.66, 9.81, 0.66));
  ok(rEarth > 100 && rEarth < 100000, 'measured endurance is metres, not the 100x-short 125 m bug (earth ' + rEarth + ')');
  ok(rUnder < rEarth - 100, 'measured endurance varies per world, not a fixed Earth-nominal (earth ' + rEarth + ' vs underwater ' + rUnder + ')');
  ok(Math.abs(rUnder - tickUnder) <= 2, 'measured endurance matches the enforced pack drain per world (' + rUnder + ' vs ' + tickUnder + ')');

  // 2c. A THROTTLED measured build (low mobility on a low-traction world, so
  //     mobMul < 1) drains at the tick's throttled cruise vMaxSim*mobMul*trac,
  //     NOT the un-throttled vMaxSim*trac. Omitting mobMul overstated the
  //     range. This build has stallForceN so mob = physMobility, and on
  //     underwater it drops mobMul below 1 - the case the earlier
  //     high-mobility build never exercised.
  const tStall = 8.0, tMassKg = 0.9, tEnergy = 14.65, tVmax = 93.75;
  const tPhys = { drainPctPerCmNominal: KM.physDrainPctPerCm(tMassKg, tEnergy, tVmax, 9.81, 1), massKg: tMassKg, energyWh: tEnergy, vMaxSimCmPerS: tVmax, stallForceN: tStall };
  const tSpec = { type: 'rover', board: 'esp32', sensors: ['ultrasonic'], actuators: ['motors2'] };
  const tDerived = { massFactor: 0.6, speedFactor: 1.0, gripFactor: 1.0, mass: 900, phys: tPhys, commands: ['distance'] };
  const tMob = KM.physMobility(tStall, tMassKg, 0.66, 9.81);
  const tMobMul = KM.mobilityMultiplier(true, tMob);
  ok(tMobMul < 1, 'throttled measured build actually drops mobMul below 1 on underwater (' + tMobMul + ')');
  const tTick = Math.round(1 / KM.physDrainPctPerCm(tMassKg, tEnergy, tVmax * tMobMul * 0.66, 9.81, 0.66));
  const tDc = (() => {
    const a = D.assess(tSpec, tDerived, { id: 'underwater', name: 'underwater', traction: 0.66, env: { gravity: 9.81 } });
    const p = a.dimensions.find((d) => d.key === 'power');
    return parseInt((p.reason.match(/(\d+) m of driving/) || [])[1], 10);
  })();
  ok(Math.abs(tDc - tTick) <= 2, 'throttled measured endurance matches the mobMul-throttled tick (' + tDc + ' vs ' + tTick + ')');
}

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

// 5. Realism top speed is measured m/s when available, else an honestly labelled
//    catalogue standard (never a bare unitless multiplier read as a speed, and
//    never a per-part multiplier that would scale with motor count — JR10-04).
const realism = read('realism.jsx');
ok(/vMaxSimCmPerS/.test(realism) && /standard \(no-load\); import a measured spec/.test(realism),
  'realism shows measured m/s when available, else the catalogue-standard label');
ok(!/×.*speedFac|speedFac.*vs a standard/.test(realism),
  'realism no longer shows a per-build top-speed multiplier for catalogue builds');

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

// 9. tilt() must not fabricate slope readings (judge round 9): worlds are flat
//    planes, the disclosure says the IMU returns level readings, and the
//    self-test / lesson grader / Python engine all model 0 - so the live host
//    and the scenario validator must return 0 too, not a position-seeded sine.
{
  const hooks = read('hooks.jsx');
  const scenario = read('scenario.jsx');
  for (const [name, src] of [['hooks.jsx', hooks], ['scenario.jsx', scenario]]) {
    // Trace-enabled engines wrap sensor values in read(...) so the learner can
    // inspect them later; the physical value must still be the literal zero.
    ok(/case 'tilt': return (?:read\()?0(?:\))?;/.test(src), name + " tilt() returns 0 (flat worlds, level IMU)");
    ok(!/case 'tilt': return Math\.round\(\(Math\.sin/.test(src), name + ' no longer synthesizes tilt from position');
  }
}

// 10. Slope-named mission sites carry their unsimulated hazard so the run
//     verdict is scoped there too (judge round 9), via terrain.unsimHazard.
{
  const terrains = read('terrains.jsx');
  ok((terrains.match(/unsim: 'slopes and terrain height'/g) || []).length >= 2,
    'Fuji Slopes and Himalayan Foothills declare their unsimulated slopes');
  ok(/unsimHazard: s\.unsim \|\| base\.unsimHazard \|\| null/.test(terrains),
    'the site merge propagates unsimHazard');
  const KD = ctx.window.KodroDiagnostics;
  const spec = { sensors: ['ultrasonic', 'imu'], actuators: ['motors4'], type: 'rover' };
  const derived = { massFactor: 0.7, speedFactor: 0.7 };
  const cleanRun = { outcome: 'done', commands: 10, distanceCm: 800, minProximityCm: 100 };
  const fuji = KD.afterRun(KD.assess(spec, derived,
    { name: 'Japan - Mount Fuji Slopes', traction: 0.6, env: { gravity: 9.81 }, unsimHazard: 'slopes and terrain height' }), cleanRun);
  ok(/slopes and terrain height/.test(fuji.text) && /not simulated/.test(fuji.text) && !/design held up\./.test(fuji.text),
    'a clean run on a slope-named site scopes its verdict (got: ' + fuji.text.slice(0, 90) + ')');
}

// 11. Battery honesty (judge round 9): every displayed endurance figure derives
//     from the SAME distance ledger the sim enforces. The old mass proxy
//     (60/massFactor "minutes") contradicted the enforced drain ~150x.
{
  const KM2 = ctx.window.KodroMotion;
  ok(typeof KM2.catRangeCm === 'function' && typeof KM2.catEnduranceMin === 'function',
    'motion model exposes catRangeCm/catEnduranceMin');
  const rangeCm = KM2.catRangeCm(0.7, 9.81, 1);
  near(rangeCm, 100 / (M.drainPctPerCm * 0.7), 'catRangeCm inverts the enforced per-cm drain');
  const lab = read('RobotLab.jsx');
  ok(!/Math\.round\(60 \/ massFactor\)/.test(lab), 'RobotLab no longer uses the mass-proxy runtime');
  ok(/catRangeCm/.test(lab) && /catEnduranceMin/.test(lab), 'RobotLab derives endurance from the ledger');
  const verify2 = read('verify.jsx');
  ok(/catRangeCm/.test(verify2) && /catEnduranceMin/.test(verify2),
    'verification report derives catalogue Runtime/Range from the ledger');
  ok(!/'top speed times runtime; real missions turn and idle'\)\);\n    \/\/ Battery per metre[\s\S]*catalogue estimate from mass/.test(verify2),
    'report no longer prints the mass-proxy runtime for catalogue builds');
  const diag2 = read('diagnostics.jsx');
  ok(/catRangeCm/.test(diag2), 'design-check endurance derives from the ledger');
  const KD = ctx.window.KodroDiagnostics;
  const rep = KD.assess({ sensors: ['ultrasonic', 'imu'], actuators: ['motors4'], type: 'rover' },
    { massFactor: 0.7, speedFactor: 1.25 }, { name: 'Riverside City', traction: 0.98, env: { gravity: 9.81 } });
  ok(rep.numbers.rangeM > 100 && rep.numbers.rangeM < 170,
    'default-build range on city is the ledger figure (~127 m, got ' + rep.numbers.rangeM + ')');
  ok(/Run the test/.test(rep.summary) && !/Press Run/.test(rep.summary),
    'design-check guidance stays action-neutral across Simple and Expert run controls');
  const realism2 = read('realism.jsx');
  ok(/rangeM/.test(realism2), 'realism dashboard shows the ledger range for catalogue builds');
  ok(/none in live runs/.test(realism2), 'realism no longer claims "nominal" sensor noise in noise-free live runs');
}

// 12. Weather is disclosed as visual-only (judge round 9).
ok(/Weather: rain, snow and dust storms change the light level and the visuals only/.test(read('specschema.js')),
  'fidelity disclosure covers weather (visual-only)');

// 13. The browser "Export progress report" control WORKS (downloads a file and
//     toasts) instead of dead-ending into a console line (judge round 9).
{
  const hooks = read('hooks.jsx');
  ok(/kodro-progress-report\.txt/.test(hooks) && /new Blob\(/.test(hooks) && /showToast\('Progress report downloaded/.test(hooks),
    'browser export builds and downloads a real report with visible feedback');
}

// 14. One evidence-bounded Build surface in both run modes. No model-generated
//     prices or electrical advice is presented as a purchasing plan.
{
  const app = read('app.jsx');
  ok(!/uses the built-in local AI/.test(app), 'Build modal no longer claims a "built-in" local AI');
  ok(!/KodroPanels\.BuildModal/.test(app), 'desktop and browser use the same evidence-bounded Build dialog');
  ok(/Purchasing advice remains unavailable/.test(app), 'Build refuses unverified purchasing advice');
  ok(/will not invent live prices, electrical compatibility or a safe wiring plan/.test(app),
    'Build states the live-price and electrical-evidence boundary');
}

// 15. The learning pillar is named at first contact (judge round 9).
ok(/Lessons<\/b>: 24 graded missions/.test(read('onboarding.jsx')),
  'onboarding step 3 introduces the Lessons pillar');

// 16. Catalogue no-load top speed must NOT scale with drive-part count or type
//     (judge round 10): every drive/actuator part shares one nominal speed, so
//     a 4-motor build is not taught to be faster than a 2-motor one. Behavioural:
//     derive() the default 4-motor rover and a 2-motor build; both get the same
//     catalogue speedFactor.
{
  const labSrc = read('RobotLab.jsx');
  ctx.window.KodroSpecSchema = ctx.window.KodroSpecSchema || undefined;
  // Parse the ACTUATORS speed tiers straight from source (derive() needs the
  // React-bound module; the tiers are plain data we can assert directly).
  const speeds = [...labSrc.matchAll(/id: '(motors2|motors4|servos)'[^}]*?speed: ([\d.]+)/g)].map((m) => [m[1], +m[2]]);
  ok(speeds.length === 3 && speeds.every(([, v]) => v === 1.0),
    'motors2/motors4/servos share one nominal no-load speed (found ' + JSON.stringify(speeds) + ')');
  ok(!/motors4:[^}]*speed: 1\.25/.test(labSrc), 'the 4-motor part no longer claims 1.25x top speed');
  ok(/more grip and torque \(not more top speed\)/.test(labSrc),
    'the 4-motor note clarifies the advantage is grip/torque, not top speed');
}

// 17. Code comments (the teaching text) must clear WCAG AA: .tok-com uses --fg-3
//     (AA-verified on --void by qa_contrast §3b), not the ~1.8:1 --fg-4 (JR10-01).
{
  const css = readFileSync(path.join(HERE, '..', 'src', 'robolearn', 'assets', 'web', 'styles.css'), 'utf8');
  ok(/\.tok-com \{ color:var\(--fg-3\)/.test(css), 'code comments use the AA-clearing --fg-3, not --fg-4');
  ok(/\.repl-input::placeholder \{ color:var\(--fg-3\); \}/.test(css), 'the REPL placeholder uses --fg-3');
}

// 18. Mars (thin, near-vacuum atmosphere) scopes its verdict like the vacuum and
//     depth worlds instead of an unqualified "held up" (JR10-03). Behavioural.
{
  const KD = ctx.window.KodroDiagnostics;
  const spec = { sensors: ['ultrasonic', 'imu'], actuators: ['motors4'], type: 'rover' };
  const derived = { massFactor: 0.7, speedFactor: 0.7 };
  const cleanRun = { outcome: 'done', commands: 10, distanceCm: 800, minProximityCm: 100 };
  const mars = KD.afterRun(KD.assess(spec, derived,
    { name: 'Mars', traction: 0.9, env: { gravity: 3.71, pressure: 0.006, pressureLabel: 'PRESSURE', pressureUnit: 'atm' } }), cleanRun);
  ok(/thin, near-vacuum atmosphere/.test(mars.text) && /not simulated/.test(mars.text) && !/design held up\./.test(mars.text),
    'a clean Mars run scopes its verdict for the unsimulated thin atmosphere (got: ' + mars.text.slice(0, 90) + ')');
  // A normal 1-atm world is untouched.
  const earth = KD.afterRun(KD.assess(spec, derived,
    { name: 'Riverside City', traction: 0.98, env: { gravity: 9.81, pressure: 1.0, pressureLabel: 'PRESSURE', pressureUnit: 'atm' } }), cleanRun);
  ok(/design held up\./.test(earth.text) && !/not simulated/.test(earth.text),
    'a normal 1-atm world keeps the plain held-up verdict');
}

// 19. Blocks palette: the print-stub sample blocks are lessonOnly and hidden on
//     the free Studio surface (judge round 10).
{
  const appData = read('app-data.jsx');
  ok(/k: 'collect'[^}]*lessonOnly: true/.test(appData) && /k: 'drop'[^}]*lessonOnly: true/.test(appData),
    'collect/drop sample blocks are marked lessonOnly');
  const panelsSrc = read('panels.jsx');
  ok(/BLOCK_DEFS\.filter\(d => classroom \|\| !d\.lessonOnly\)/.test(panelsSrc),
    'the blocks palette hides lessonOnly blocks outside classroom mode');
}

// 20. Battery-range CONSISTENCY (judge round 11): the Robot Lab badge, the
//     design-check Endurance line and the Realism Battery row must all show the
//     SAME world-accurate range (what the ledger enforces at the world traction),
//     not a nominal traction-1.0 figure mislabelled "the ledger the run
//     enforces". The badge reuses the design-check's report.numbers.rangeM and
//     realism recomputes at the world's traction.
{
  const lab = read('RobotLab.jsx');
  ok(/report && report\.numbers && report\.numbers\.rangeM/.test(lab),
    'Robot Lab range badge reuses the design-check world-accurate rangeM');
  const realism2 = read('realism.jsx');
  // Both build kinds recompute the battery range at the WORLD's gravity and
  // traction (gravityHere/tractionHere), so the "here (the ledger the run
  // enforces)" row is world-accurate for a catalogue build (catRangeCm) AND a
  // measured build (real pack drain, physDrainPctPerCm). The measured branch
  // used to show the fixed Earth-nominal robot.rangeM on every world.
  ok(/catRangeCm\(massFac, gravityHere, tractionHere\)/.test(realism2),
    'realism recomputes the catalogue battery range at the world gravity/traction');
  ok(/physDrainPctPerCm\([\s\S]*?vMaxSimCmPerS \* rMobMul \* tractionHere, gravityHere, tractionHere\)/.test(realism2),
    'realism recomputes the MEASURED battery range at the world gravity/traction AND mobility throttle (not fixed Earth-nominal, not un-throttled)');
  ok(!/robot\.rangeM \? '~' \+ robot\.rangeM \+ ' m of driving on a charge \(the ledger/.test(realism2),
    'realism no longer captions the nominal traction-1 range as the enforced ledger');
  // Behavioural: the design-check range at city traction (0.98) is a few metres
  // below the nominal traction-1.0 range, and that lower figure is what all
  // surfaces must agree on.
  const KM3 = ctx.window.KodroMotion;
  const nominal = Math.round(KM3.catRangeCm(0.7, 9.81, 1) / 100);
  const atCity = Math.round(KM3.catRangeCm(0.7, 9.81, 0.98) / 100);
  ok(atCity < nominal, 'world-traction range (' + atCity + ' m) is below the nominal traction-1 range (' + nominal + ' m), as expected');
  const KD2 = ctx.window.KodroDiagnostics;
  const rep2 = KD2.assess({ sensors: ['ultrasonic', 'imu'], actuators: ['motors4'], type: 'rover' },
    { massFactor: 0.7, speedFactor: 1.0 }, { name: 'Riverside City', traction: 0.98, env: { gravity: 9.81 } });
  ok(rep2.numbers.rangeM === atCity, 'design-check rangeM equals the world-traction ledger figure (' + rep2.numbers.rangeM + ')');
}

// 21. Teacher register heatmap has row/column header semantics (WCAG 1.3.1,
//     judge round 11): the learner name is a th scope=row, concept columns are
//     th scope=col.
{
  const panelsSrc = read('panels.jsx');
  ok(/<th scope="row" className="hm-name">/.test(panelsSrc), 'learner name is a scope=row header');
  ok(/<th key={c} scope="col" className="hm-concept">/.test(panelsSrc), 'concept columns are scope=col headers');
  ok(/<th scope="col">\{browserMode \? 'Learner' : 'Pupil'\}<\/th>/.test(panelsSrc), 'the corner header carries scope=col');
}

// 22. Quick-fit "Fit a motor" must not present a top speed derived from a
//     silently-assumed wheel radius as HONOURED/measured (judge round 11's
//     builder finding, JR12-01). The assumed wheel is flagged, badged
//     approximated (never honoured), disclosed with a warning, and shown in the
//     Robot Lab measured banner.
{
  const lab = read('RobotLab.jsx');
  ok(/drive\.wheelRadiusCm = 3\.5; drive\.wheelRadiusAssumed = true;/.test(lab),
    'applyMotor flags the injected wheel radius as assumed');
  ok(/Wheel ',[\s\S]{0,120}wheelRadiusAssumed \? ' \(assumed\)'/.test(lab),
    'the measured banner shows the wheel radius, marked (assumed) when guessed');
  vm.runInContext(read('specschema.js'), ctx, { filename: 'specschema.js' });
  const SS = ctx.window.KodroSpecSchema;
  ok(SS && typeof SS.deriveFromPhysical === 'function', 'specschema exposes deriveFromPhysical');
  const specAssumed = { physical: { massKg: 0.6, drive: { motor: { noLoadRpm: 310, stallTorqueNm: 0.3 }, wheelRadiusCm: 3.5, wheelRadiusAssumed: true, motorCount: 4 } } };
  const phAssumed = SS.deriveFromPhysical(specAssumed, { massFactor: 0.7, speedFactor: 1, runtimeMin: 60 });
  ok(phAssumed.badges.topSpeed === 'approximated',
    'an assumed-wheel top speed is badged approximated, never honoured (got ' + phAssumed.badges.topSpeed + ')');
  ok((phAssumed.warnings || []).some((w) => /assumes a 3\.5 cm wheel radius/.test(w)),
    'an assumed-wheel top speed carries a disclosure warning');
  ok(phAssumed.wheelRadiusAssumed === true && phAssumed.wheelRadiusCm === 3.5,
    'the derived block exposes the assumed wheel for the banner');
  // A REAL wheel radius still honours the top speed (regression guard).
  const specReal = { physical: { massKg: 0.6, drive: { motor: { noLoadRpm: 310, stallTorqueNm: 0.3 }, wheelRadiusCm: 3.5, motorCount: 4 } } };
  const phReal = SS.deriveFromPhysical(specReal, { massFactor: 0.7, speedFactor: 1, runtimeMin: 60 });
  ok(phReal.badges.topSpeed === 'honoured' && phReal.wheelRadiusAssumed === false,
    'a real (non-assumed) wheel radius still honours the top speed');
}

// 23. WCAG 2.5.3 Label in Name (judge round 12): a control's accessible name
//     must contain its visible label. The sim-speed slider must not override its
//     visible "Sim speed" <label> with a different aria-label, and the Vibe model
//     picker's aria-label must contain the visible "Use model".
{
  const app = read('app.jsx');
  ok(/<label htmlFor="sim-speed">Sim speed<\/label>/.test(app), 'sim-speed keeps its visible label');
  // The slider's aria-label must EXACTLY match the visible label "Sim speed":
  // this satisfies WCAG 2.5.3 (accessible name contains the visible text) AND,
  // crucially, survives the visible <label> being display:none at <=768px so
  // the slider never loses its accessible name on mobile (JR13-02 regression).
  ok(/id="sim-speed"[^\n]*aria-label="Sim speed"/.test(app),
    'sim-speed has aria-label="Sim speed" (matches visible label, survives mobile display:none)');
  ok(!/id="sim-speed"[^\n]*aria-label="Simulation speed"/.test(app),
    'sim-speed does not use the mismatched "Simulation speed" name');
  const panelsSrc = read('panels.jsx');
  ok(/aria-label="Use model"/.test(panelsSrc), 'the model picker accessible name contains the visible "Use model"');
  ok(!/onChange=\{e => pickModel\(e\.target\.value\)\} aria-label="AI model"/.test(panelsSrc),
    'the model picker no longer uses the mismatched "AI model" name');
}

// 24. The phone-width world-switch bar must keep the FIXED dark glass in every
//     theme (judge round 13): the light-cream --hud-fg-3 labels vanished to
//     ~1.05:1 when the @640px rule repainted the bar to a light theme's
//     near-white --navy-2. Pin the dark-glass background + AA of --hud-fg-3 on
//     it across all themes.
{
  const css = readFileSync(path.join(HERE, '..', 'src', 'robolearn', 'assets', 'web', 'styles.css'), 'utf8');
  const phone640 = (css.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}/) || [])[1] || '';
  const barRule = (phone640.match(/\.view-panel \.terrain-switch \{([\s\S]*?)\}/) || [])[1] || '';
  ok(/background:rgba\(8,9,15,0\.85\)/.test(barRule) && !/background:var\(--navy-2\)/.test(barRule),
    'the phone world-switch bar keeps the fixed dark glass, not a theme navy-2');
}

// 25. Sound is OFF by default (user request: the auto-playing ambience/sfx were
//     intrusive). Both the React mute state and the sound module default to
//     muted unless the user has explicitly opted in (or_muted === "0").
{
  const app = read('app.jsx');
  ok(/const \[muted, setMuted\] = useState\(\(\) => lsGet\('or_muted'\) !== '0'\);/.test(app),
    'the app defaults to muted (sound off) unless the user opted in');
  const snd = read('sound.js');
  ok(/localStorage\.getItem\("or_muted"\) !== "0"/.test(snd),
    'the sound module defaults to muted unless the user opted in');
}

// 26. The Design Check's "fit 4 DC motors for grip/torque" mobility advice must
//     actually IMPROVE the catalogue mobility it computes (judge round 14):
//     JR10-04 set all drive parts to speed 1.0, so motor count had entered
//     mobility only as mass (penalty), making the advice counterproductive. A
//     gripFactor now models drive torque, so a 4-motor build out-grips its
//     2-motor twin on every surface. Behavioural, via the REAL assess().
{
  const KD = ctx.window.KodroDiagnostics;
  function derivedFor(motor) {
    const mass = 300 + 10 + 13 + (motor === 'motors4' ? 220 : 120);
    return { mass, massFactor: Math.min(1.8, Math.max(0.6, mass / 900)), speedFactor: 1.0, gripFactor: motor === 'motors4' ? 1.4 : 1.0 };
  }
  let consistent = true;
  for (const tr of [0.45, 0.55, 0.75, 0.98]) {
    const world = { name: 'W', traction: tr, env: { gravity: 9.81 } };
    const m2 = KD.assess({ sensors: ['ultrasonic', 'imu'], actuators: ['motors2'], type: 'rover' }, derivedFor('motors2'), world).numbers.mobility;
    const m4 = KD.assess({ sensors: ['ultrasonic', 'imu'], actuators: ['motors4'], type: 'rover' }, derivedFor('motors4'), world).numbers.mobility;
    if (!(m4 >= m2)) { consistent = false; ok(false, `4 DC motors must not LOWER mobility (traction ${tr}: motors2 ${m2} vs motors4 ${m4})`); }
  }
  if (consistent) ok(true, 'the "fit 4 DC motors for grip" advice raises catalogue mobility on every surface (gripFactor models torque)');
  const lab = read('RobotLab.jsx');
  ok(/motors4: \{[^}]*grip: 1\.4/.test(lab) && /motors2: \{[^}]*grip: 1\.0/.test(lab),
    'the drive parts carry a grip (torque) factor, 4 motors > 2 motors');
  ok(/gripFactor: grip/.test(lab), 'derive() exposes gripFactor');
  const mm = read('motion-model.js');
  ok(/function mobilityScore\(gripFactor, massFactor, traction\)/.test(mm),
    'mobilityScore takes the drive gripFactor (not top speed)');
}

// 27. The skip-link target must be focusable so the WCAG 2.4.1 bypass works on
//     Safari/VoiceOver (judge round 14): #editor-main needs tabIndex=-1.
{
  const app = read('app.jsx');
  ok(/<main id="editor-main" tabIndex=\{-1\}/.test(app),
    'the skip-link target #editor-main is focusable (tabIndex=-1)');
}

// 28. Simple mode must be a genuine novice workflow, not the expert IDE with a
//     few buttons hidden. The proving cockpit owns the first decision, code is
//     an explicit transition, and only an exact configuration/world/source
//     match may be presented as evidence for the current plan. Four stages must
//     also fit on one phone navigation row.
{
  const app = read('app.jsx');
  const css = readFileSync(path.join(HERE, '..', 'src', 'robolearn', 'assets', 'web', 'styles.css'), 'utf8');
  ok(/const \[simpleCodeOpen, setSimpleCodeOpen\] = useState\(false\)/.test(app),
    'Simple mode opens on the test plan instead of source code');
  ok(/showSimpleCockpit = simpleExperience && activeStage === 'prove' && !simpleCodeOpen/.test(app),
    'the novice cockpit is scoped to Simple Prove and yields to deliberate code editing');
  ok(/r\.world === terrainId && r\.robotName === chipName[\s\S]*r\.robotKey && r\.robotKey === simpleRobotKey && r\.source === code/.test(app),
    'Simple results require the exact current world, robot configuration and source');
  ok(/function runRobotKey\(spec\)[\s\S]*boardMassG:[\s\S]*sensors:[\s\S]*actuators:[\s\S]*physical:/.test(app),
    'run evidence fingerprints catalogue and measured-spec behaviour inputs');
  const runreport = read('runreport.js');
  ok(/robotKey: String\(entry\.robotKey \|\| ''\)/.test(runreport),
    'new structured run reports persist the exact robot configuration fingerprint');
  ok(/KodroDiagnostics\.afterRun\(simpleAssessment, simpleLatestRun\)/.test(app)
      && /simpleLatestVerdict \|\| simpleLatestRun\.detail/.test(app)
      && !/simpleLatestRun\.verdict \|\| simpleLatestRun\.detail/.test(app),
    'Simple cockpit recomputes current coaching copy instead of trusting persisted prose');
  ok(/aria-label="Robot test plan"/.test(app) && /Build it with Companion/.test(app),
    'the novice cockpit exposes a named test plan and a visible Companion action');
  ok(/!showSimpleCockpit\s*&&\s*\(\s*<button className=\{'ctrl global-run/.test(app),
    'Simple plan mode has one primary Run action (the duplicate global Run is withheld)');
  ok(/data-simple-view="plan"/.test(css) && /\.simple-cockpit/.test(css),
    'Simple plan mode has a dedicated cockpit presentation');
  ok(/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css),
    'the three primary stages fit on one phone navigation row');
  const capGenerator = readFileSync(path.join(HERE, 'build_screenshot_harness.cjs'), 'utf8');
  ok(/q\.get\('experience'\)/.test(capGenerator)
      && /q\.get\('code'\)[\s\S]*q\.get\('run'\)[\s\S]*q\.get\('panel'\)[\s\S]*q\.get\('lesson'\)[\s\S]*q\.get\('tab'\)[\s\S]*kodro_experience', 'expert'/.test(capGenerator),
    'the QA fixture generator can select Simple or Expert and keeps code-driving tests deterministic');
}

// 29. A measured near miss must not fabricate a sensor error or imply a safety
//     certification, and it must retain the current site's unmodelled-hazard
//     disclosure just like every other successful-run branch.
{
  const KD = ctx.window.KodroDiagnostics;
  const spec = { sensors: ['ultrasonic', 'imu'], actuators: ['motors4'], type: 'rover' };
  const derived = { massFactor: 0.7, speedFactor: 0.7 };
  const nearRun = { outcome: 'done', commands: 10, distanceCm: 1000, minProximityCm: 20 };
  const land = KD.afterRun(KD.assess(spec, derived,
    { name: 'Earth', traction: 0.98, env: { gravity: 9.81 } }), nearRun);
  ok(/20 cm of clearance/.test(land.text) && /near miss/.test(land.text)
      && !/sensor misread|design safe/i.test(land.text),
    'near-miss verdict reports measured clearance without inventing a sensor error or safety claim');
  const deep = KD.afterRun(KD.assess(spec, derived,
    { name: 'Abyssal', traction: 0.66, env: { gravity: 9.81 }, unsimHazard: 'depth pressure' }), nearRun);
  ok(/depth pressure/.test(deep.text) && /not simulated/.test(deep.text),
    'near-miss verdict retains the current site unmodelled-hazard disclosure');
}

console.log((fail === 0 ? 'PASS' : 'FAIL') + '  honesty: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
