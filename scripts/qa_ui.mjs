/* Offline UI regression smoke for the Kodro studio.
 *
 * The interpreter has hard numbers (qa_interpreter.mjs: 21/21) but the React
 * studio itself had no regression net: a broken bundle, a crashing world, or a
 * panel that throws on mount would render a blank canvas and ship silently.
 * This harness closes that gap. It drives the REAL shipped bundle through
 * cap.html (the same capture harness `build_screenshot_harness.cjs` emits) in
 * headless Chrome, across a handful of core flows, and FAILS a flow if either:
 *   (a) the screenshot is blank/tiny (the studio did not actually render), or
 *   (b) the page logged a genuine JS console error / uncaught exception.
 *
 * It then goes one step further and checks BEHAVIOUR, not just paint, with a
 * suite of per-concern asserts. Each drives a concrete action through cap.html,
 * dumps the post-action DOM (--dump-dom), and asserts a concrete marker (never a
 * fake pass — where a marker can't be reliably located it falls back to the most
 * specific real signal it CAN verify and labels the result honestly):
 *   1. RUN DETERMINISM  studio-earth-run -> the telemetry odometer reads the
 *      EXACT deterministic distance (3.4m ±0.3), not merely > 0. A green
 *      screenshot proves the studio painted; this proves the simulation ran AND
 *      ran the same way it always does — catching run-pump drift (a dropped or
 *      doubled advance, a physics tweak), not just a parked rover.
 *   2. BLOCKS INSERT    the Blocks palette compiles to Python and types it into
 *      the editor: assert the editor textarea now holds a known command token.
 *   3. ERROR PATH       a deliberately broken program run through the studio
 *      surfaces a `cline err` console line, not a silent no-op.
 *   4. WORLD IDENTITY   earth / lab / warehouse each report THEIR OWN world name
 *      on Run ("Deployed on <name>."), proving the worlds are distinct and
 *      reachable, not aliased to one default.
 * Together these catch a class of drift the pixel check misses: a broken
 * interpreter, a Run button wired to nothing, a frozen loop, a blocks->editor
 * break, a swallowed error, or worlds collapsing onto a single terrain.
 *
 * It is a SMOKE report: it always exits 0. If Chrome or the static server is
 * missing (e.g. a headless CI box with no GPU) it prints SKIP and exits 0 so it
 * never breaks a pipeline. Flows run SEQUENTIALLY with a short gap between them
 * because the dev http.server is single-threaded and stalls if hammered.
 *
 *   cd src/robolearn/assets/web && python -m http.server 8099   # serve first
 *   node scripts/build_screenshot_harness.cjs                   # emit cap.html
 *   node scripts/qa_ui.mjs                                      # this harness
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const TMP = path.join(REPO, 'tmp', 'ui');
const CAP = path.join(REPO, 'src', 'robolearn', 'assets', 'web', 'cap.html');

const HOST = 'localhost';
const PORT = 8099;
const BASE = `http://${HOST}:${PORT}/cap.html`;

// A real studio render fills a 1280x800 canvas; anything under this is a blank
// page or a partial paint, which is exactly the regression we are hunting.
const MIN_PNG_BYTES = 90_000;
// Single-threaded dev server: let it breathe between sequential hits.
const GAP_MS = 1200;
// Generous virtual-time so worlds, robots and the Run click all settle.
const VTIME_MS = 12_000;
// The behaviour pass needs the rover to finish driving, not just to render the
// first frame: Run is clicked ~1.4s in and the starter program animates several
// forward moves. Give it more headroom than the paint pass so the odometer has
// actually accumulated distance by the time we dump the DOM.
const BEHAVIOUR_VTIME_MS = 16_000;
// Hard ceiling on a single Chrome invocation in case it wedges. The FIRST
// headless launch builds a fresh --user-data-dir profile and JITs the WebGL
// stack from cold, which can run long; later launches are warm. We do a cheap
// about:blank warm-up before the flows AND give the first real spawn more
// headroom so a cold box does not flake the very first flow.
const SPAWN_TIMEOUT_MS = 60_000;
const FIRST_SPAWN_TIMEOUT_MS = 90_000;
// The flow whose Run we verify actually moved the rover.
const BEHAVIOUR_FLOW = 'studio-earth-run';

// RUN DETERMINISM: the default starter program on world=earth/robot=rover at
// q=high drives a fixed distance every time. After the default program changed,
// its stable single-run odometer is 3.4m: captured by driving the earth run flow
// at virtual-time 9000/16000/22000ms — all three read 3.4m with status IDLE (the
// run has fully completed, not caught mid-drive). We assert equality within a
// small tolerance — tight enough to catch run-pump drift (a dropped step, a
// doubled advance, a physics tweak), loose enough to absorb a sub-decimetre
// rounding wobble. If a future run ever proves NON-deterministic, drop back to
// the >0 check and say so in the label rather than asserting a value that drifts.
const EXPECTED_ODOMETER_M = 3.4;
const ODOMETER_TOLERANCE_M = 0.3;

// First Chrome we can find. The Git-Bash-style path in the task maps to this
// Windows location; fall back to a couple of common spots / PATH.
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_PATH,
  'chrome',
  'google-chrome',
].filter(Boolean);

// Lines we never want to count as failures: GPU/swiftshader chatter, service
// worker / GCM registration, extension + manifest noise, policy/deprecation
// notices, and the benign blank-tab line. The autoplay AudioContext warning is
// INFO-level and carries no error keyword, so it is excluded by the matcher
// below anyway, but we keep the noise net broad and defensive.
const NOISE = /gcm|registration|GROUP_MARKER|swiftshader|GPU stall|extension|manifest|web_app|externally_managed|about:blank|Permissions-Policy|deprecat|AudioContext|autoplay/i;
// A line is a real failure only if it is a console/exception line AND names a
// concrete error symptom. INFO console logs without these keywords pass.
const FAIL = /CONSOLE.*(error|uncaught|is not a function|is not defined|cannot read)/i;

const FLOWS = [
  { name: 'studio-earth-run', url: 'world=earth&robot=rover&q=high&run=1' },
  { name: 'world-mars',       url: 'world=mars&robot=rover&q=high&run=1' },
  { name: 'world-warehouse',  url: 'world=warehouse&robot=rover&q=high&run=1' },
  { name: 'arm-firstrun',     url: 'world=room&robot=arm&run=1' },
  { name: 'blocks-panel',     url: 'world=earth&robot=rover&panel=blocks' },
  { name: 'onboarding',       url: 'onb=1' },
];

// A deliberately broken program: an undefined name. The interpreter raises and
// the studio prints a "cline err" console line. Used by the error-path assert.
// Canonical bare dialect (F7): the shipped surface no longer teaches rover.*.
const BROKEN_PROGRAM = 'move_forward(nope_undefined_var)';

// WORLD IDENTITY: drive Run in three distinct worlds and assert each one's own
// name shows up. On Run the studio prints "Deployed on <name>." and lights the
// matching terrain button, so this proves the worlds are real and reachable —
// not aliased to one default. lab/warehouse are mission SITES layered on the
// room base; earth is a base terrain. Each must report ITS OWN name.
const WORLD_IDENTITY = [
  { world: 'earth',     expect: 'Earth' },
  { world: 'lab',       expect: 'Robotics Lab' },
  { world: 'warehouse', expect: 'Warehouse Test Zone' },
];

// MODALS RENDER: every studio toolbar button that opens a modal/popover, driven
// one at a time via cap.html?open=<name>. For each we assert (a) the modal's own
// known root marker is present in the dumped DOM, AND (b) no genuine console
// error fired (same NOISE/FAIL filter as the paint pass). `marker` is matched
// against the dumped HTML; it is taken from app.jsx (or the component file for
// the window-mounted ones) so it tracks the REAL markup, not a guess:
//   - aria-label="..."   the dialog's own accessible name (most modals)
//   - a class            settings-pop (the Settings popover) / rl-modal (Lab)
//   - a literal string   the Demo modal has no aria-label, so its eyebrow text
// Modals that would normally need a model (Vibe / Ask / Review) still RENDER
// without Ollama — they open to an input or a "needs Ollama" state — so opening
// is asserted, NOT an AI response, and no Ollama is required.
// Validate is intentionally NOT a modal: its button runs 5 seeds and prints a
// "Validation:" console line, so it is asserted on that console marker instead
// of a dialog root, and labelled as such.
const MODALS = [
  { name: 'vibe',       marker: /aria-label="Code with AI"/,        note: 'Vibe (Code with AI) modal' },
  { name: 'blocks',     marker: /aria-label="Block coding"/,         note: 'Blocks (visual block editor) modal' },
  { name: 'review',     marker: /aria-label="AI code review"/,       note: 'Review (second-agent) modal' },
  { name: 'realism',    marker: /aria-label="Realism dashboard"/,    note: 'Realism dashboard modal' },
  { name: 'demo',       marker: /Kodro Realism Demo/,                note: 'Guided Demo modal (no aria-label; eyebrow text)' },
  { name: 'ask',        marker: /aria-label="Ask a question"/,       note: 'Ask (lesson Q&A) modal' },
  { name: 'robotlab',   marker: /aria-label="Robot Lab"[^>]*role="dialog"|class="[^"]*rl-modal[^"]*"/, note: 'Robot Lab modal' },
  { name: 'memory',     marker: /aria-label="Memory and skills"[^>]*data-tick|class="modal modal-wide"[^>]*aria-label="Memory and skills"|aria-label="Memory and skills"[^>]*role="dialog"|role="dialog"[^>]*aria-label="Memory and skills"/, note: 'Memory and skills modal' },
  { name: 'build',      marker: /aria-label="Build a real robot"[^>]*role="dialog"|role="dialog"[^>]*aria-label="Build a real robot"/, note: 'Build a real robot modal' },
  { name: 'help',       marker: /aria-label="Keyboard shortcuts"[^>]*role="dialog"|role="dialog"[^>]*aria-label="Keyboard shortcuts"/, note: 'Keyboard shortcuts modal' },
  { name: 'settings',   marker: /class="settings-pop"/,              note: 'Settings popover' },
];

// Validate has no modal — it drives a 5-seed run and prints a "Validation:"
// console line. Asserted separately on that marker so the coverage is honest.
const VALIDATE = { name: 'validate', marker: /Validation:/, note: 'Validate (5-seed run; console line, not a modal)' };

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (c === 'chrome' || c === 'google-chrome') return c; // resolved via PATH
    if (existsSync(c)) return c;
  }
  return null;
}

// Probe the static server with a tiny HEAD-ish GET. Resolves to the status code
// or 0 on connection failure. No external deps, short timeout.
function probeServer() {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: PORT, path: '/cap.html', timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
  });
}

// Drive a URL in headless Chrome and dump the post-action DOM (not a
// screenshot). Returns { dom, stderr, consoleError, error }. The behaviour
// asserts below all read concrete DOM markers from the dumped HTML; the console
// stream is parsed with the SAME noise/fail matchers used for the paint pass so
// "a marker is present" is never reported over the top of a real JS error.
function dumpDom(chrome, tag, url, opts = {}) {
  const udd = path.join(TMP, `udd_${tag}`);
  const log = path.join(TMP, `log_${tag}.txt`);
  const args = [
    '--headless=new',
    `--window-size=${opts.size || '1280,800'}`,
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    `--virtual-time-budget=${opts.vtime || BEHAVIOUR_VTIME_MS}`,
    `--user-data-dir=${udd}`,
    '--enable-logging=stderr',
    '--v=0',
    '--dump-dom',
    url,
  ];
  const res = spawnSync(chrome, args, {
    encoding: 'utf8',
    timeout: opts.timeout || SPAWN_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, // the dumped DOM can be large; don't truncate it
  });
  const stderr = (res.stderr || '') + (res.error ? `\nSPAWN_ERROR: ${res.error.message}` : '');
  try { writeFileSync(log, stderr); } catch { /* best effort */ }
  const consoleError = stderr
    .split(/\r?\n/)
    .filter((l) => l && !NOISE.test(l) && FAIL.test(l))[0];
  return { dom: res.stdout || '', stderr, consoleError, error: res.error || null };
}

