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
    ok(/case 'tilt': return 0;/.test(src), name + " tilt() returns 0 (flat worlds, level IMU)");
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

// 14. Honest desktop-AI copy (judge round 9): the browser Build modal must not
//     call separately-installed Ollama "built-in".
{
  const app = read('app.jsx');
  ok(!/uses the built-in local AI/.test(app), 'Build modal no longer claims a "built-in" local AI');
  ok(/through Ollama, a separate free install/.test(app), 'Build modal names Ollama as a separate free install');
}

// 15. The learning pillar is named at first contact (judge round 9).
ok(/Lessons<\/b>: 18 graded missions/.test(read('onboarding.jsx')),
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
  ok(/catRangeCm\(massFac, \(terrain\.env && terrain\.env\.gravity\)/.test(realism2),
    'realism recomputes the battery range at the world traction');
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
  ok(!/id="sim-speed"[^>]*aria-label="Simulation speed"/.test(app),
    'sim-speed no longer overrides the visible label with a mismatched aria-label');
  const panelsSrc = read('panels.jsx');
  ok(/aria-label="Use model"/.test(panelsSrc), 'the model picker accessible name contains the visible "Use model"');
  ok(!/onChange=\{e => pickModel\(e\.target\.value\)\} aria-label="AI model"/.test(panelsSrc),
    'the model picker no longer uses the mismatched "AI model" name');
}

console.log((fail === 0 ? 'PASS' : 'FAIL') + '  honesty: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
