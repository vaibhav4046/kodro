/* WCAG contrast gate for theme-token colours on their real surfaces (judge
 * round 4). Two classes of defect this pins:
 *
 *  - the editor file tabs must not fall back to the UA light button face: the
 *    .tab base rule needs appearance:none + an explicit background, and its
 *    label (--fg-2) must clear AA on the dark tab bar (--navy);
 *  - the run controls' Reset label (--danger) must clear AA on the mission-bar
 *    background in EVERY theme, including the classroom novelty themes, so a
 *    new or retuned theme cannot ship an illegible control.
 *
 * It parses the shipped styles.css, resolves each theme's tokens (a theme
 * inherits :root where it does not override), composites alpha colours over
 * their background, and computes the WCAG 2.1 contrast ratio.
 *
 *   node scripts/qa_contrast.mjs   # exits non-zero on any sub-AA surface
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(path.join(HERE, '..', 'src', 'robolearn', 'assets', 'web', 'styles.css'), 'utf8');
const AA = 4.5;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass += 1; } else { fail += 1; console.error('FAIL  ' + msg); } }

// --- colour parsing + WCAG ratio -------------------------------------------
function parseColor(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return [17 * parseInt(m[1][0], 16), 17 * parseInt(m[1][1], 16), 17 * parseInt(m[1][2], 16), 1];
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return null;
}
function over(fg, bg) { // composite fg (may have alpha) over opaque bg
  const a = fg[3];
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))).concat(1);
}
function lum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fgRaw, bgRaw) {
  const bg = bgRaw; const fg = fgRaw[3] < 1 ? over(fgRaw, bg) : fgRaw;
  const l1 = lum(fg), l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// --- theme token maps ------------------------------------------------------
// :root holds the default theme; each [data-theme="X"] block overrides some
// tokens and inherits the rest.
function tokensOf(selectorRe) {
  const block = CSS.match(selectorRe);
  const out = {};
  if (block) for (const m of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const root = tokensOf(/:root\s*\{([\s\S]*?)\}/);
const themeNames = [...CSS.matchAll(/\[data-theme="([\w-]+)"\]\s*\{/g)].map((m) => m[1]);
const themes = { default: root };
for (const name of themeNames) {
  themes[name] = Object.assign({}, root, tokensOf(new RegExp('\\[data-theme="' + name + '"\\]\\s*\\{([\\s\\S]*?)\\}')));
}
function color(theme, token) {
  let v = themes[theme][token];
  let guard = 0;
  while (v && v.startsWith('var(') && guard++ < 5) {
    const inner = v.match(/var\((--[\w-]+)\)/);
    v = inner ? themes[theme][inner[1]] : null;
  }
  return v ? parseColor(v) : null;
}

// 1. .tab label must clear AA on the tab bar in EVERY theme (the bar is --navy).
for (const t of Object.keys(themes)) {
  const fg = color(t, '--fg-2'), bg = color(t, '--navy');
  if (!fg || !bg) { ok(false, `${t}: missing --fg-2/--navy token`); continue; }
  const r = ratio(fg, bg);
  ok(r >= AA, `tab label (--fg-2) on the tab bar (--navy) in "${t}" is ${r.toFixed(2)}:1 (need ${AA})`);
}

// 2. The .tab base rule must reset the UA appearance and set a background, so an
//    inactive tab can never fall back to the light UA button face.
const tabRule = (CSS.match(/\.tab\s*\{([\s\S]*?)\}/) || [])[1] || '';
ok(/appearance\s*:\s*none/.test(tabRule), '.tab base rule resets appearance to none');
ok(/background\s*:/.test(tabRule), '.tab base rule sets an explicit background');

// 3. The Reset control label (--danger) must clear AA on the mission-bar
//    background in EVERY theme. The bar is linear-gradient(--navy-2, --navy);
//    the lighter --navy-2 end is the worst case, so test against it.
for (const t of Object.keys(themes)) {
  const fg = color(t, '--danger'), bg = color(t, '--navy-2');
  if (!fg || !bg) { ok(false, `${t}: missing --danger/--navy-2 token`); continue; }
  const r = ratio(fg, bg);
  ok(r >= AA, `Reset label (--danger) on the mission bar (--navy-2) in "${t}" is ${r.toFixed(2)}:1 (need ${AA})`);
}

// 3b. Secondary label text (--fg-3): section headers, gauge labels, and bar
//     keys name the telemetry numbers, so they must clear AA too, on the
//     darkest surface they sit on (--void, the gauge/console background).
for (const t of Object.keys(themes)) {
  const fg = color(t, '--fg-3'), bg = color(t, '--void');
  if (!fg || !bg) { ok(false, `${t}: missing --fg-3/--void token`); continue; }
  const r = ratio(fg, bg);
  ok(r >= AA, `label text (--fg-3) on the panel surface (--void) in "${t}" is ${r.toFixed(2)}:1 (need ${AA})`);
}

// 4. Responsive integrity: at phone width the view controls (3D/2D/quality/
//    time/weather) must take their own full-width row so they wrap inside the
//    panel; without it the rigid cluster overflowed and .view-panel
//    overflow:hidden clipped the 3D button off-screen (judge round 5).
ok(/\.terrain-switch\s*>\s*\.view-toggle\s*\{\s*flex\s*:\s*1\s+1\s+100%/.test(CSS),
  'phone width gives .view-toggle a full-width wrapping row inside .terrain-switch');

console.log((fail === 0 ? 'PASS' : 'FAIL') + '  contrast + responsive: ' + pass + ' passed, ' + fail + ' failed (over ' + Object.keys(themes).length + ' themes)');
process.exit(fail === 0 ? 0 : 1);