// Pull every odometer-style reading out of the dumped DOM. Telemetry.jsx renders
// the odometer as:  <span class="g-val">3.4<span class="g-unit">m</span></span>
// from `{(odometer/100).toFixed(1)}` + a bare "m" unit span. The Odometer gauge
// is the only one whose unit is a bare "m", so anchoring on g-val + g-unit="m"
// is specific to it. Returns the first > 0 value, else 0 if a 0.0 was seen, else
// null if no such gauge is in the DOM at all.
function readOdometer(dom) {
  const gaugeRe = /<span class="g-val">\s*(\d+(?:\.\d+)?)\s*<span class="g-unit">\s*m\s*<\/span>/gi;
  let matched = null;
  let m;
  while ((m = gaugeRe.exec(dom)) !== null) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && v > 0) return v;
    if (matched === null && Number.isFinite(v)) matched = v;
  }
  return matched;
}

// (1) RUN DETERMINISM — drive the run flow a SECOND time (--dump-dom) and assert
// the rover moved AND landed on the exact deterministic odometer reading. A
// green screenshot proves the studio painted; this proves the simulation ran
// and ran the SAME way it always does. Asserting equality (not just > 0) catches
// run-pump drift: a dropped step, a doubled advance, a physics tweak that nudges
// the distance. Falls back to a labelled weaker check only if the odometer span
// drifts out of the DOM. Returns { pass, reason, value }.
function checkRoverMoved(chrome, flow) {
  const { dom, consoleError, error } = dumpDom(chrome, `behaviour_${flow.name}`, `${BASE}?${flow.url}`);
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}`, value: null };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)', value: null };

  const odo = readOdometer(dom);
  // Shared status vocabulary (F11): telemetry prints RUNNING while driving.
  const driving = /RUNNING/.test(dom);

  if (odo !== null && odo > 0) {
    const delta = Math.abs(odo - EXPECTED_ODOMETER_M);
    const tag = driving ? ', status RUNNING' : '';
    if (delta <= ODOMETER_TOLERANCE_M) {
      return { pass: true, reason: `rover moved deterministically (odometer ${odo.toFixed(1)}m == ${EXPECTED_ODOMETER_M}m ±${ODOMETER_TOLERANCE_M}${tag})`, value: odo };
    }
    // It moved, but not to the expected mark: real run-pump / physics drift.
    return { pass: false, reason: `rover moved but odometer DRIFTED (${odo.toFixed(1)}m vs expected ${EXPECTED_ODOMETER_M}m ±${ODOMETER_TOLERANCE_M})`, value: odo };
  }

  // Odometer found but zero: the rover did NOT move — a genuine behaviour fail.
  if (odo !== null && odo === 0) {
    return { pass: false, reason: 'rover did NOT move (odometer 0.0m after Run)', value: 0 };
  }

  // FALLBACK: odometer span not locatable (markup drift). Don't fake a pass —
  // assert the weaker-but-real signal and LABEL it as the fallback.
  const haveTelemetry = /Odometer/.test(dom) && /(RUNNING|STANDBY|PAUSED|COMPLETE|HALTED)/.test(dom);
  if (haveTelemetry && driving && !consoleError) {
    return { pass: true, reason: 'rover moved (FALLBACK: odometer value not parseable, telemetry mounted + status=RUNNING; exact-value check skipped)', value: null };
  }
  const why = consoleError ? `console error during run: ${consoleError.slice(0, 120)}`
    : !haveTelemetry ? 'telemetry panel/odometer not found in DOM'
    : 'odometer not > 0 and status not RUNNING';
  return { pass: false, reason: `could not confirm rover moved (${why})`, value: odo };
}

// (2) BLOCKS INSERT -> editor gets code. Drive panel=blocks&blockstest=1: the
// cap.html driver opens the Blocks panel, clicks the first palette chip, then
// "Insert code →", which compiles the blocks to Python and types them into the
// editor textarea. We assert the editor (.code-ta) now holds a known command
// token. This is a real behaviour check: the blocks path is wired to the editor,
// not just that the palette renders. Falls back to a labelled render-level check
// (palette chip present) if the driver could not insert.
function checkBlocksInsert(chrome) {
  const url = `${BASE}?world=earth&robot=rover&panel=blocks&blockstest=1`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_blocks', url);
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error during blocks insert: ${consoleError.slice(0, 120)}` };

  // The editor textarea content sits between <textarea ...class="code-ta"...> and
  // its closing tag. The first palette chip is "move forward" -> move_forward(N).
  const taMatch = /<textarea[^>]*class="code-ta"[^>]*>([\s\S]*?)<\/textarea>/i.exec(dom);
  const editorText = taMatch ? taMatch[1] : '';
  if (/move_forward\(/.test(editorText) || /\bforward\b/.test(editorText)) {
    return { pass: true, reason: 'blocks inserted code (editor textarea now contains "move_forward")' };
  }

  // FALLBACK: insert did not reach the editor. Don't fake a pass — assert the
  // weaker render-level signal (the palette actually rendered its chips) and
  // LABEL it so the gap is visible.
  if (/class="block-chip/.test(dom)) {
    return { pass: false, reason: 'blocks insert did NOT reach editor; palette rendered (RENDER-LEVEL only) but no command token in .code-ta' };
  }
  return { pass: false, reason: 'blocks panel did not render a palette and no code reached the editor' };
}

