// Compile-check every vendored .jsx with the bundled Babel-standalone,
// loaded in a vm context (the browser UMD branch). Prints JSON:
//   {"fails": [...]} or {"fatal": "no-babel"}.
// Usage: node jsx_validate.js <web-assets-dir>
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.log(JSON.stringify({ fatal: 'no-dir' })); process.exit(0); }

const ctx = { console };
ctx.self = ctx; ctx.window = ctx; ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(dir, 'vendor', 'babel.min.js'), 'utf8'),
  ctx,
  { filename: 'babel.min.js' },
);

const Babel = ctx.Babel;
if (!Babel || typeof Babel.transform !== 'function') {
  console.log(JSON.stringify({ fatal: 'no-babel' }));
  process.exit(0);
}

const files = ['app.jsx', 'Editor.jsx', 'Viewport.jsx', 'Telemetry.jsx', 'Rover.jsx', 'terrains.jsx', 'tweaks-panel.jsx'];
const fails = [];
for (const f of files) {
  try {
    Babel.transform(fs.readFileSync(path.join(dir, f), 'utf8'), { presets: ['react'], filename: f });
  } catch (e) {
    fails.push(f + ': ' + String(e.message).split('\n')[0]);
  }
}
console.log(JSON.stringify({ fails }));
