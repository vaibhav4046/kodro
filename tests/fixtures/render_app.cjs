// Execute the App component's render body once, with mocked React hooks and
// browser globals, to catch render-time runtime errors (TDZ ReferenceErrors,
// undefined reads) that Babel.transform alone cannot. Prints {"error": ...}.
// Usage: node render_app.cjs <web-assets-dir>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = process.argv[2];

// Minimal browser + React shims. useState returns the initial value; effects
// are not run (we only need the synchronous render body to execute).
function makeReact() {
  return {
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    memo: (c) => c,
    createElement: (type, props, ...kids) => {
      // Recursively invoke function components so child render bodies run too.
      if (typeof type === 'function') {
        try { type({ ...(props || {}), children: kids }); } catch (e) { throw e; }
      }
      return { type, props, kids };
    },
  };
}

const ctx = { console };
ctx.self = ctx; ctx.window = ctx; ctx.global = ctx;
const _el = () => ({
  style: {}, setAttribute: () => {}, appendChild: () => {}, append: () => {},
  classList: { toggle: () => {}, add: () => {}, remove: () => {} },
  textContent: '', innerHTML: '',
});
ctx.document = {
  getElementById: () => _el(),
  createElement: () => _el(),
  documentElement: { style: { setProperty: () => {} } },
  body: { classList: { toggle: () => {}, add: () => {}, remove: () => {} }, appendChild: () => {} },
  head: { appendChild: () => {} },
};
ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
ctx.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
ctx.performance = { now: () => 0 };
ctx.requestAnimationFrame = () => 0;
ctx.setTimeout = () => 0;
ctx.React = makeReact();
let rendered = false;
ctx.ReactDOM = { createRoot: () => ({ render: () => { rendered = true; } }) };
// Stub the sibling components app.jsx pulls off window.
for (const name of ['Editor', 'Viewport', 'Telemetry', 'Rover', 'TweaksPanel', 'TweakSection', 'TweakSlider', 'TweakToggle', 'TweakRadio']) {
  ctx[name] = () => null;
}
ctx.useTweaks = () => [{ zoom: 1, tilt: 46, grid: true, ambientFx: true, trail: 'terrain' }, () => {}];
ctx.TERRAINS = new Proxy({ WALL: 1500 }, { get: (t, k) => (k in t ? t[k] : { name: String(k), accent: '#000', traction: 1, obstacleLabel: 'rock', coord: '', dot: '#000', label: String(k) }) });
ctx.RoboLearn = { isAvailable: () => false };

vm.createContext(ctx);
try {
  vm.runInContext(fs.readFileSync(path.join(dir, 'vendor', 'babel.min.js'), 'utf8'), ctx, { filename: 'babel.min.js' });
  const src = fs.readFileSync(path.join(dir, 'app.jsx'), 'utf8');
  const code = ctx.Babel.transform(src, { presets: ['react'] }).code;
  vm.runInContext(code, ctx, { filename: 'app.jsx' });
  process.stdout.write(JSON.stringify({ error: null, rendered }));
} catch (e) {
  process.stdout.write(JSON.stringify({ error: (e && e.message) || String(e) }));
}
