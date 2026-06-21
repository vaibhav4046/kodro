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
 * For the `studio-earth-run` flow it goes one step further and checks BEHAVIOUR,
 * not just paint: a second headless pass dumps the post-run DOM (--dump-dom) and
 * asserts the telemetry odometer reads a non-zero distance, i.e. the rover
 * actually drove when Run was clicked. A green screenshot proves the studio
 * painted; the odometer check proves the simulation ran. This catches a whole
 * class of drift the pixel check misses: a broken interpreter, a Run button
 * wired to nothing, a frozen animation loop, or a physics regression that
 * leaves the rover parked.
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
// Hard ceiling on a single Chrome invocation in case it wedges.
const SPAWN_TIMEOUT_MS = 45_000;
// The flow whose Run we verify actually moved the rover (odometer > 0).
const BEHAVIOUR_FLOW = 'studio-earth-run';

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

// Drive the run flow a SECOND time, dumping the post-run DOM instead of a
// screenshot, and assert the rover actually moved. Telemetry.jsx renders the
// odometer as:  <span class="g-label">Odometer</span>
//               <span class="g-val">17.6<span class="g-unit">m</span></span>
// from `{(odometer/100).toFixed(1)}` + an "m" unit span. We look for that
// reading and PASS iff it parses to > 0.0. Falls back to a weaker-but-real
// signal (the live telemetry markers present AND the run clearly executed) only
// if the odometer cannot be located, and SAYS SO in the reason string.
// Returns { pass, reason, value }.
function checkRoverMoved(chrome, flow) {
  const udd = path.join(TMP, `udd_behaviour_${flow.name}`);
  const log = path.join(TMP, `log_behaviour_${flow.name}.txt`);
  const url = `${BASE}?${flow.url}`;

  const args = [
    '--headless=new',
    '--window-size=1280,800',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    `--virtual-time-budget=${BEHAVIOUR_VTIME_MS}`,
    `--user-data-dir=${udd}`,
    '--enable-logging=stderr',
    '--v=0',
    '--dump-dom',
    url,
  ];

  const res = spawnSync(chrome, args, {
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, // the dumped DOM can be large; don't truncate it
  });

  const stderr = (res.stderr || '') + (res.error ? `\nSPAWN_ERROR: ${res.error.message}` : '');
  try { writeFileSync(log, stderr); } catch { /* best effort */ }
  if (res.error) return { pass: false, reason: `dump-dom spawn failed: ${res.error.message}`, value: null };

  const dom = res.stdout || '';
  if (!dom) return { pass: false, reason: 'dump-dom produced no DOM (page never rendered)', value: null };

  // Console must not have logged a real error during the run, or "the rover
  // moved" would be meaningless. Reuse the same noise/fail matchers.
  const consoleError = stderr
    .split(/\r?\n/)
    .filter((l) => l && !NOISE.test(l) && FAIL.test(l))[0];

  // PRIMARY: pull the odometer reading out of the gauge. The label and value
  // sit in adjacent spans; the value is `N.N` immediately followed by the unit
  // span `<span class="g-unit">m</span>`. Anchor on g-val + g-unit so we match
  // the odometer/environment gauges and not some unrelated "N.N m" in prose.
  // The Odometer gauge is the only one whose unit is a bare "m", so this is
  // specific to it in practice.
  let matched = null;
  const gaugeRe = /<span class="g-val">\s*(\d+(?:\.\d+)?)\s*<span class="g-unit">\s*m\s*<\/span>/gi;
  let m;
  while ((m = gaugeRe.exec(dom)) !== null) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && v > 0) { matched = v; break; }
    if (matched === null && Number.isFinite(v)) matched = v; // remember a 0.0 so we can report it
  }

  if (matched !== null && matched > 0) {
    const driving = /DRIVING/.test(dom);
    const tag = driving ? `, status DRIVING` : '';
    return { pass: true, reason: `rover moved (odometer ${matched.toFixed(1)}m${tag})`, value: matched };
  }

  // The odometer was found but reads zero: the rover did NOT move. That is a
  // genuine behaviour failure, not a harness limitation — report it plainly.
  if (matched !== null && matched === 0) {
    return { pass: false, reason: `rover did NOT move (odometer 0.0m after Run)`, value: 0 };
  }

  // FALLBACK: odometer span not locatable (markup drift). Don't silently fake a
  // pass — assert the weaker-but-real signal and label it as the fallback. The
  // run executed if the live-telemetry panel mounted (odometer label + status
  // gauge) and the page showed DRIVING with no console error.
  const haveTelemetry = /Odometer/.test(dom) && /(DRIVING|IDLE)/.test(dom);
  const driving = /DRIVING/.test(dom);
  if (haveTelemetry && driving && !consoleError) {
    return { pass: true, reason: 'rover moved (FALLBACK: odometer value not parseable, but telemetry mounted and status=DRIVING)', value: null };
  }

  // Could not confirm movement by any real signal.
  const why = consoleError ? `console error during run: ${consoleError.slice(0, 120)}`
    : !haveTelemetry ? 'telemetry panel/odometer not found in DOM'
    : 'odometer not > 0 and status not DRIVING';
  return { pass: false, reason: `could not confirm rover moved (${why})`, value: matched };
}

// Run one flow in headless Chrome. Returns { pass, reason, bytes }.
function runFlow(chrome, flow) {
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
    timeout: SPAWN_TIMEOUT_MS,
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

  let clean = 0;
  for (const flow of FLOWS) {
    const r = runFlow(chrome, flow);
    let flowPass = r.pass;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${flow.name.padEnd(18)} ${r.reason}`);

    // For the run flow, also assert the rover actually MOVED, not just that the
    // studio painted. A second --dump-dom pass reads the telemetry odometer.
    // The behaviour result is folded into THIS flow's pass/fail.
    if (flow.name === BEHAVIOUR_FLOW && r.pass) {
      const b = checkRoverMoved(chrome, flow);
      flowPass = flowPass && b.pass;
      console.log(`${b.pass ? 'PASS' : 'FAIL'}  ${'  └ behaviour'.padEnd(18)} ${b.reason}`);
    }

    if (flowPass) clean++;
    // Let the single-threaded dev server recover before the next hit.
    if (flow !== FLOWS[FLOWS.length - 1]) {
      const until = Date.now() + GAP_MS;
      while (Date.now() < until) { /* tiny busy-wait, keeps it dependency-free */ }
    }
  }

  cleanup();
  console.log(`\n== UI SMOKE: ${clean}/${FLOWS.length} flows clean ==`);
  // Smoke report: never break CI on a render/console hiccup or a GPU-less box.
  process.exit(0);
})();
