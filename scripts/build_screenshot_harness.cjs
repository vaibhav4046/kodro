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
// motion-model.js / specschema.js are plain JS (no JSX) but RobotLab and
// diagnostics read them, so they load first here too.
const ORDER = ['motion-model.js', 'specschema.js', 'agents', 'memory', 'terrains', 'Rover', 'Viewport', 'Viewport3D', 'Editor', 'Telemetry', 'tweaks-panel', 'diagnostics', 'selftest', 'RobotLab', 'onboarding'];

const ctx = { console };
ctx.self = ctx; ctx.window = ctx; ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, 'vendor', 'babel.min.js'), 'utf8'), ctx, { filename: 'babel.min.js' });

let out = '/* AUTO-GENERATED screenshot harness bundle. Dev-only, do not ship. */\n';
for (const name of ORDER) {
  const file = name.endsWith('.js') ? name : name + '.jsx';
  const src = fs.readFileSync(path.join(WEB, file), 'utf8').replace(/\r\n/g, '\n');
  const code = ctx.Babel.transform(src, { presets: ['react'], filename: file }).code;
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

// Parametric capture harness. Loads the real app stack and drives it via URL
// query params so any surface can be screenshot with headless Chrome:
//   cap.html?onb=1            onboarding landing
//   cap.html?onb=1&step=1     onboarding robot picker
//   cap.html?onb=1&step=2     onboarding world recommendation
//   cap.html?world=room&robot=home   studio, home robot in the Room
//   cap.html?world=mars&robot=rover  studio, rover on Mars
//   cap.html?panel=lab        studio with the Robot Lab open
//   cap.html?panel=memory     studio with the Memory panel open
//   cap.html?open=vibe        studio with a named modal/popover opened. Names:
//                             vibe blocks review validate realism demo ask
//                             robotlab memory build help settings
//   cap.html?view=2d          force the flat 2.5D viewport (view=3d forces 3D)
//   cap.html?tod=night        time-of-day preset (dawn|noon|dusk|night, R8)
//   cap.html?weather=storm    weather preset (clear|storm|rain|snow, R10)
//   cap.html?repl=<line>      type one line into the live terminal and Enter it
//   cap.html?code=-           the '-' sentinel types an EMPTY program (blank-run
//                             coverage); any other value types that program
//   cap.html?site=<id>        after load, switch to a mission site through the
//                             real site <select> (drives onTerrain like a user)
//   cap.html?layout=1         append a hidden #layout-probe div carrying
//                             data-scroll-w / data-inner-w so a DOM dump can
//                             assert the page does not overflow horizontally
//   cap.html?seedmem=1        seed one fixture reflection into localStorage so
//                             memory-driven UI (Vibe context chip) is testable
//   cap.html?tab=encore       open a named example tab (writes or_tab)
//   cap.html?mode=classroom   set the Studio/Classroom mode before mount (A1)
//   cap.html?reverttest=1     blocks-insert then click the Revert toast (A9)
//   cap.html?importspec=1     import the fixture KRS robot spec through the
//                             REAL validate-then-save path (SI1) before any
//                             open= driver fires, so the Robot Lab shows the
//                             Measured build banner
// Every driver logs a console.error (picked up by the UI harness console
// filter) when its click target is missing, so a renamed button FAILS the
// harness instead of silently capturing the wrong state.
// Combine with Chrome --virtual-time-budget so timed clicks and WebGL settle.
const CAP = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Kodro capture</title><link rel="stylesheet" href="styles.css" />
<style>.konb-root,.konb-card,.konb-mark{animation:none !important;opacity:1 !important;transform:none !important}</style></head>
<body>
  <script>
    (function () {
      var q = new URLSearchParams(location.search);
      var onb = q.get('onb');
      try {
        if (onb) localStorage.removeItem('or_onboarded');
        else localStorage.setItem('or_onboarded', '1');
        var w = q.get('world'); if (w) localStorage.setItem('or_terrain', w);
        var tb = q.get('tab'); if (tb) localStorage.setItem('or_tab', tb);
        var qq = q.get('q'); if (qq) localStorage.setItem('kodro_quality', qq);
        var td = q.get('tod'); if (td) localStorage.setItem('kodro_tod', td);
        var wx = q.get('weather'); if (wx) localStorage.setItem('kodro_weather', wx);
        var md = q.get('mode'); if (md) localStorage.setItem('kodro_mode', md);
        var vw = q.get('view');
        if (vw === '2d') localStorage.setItem('or_view3d', '0');
        else if (vw === '3d') localStorage.setItem('or_view3d', '1');
        if (q.get('seedmem')) {
          // One fixture reflection so memory-driven UI renders deterministically.
          localStorage.setItem('kodro_reflections_v1', JSON.stringify([{
            ts: 1, world: (q.get('world') || 'earth'), robotType: 'rover', outcome: 'crash',
            detail: 'a boulder', reflection: 'Collided with a boulder. Add a distance() check before moving forward.'
          }]));
        }
      } catch (e) { void e; }
      window.__CAP = { onb: onb, step: +(q.get('step') || 0), robot: q.get('robot'), world: q.get('world'), panel: q.get('panel'), run: q.get('run'), vibe: q.get('vibe'), blockstest: q.get('blockstest'), code: q.get('code'), open: q.get('open'), repl: q.get('repl'), site: q.get('site'), layout: q.get('layout'), importspec: q.get('importspec'), reverttest: q.get('reverttest'), memview: q.get('memview'), lesson: q.get('lesson') };
    })();
  </script>
  <div id="root"></div>
  <script src="vendor/react.production.min.js"></script>
  <script src="vendor/react-dom.production.min.js"></script>
  <script src="vendor/three.min.js"></script>
  <script src="interpreter.js"></script>
  <script src="sound.js"></script>
  <script src="bridge.js"></script>
  <script src="bundle.js"></script>
  <script>
    (function () {
      var C = window.__CAP || {};
      function clickText(txt) {
        var els = [].slice.call(document.querySelectorAll('button,.konb-btn,.konb-tile'));
        for (var i = 0; i < els.length; i++) { if ((els[i].textContent || '').trim().indexOf(txt) >= 0) { els[i].click(); return true; } }
        return false;
      }
      function clickAria(label) { var el = document.querySelector('[aria-label="' + label + '"]'); if (el) { el.click(); return true; } return false; }
      // The icon-bar buttons now carry a descriptive aria-label SUFFIX
      // (e.g. "Robot Lab — design a custom robot"), so an exact [aria-label="..."]
      // selector misses them. Match on an aria-label PREFIX instead, scanning real
      // elements, so the open=<name> driver opens those modals against the current
      // markup. The dialog roots keep their clean aria-labels (see panels.jsx /
      // RobotLab.jsx), so a button-prefix match cannot collide with a dialog.
      function clickAriaStartsWith(prefix) {
        var els = [].slice.call(document.querySelectorAll('[aria-label]'));
        for (var i = 0; i < els.length; i++) {
          if ((els[i].getAttribute('aria-label') || '').indexOf(prefix) === 0) { els[i].click(); return true; }
        }
        return false;
      }
      function clickTitle(title) { var el = document.querySelector('[title="' + title + '"]'); if (el) { el.click(); return true; } return false; }
      // Some toolbar titles get a "(needs local Ollama)" suffix appended when no
      // model is running, so an exact [title="..."] selector misses them. Match
      // on a title PREFIX instead, scanning real elements, so the open=<name>
      // driver opens those modals whether or not Ollama is present.
      function clickTitleStartsWith(prefix) {
        var els = [].slice.call(document.querySelectorAll('[title]'));
        for (var i = 0; i < els.length; i++) {
          if ((els[i].getAttribute('title') || '').indexOf(prefix) === 0) { els[i].click(); return true; }
        }
        return false;
      }
      // Set a React-controlled textarea's value the way a user typing would:
      // native setter + a bubbling input event, so React's onChange fires.
      function setTextarea(sel, value) {
        var inp = document.querySelector(sel);
        if (!inp) return false;
        var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(inp, value);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      // Driver self-check: a missing click target is a HARNESS failure, not a
      // silent no-op. console.error carries the word "error" so the UI smoke's
      // console filter (FAIL regex) flags the flow instead of passing a capture
      // of the wrong state.
      function must(okVal, what) {
        if (!okVal) { try { console.error('[cap-driver] ERROR: click target missing: ' + what); } catch (e) { void e; } }
        return okVal;
      }
      function clickRun() {
        var b = [].slice.call(document.querySelectorAll('.ctrl'));
        for (var i = 0; i < b.length; i++) { if ((b[i].textContent || '').indexOf('Run') >= 0) { b[i].click(); return true; } }
        return false;
      }
      if (!C.onb && C.robot) {
        setTimeout(function () { try { window.dispatchEvent(new CustomEvent('kodro-robot', { detail: { type: C.robot, world: C.world || undefined } })); } catch (e) { void e; } }, 500);
      }
      if (!C.onb && C.repl) {
        // Live-terminal driver: type one line into the REPL input the way a user
        // would (native setter + input event so React sees it), then press
        // Enter. Runs BEFORE any run=1 click (which is pushed later below) so a
        // REPL error can be followed by an editor Run in one capture.
        setTimeout(function () {
          var inp = document.querySelector('.repl-input');
          if (!must(!!inp, 'repl input (.repl-input)')) return;
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(inp, C.repl);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }, 1100);
      }
      if (!C.onb && C.run) {
        // Click Run so a capture can show the rover mid-drive (trail + heading).
        // When a repl= line is also being driven, wait for it to finish first so
        // the capture proves the run happened AFTER the terminal line.
        setTimeout(function () { must(clickRun(), 'Run button (.ctrl)'); }, C.repl ? 3200 : 1400);
      }
      if (!C.onb && C.importspec) {
        // SI1 driver: push the fixture KRS spec through the REAL
        // validate-then-save path (the same function the Import button calls
        // after reading the picked file). Fires before any open= driver so
        // an open=robotlab capture shows the Measured build banner.
        var KRS_FIXTURE = {
          kodroSpec: 1, name: 'Reference Rover', type: 'rover', board: 'esp32',
          massKg: 1.2, bodyCm: { lengthCm: 25, widthCm: 18, heightCm: 12 },
          drive: { kind: 'differential', wheelRadiusCm: 3.25, wheelbaseCm: 14, motorCount: 2,
            motor: { noLoadRpm: 300, stallTorqueNm: 0.35, nominalV: 6 } },
          battery: { mAh: 2200, voltage: 7.4, usableFraction: 0.8 },
          sensors: [{ kind: 'ultrasonic', posCm: { x: 10, y: 0 }, yawDeg: 0, rangeCm: 400, fovDeg: 15 }, { kind: 'imu' }],
          actuators: ['motors2'],
          declared: { maxSpeedMps: 1.0, runtimeMin: 180 }
        };
        setTimeout(function () {
          if (!window.RobotLab || !window.RobotLab.importSpecText) {
            must(false, 'importspec (RobotLab.importSpecText)');
            return;
          }
          var r = window.RobotLab.importSpecText(JSON.stringify(KRS_FIXTURE));
          if (!r || !r.ok) { try { console.error('[cap-driver] ERROR: spec import failed: ' + ((r && r.errors) || []).join('; ')); } catch (e) { void e; } }
        }, 700);
      }
      if (!C.onb && C.site) {
        // Mission-site driver: change the real site <select> like a user, which
        // routes through onTerrain and must rebuild the 3D scene (F1).
        setTimeout(function () {
          var sel = document.querySelector('.site-select');
          if (!must(!!sel, 'mission site select (.site-select)')) return;
          var setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
          setter.call(sel, C.site);
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, 1600);
      }
      if (C.layout) {
        // Layout probe: record the real overflow numbers late (after fonts and
        // panels settle) so a DOM dump can assert scrollWidth <= innerWidth.
        setTimeout(function () {
          try {
            var d = document.createElement('div');
            d.id = 'layout-probe';
            var sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
            d.setAttribute('data-scroll-w', String(sw));
            d.setAttribute('data-inner-w', String(window.innerWidth));
            d.style.display = 'none';
            document.body.appendChild(d);
          } catch (e) { void e; }
        }, 2600);
      }
      if (!C.onb && C.vibe) {
        // Drive the Vibe panel end-to-end like a user: open it, type the prompt
        // into the React-controlled textarea (native setter + input event), then
        // click Send. A long virtual-time-budget lets the local model reply.
        setTimeout(function () {
          var vb = document.querySelector('.btn-vibe'); if (vb) vb.click();
          setTimeout(function () {
            var inp = document.querySelector('.vibe-input');
            if (inp) {
              var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              setter.call(inp, C.vibe);
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              setTimeout(function () {
                var btns = [].slice.call(document.querySelectorAll('button'));
                for (var i = 0; i < btns.length; i++) { if ((btns[i].textContent || '').trim() === 'Send') { btns[i].click(); return; } }
              }, 400);
            }
          }, 700);
        }, 1200);
      }
      if (!C.onb && C.panel) {
        setTimeout(function () {
          // Icon-bar aria-labels gained a " — <suffix>"; match on the prefix.
          if (C.panel === 'lab') must(clickAriaStartsWith('Robot Lab'), 'panel=lab (aria "Robot Lab")');
          else if (C.panel === 'memory') must(clickAriaStartsWith('Memory and skills'), 'panel=memory (aria "Memory and skills")');
          // The Blocks toolbar button reads "Blocks" (SVG icon + label), so an uppercase
          // text match misses it; open it by its unambiguous title instead.
          else if (C.panel === 'blocks') must(clickTitle('Build the program from blocks'), 'panel=blocks (title "Build the program from blocks")');
        }, 1000);
      }
      if (!C.onb && C.lesson) {
        // lesson=<id>: pick a lesson through the REAL classroom dropdown (needs
        // mode=classroom so the picker is on screen). React-controlled select:
        // native value setter + a bubbling change event, mirroring setTextarea.
        // The lessons list loads async (listLessons), so fire quietly first and
        // only self-check on the RETRY -- the same pattern the open= driver uses.
        var pickLesson = function () {
          var sel = document.getElementById('lesson-select');
          if (!sel) return false;
          try {
            var setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
            setter.call(sel, C.lesson);
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          } catch (e) { return false; }
        };
        // Quiet retry loop: the lessons list arrives over a REAL network fetch,
        // which virtual time races ahead of, so a fixed-delay must() fired
        // noise before the picker could exist. Keep trying silently; only the
        // very last attempt self-checks loudly.
        var lessonTries = 0;
        var lessonTimer = setInterval(function () {
          lessonTries += 1;
          if (document.querySelector('.lesson-card') || pickLesson()) { clearInterval(lessonTimer); return; }
          if (lessonTries >= 10) {
            clearInterval(lessonTimer);
            must(false, 'lesson=' + C.lesson + ' (#lesson-select present; needs mode=classroom)');
          }
        }, 700);
      }
      if (!C.onb && C.blockstest) {
        // Behaviour driver for the UI harness (gated behind blockstest=1 so it
        // never affects a normal load). Open the Blocks panel, click the FIRST
        // palette chip, then "Insert code →". The block palette turns into
        // Python and types it into the editor, so the editor textarea ends up
        // holding a known command token (move_forward) — proof the blocks path
        // is wired to the editor, not just that the palette renders.
        setTimeout(function () { clickTitle('Build the program from blocks'); }, 900);
        setTimeout(function () {
          var chip = document.querySelector('.block-chip:not([disabled])');
          if (chip) chip.click();
        }, 1300);
        setTimeout(function () {
          var btns = [].slice.call(document.querySelectorAll('.ctrl-run, button'));
          for (var i = 0; i < btns.length; i++) {
            if ((btns[i].textContent || '').indexOf('Insert code') >= 0) { btns[i].click(); return; }
          }
        }, 1700);
      }
      if (!C.onb && C.reverttest) {
        // A9 driver: insert code via the Blocks path (which snapshots the
        // buffer it overwrites), then click the Revert toast action. The DOM
        // dump should show the ORIGINAL starter program back in the editor.
        setTimeout(function () { clickTitle('Build the program from blocks'); }, 900);
        setTimeout(function () {
          var chip = document.querySelector('.block-chip:not([disabled])');
          if (chip) chip.click();
        }, 1300);
        setTimeout(function () {
          var btns = [].slice.call(document.querySelectorAll('.ctrl-run, button'));
          for (var i = 0; i < btns.length; i++) {
            if ((btns[i].textContent || '').indexOf('Insert code') >= 0) { btns[i].click(); return; }
          }
        }, 1700);
        setTimeout(function () {
          var rb = document.querySelector('.toast-action');
          must(!!rb, 'Revert toast action (.toast-action)');
          if (rb) rb.click();
        }, 3200);
      }
      if (!C.onb && C.code) {
        // Program driver: type a program into the editor, then click Run. The
        // '-' sentinel types an EMPTY program (URLSearchParams cannot carry a
        // truly empty value the driver can distinguish from an absent param),
        // covering the blank-run path. Broken programs cover the error path:
        // the interpreter raises and the studio prints a "cline err" line.
        var codeVal = C.code === '-' ? '' : C.code;
        setTimeout(function () { must(setTextarea('.code-ta', codeVal), 'editor textarea (.code-ta)'); }, 900);
        setTimeout(function () { must(clickRun(), 'Run button (.ctrl)'); }, 1400);
      }
      if (!C.onb && C.open) {
        // Modal-coverage driver (gated behind open=<name> so a normal load is
        // unaffected). On load, click the toolbar button that opens the named
        // modal/popover so the UI harness can assert each one renders. Triggers
        // are taken from app.jsx: btn-vibe class for Vibe; aria-label PREFIXES for
        // the icon buttons (Robot Lab / Memory / Build / Keyboard
        // shortcuts / Settings — each button's aria-label gained a " — <suffix>",
        // so we match the label prefix, not the whole string); and title text for
        // the editor-toolbar buttons
        // (Blocks / Review / Validate / Realism / Demo / Ask), matched on a title
        // PREFIX because the AI buttons gain a "(needs local Ollama)" suffix when
        // no model is running. Opening a modal does NOT need Ollama — the modal
        // renders its input / "needs Ollama" state regardless.
        var OPENERS = {
          vibe: function () { var b = document.querySelector('.btn-vibe'); if (b) { b.click(); return true; } return false; },
          blocks: function () { return clickTitleStartsWith('Build the program from blocks'); },
          review: function () { return clickTitleStartsWith('A second AI agent reviews your code'); },
          validate: function () { return clickTitleStartsWith('Validate this program across 5 randomised seeds'); },
          realism: function () { return clickTitleStartsWith('Realism dashboard'); },
          demo: function () { return clickTitleStartsWith('Guided 2 to 3 minute realism demo'); },
          ask: function () { return clickTitleStartsWith('Ask a question'); },
          // Icon-bar buttons: match the aria-label PREFIX (the label text before
          // the " — <suffix>" the buttons gained). See app.jsx icon-bar markup.
          robotlab: function () { return clickAriaStartsWith('Robot Lab'); },
          memory: function () { return clickAriaStartsWith('Memory and skills'); },
          build: function () { return clickAriaStartsWith('Build a real robot'); },
          help: function () { return clickAriaStartsWith('Keyboard shortcuts'); },
          settings: function () { return clickAriaStartsWith('Settings'); }
        };
        // Wait for the studio toolbar to mount, then fire the opener. A second
        // attempt covers a slow first paint without affecting a modal that is
        // already open (the openers are idempotent toggles or no-ops on a hit).
        // If the RETRY still cannot find its target, the self-check fires.
        var opener = OPENERS[String(C.open).toLowerCase()];
        if (opener) {
          setTimeout(function () { try { opener(); } catch (e) { void e; } }, 1000);
          setTimeout(function () { try { if (!document.querySelector('[role="dialog"]')) must(opener(), 'open=' + C.open); } catch (e) { void e; } }, 1600);
          // memview=graph: after the Memory dialog is open, click its Graph
          // toggle so the relationship-graph view is what the capture sees.
          if (C.memview === 'graph') {
            setTimeout(function () { try { var g = document.querySelector('[data-mem-graph]'); if (g) g.click(); } catch (e) { void e; } }, 2000);
          }
        } else {
          must(false, 'open=' + C.open + ' (unknown opener name)');
        }
      }
      if (C.onb) {
        if (C.step >= 1) setTimeout(function () { must(clickText('Start building'), 'onboarding CTA "Start building"'); }, 300);
        if (C.step >= 2) {
          setTimeout(function () { var t = document.querySelector('.konb-tile'); must(!!t, 'onboarding robot tile (.konb-tile)'); if (t) t.click(); }, 700);
          setTimeout(function () { must(clickText('Continue'), 'onboarding "Continue"'); }, 1000);
        }
      }
    })();
  </script>
</body></html>`;
fs.writeFileSync(path.join(WEB, 'cap.html'), CAP);
console.log('wrote harness_bundle.js + harness.html + studio_harness.html + cap.html');
