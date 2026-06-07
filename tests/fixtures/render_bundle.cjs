// Execute the PRE-COMPILED bundle.js (interpreter + all components + app) under
// Node with mocked React hooks + browser globals, and confirm every component
// registers on window and App's render body runs without throwing. This guards
// the shipped artifact (what the app actually loads), not just the JSX source.
// Usage: node render_bundle.cjs <web-assets-dir>   -> prints {"error":...}
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = process.argv[2];

const ctx = { console };
ctx.self = ctx;
ctx.window = ctx;
ctx.global = ctx;
ctx.React = {
  useState: (i) => [typeof i === 'function' ? i() : i, () => {}],
  useRef: (i) => ({ current: i }),
  useEffect: () => {},
  useCallback: (f) => f,
  useMemo: (f) => f(),
  memo: (c) => c,
  Fragment: 'frag',
  createElement: (t, p, ...k) => {
    if (typeof t === 'function') t({ ...(p || {}), children: k });
    return { t, p };
  },
};
const el = () => ({
  style: {}, setAttribute() {}, appendChild() {}, append() {},
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {}, removeEventListener() {}, textContent: '', innerHTML: '',
});
ctx.document = {
  getElementById: () => el(), createElement: () => el(),
  documentElement: { style: { setProperty() {} } },
  body: { classList: { toggle() {}, add() {}, remove() {} }, appendChild() {} },
  head: { appendChild() {} }, addEventListener() {}, removeEventListener() {},
};
ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
ctx.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
ctx.performance = { now: () => 0 };
ctx.requestAnimationFrame = () => 0;
ctx.cancelAnimationFrame = () => {};
ctx.setTimeout = () => 0;
ctx.clearTimeout = () => {};
ctx.RoboLearn = { isAvailable: () => false };
ctx.RLSound = { play() {}, resume() {}, setMuted() {}, isMuted: () => false };
let rendered = false;
ctx.ReactDOM = { createRoot: () => ({ render: () => { rendered = true; } }) };

vm.createContext(ctx);
try {
  vm.runInContext(fs.readFileSync(path.join(dir, 'interpreter.js'), 'utf8'), ctx, { filename: 'interpreter.js' });
  vm.runInContext(fs.readFileSync(path.join(dir, 'bundle.js'), 'utf8'), ctx, { filename: 'bundle.js' });
  const ok = rendered && !!ctx.TERRAINS && !!ctx.Viewport && !!ctx.Editor && !!ctx.useTweaks;
  process.stdout.write(JSON.stringify({ error: null, rendered, componentsRegistered: ok }));
} catch (e) {
  process.stdout.write(JSON.stringify({ error: (e && e.message) || String(e) }));
}
