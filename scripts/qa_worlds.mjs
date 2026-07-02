/* Offline world x robot sweep for the Kodro studio.
 *
 * The UI smoke (qa_ui.mjs) drives a handful of core flows; this suite closes
 * the coverage gap the world-coherence audit named: EVERY base world crossed
 * with EVERY robot archetype must render and run the active program with zero
 * genuine JS console errors. 6 worlds x 6 robots (the 5 archetypes plus the
 * default build) = 36 combos, each driven through cap.html in headless Chrome
 * exactly like qa_ui does, asserting (a) a real paint (screenshot not blank)
 * and (b) a clean console.
 *
 * On top of the 36-combo sweep it runs:
 *   - a render-tier loop (one combo at med / high / cinematic) so a tier-gated
 *     code path that throws cannot ship unseen, and
 *   - two 2.5D site-identity DOM asserts pinning the F2 fix: base Earth still
 *     paints its farmland/river map layer, and an Earth SITE (Antarctica) must
 *     NOT (fields and a river on the Ross Ice Shelf were the bug).
 *
 * Environment-missing cases (no Chrome, no static server) SKIP with exit 0 so
 * a GPU-less box never breaks a pipeline; real failures exit 1.
 *
 *   cd src/robolearn/assets/web && python -m http.server 8099   # serve first
 *   node scripts/build_screenshot_harness.cjs                   # emit cap.html
 *   node scripts/qa_worlds.mjs                                  # this sweep
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const TMP = path.join(REPO, 'tmp', 'worlds');
const CAP = path.join(REPO, 'src', 'robolearn', 'assets', 'web', 'cap.html');

const HOST = 'localhost';
const PORT = 8099;
const BASE = `http://${HOST}:${PORT}/cap.html`;

const MIN_PNG_BYTES = 90_000;   // a real 1280x800 studio paint; below = blank
const GAP_MS = 1000;            // single-threaded dev server: let it breathe
const VTIME_MS = 9_000;         // load + robot dispatch + Run + several moves
const SPAWN_TIMEOUT_MS = 60_000;
const FIRST_SPAWN_TIMEOUT_MS = 90_000;

const WORLDS = ['city', 'room', 'earth', 'mars', 'underwater', 'space'];
// null = the default saved build; the rest are the Robot Lab archetypes.
const ROBOTS = [null, 'rover', 'car', 'home', 'arm', 'custom'];
// One combo re-run at every non-low tier: tier-gated paths must not throw.
const TIER_LOOP = ['med', 'high', 'cinematic'];

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_PATH,
  'chrome',
  'google-chrome',
].filter(Boolean);

// Same console filters as qa_ui.mjs: noise lines never fail a combo, and a
// line only fails when it is a console/exception line naming a real symptom.
const NOISE = /gcm|registration|GROUP_MARKER|swiftshader|GPU stall|extension|manifest|web_app|externally_managed|about:blank|Permissions-Policy|deprecat|AudioContext|autoplay/i;
const FAIL = /CONSOLE.*(error|uncaught|is not a function|is not defined|cannot read)/i;

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (c === 'chrome' || c === 'google-chrome') return c;
    if (existsSync(c)) return c;
  }
  return null;
}

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

// Drive one URL; screenshot mode asserts paint + console, dom mode returns the
// dumped HTML for content asserts. Returns { pass, reason, dom }.
function drive(chrome, tag, url, opts = {}) {
  const udd = path.join(TMP, `udd_${tag}`);
  const log = path.join(TMP, `log_${tag}.txt`);
  const shot = path.join(TMP, `shot_${tag}.png`);
  const wantDom = !!opts.dom;
  try { rmSync(shot, { force: true }); } catch { /* noop */ }
  const args = [
    '--headless=new',
    '--window-size=1280,800',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    `--virtual-time-budget=${opts.vtime || VTIME_MS}`,
    `--user-data-dir=${udd}`,
    '--enable-logging=stderr',
    '--v=0',
    wantDom ? '--dump-dom' : `--screenshot=${shot}`,
    url,
  ];
  const res = spawnSync(chrome, args, {
    encoding: 'utf8',
    timeout: opts.timeout || SPAWN_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const stderr = (res.stderr || '') + (res.error ? `\nSPAWN_ERROR: ${res.error.message}` : '');
  try { writeFileSync(log, stderr); } catch { /* best effort */ }
  if (res.error) return { pass: false, reason: `chrome spawn failed: ${res.error.message}`, dom: '' };
  const bad = stderr.split(/\r?\n/).filter((l) => l && !NOISE.test(l) && FAIL.test(l));
  if (bad.length) return { pass: false, reason: `console error: ${bad[0].slice(0, 160)}`, dom: res.stdout || '' };
  if (wantDom) {
    if (!res.stdout) return { pass: false, reason: 'dump-dom produced no DOM', dom: '' };
    return { pass: true, reason: 'ok', dom: res.stdout };
  }
  let bytes = 0;
  if (existsSync(shot)) { try { bytes = statSync(shot).size; } catch { bytes = 0; } }
  if (bytes === 0) return { pass: false, reason: 'no screenshot written (page never painted)', dom: '' };
  if (bytes < MIN_PNG_BYTES) return { pass: false, reason: `blank/tiny render (${bytes}B < ${MIN_PNG_BYTES}B)`, dom: '' };
  return { pass: true, reason: `ok (${bytes}B)`, dom: '' };
}

function warmUpChrome(chrome) {
  const udd = path.join(TMP, 'udd_warmup');
  spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--virtual-time-budget=1500',
    `--user-data-dir=${udd}`, '--dump-dom', 'about:blank',
  ], { encoding: 'utf8', timeout: FIRST_SPAWN_TIMEOUT_MS, windowsHide: true });
}

