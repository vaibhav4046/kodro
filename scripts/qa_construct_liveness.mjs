/* Gate: `uses_construct` must reject provably dead constructs, identically in
 * both engines.
 *
 * The criterion exists because a lesson is teaching selection, iteration or
 * decomposition. A bare "does the source contain an If node" check is satisfied
 * by `if False: pass`, which lets a pupil pass a sensor-reading lesson without
 * ever reading the sensor, and by a `def` that is never called, which is dead
 * code rather than modular design.
 *
 * The check is STATIC on both sides: the Python executor detaches every trace
 * hook (sys.settrace(None)) because tracing a force-killed pupil thread could
 * deadlock the run, so runtime coverage is not available. It therefore rejects
 * what is provably dead at parse time, not everything that happens not to run
 * on a given input. A condition that is merely false at runtime still counts,
 * and that limit is stated rather than papered over.
 *
 * This file gates the JS half and asserts it agrees with the Python half; the
 * Python half is gated by tests/unit/test_grader.py. Divergence between the two
 * graders means the same program passes in the browser and fails on the
 * desktop, so parity is asserted case by case.
 *
 * Run: node scripts/qa_construct_liveness.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WEB = path.join(ROOT, 'src', 'robolearn', 'assets', 'web');

const ctx = { console, JSON, Math, String, Number, Object, Array, Error, RegExp, Date };
ctx.window = ctx;
ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['interpreter.js', 'lesson-grader.jsx']) {
  let src = readFileSync(path.join(WEB, f), 'utf8');
  if (f.endsWith('.jsx')) {
    // lesson-grader.jsx is plain JS inside an IIFE (no JSX in the graded path),
    // so it runs directly. If that ever stops being true this throws loudly
    // rather than silently skipping the gate.
    src = src;
  }
  vm.runInContext(src, ctx, { filename: f });
}

const LG = ctx.window.KodroLessonGrader || ctx.window.LessonGrader;
const sourceUses = (LG && (LG.sourceUses || LG._sourceUses)) || null;

let pass = 0;
const fails = [];
const check = (name, cond, detail) => {
  if (cond) pass++;
  else fails.push(name + (detail ? '  -> ' + detail : ''));
};

check('lesson-grader exposes sourceUses for gating', typeof sourceUses === 'function',
  'expected KodroLessonGrader.sourceUses to be exported');

// [source, construct, expected]. Kept identical to the Python cases in
// tests/unit/test_grader.py so the two engines are compared on the same set.
const CASES = [
  // --- provably dead: must NOT count ---
  ['if False:\n    pass\n', 'if', false],
  ['while False:\n    pass\n', 'while', false],
  ['for i in range(0):\n    pass\n', 'for', false],
  ['for i in []:\n    pass\n', 'for', false],
  ['def f():\n    pass\n', 'function_def', false],
  // --- live: must still count ---
  ['if obstacle_ahead():\n    turn_left(90)\n', 'if', true],
  ['if 2 < 3:\n    move_forward(1)\n', 'if', true],
  // `if True:` is NOT selection. It always runs, so it asks no question and
  // demonstrates nothing a lesson requiring `if` is teaching: a pupil could
  // wrap a fixed route in it and be told they had learned to choose.
  ['if True:\n    move_forward(1)\n', 'if', false],
  // `while True:` with a break is an ordinary idiom, so it still counts.
  ['while True:\n    move_forward(1)\n', 'while', true],
  ['for i in range(4):\n    move_forward(1)\n', 'for', true],
  ['def f():\n    pass\n\nf()\n', 'function_def', true],
  ['def f(n):\n    if n <= 0:\n        return 0\n    return f(n - 1)\n\nf(3)\n', 'recursion', true],
];

if (typeof sourceUses === 'function') {
  for (const [src, construct, want] of CASES) {
    const got = sourceUses(src, construct);
    const label = JSON.stringify(src.split('\n')[0]).slice(0, 34);
    check(`js ${construct} ${label} -> ${want}`, got === want, `got ${got}`);
  }

  // The real cheat, end to end: a program that DOES move (so it clears the
  // distance criterion) but whose required construct is dead. Before this gate
  // it passed 00c_look_first, a lesson whose entire point is reading a sensor.
  const cheat = 'if False:\n    pass\n\nmove_forward(3)\n';
  check('the dead-if cheat no longer satisfies the if criterion',
    sourceUses(cheat, 'if') === false, 'this is the exact 00c_look_first bypass');

  // The other bypass the audits found: a fixed route wrapped in a constant
  // condition, which satisfied every selection lesson.
  const alwaysTrue = 'if True:\n    move_forward(3)\n';
  check('a constant-true if does not satisfy the if criterion',
    sourceUses(alwaysTrue, 'if') === false, 'if True: is not a decision');
}

// The Python side must agree case for case. Read as data rather than executed
// here; tests/unit/test_grader.py runs the Python assertions themselves.
const pySrc = readFileSync(path.join(ROOT, 'src', 'robolearn', 'lessons', 'grader.py'), 'utf8');
check('python grader has the liveness check', /def _is_live\(/.test(pySrc));
check('python grader rejects constant-falsy tests', /_is_constant_falsy/.test(pySrc));
check('python grader rejects empty iterables', /_is_provably_empty_iterable/.test(pySrc));
check('python grader applies liveness in _source_uses',
  /_is_live\(node, tree\)/.test(pySrc), 'the helper must actually be used');

const jsSrc = readFileSync(path.join(WEB, 'lesson-grader.jsx'), 'utf8');
check('js grader applies liveness in sourceUses',
  /test\(n\) && isLive\(n, program\)/.test(jsSrc), 'the helper must actually be used');

// Both engines must ship the same rule. If one grows a case the other lacks,
// the same pupil program grades differently in the browser and on the desktop.
for (const [pyMarker, jsMarker, what] of [
  ['_is_constant_falsy', 'isConstantFalsy', 'constant-falsy test'],
  ['_is_provably_empty_iterable', 'isProvablyEmptyIterable', 'empty-iterable test'],
  ['_is_live', 'isLive', 'liveness entry point'],
]) {
  check(`both engines implement the ${what}`,
    pySrc.includes(pyMarker) && jsSrc.includes(jsMarker));
}

if (fails.length) {
  console.error(`qa_construct_liveness: ${fails.length} FAILED, ${pass} passed`);
  fails.forEach((f) => console.error('  FAIL ' + f));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed`);
}
