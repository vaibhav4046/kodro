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

const WEB = path.join(__dirname, '..', 'src', 'robolearn', 'assets', 'web');
// Entries ending in '.js' are plain-JS modules (no JSX) bundled verbatim in
// order; everything else is '<name>.jsx'. motion-model.js (the shared physics
// model, E-P1) and specschema.js (the KRS import schema, SI0) must load
// before the modules that call them (diagnostics/selftest/RobotLab/scenario/app).
const ORDER = ['motion-model.js', 'specschema.js', 'project.js', 'runreport.js', 'icons', 'agents', 'memory', 'terrains', 'Rover', 'Viewport', 'textures', 'post', 'worldfx', 'ambient', 'Viewport3D', 'Editor', 'Telemetry', 'tweaks-panel', 'diagnostics', 'selftest', 'RobotLab', 'scenario', 'verify', 'realism', 'demo', 'onboarding', 'ai-providers', 'ai-web', 'hooks', 'app-data', 'panels', 'app'];
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
  const DROP_PREFIX = ['_a11y_probe', '_perf_probe'];
  function keep(srcPath) {
    const base = path.basename(srcPath);
    if (DROP_EXT.has(path.extname(base))) return false;
    if (DROP_NAME.has(base)) return false;
    if (DROP_PREFIX.some((p) => base.startsWith(p))) return false;
    return true;
  }
  fs.rmSync(SITE, { recursive: true, force: true });
  fs.cpSync(WEB, SITE, { recursive: true, filter: keep });
  let files = 0;
  (function count(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) count(path.join(dir, entry.name));
      else files += 1;
    }
  })(SITE);
  console.log('wrote static site/ (' + files + ' files) at ' + SITE);
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