// (3) ERROR PATH -> console shows an error line. Drive code=<broken program>:
// the cap.html driver types it into the editor and clicks Run. The interpreter
// raises and the studio renders a console line styled `cline err`. We assert
// that styled error line is present (and ideally names the error). This proves
// the error path surfaces failures to the user, not a silent no-op.
function checkErrorPath(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=high&code=${encodeURIComponent(BROKEN_PROGRAM)}`;
  const { dom, error } = dumpDom(chrome, 'behaviour_error', url);
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };

  // PRIMARY: the console renders an error line as <div class="cline err">...text.
  // Anchor on that class so we match the actual styled console error and not the
  // word "error" appearing elsewhere (e.g. an aria string or our own comment).
  const clineRe = /<div class="cline err">(?:<span class="ts">[^<]*<\/span>)?([^<]*)/i.exec(dom);
  if (clineRe) {
    const text = (clineRe[1] || '').trim().slice(0, 100);
    return { pass: true, reason: `error path surfaced a "cline err" console line${text ? `: "${text}"` : ''}` };
  }

  // FALLBACK: class drifted but the interpreter's "is not defined" message is the
  // expected runtime error for this broken program. Label it as the weaker check.
  if (/is not defined/.test(dom)) {
    return { pass: false, reason: 'error text present ("is not defined") but NOT in a "cline err" line — error styling may have drifted' };
  }
  return { pass: false, reason: 'no "cline err" console line and no error text after running broken program' };
}

// (4) WORLD IDENTITY -> distinct worlds. For each (world, expectedName), drive
// Run and assert the studio reports THAT world's own name. On Run the studio
// prints "Deployed on <name>." (terrain.name) and lights the matching terrain
// button. Confirms the worlds are genuinely distinct and reachable, not aliased
// to a single default. Returns { pass, reason } for one world.
function checkWorldIdentity(chrome, world, expectedName) {
  const url = `${BASE}?world=${world}&robot=rover&q=high&run=1`;
  const { dom, consoleError, error } = dumpDom(chrome, `behaviour_world_${world}`, url);
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error in ${world}: ${consoleError.slice(0, 100)}` };

  // PRIMARY: the Run handler prints `Deployed on <terrain.name>.` to the console.
  const deployRe = /Deployed on ([^.<]+)\./.exec(dom);
  const reported = deployRe ? deployRe[1].trim() : null;
  if (reported && reported.indexOf(expectedName) >= 0) {
    return { pass: true, reason: `${world} -> "Deployed on ${reported}" (matches "${expectedName}")` };
  }
  if (reported) {
    return { pass: false, reason: `${world} reported WRONG world: "Deployed on ${reported}" (expected "${expectedName}")` };
  }

  // FALLBACK: the deploy line drifted. Base terrains light a terrain button with
  // their LABEL (EARTH/MARS/...); assert that as a weaker, labelled signal.
  const labelRe = new RegExp(`class="terrain-btn active"[^>]*>(?:<[^>]*>)*\\s*${world.toUpperCase()}`, 'i');
  if (labelRe.test(dom)) {
    return { pass: false, reason: `${world}: no "Deployed on" line; terrain button "${world.toUpperCase()}" is active (RENDER-LEVEL only)` };
  }
  return { pass: false, reason: `${world}: could not confirm world identity (no deploy line, no active label)` };
}

