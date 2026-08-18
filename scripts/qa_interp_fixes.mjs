/* Regression tests for the 2026-07-11 interpreter hardening pass.
 *
 * Each assertion pins a specific fix from the judge-panel review so a later
 * change that reintroduces the bug fails loudly:
 *   - function-local scope (a callee no longer clobbers a caller's variable)
 *   - multi-local recursion computes correctly (expression-context calls)
 *   - the `global` statement writes through to module scope
 *   - `x += 1` on an undefined name raises NameError (not a silent base-0)
 *   - stray break/continue/return surface a real diagnostic, not [object Object]
 *   - Object.prototype members (constructor/toString) are NOT callable builtins
 *   - a string ending in an escaped backslash before a # comment tokenizes
 *   - min()/max() over a large iterable do not overflow the native stack
 *   - list/tuple repeat is O(n) and correct
 *
 *   node scripts/qa_interp_fixes.mjs      # exits non-zero on any failure
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/kodro/assets/web/interpreter.js', import.meta.url), 'utf8');
const MM = readFileSync(new URL('../src/kodro/assets/web/motion-model.js', import.meta.url), 'utf8');
const win = {};
new Function('window', MM)(win);
new Function('window', SRC)(win);
const { compile } = win.RoverLang;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass += 1; else { fail += 1; console.error('FAIL  ' + msg); } }

// Run a program, capturing print()/log() text. Returns { out:[lines], error }.
function runProg(src) {
  const out = [];
  const host = { sensor() { return 0; }, lessonApi() { return null; } };
  let error = null;
  try {
    const gen = compile(src).run(host);
    let guard = 0;
    while (true) {
      const res = gen.next();
      if (res.done) break;
      if (++guard > 5_000_000) throw new Error('non-termination');
      const ev = res.value;
      if (ev && ev.type === 'print') out.push(ev.text);
    }
  } catch (e) { error = (e && e.message) || String(e); }
  return { out, error };
}
function expectOut(src, expected, msg) {
  const r = runProg(src);
  ok(!r.error && r.out.join('|') === expected.join('|'), msg + (r.error ? ' [threw: ' + r.error + ']' : ' [out=' + r.out.join('|') + ']'));
}
function expectThrows(src, needle, msg) {
  const r = runProg(src);
  ok(r.error && r.error.indexOf(needle) >= 0, msg + ' [got: ' + (r.error || 'no error, out=' + r.out.join('|')) + ']');
}

// 1. Function-local scope: callee's local does not clobber the caller's var.
expectOut('x = 5\ndef f():\n    x = 99\nf()\nprint(x)', ['5'], 'local scope: callee local does not clobber caller');

// 2. Multi-local recursion (expression context) computes correctly.
expectOut('def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\nprint(fact(5))', ['120'], 'recursion: fact(5) == 120');

// 3. for-loop variable is local to the function, not global.
expectOut('i = 42\ndef loop():\n    for i in range(3):\n        pass\nloop()\nprint(i)', ['42'], 'local scope: callee loop var does not clobber caller i');

// 4. `global` writes through to module scope.
expectOut('c = 0\ndef inc():\n    global c\n    c = c + 1\ninc()\ninc()\nprint(c)', ['2'], 'global statement: module counter updates');

// 5. augmented assignment on undefined name -> NameError.
expectThrows('x += 1', 'not defined', 'augassign on undefined name raises NameError');

// 6. Stray control-flow surfaces a real diagnostic.
expectThrows('break', "'break' outside loop", 'break outside loop is a real error');
expectThrows('return 5', "'return' outside function", 'return outside function is a real error');

// 7. Object.prototype members are not callable builtins / defined names.
expectThrows('x = constructor', 'not defined', 'constructor is not a defined name');
expectThrows('toString()', 'not defined', 'toString is not a callable builtin');

// 8. String ending in an escaped backslash before a # comment tokenizes.
expectOut('s = "a\\\\"  # trailing comment\nprint(s)', ['a\\'], 'escaped backslash before comment does not swallow the line');

// 9. min()/max() over a large iterable do not blow the native stack.
expectOut('print(min(range(130000)))\nprint(max(range(130000)))', ['0', '129999'], 'min/max over ~130k elements do not overflow');

// 10. List repeat is correct and O(n) (completes well under a timeout).
expectOut('x = [7] * 4\nprint(len(x))\nprint(x[3])', ['4', '7'], 'list repeat builds the right list');
{
  const t0 = Date.now();
  const r = runProg('x = [0] * 500000\nprint(len(x))');
  const ms = Date.now() - t0;
  ok(!r.error && r.out.join('') === '500000' && ms < 4000, 'list repeat of 500k is O(n) (' + ms + 'ms, out=' + r.out.join('') + (r.error ? ', threw ' + r.error : '') + ')');
}

console.log((fail ? 'FAIL' : 'PASS') + '  interpreter fixes: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
