/* Pre-compile the React/JSX sources into a single bundle.js so the shipped app
 * does NOT load Babel (~3 MB) or transpile 7 files at every cold start -- it
 * just runs plain JS. Uses the VENDORED Babel (offline, no network).
 *
 *   node scripts/build_web.cjs            # write bundle.js
 *   node scripts/build_web.cjs --check    # exit 1 if bundle.js is stale
 *
 * Each file is wrapped in its own IIFE so top-level names never collide; the
 * components expose themselves on `window`, so order is preserved.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const WEB = path.join(__dirname, '..', 'src', 'robolearn', 'assets', 'web');
// Entries ending in '.js' are plain-JS modules (no JSX) bundled verbatim in
// order; everything else is '<name>.jsx'. motion-model.js (the shared physics
// model, E-P1) and specschema.js (the KRS import schema, SI0) must load
// before the modules that call them (diagnostics/selftest/RobotLab/scenario/app).
// sim-physics.js (the pure collision + trapezoid math extracted from
// useSimEngine) must load before hooks, which calls window.KodroPhysics.
const ORDER = ['motion-model.js', 'specschema.js', 'parts-db.js', 'project.js', 'runreport.js', 'icons', 'agents', 'memory', 'memory-graph.js', 'terrains', 'Rover', 'Viewport', 'textures', 'post', 'worldfx', 'ambient', 'Viewport3D', 'Editor', 'Telemetry', 'tweaks-panel', 'diagnostics', 'selftest', 'RobotLab', 'scenario', 'lesson-grader', 'verify', 'realism', 'demo', 'onboarding', 'ai-providers', 'ai-web', 'chat-intent.js', 'sim-physics.js', 'hooks', 'app-data', 'panels', 'app'];
const HEADER = '/* AUTO-GENERATED from the .jsx sources by scripts/build_web.cjs. Do not edit. */\n';

function build() {
  const ctx = { console };
  ctx.self = ctx;
  ctx.window = ctx;
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB, 'vendor', 'babel.min.js'), 'utf8'), ctx, {
    filename: 'babel.min.js',
  });
  let out = HEADER;
  for (const name of ORDER) {
    // Normalise CRLF -> LF before compiling so the output is byte-identical
    // regardless of how git checked the .jsx out (Babel otherwise preserves
    // CRLF inside template literals, which broke the freshness check on
    // Windows CI).
    const file = name.endsWith('.js') ? name : name + '.jsx';
    const src = fs.readFileSync(path.join(WEB, file), 'utf8').replace(/\r\n/g, '\n');
    const code = ctx.Babel.transform(src, { presets: ['react'], filename: file }).code;
    out += '\n;(function () {\n' + code + '\n})();\n';
  }
  return out.replace(/\r\n/g, '\n');
}

function normalise(s) {
  return s.replace(/\r\n/g, '\n');
}

// --static: emit a self-contained site/ directory for the zero-install web
// build (served on GitHub Pages). Copies the runtime web assets and DROPS
// everything only the desktop app or the dev harnesses need: the .jsx sources
// (already compiled into bundle.js), the ~3 MB Babel transpiler (index.html
// never loads it), and the screenshot / a11y / perf harness pages. The result
// is a plain static folder anyone can open or host, no Python and no build.
function emitStaticSite() {
  const SITE = path.join(__dirname, '..', 'site');
  const DROP_EXT = new Set(['.jsx']);
  const DROP_NAME = new Set([
    'babel.min.js',
    'harness.html',
    'studio_harness.html',
    'cap.html',
    'harness_bundle.js',
  ]);
  function keep(srcPath) {
    const base = path.basename(srcPath);
    if (DROP_EXT.has(path.extname(base))) return false;
    if (DROP_NAME.has(base)) return false;
    // Every dev-only artifact in the web dir is named with a leading underscore
    // (the a11y/perf probe HTML and the *_default/_ped screenshot captures), so
    // one rule keeps ~800KB of throwaway assets out of the deployed static site
    // and covers any future probe without another allowlist edit.
    if (base.startsWith('_')) return false;
    return true;
  }
  fs.rmSync(SITE, { recursive: true, force: true });
  fs.cpSync(WEB, SITE, { recursive: true, filter: keep });
  stampServiceWorker(SITE);
  let files = 0;
  (function count(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) count(path.join(dir, entry.name));
      else files += 1;
    }
  })(SITE);
  console.log('wrote static site/ (' + files + ' files) at ' + SITE);
}

// Stamp the emitted service worker's cache name with a short content hash of
// EVERY cache-critical runtime asset that ships standalone -- not just
// bundle.js. interpreter.js, bridge.js, sound.js and styles.css each load via
// their own <script>/<link> tags (they are NOT bundled into bundle.js) and the
// shell serves them cache-first; index.html is the shell markup itself. If the
// stamp hashed bundle.js alone, an interpreter-only, bridge-only, sound-only or
// CSS-only deploy would leave the cache name unchanged and pin returning
// visitors to the stale standalone file. Hashing the concatenation means ANY
// byte change in ANY of these shifts the hash => new sw.js bytes => the browser
// installs the new SW, precaches the fresh shell, and drops the old cache on
// activate. The SOURCE sw.js keeps a stable 'kodro-shell-v1' placeholder (clean
// diffs, no churn in the freshness check); only this site copy is stamped.
// Deploys that touch only lessons.json are still picked up network-first.
function stampServiceWorker(siteDir) {
  const swPath = path.join(siteDir, 'sw.js');
  if (!fs.existsSync(swPath)) return;
  // Fixed order so the hash is deterministic across rebuilds. sound.js is
  // hashed "if present" (some builds omit it); each file is tagged with its
  // name so adding or removing an asset also shifts the fingerprint.
  const CACHE_CRITICAL = ['bundle.js', 'interpreter.js', 'bridge.js', 'sound.js', 'styles.css', 'index.html'];
  const h = crypto.createHash('sha256');
  let hashedAny = false;
  for (const name of CACHE_CRITICAL) {
    const assetPath = path.join(siteDir, name);
    if (!fs.existsSync(assetPath)) continue;
    h.update(name + '\0');
    h.update(fs.readFileSync(assetPath));
    hashedAny = true;
  }
  if (!hashedAny) return; // no build assets present -- nothing to fingerprint
  const hash = h.digest('hex').slice(0, 12);
  const sw = fs.readFileSync(swPath, 'utf8');
  const stamped = sw.replace(/kodro-shell-v\d+/, 'kodro-shell-' + hash);
  if (stamped === sw) {
    throw new Error('stampServiceWorker: no kodro-shell-vN token found in site/sw.js');
  }
  fs.writeFileSync(swPath, stamped);
  console.log('stamped site/sw.js cache -> kodro-shell-' + hash);
}

const bundlePath = path.join(WEB, 'bundle.js');
const fresh = build();

if (process.argv.includes('--check')) {
  const existing = fs.existsSync(bundlePath) ? fs.readFileSync(bundlePath, 'utf8') : '';
  if (normalise(existing) !== normalise(fresh)) {
    console.error('bundle.js is STALE -- run: node scripts/build_web.cjs');
    process.exit(1);
  }
  console.log('bundle.js is up to date.');
} else {
  fs.writeFileSync(bundlePath, fresh);
  console.log('wrote bundle.js (' + fresh.length + ' bytes) from ' + ORDER.length + ' sources');
  if (process.argv.includes('--static')) emitStaticSite();
}