// MODALS RENDER — open one modal/popover via cap.html?open=<name> and assert it
// actually rendered. We dump the post-click DOM and require BOTH:
//   (a) the modal's own root marker is present (a dialog-specific signal, NOT
//       the toolbar button's shared aria-label — see note below), AND
//   (b) no genuine console error fired (same NOISE/FAIL filter as elsewhere).
// The icon-bar buttons (Robot Lab / Memory / Build / Keyboard shortcuts) carry
// the SAME aria-label as their dialog, so a bare aria-label match would pass on
// the button alone even if the modal never opened. The markers in MODALS guard
// against that by anchoring on a dialog-only signal (role="dialog" adjacency, a
// modal-only class like rl-modal / settings-pop, or a body-only string). Returns
// { pass, reason }.
function checkModalRenders(chrome, modal) {
  const url = `${BASE}?world=earth&robot=rover&q=high&open=${modal.name}`;
  const { dom, consoleError, error } = dumpDom(chrome, `modal_${modal.name}`, url);
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  // A real console error while opening is a fail even if the marker is present —
  // a modal that mounts then throws is exactly the regression we are hunting.
  if (consoleError) return { pass: false, reason: `console error opening ${modal.name}: ${consoleError.slice(0, 120)}` };

  if (modal.marker.test(dom)) {
    return { pass: true, reason: `${modal.note} opened and rendered (marker present, no console error)` };
  }
  // Marker absent: the modal did not open, or its root markup drifted. Report
  // honestly which — a dialog root with the wrong name vs. nothing at all.
  const anyDialog = /role="dialog"/.test(dom);
  if (anyDialog) {
    return { pass: false, reason: `${modal.note} marker NOT found, though a dialog is open — root markup may have drifted or the wrong modal opened` };
  }
  return { pass: false, reason: `${modal.note} did NOT open (no matching root and no dialog in the DOM)` };
}

// REPL RECOVERY (F4) — run a live-terminal line that errors at runtime
// (print(1/0)), THEN run the editor program. The leaked replRef flag used to
// swallow the next run's "Program finished." line (plus its toast, memory
// record, verdict and grading), so this asserts BOTH the REPL error surfaced
// AND the following editor run still announced its completion.
function checkReplRecovery(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&repl=${encodeURIComponent('print(1/0)')}&run=1`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_repl_recovery', url);
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  const errShown = /division by zero/.test(dom);
  const finished = /Program finished\./.test(dom);
  if (errShown && finished) {
    return { pass: true, reason: 'REPL error surfaced AND the next editor run still printed "Program finished."' };
  }
  if (!errShown) return { pass: false, reason: 'REPL error line ("division by zero") never surfaced in the console' };
  return { pass: false, reason: 'run after a REPL error SWALLOWED its "Program finished." line (replRef leak)' };
}

// REPL ERRORS STAY IN THE TERMINAL (F5) — a live-terminal error must not mark
// the editor: no Halted status pill and no active-line highlight, because the
// editor program never ran. Asserts the error IS in the console (so the check
// cannot pass on a page where the REPL never fired) and both editor markers
// are absent.
function checkReplNoHalt(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&repl=${encodeURIComponent('print(1/0)')}`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_repl_nohalt', url, { vtime: 8000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/division by zero/.test(dom)) {
    return { pass: false, reason: 'REPL error never surfaced, so the no-halt claim would be vacuous' };
  }
  const halted = /aria-label="Status: Halted"/.test(dom);
  const lineMarked = /class="gl active"/.test(dom);
  if (!halted && !lineMarked) {
    return { pass: true, reason: 'REPL error surfaced with no Halted pill and no editor line highlight' };
  }
  return { pass: false, reason: `REPL error marked the editor (${halted ? 'Halted pill shown' : ''}${halted && lineMarked ? ' + ' : ''}${lineMarked ? 'active line highlighted' : ''})` };
}

// SITE SWITCH REBUILDS THE SCENE (F1) — load base Earth, then switch to the
// Japan mission site through the real site <select> (cap.html?site=japan).
// Viewport3D stamps data-world="<base>:<site>" on its mount when it BUILDS a
// scene, so this asserts the switch actually tore down and rebuilt the 3D
// scene for the site, not just relabelled the chrome (world-coherence BUG-1).
function checkSiteSwitch(chrome) {
  const url = `${BASE}?world=earth&site=japan&q=low`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_site_switch', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error during site switch: ${consoleError.slice(0, 120)}` };
  if (/data-world="earth:japan"/.test(dom)) {
    return { pass: true, reason: 'scene rebuilt for the site (marker data-world="earth:japan" present)' };
  }
  if (/data-world="earth"/.test(dom)) {
    return { pass: false, reason: 'scene did NOT rebuild after the site switch (marker still base "earth")' };
  }
  return { pass: false, reason: 'no scene-build marker in the DOM (3D viewport missing or marker drifted)' };
}

// REALISM READS THE LIVE WORLD (F9) — open the Realism dashboard while the
// UNDERWATER world is on screen and assert the Environment card names it
// ("Abyssal"). Before the fix the card described the robot's RECOMMENDED
// world (Earth for the default rover) regardless of what was on screen.
function checkRealismLiveWorld(chrome) {
  const url = `${BASE}?world=underwater&robot=rover&q=low&open=realism`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_realism_world', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/aria-label="Realism dashboard"/.test(dom)) {
    return { pass: false, reason: 'Realism dashboard never opened, so the live-world claim would be vacuous' };
  }
  if (/Abyssal/.test(dom)) {
    return { pass: true, reason: 'Environment card names the on-screen world (Abyssal / underwater preset)' };
  }
  return { pass: false, reason: 'Realism dashboard does NOT name the on-screen underwater world (still describing the recommended world?)' };
}

// AGENTS AT A SITE (F3) — open the Realism dashboard at an outdoor mission
// site (Sahara) and assert the Moving agents row is NONZERO. The agent sim is
// keyed by the site id; the old gate compared it against the base id, so the
// row read 0 while roaming robots were live and collidable.
function checkAgentsAtSite(chrome) {
  const url = `${BASE}?world=sahara&q=low&open=realism`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_site_agents', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/aria-label="Realism dashboard"/.test(dom)) {
    return { pass: false, reason: 'Realism dashboard never opened, so the agents claim would be vacuous' };
  }
  const m = /Moving agents<\/span><span[^>]*>(\d+)/.exec(dom);
  if (!m) return { pass: false, reason: 'Moving agents row not found in the dashboard' };
  const n = parseInt(m[1], 10);
  if (n > 0) return { pass: true, reason: `Realism reports ${n} moving agents at the Sahara site (site-keyed gate agrees)` };
  return { pass: false, reason: 'Moving agents reads 0 at an outdoor site (agent world gate still base-id keyed)' };
}