const gap = () => { const until = Date.now() + GAP_MS; while (Date.now() < until) { /* dep-free pause */ } };

(async function main() {
  if (!existsSync(CAP)) {
    console.log('SKIP: cap.html missing — run `node scripts/build_screenshot_harness.cjs` first.');
    process.exit(0);
  }
  const chrome = findChrome();
  if (!chrome) {
    console.log('SKIP: Chrome not found (set CHROME_PATH). World sweep needs headless Chrome.');
    process.exit(0);
  }
  const status = await probeServer();
  if (status !== 200) {
    console.log(`SKIP: static server not serving cap.html on :${PORT} (got ${status || 'no connection'}).`);
    console.log('      Start it with:  cd src/robolearn/assets/web && python -m http.server 8099');
    process.exit(0);
  }

  mkdirSync(TMP, { recursive: true });
  console.log('== WORLD SWEEP: 6 worlds x 6 robots through cap.html (headless Chrome) ==');
  warmUpChrome(chrome);

  let pass = 0, fail = 0, first = true;
  const failures = [];
  const record = (name, r) => {
    if (r.pass) pass++; else { fail++; failures.push(`${name}: ${r.reason}`); }
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} ${r.reason}`);
  };

  // ---- Phase 1: the 36-combo sweep (q=low keeps 36 runs affordable; the
  // tier loop below covers the shadow/bloom paths the low tier skips). -------
  for (const world of WORLDS) {
    for (const robot of ROBOTS) {
      const name = `${world} x ${robot || 'default'}`;
      const url = `${BASE}?world=${world}&q=low&run=1${robot ? `&robot=${robot}` : ''}`;
      const r = drive(chrome, `combo_${world}_${robot || 'default'}`, url, { timeout: first ? FIRST_SPAWN_TIMEOUT_MS : SPAWN_TIMEOUT_MS });
      first = false;
      record(name, r);
      gap();
    }
  }

  // ---- Phase 2: render-tier loop on one combo -------------------------------
  console.log('\n== TIER LOOP: earth x rover at med / high / cinematic ==');
  for (const tier of TIER_LOOP) {
    const r = drive(chrome, `tier_${tier}`, `${BASE}?world=earth&robot=rover&q=${tier}&run=1`, { vtime: 12_000 });
    record(`tier ${tier}`, r);
    gap();
  }

  // ---- Phase 3: 2.5D site identity (pins the F2 farmland fix) --------------
  // '#2f6ea6' is the river stroke EarthFeatures paints; base Earth must have
  // it, an Earth SITE (Antarctica) must not. Both are dump-dom content asserts
  // on the flat view where the layer is real DOM.
  console.log('\n== SITE IDENTITY (2.5D): farmland stays on base Earth only ==');
  const earth2d = drive(chrome, 'site_earth_2d', `${BASE}?world=earth&view=2d`, { dom: true, vtime: 6_000 });
  record('earth 2.5D has map layer', earth2d.pass && /#2f6ea6/.test(earth2d.dom)
    ? { pass: true, reason: 'river/farmland layer present on base Earth' }
    : { pass: false, reason: earth2d.pass ? 'EarthFeatures layer missing from base Earth' : earth2d.reason });
  gap();
  const ant2d = drive(chrome, 'site_antarctica_2d', `${BASE}?world=antarctica&view=2d`, { dom: true, vtime: 6_000 });
  record('antarctica 2.5D no farmland', ant2d.pass && !/#2f6ea6/.test(ant2d.dom)
    ? { pass: true, reason: 'no farmland/river painted on the Ross Ice Shelf' }
    : { pass: false, reason: ant2d.pass ? 'farmland/river layer leaked onto an Earth site' : ant2d.reason });
  gap();

  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* noop */ }
  console.log(`\n== WORLD SWEEP RESULT: ${pass} passed, ${fail} failed ==`);
  if (fail) {
    console.log('FAILURES:');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  process.exit(0);
})();
