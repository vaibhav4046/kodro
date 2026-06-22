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
const ORDER = ['agents', 'memory', 'terrains', 'Rover', 'Viewport', 'Viewport3D', 'Editor', 'Telemetry', 'tweaks-panel', 'diagnostics', 'selftest', 'RobotLab', 'onboarding'];

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
//                             voiceagent robotlab memory build help settings
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
        var qq = q.get('q'); if (qq) localStorage.setItem('kodro_quality', qq);
      } catch (e) { void e; }
      window.__CAP = { onb: onb, step: +(q.get('step') || 0), robot: q.get('robot'), world: q.get('world'), panel: q.get('panel'), run: q.get('run'), vibe: q.get('vibe'), blockstest: q.get('blockstest'), code: q.get('code'), open: q.get('open') };
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
      if (!C.onb && C.robot) {
        setTimeout(function () { try { window.dispatchEvent(new CustomEvent('kodro-robot', { detail: { type: C.robot, world: C.world || undefined } })); } catch (e) { void e; } }, 500);
      }
      if (!C.onb && C.run) {
        // Click Run so a capture can show the rover mid-drive (trail + heading).
        setTimeout(function () { var b = [].slice.call(document.querySelectorAll('.ctrl')); for (var i = 0; i < b.length; i++) { if ((b[i].textContent || '').indexOf('Run') >= 0) { b[i].click(); return; } } }, 1400);
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
          if (C.panel === 'lab') clickAria('Robot Lab');
          else if (C.panel === 'memory') clickAria('Memory and skills');
          // The Blocks toolbar button reads "🧩 Blocks", so an uppercase
          // text match misses it; open it by its unambiguous title instead.
          else if (C.panel === 'blocks') clickTitle('Build the program from blocks');
        }, 1000);
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
      if (!C.onb && C.code) {
        // Error-path driver: type a deliberately broken program into the editor,
        // then click Run. The interpreter raises and the studio prints a
        // "cline err" line in the console-out region. Used by the UI harness to
        // assert the error path actually surfaces an error, not a silent no-op.
        setTimeout(function () { setTextarea('.code-ta', C.code); }, 900);
        setTimeout(function () {
          var b = [].slice.call(document.querySelectorAll('.ctrl'));
          for (var i = 0; i < b.length; i++) { if ((b[i].textContent || '').indexOf('Run') >= 0) { b[i].click(); return; } }
        }, 1400);
      }
      if (!C.onb && C.open) {
        // Modal-coverage driver (gated behind open=<name> so a normal load is
        // unaffected). On load, click the toolbar button that opens the named
        // modal/popover so the UI harness can assert each one renders. Triggers
        // are taken from app.jsx: btn-vibe class for Vibe; aria-labels for the
        // icon buttons (Voice agent / Robot Lab / Memory / Build / Keyboard
        // shortcuts / Settings); and title text for the editor-toolbar buttons
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
          ask: function () { return clickTitleStartsWith('Ask a question, answered from the lesson material'); },
          voiceagent: function () { return clickAria('Voice agent'); },
          robotlab: function () { return clickAria('Robot Lab'); },
          memory: function () { return clickAria('Memory and skills'); },
          build: function () { return clickAria('Build a real robot'); },
          help: function () { return clickAria('Keyboard shortcuts'); },
          settings: function () { return clickAria('Settings'); }
        };
        // Wait for the studio toolbar to mount, then fire the opener. A second
        // attempt covers a slow first paint without affecting a modal that is
        // already open (the openers are idempotent toggles or no-ops on a hit).
        var opener = OPENERS[String(C.open).toLowerCase()];
        if (opener) {
          setTimeout(function () { try { opener(); } catch (e) { void e; } }, 1000);
          setTimeout(function () { try { if (!document.querySelector('[role="dialog"]')) opener(); } catch (e) { void e; } }, 1600);
        }
      }
      if (C.onb) {
        if (C.step >= 1) setTimeout(function () { clickText('Get started'); }, 300);
        if (C.step >= 2) {
          setTimeout(function () { var t = document.querySelector('.konb-tile'); if (t) t.click(); }, 700);
          setTimeout(function () { clickText('Continue'); }, 1000);
        }
      }
    })();
  </script>
</body></html>`;
fs.writeFileSync(path.join(WEB, 'cap.html'), CAP);
console.log('wrote harness_bundle.js + harness.html + studio_harness.html + cap.html');
