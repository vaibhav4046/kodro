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
}