// BUILD HONESTY (F10 + F12) — dispatch a fixture build with NO sensors fitted
// (cap.html?robot=custom sends a minimal spec) and assert the chrome tells the
// truth about it: telemetry shows a NO RANGE SENSOR state instead of a lidar
// number, and the api-hint greys distance() out instead of advertising it.
function checkBuildHonesty(chrome) {
  const url = `${BASE}?world=earth&robot=custom&q=low`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_build_honesty', url, { vtime: 8000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  const noRange = /NO RANGE SENSOR/.test(dom);
  const distOff = /<b class="cmd-off"[^>]*>distance\(\)<\/b>/.test(dom);
  const baseOn = /<b>move_forward\(m\)<\/b>/.test(dom);
  if (noRange && distOff && baseOn) {
    return { pass: true, reason: 'sensorless build: telemetry shows NO RANGE SENSOR, hint greys distance(), base commands stay live' };
  }
  const missing = [!noRange && 'telemetry still shows a range readout', !distOff && 'distance() not greyed in the hint', !baseOn && 'base commands wrongly greyed'].filter(Boolean).join('; ');
  return { pass: false, reason: `build honesty failed: ${missing}` };
}

// ONE STATUS VOCABULARY (F11) — crash the rover (drive 15 m straight into the
// field/wall) and assert the mission bar AND the telemetry rail agree on the
// SAME label, "Halted". The old pair could read Halted beside IDLE.
function checkStatusAgree(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&code=${encodeURIComponent('move_forward(15)')}`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_status_agree', url, { vtime: 20000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/Collision with|Robot halted/.test(dom)) {
    return { pass: false, reason: 'the crash program never crashed, so the status-agree claim would be vacuous' };
  }
  const barHalted = /aria-label="Status: Halted"/.test(dom);
  const teleHalted = />HALTED</.test(dom);
  if (barHalted && teleHalted) {
    return { pass: true, reason: 'after a crash both surfaces show the same label (mission bar "Halted", telemetry "HALTED")' };
  }
  return { pass: false, reason: `status surfaces disagree after crash (mission bar Halted: ${barHalted}, telemetry HALTED: ${teleHalted})` };
}

// VISIBLE GOAL (F8) — the validation scenario's goal beacon must exist in the
// live 3D scene (Viewport3D stamps data-goal="1" on its mount when it builds
// the beacon), so Validate grades a mission the user can see.
function checkGoalMarker(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_goal_marker', url, { vtime: 8000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (/data-goal="1"/.test(dom)) {
    return { pass: true, reason: 'goal beacon built into the live scene (data-goal marker present)' };
  }
  return { pass: false, reason: 'no goal beacon in the live scene (data-goal marker missing)' };
}

// NOTHING-RAN VERDICT (F14) — run an EMPTY program (cap.html?code=- types an
// empty editor buffer) and assert the post-run verdict says nothing ran,
// instead of the old "the design held up" claim from a run that proved
// nothing (bugs D5).
function checkNothingRan(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&code=-`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_nothing_ran', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/Program finished\./.test(dom)) {
    return { pass: false, reason: 'the empty program never ran to completion, so the verdict claim would be vacuous' };
  }
  if (/Nothing ran: the program produced no commands/.test(dom)) {
    return { pass: true, reason: 'empty program yields the honest "Nothing ran" verdict' };
  }
  if (/design held up|Margins looked healthy/.test(dom)) {
    return { pass: false, reason: 'empty program still claims "the design held up" (verdict ignores run stats)' };
  }
  return { pass: false, reason: 'no "Nothing ran" verdict found after an empty-program run' };
}

// MEMORY MADE VISIBLE (F17a) — seed one fixture reflection (cap.html?seedmem=1)
// and open the Vibe panel: the reflection the assistant is fed must render as
// a visible context chip, not an invisible prompt injection.
function checkVibeMemoryChip(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&seedmem=1&open=vibe`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_vibe_ctx', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/aria-label="Code with AI"/.test(dom)) {
    return { pass: false, reason: 'Vibe panel never opened, so the chip claim would be vacuous' };
  }
  if (/class="vibe-ctx"/.test(dom) && /Collided with a boulder/.test(dom)) {
    return { pass: true, reason: 'Vibe shows the seeded reflection as a visible Memory context chip' };
  }
  return { pass: false, reason: 'no Memory context chip in the Vibe panel despite a seeded reflection' };
}

// MEMORY EXPORT WIRED (F17b) — the Memory panel carries a real Export control
// bound to the store's exportData (dead code until wired). The download itself
// cannot be observed from a DOM dump, so this pins the control's presence via
// its data marker inside the OPEN memory dialog.
function checkMemoryExport(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&open=memory`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_mem_export', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/role="dialog"[^>]*aria-label="Memory and skills"|aria-label="Memory and skills"[^>]*role="dialog"/.test(dom)) {
    return { pass: false, reason: 'Memory panel never opened, so the export claim would be vacuous' };
  }
  if (/data-mem-export/.test(dom)) {
    return { pass: true, reason: 'Memory panel carries the wired Export control (and its Import twin)' };
  }
  return { pass: false, reason: 'no Export control in the open Memory panel' };
}

// STUDIO MODE (A1) — the default profile is the professional studio: the
// Settings popover must carry the Mode control but NONE of the classroom
// furniture (teacher dashboard, progress-report export, novelty themes).
function checkStudioMode(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&open=settings`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_studio_mode', url, { vtime: 8000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/class="settings-pop"/.test(dom)) {
    return { pass: false, reason: 'Settings popover never opened, so the mode claim would be vacuous' };
  }
  const hasModeControl = /aria-label="Studio or Classroom mode"/.test(dom);
  const classroomStrings = ['Teacher dashboard', 'Export progress report', '>Matrix<', '>Arcade<', '>Brick<'].filter((s) => dom.indexOf(s) >= 0);
  if (hasModeControl && classroomStrings.length === 0) {
    return { pass: true, reason: 'studio mode: Mode control present, zero classroom strings (teacher/report/novelty themes hidden)' };
  }
  if (!hasModeControl) return { pass: false, reason: 'Mode control missing from the Settings popover' };
  return { pass: false, reason: `classroom strings leak into studio mode: ${classroomStrings.join(', ')}` };
}

// CLASSROOM MODE (A1/A5) — flipping the toggle brings the classroom register
// back: teacher dashboard row and the novelty theme options reappear.
function checkClassroomMode(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&mode=classroom&open=settings`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_classroom_mode', url, { vtime: 8000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/class="settings-pop"/.test(dom)) {
    return { pass: false, reason: 'Settings popover never opened, so the classroom claim would be vacuous' };
  }
  const teacher = /Teacher dashboard/.test(dom);
  const themes = />Matrix</.test(dom) && />Arcade</.test(dom);
  if (teacher && themes) {
    return { pass: true, reason: 'classroom mode restores the teacher dashboard row and the novelty themes' };
  }
  return { pass: false, reason: `classroom mode incomplete (teacher row: ${teacher}, novelty themes: ${themes})` };
}

