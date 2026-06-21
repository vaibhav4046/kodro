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
// Hard ceiling on a single Chrome invocation in case it wedges.
const SPAWN_TIMEOUT_MS = 45_000;

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
    if (r.pass) clean++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${flow.name.padEnd(18)} ${r.reason}`);
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
