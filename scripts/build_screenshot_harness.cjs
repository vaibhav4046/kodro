/* Build a standalone screenshot harness for the DOM-only surfaces (onboarding,
 * brand mark) so they can be captured as real PNGs.
 *
 * The shipped bundle.js ends by mounting <App/>, which mounts the Three.js
 * viewport; a live WebGL render loop makes the automated screenshot tool hang.
 * This harness compiles the SAME .jsx sources EXCEPT app.jsx, so window
 * components (KodroOnboarding, RobotLab, TERRAINS) are defined but no viewport
 * is ever mounted. harness.html then mounts a chosen surface on its own.
 *
 *   node scripts/build_screenshot_harness.cjs   # writes harness_bundle.js + harness.html
 *
 * Output lives next to index.html and is dev-only (not loaded by the app).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..', 'src', 'robolearn', 'assets', 'web');
// Same load order as build_web.cjs, minus 'app' (so nothing auto-mounts).
const ORDER = ['agents', 'memory', 'terrains', 'Rover', 'Viewport', 'Viewport3D', 'Editor', 'Telemetry', 'tweaks-panel', 'RobotLab', 'onboarding'];

const ctx = { console };
ctx.self = ctx; ctx.window = ctx; ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, 'vendor', 'babel.min.js'), 'utf8'), ctx, { filename: 'babel.min.js' });

let out = '/* AUTO-GENERATED screenshot harness bundle. Dev-only, do not ship. */\n';
for (const name of ORDER) {
  const src = fs.readFileSync(path.join(WEB, name + '.jsx'), 'utf8').replace(/\r\n/g, '\n');
  const code = ctx.Babel.transform(src, { presets: ['react'], filename: name + '.jsx' }).code;
  out += '\n;(function () {\n' + code + '\n})();\n';
}
fs.writeFileSync(path.join(WEB, 'harness_bundle.js'), out);

const HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Kodro harness</title><link rel="stylesheet" href="styles.css" />
<style>html,body{margin:0;background:#08090f}
/* freeze entry animations so a screenshot captures the settled final state */
.konb-root,.konb-card,.konb-mark{animation:none !important;opacity:1 !important;transform:none !important}</style></head>
<body>
  <div id="root"></div>
  <div id="logo-proof" style="position:fixed;bottom:18px;right:18px;width:96px;height:96px;color:#5ce0d8"></div>
  <script src="vendor/react.production.min.js"></script>
  <script src="vendor/react-dom.production.min.js"></script>
  <script src="vendor/three.min.js"></script>
  <script src="interpreter.js"></script>
  <script src="harness_bundle.js"></script>
  <script>
    (function () {
      // Render the brand mark large, bottom-right, as a logo proof tile.
      var mark = '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'
        + '<circle cx="32" cy="32" r="21" stroke="currentColor" stroke-width="2.4" opacity="0.2"></circle>'
        + '<path d="M15 44 A21 21 0 1 1 44 15" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" opacity="0.9"></path>'
        + '<circle cx="15" cy="44" r="2.6" fill="currentColor" opacity="0.45"></circle>'
        + '<circle cx="44" cy="15" r="6.4" fill="currentColor"></circle></svg>';
      document.getElementById('logo-proof').innerHTML = mark;
      // Mount onboarding alone. No App, so no viewport and no WebGL.
      if (window.KodroOnboarding) {
        ReactDOM.createRoot(document.getElementById('root')).render(
          React.createElement(window.KodroOnboarding, { onClose: function () {} })
        );
      }
    })();
  </script>
</body></html>`;
fs.writeFileSync(path.join(WEB, 'harness.html'), HTML);

// Studio harness: prime localStorage so the app skips onboarding and opens
// straight into the studio in the City world, then load the real app stack.
// Used for the studio screenshot (Chrome headless renders WebGL via
// SwiftShader). Same origin and directory as index.html, so the scripts and
// styles resolve identically.
const STUDIO = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Kodro studio harness</title><link rel="stylesheet" href="styles.css" /></head>
<body>
  <script>
    try {
      localStorage.setItem('or_onboarded', '1');
      localStorage.setItem('or_terrain', 'city');
    } catch (e) { void e; }
  </script>
  <div id="root"></div>
  <script src="vendor/react.production.min.js"></script>
  <script src="vendor/react-dom.production.min.js"></script>
  <script src="vendor/three.min.js"></script>
  <script src="interpreter.js"></script>
  <script src="sound.js"></script>
  <script src="bridge.js"></script>
  <script src="bundle.js"></script>
</body></html>`;
fs.writeFileSync(path.join(WEB, 'studio_harness.html'), STUDIO);
console.log('wrote harness_bundle.js + harness.html + studio_harness.html');