// UNDO / REVERT (A9) — a programmatic editor write (blocks insert) snapshots
// the buffer and offers a Revert toast; clicking it must restore the ORIGINAL
// starter program. The driver (reverttest=1) inserts then clicks Revert.
function checkRevertApply(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&reverttest=1`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_revert', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error (or missing Revert toast target): ${consoleError.slice(0, 120)}` };
  const taMatch = /<textarea[^>]*class="code-ta"[^>]*>([\s\S]*?)<\/textarea>/i.exec(dom);
  const editorText = taMatch ? taMatch[1] : '';
  if (/# Welcome to Kodro\./.test(editorText)) {
    return { pass: true, reason: 'Revert restored the pre-apply starter program after a blocks insert' };
  }
  if (/move_forward\(/.test(editorText)) {
    return { pass: false, reason: 'editor still holds the inserted blocks code (Revert did not restore the prior buffer)' };
  }
  return { pass: false, reason: 'editor content unrecognised after revert (neither starter nor inserted code found)' };
}

// SPEC IMPORT (SI1) — drive the fixture KRS spec through the REAL
// validate-then-save path (cap.html?importspec=1), open the Robot Lab, and
// assert the Measured build banner renders with the imported numbers. This
// is the core product mission: the imported spec visibly drives the Lab.
function checkSpecImport(chrome) {
  const url = `${BASE}?world=earth&q=low&importspec=1&open=robotlab`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_spec_import', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error during spec import: ${consoleError.slice(0, 120)}` };
  if (!/rl-modal/.test(dom)) {
    return { pass: false, reason: 'Robot Lab never opened, so the import claim would be vacuous' };
  }
  const banner = /data-spec-import="measured"/.test(dom);
  const speed = /1\.02 m\/s/.test(dom);
  const badge = /class="fid-badge fid-honoured"/.test(dom);
  if (banner && speed && badge) {
    return { pass: true, reason: 'imported KRS spec shows the Measured build banner (1.02 m/s motor-derived top speed, HONOURED badge)' };
  }
  const missing = [!banner && 'no Measured banner', !speed && 'derived top speed missing', !badge && 'no fidelity badge'].filter(Boolean).join('; ');
  return { pass: false, reason: `spec import did not surface: ${missing}` };
}

// FIDELITY DISCLOSURE (SI4) — the Realism dashboard carries the three-tier
// honesty card (HONOURED / APPROXIMATED / NOT SIMULATED).
function checkFidelityCard(chrome) {
  const url = `${BASE}?world=earth&q=low&open=realism`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_fidelity', url, { vtime: 9000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error: ${consoleError.slice(0, 120)}` };
  if (!/aria-label="Realism dashboard"/.test(dom)) {
    return { pass: false, reason: 'Realism dashboard never opened, so the fidelity claim would be vacuous' };
  }
  if (/Fidelity disclosure/.test(dom) && /NOT SIMULATED/.test(dom) && /APPROXIMATED/.test(dom)) {
    return { pass: true, reason: 'Realism dashboard lists all three fidelity tiers (SI4 disclosure card)' };
  }
  return { pass: false, reason: 'fidelity disclosure card missing from the Realism dashboard' };
}

// ENCORE TAB (S1): open the Encore showcase example tab and Run it (one of
// ten example tabs, alongside the Searchlight and Gauntlet showcases). The tab
// must be active and the show must actually start (its Act I console prints).
function checkEncoreRuns(chrome) {
  const url = `${BASE}?world=earth&robot=rover&q=low&tab=encore&run=1`;
  const { dom, consoleError, error } = dumpDom(chrome, 'behaviour_encore', url, { vtime: 20000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error during encore run: ${consoleError.slice(0, 120)}` };
  const tabActive = /class="tab active"[^>]*>encore\.py|>encore\.py<\/button>/.test(dom) && /encore\.py/.test(dom);
  const started = /ACT I - walk-on square/.test(dom);
  if (tabActive && started) {
    return { pass: true, reason: 'encore.py tab opened and the show ran (Act I console line printed)' };
  }
  if (!/encore\.py/.test(dom)) return { pass: false, reason: 'encore.py tab is not in the tab row' };
  if (!started) return { pass: false, reason: 'encore tab present but the show never started (no Act I line)' };
  return { pass: false, reason: 'encore tab did not activate' };
}

// LAYOUT — the studio must not overflow horizontally at common laptop sizes.
// cap.html?layout=1 appends a hidden #layout-probe div carrying the REAL
// measured scrollWidth/innerWidth (recorded in-page after panels settle), so
// this is a true layout assert, not a guess from markup. The 1280x800 clip
// (Settings button 56px offscreen with scrollbars hidden) is the regression
// this pins.
function checkLayout(chrome, w, h) {
  const url = `${BASE}?world=earth&robot=rover&q=low&layout=1`;
  const { dom, consoleError, error } = dumpDom(chrome, `layout_${w}x${h}`, url, { size: `${w},${h}`, vtime: 8000 });
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error at ${w}x${h}: ${consoleError.slice(0, 120)}` };
  const m = /id="layout-probe"[^>]*data-scroll-w="(\d+)"[^>]*data-inner-w="(\d+)"/.exec(dom);
  if (!m) return { pass: false, reason: `layout probe missing from DOM at ${w}x${h} (driver did not run)` };
  const scrollW = parseInt(m[1], 10), innerW = parseInt(m[2], 10);
  if (scrollW <= innerW) {
    return { pass: true, reason: `no horizontal overflow at ${w}x${h} (scrollWidth ${scrollW} <= innerWidth ${innerW})` };
  }
  return { pass: false, reason: `page OVERFLOWS at ${w}x${h}: scrollWidth ${scrollW} > innerWidth ${innerW} (${scrollW - innerW}px clipped)` };
}

// VALIDATE has no modal: its button runs 5 seeds and prints a "Validation:"
// console line. Assert that console marker is in the DOM, with the same
// console-error guard. Labelled as a console (not dialog) assert in MODALS.
function checkValidateRuns(chrome, v) {
  const url = `${BASE}?world=earth&robot=rover&q=high&open=${v.name}`;
  const { dom, consoleError, error } = dumpDom(chrome, `modal_${v.name}`, url);
  if (error) return { pass: false, reason: `dump-dom spawn failed: ${error.message}` };
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)' };
  if (consoleError) return { pass: false, reason: `console error running validate: ${consoleError.slice(0, 120)}` };
  if (!v.marker.test(dom)) {
    return { pass: false, reason: `${v.note} — no "Validation:" console line after clicking Validate` };
  }
  // F8: the run must be ABOUT the on-screen world (the announcement names it),
  // and a 0% result must carry the goal-marker explanation instead of a bare
  // number the default starter always "fails".
  if (!/on Earth \(friction/.test(dom)) {
    return { pass: false, reason: `${v.note} — validation ran but did not name the on-screen world (Earth)` };
  }
  if (/success 0%/.test(dom) && !/never reached the goal marker/.test(dom)) {
    return { pass: false, reason: `${v.note} — 0% result printed without the goal-marker explanation` };
  }
  return { pass: true, reason: `${v.note} — validated the on-screen world; 0% carries its explanation` };
}

// Run one flow in headless Chrome. Returns { pass, reason, bytes }.
function runFlow(chrome, flow, timeoutMs = SPAWN_TIMEOUT_MS) {
  const shotWin = path.join(TMP, `shot_${flow.name}.png`); // absolute Windows path
  const log = path.join(TMP, `log_${flow.name}.txt`);
  const udd = path.join(TMP, `udd_${flow.name}`);
  const url = `${BASE}?${flow.url}`;

  // Clear any stale PNG so existence truly proves THIS run rendered.
  try { rmSync(shotWin, { force: true }); } catch { /* noop */ }

  const args = [
    '--headless=new',
    '--window-size=1280,800',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    `--virtual-time-budget=${VTIME_MS}`,
    `--user-data-dir=${udd}`,
    '--enable-logging=stderr',
    '--v=0',
    `--screenshot=${shotWin}`,
    url,
  ];

  const res = spawnSync(chrome, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });

  // Chrome writes its console/log stream to stderr; persist it for forensics.
  const stderr = (res.stderr || '') + (res.error ? `\nSPAWN_ERROR: ${res.error.message}` : '');
  try { writeFileSync(log, stderr); } catch { /* best effort */ }

  if (res.error) return { pass: false, reason: `chrome spawn failed: ${res.error.message}`, bytes: 0 };

  // (a) blank-render check
  let bytes = 0;
  if (existsSync(shotWin)) { try { bytes = statSync(shotWin).size; } catch { bytes = 0; } }
  if (bytes === 0) return { pass: false, reason: 'no screenshot written (page never painted)', bytes: 0 };
  if (bytes < MIN_PNG_BYTES) {
    return { pass: false, reason: `blank/tiny render (${bytes}B < ${MIN_PNG_BYTES}B)`, bytes };
  }

  // (b) console-error check
  const bad = stderr
    .split(/\r?\n/)
    .filter((l) => l && !NOISE.test(l) && FAIL.test(l));
  if (bad.length) {
    const first = bad[0].slice(0, 160);
    return { pass: false, reason: `console error: ${first}`, bytes };
  }

  return { pass: true, reason: `ok (${bytes}B)`, bytes };
}

// One cheap cold launch to about:blank. The first headless Chrome on a box pays
// a one-time cost (profile build, GPU/SwiftShader JIT); paying it here on a
// trivial page keeps it off the first real flow's clock. Best-effort: a failure
// here is not a flow failure, so we ignore the result.
function warmUpChrome(chrome) {
  const udd = path.join(TMP, 'udd_warmup');
  spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--virtual-time-budget=1500',
    `--user-data-dir=${udd}`, '--dump-dom', 'about:blank',
  ], { encoding: 'utf8', timeout: FIRST_SPAWN_TIMEOUT_MS, windowsHide: true });
}

function cleanup() {
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* noop */ }
}

(async function main() {
  if (!existsSync(CAP)) {
    console.log('SKIP: cap.html missing — run `node scripts/build_screenshot_harness.cjs` first.');
    process.exit(0);
  }

  const chrome = findChrome();
  if (!chrome) {
    console.log('SKIP: Chrome not found (set CHROME_PATH). UI smoke needs headless Chrome.');
    process.exit(0);
  }

  const status = await probeServer();
  if (status !== 200) {
    console.log(`SKIP: static server not serving cap.html on :${PORT} (got ${status || 'no connection'}).`);
    console.log('      Start it with:  cd src/robolearn/assets/web && python -m http.server 8099');
    process.exit(0);
  }

  mkdirSync(TMP, { recursive: true });
  console.log('== UI SMOKE: driving the real Kodro bundle through cap.html (headless Chrome) ==');

  // Pay the cold-start tax on a trivial page so it does not flake flow #1.
  warmUpChrome(chrome);

  const gap = () => { const until = Date.now() + GAP_MS; while (Date.now() < until) { /* dep-free pause */ } };

  // ---- Phase 1: paint + console smoke across the core flows (unchanged) -----
  let clean = 0;
  for (let i = 0; i < FLOWS.length; i++) {
    const flow = FLOWS[i];
    // The very first real flow still warms WebGL for the full app; give it room.
    const r = runFlow(chrome, flow, i === 0 ? FIRST_SPAWN_TIMEOUT_MS : SPAWN_TIMEOUT_MS);
    let flowPass = r.pass;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${flow.name.padEnd(18)} ${r.reason}`);

    // For the run flow, also assert the rover actually MOVED to its deterministic
    // mark, not just that the studio painted. A second --dump-dom pass reads the
    // telemetry odometer. The behaviour result is folded into THIS flow's pass.
    if (flow.name === BEHAVIOUR_FLOW && r.pass) {
      const b = checkRoverMoved(chrome, flow);
      flowPass = flowPass && b.pass;
      console.log(`${b.pass ? 'PASS' : 'FAIL'}  ${'  └ determinism'.padEnd(18)} ${b.reason}`);
    }

    if (flowPass) clean++;
    gap(); // let the single-threaded dev server recover before the next hit
  }

  // ---- Phase 2: per-concern behaviour asserts (deterministic, no Ollama) -----
  // Each drives a concrete action and asserts a concrete DOM marker. These run
  // AFTER the paint smoke so a blank bundle is already reported above.
  console.log('\n== UI BEHAVIOUR: per-concern asserts on the real bundle ==');
  const behaviour = [];

  const blocks = checkBlocksInsert(chrome);
  behaviour.push(blocks.pass);
  console.log(`${blocks.pass ? 'PASS' : 'FAIL'}  ${'blocks-insert'.padEnd(20)} ${blocks.reason}`);
  gap();

  const errPath = checkErrorPath(chrome);
  behaviour.push(errPath.pass);
  console.log(`${errPath.pass ? 'PASS' : 'FAIL'}  ${'error-path'.padEnd(20)} ${errPath.reason}`);
  gap();

  for (const w of WORLD_IDENTITY) {
    const wi = checkWorldIdentity(chrome, w.world, w.expect);
    behaviour.push(wi.pass);
    console.log(`${wi.pass ? 'PASS' : 'FAIL'}  ${('world-' + w.world).padEnd(20)} ${wi.reason}`);
    gap();
  }

  const siteSwitch = checkSiteSwitch(chrome);
  behaviour.push(siteSwitch.pass);
  console.log(`${siteSwitch.pass ? 'PASS' : 'FAIL'}  ${'site-switch'.padEnd(20)} ${siteSwitch.reason}`);
  gap();

  const replRec = checkReplRecovery(chrome);
  behaviour.push(replRec.pass);
  console.log(`${replRec.pass ? 'PASS' : 'FAIL'}  ${'repl-recovery'.padEnd(20)} ${replRec.reason}`);
  gap();

  const replHalt = checkReplNoHalt(chrome);
  behaviour.push(replHalt.pass);
  console.log(`${replHalt.pass ? 'PASS' : 'FAIL'}  ${'repl-no-halt'.padEnd(20)} ${replHalt.reason}`);
  gap();

  const realismWorld = checkRealismLiveWorld(chrome);
  behaviour.push(realismWorld.pass);
  console.log(`${realismWorld.pass ? 'PASS' : 'FAIL'}  ${'realism-live-world'.padEnd(20)} ${realismWorld.reason}`);
  gap();

  const siteAgents = checkAgentsAtSite(chrome);
  behaviour.push(siteAgents.pass);
  console.log(`${siteAgents.pass ? 'PASS' : 'FAIL'}  ${'agents-at-site'.padEnd(20)} ${siteAgents.reason}`);
  gap();

  const honesty = checkBuildHonesty(chrome);
  behaviour.push(honesty.pass);
  console.log(`${honesty.pass ? 'PASS' : 'FAIL'}  ${'build-honesty'.padEnd(20)} ${honesty.reason}`);
  gap();

  const statusAgree = checkStatusAgree(chrome);
  behaviour.push(statusAgree.pass);
  console.log(`${statusAgree.pass ? 'PASS' : 'FAIL'}  ${'status-agree'.padEnd(20)} ${statusAgree.reason}`);
  gap();

  const nothingRan = checkNothingRan(chrome);
  behaviour.push(nothingRan.pass);
  console.log(`${nothingRan.pass ? 'PASS' : 'FAIL'}  ${'nothing-ran'.padEnd(20)} ${nothingRan.reason}`);
  gap();

  const vibeChip = checkVibeMemoryChip(chrome);
  behaviour.push(vibeChip.pass);
  console.log(`${vibeChip.pass ? 'PASS' : 'FAIL'}  ${'vibe-memory-chip'.padEnd(20)} ${vibeChip.reason}`);
  gap();

  const memExport = checkMemoryExport(chrome);
  behaviour.push(memExport.pass);
  console.log(`${memExport.pass ? 'PASS' : 'FAIL'}  ${'memory-export'.padEnd(20)} ${memExport.reason}`);
  gap();

  const goalMarker = checkGoalMarker(chrome);
  behaviour.push(goalMarker.pass);
  console.log(`${goalMarker.pass ? 'PASS' : 'FAIL'}  ${'goal-marker'.padEnd(20)} ${goalMarker.reason}`);
  gap();

  const studioMode = checkStudioMode(chrome);
  behaviour.push(studioMode.pass);
  console.log(`${studioMode.pass ? 'PASS' : 'FAIL'}  ${'studio-mode'.padEnd(20)} ${studioMode.reason}`);
  gap();

  const classroomMode = checkClassroomMode(chrome);
  behaviour.push(classroomMode.pass);
  console.log(`${classroomMode.pass ? 'PASS' : 'FAIL'}  ${'classroom-mode'.padEnd(20)} ${classroomMode.reason}`);
  gap();

  const revertApply = checkRevertApply(chrome);
  behaviour.push(revertApply.pass);
  console.log(`${revertApply.pass ? 'PASS' : 'FAIL'}  ${'revert-apply'.padEnd(20)} ${revertApply.reason}`);
  gap();

  const specImport = checkSpecImport(chrome);
  behaviour.push(specImport.pass);
  console.log(`${specImport.pass ? 'PASS' : 'FAIL'}  ${'spec-import'.padEnd(20)} ${specImport.reason}`);
  gap();

  const fidelity = checkFidelityCard(chrome);
  behaviour.push(fidelity.pass);
  console.log(`${fidelity.pass ? 'PASS' : 'FAIL'}  ${'fidelity-card'.padEnd(20)} ${fidelity.reason}`);
  gap();

  const encore = checkEncoreRuns(chrome);
  behaviour.push(encore.pass);
  console.log(`${encore.pass ? 'PASS' : 'FAIL'}  ${'encore-run'.padEnd(20)} ${encore.reason}`);
  gap();

  // Layout: the studio must fit common laptop widths with zero horizontal
  // overflow (bugs D1: 1280x800 clipped the Settings button offscreen).
  for (const [w, h] of [[1280, 800], [1366, 768]]) {
    const lr = checkLayout(chrome, w, h);
    behaviour.push(lr.pass);
    console.log(`${lr.pass ? 'PASS' : 'FAIL'}  ${('layout-' + w + 'x' + h).padEnd(20)} ${lr.reason}`);
    gap();
  }

  const behClean = behaviour.filter(Boolean).length;

  // ---- Phase 3: modals render — open EVERY toolbar modal/popover, one at a
  // time, and assert each renders cleanly. This closes the gap where the harness
  // never opened the modals at all: a modal that throws on mount, or whose root
  // markup silently breaks, now FAILS here instead of shipping unseen. Runs
  // sequentially like the other phases (single-threaded dev server). No Ollama
  // needed — we assert the modal OPENS, not that any AI responds.
  console.log('\n== UI MODALS: open and verify every toolbar modal/popover renders ==');
  const modals = [];

  for (const m of MODALS) {
    const mr = checkModalRenders(chrome, m);
    modals.push(mr.pass);
    console.log(`${mr.pass ? 'PASS' : 'FAIL'}  ${('modal-' + m.name).padEnd(20)} ${mr.reason}`);
    gap();
  }
  // Validate is a console-line action, not a modal — assert it on its own marker.
  const val = checkValidateRuns(chrome, VALIDATE);
  modals.push(val.pass);
  console.log(`${val.pass ? 'PASS' : 'FAIL'}  ${('modal-' + VALIDATE.name).padEnd(20)} ${val.reason}`);
  gap();

  const modalsClean = modals.filter(Boolean).length;

  cleanup();
  console.log(`\n== UI SMOKE: ${clean}/${FLOWS.length} flows clean · ${behClean}/${behaviour.length} behaviour asserts pass · ${modalsClean}/${modals.length} modals render ==`);
  // Smoke report: never break CI on a render/console hiccup or a GPU-less box.
  process.exit(0);
})();
