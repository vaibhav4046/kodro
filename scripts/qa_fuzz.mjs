/* Fuzz gate: programs nobody wrote deliberately, faults nobody scripted.
 *
 * Three attacks, all seeded and therefore reproducible:
 *
 * 1. CROSS-ENGINE GRADING PARITY. Generate random pupil programs from the
 *    dialect both engines share, grade each against three real shipped
 *    lessons in the browser grader (lesson-grader.jsx under Node) AND the
 *    desktop pipeline (executor + tracer + grader.py via fuzz_runner.py), and
 *    assert the verdicts agree: same passed, same score, same sorted reason
 *    strings for clean runs, same error kind for crashing ones. Unit tests
 *    pin behaviours someone thought of; this compares the engines where
 *    silent divergence hides.
 *
 * 2. PARSER/RUNTIME ROBUSTNESS. Feed seeded junk (token soup, truncated
 *    programs, hostile identifiers) through the shipped compiler and grader.
 *    Every outcome must be a structured result or a structured error; no
 *    exception may escape, nothing may hang past the step caps.
 *
 * 3. STORAGE CORRUPTION. Load the real project.js and pupil-store.js against
 *    a localStorage returning seeded garbage (junk strings, truncated JSON,
 *    wrong types, __proto__ keys). Every read path must degrade to its
 *    documented fallback without throwing.
 *
 * Determinism: mulberry32 with fixed seeds, so a failure reproduces exactly.
 * Run: node scripts/qa_fuzz.mjs        (add --n=80 for a bigger program pool)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WEB = path.join(ROOT, 'src', 'kodro', 'assets', 'web');
const TMP = path.join(ROOT, 'tmp', 'fuzz');

let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else fails.push(name + (detail ? '  -> ' + String(detail).slice(0, 220) : ''));
}

// --- deterministic PRNG ------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// --- random program generator (shared dialect ONLY) --------------------------
// Restricted to commands and syntax both engines implement identically, per
// the documented divergence list in lesson-grader.jsx's header: no int()/str()
// builtins, no method calls, distances far below the move clamps.
function genProgram(rnd) {
  const lines = [];
  let counters = 0;
  const dist = () => (int(rnd, 1, 6) / 2).toFixed(1);       // 0.5 .. 3.0 m
  const angle = () => pick(rnd, [30, 45, 60, 90, 120, 180]);

  function stmt(indent, depth) {
    const pad = '    '.repeat(indent);
    const roll = rnd();
    if (roll < 0.30) lines.push(pad + `move_forward(${dist()})`);
    else if (roll < 0.40) lines.push(pad + `move_backward(${dist()})`);
    else if (roll < 0.55) lines.push(pad + (rnd() < 0.5 ? `turn_left(${angle()})` : `turn_right(${angle()})`));
    else if (roll < 0.63) lines.push(pad + 'collect_sample()');
    else if (roll < 0.68) lines.push(pad + `beep(${int(rnd, 1, 3)})`);
    else if (roll < 0.73) lines.push(pad + `log("f${int(rnd, 0, 99)}")`);
    else if (roll < 0.80 && depth < 2) {
      lines.push(pad + (rnd() < 0.5 ? 'if obstacle_ahead():' : `if ${int(rnd, 0, 3)} < ${int(rnd, 0, 3)}:`));
      block(indent + 1, depth + 1);
      if (rnd() < 0.4) {
        lines.push(pad + 'else:');
        block(indent + 1, depth + 1);
      }
    } else if (roll < 0.90 && depth < 2) {
      lines.push(pad + `for i${counters++} in range(${int(rnd, 1, 4)}):`);
      block(indent + 1, depth + 1);
    } else if (depth < 2) {
      const c = 'w' + counters++;
      const bound = int(rnd, 1, 4);
      lines.push(pad + `${c} = 0`);
      lines.push(pad + `while ${c} < ${bound}:`);
      block(indent + 1, depth + 1);
      lines.push(pad + '    '.repeat(1) + `${c} = ${c} + 1`);
    } else {
      lines.push(pad + `move_forward(${dist()})`);
    }
  }
  function block(indent, depth) {
    const n = int(rnd, 1, 3);
    for (let i = 0; i < n; i++) stmt(indent, depth);
  }

  const top = int(rnd, 2, 7);
  for (let i = 0; i < top; i++) stmt(0, 0);
  return lines.join('\n') + '\n';
}

// Fix the while-body counter increment indentation: stmt() emits it at one
// level regardless of nesting. Regenerate deterministically until the shipped
// compiler accepts the program, so only syntactically valid programs reach
// the parity comparison (invalid ones belong to the robustness attack below).
function genValidProgram(rnd, compile) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const src = genProgram(rnd);
    try { compile(src); return src; } catch { /* try the next shape */ }
  }
  return 'move_forward(1)\n'; // deterministic fallback, always valid
}

// --- load the shipped browser modules ---------------------------------------
const win = {};
for (const f of ['motion-model.js', 'interpreter.js', 'lesson-grader.jsx']) {
  new Function('window', readFileSync(path.join(WEB, f), 'utf8'))(win);
}
const G = win.KodroLessonGrader;
const RL = win.RoverLang;
check('browser grader loaded', !!G && typeof G.gradeSync === 'function');
check('browser compiler loaded', !!RL && typeof RL.compile === 'function');

// --- attack 1: cross-engine grading parity -----------------------------------
const N = Math.max(10, Math.min(200, Number((process.argv.find((a) => a.startsWith('--n=')) || '').slice(4)) || 40));
// 01 and 05 are here because they declare max_battery_used. Without a
// battery-gated lesson in this list the cross-engine fuzz never compared a
// battery-gated verdict at all, which is precisely where the two graders had
// drifted: the desktop was charging drain by the pupil's build mass and the
// browser was not, so the same program passed in one and failed in the other.
// A parity fuzz that skips the gated lessons cannot see that class of bug.
const LESSONS = ['00_first_drive', '01_hello_rover', '04_selection', '05_iteration', '13_nested_loops'];
const rndProg = mulberry32(20260726);
const programs = [];
for (let i = 0; i < N; i++) programs.push(genValidProgram(rndProg, (s) => RL.compile(s)));

const cases = [];
for (const source of programs) for (const lesson_id of LESSONS) cases.push({ lesson_id, source });

const jsResults = cases.map(({ lesson_id, source }) => {
  try {
    const r = G.gradeSync({ id: lesson_id }, source);
    if (!r.ok) return { crashed: false, harness: 'not ok: ' + r.reason };
    const errorKind = (!r.passed && r.score === 0 && r.reasons.length === 1 && /^[a-z]+:/.test(r.reasons[0]))
      ? r.reasons[0].split(':')[0] : null;
    return { passed: r.passed, score: r.score, reasons: r.reasons.slice().sort(), errorKind, crashed: false };
  } catch (e) {
    return { crashed: true, harness: String(e && e.message || e) };
  }
});
check('browser grader never threw on a generated program',
  jsResults.every((r) => !r.crashed),
  jsResults.filter((r) => r.crashed).map((r) => r.harness)[0]);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const casesFile = path.join(TMP, 'cases.json');
const outFile = path.join(TMP, 'py-results.json');
writeFileSync(casesFile, JSON.stringify({ cases }));

// Prefer an explicit override, then the repo venv, then whatever python is on
// PATH (CI installs the package into the runner's environment and has no venv).
import { existsSync } from 'node:fs';
const venvPython = process.platform === 'win32'
  ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
  : path.join(ROOT, '.venv', 'bin', 'python');
const python = process.env.PYTHON
  || (existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3'));
const py = spawnSync(python, [path.join(ROOT, 'scripts', 'fuzz_runner.py'), casesFile, outFile],
  { timeout: 15 * 60 * 1000, encoding: 'utf8' });
check('python engine graded the full case list',
  py.status === 0, (py.stderr || py.stdout || 'no output').slice(-300));

if (py.status === 0) {
  const pyResults = JSON.parse(readFileSync(outFile, 'utf8')).results;
  check('both engines returned the same case count', pyResults.length === jsResults.length,
    `${pyResults.length} vs ${jsResults.length}`);
  let agree = 0;
  const diffs = [];
  for (let i = 0; i < Math.min(pyResults.length, jsResults.length); i++) {
    const P = pyResults[i], J = jsResults[i];
    let same;
    if (P.errorKind || J.errorKind) {
      // Error texts legitimately differ between engines; the KIND must not.
      same = (P.errorKind || '').split(':')[0] === (J.errorKind || '');
    } else {
      same = P.passed === J.passed && P.score === J.score
        && JSON.stringify(P.reasons) === JSON.stringify(J.reasons);
    }
    if (same) agree++;
    else if (diffs.length < 3) diffs.push({ case: cases[i], py: P, js: J });
  }
  check(`engines agree on all ${cases.length} fuzz verdicts`, agree === cases.length,
    `${agree}/${cases.length} agree; first diff: ${JSON.stringify(diffs[0] || {}).slice(0, 400)}`);
}

// --- attack 2: parser and runtime robustness ---------------------------------
const rndJunk = mulberry32(1337);
const ALPH = 'abcdef ghij()[]{}:=+-*/<>!"\'\\\n\t.,#0123456789_';
let robust = true;
let robustDetail = '';
for (let i = 0; i < 120; i++) {
  let junk = '';
  const len = int(rndJunk, 1, 160);
  for (let k = 0; k < len; k++) junk += ALPH[Math.floor(rndJunk() * ALPH.length)];
  try {
    RL.compile(junk); // may succeed (some soup parses) or throw with a message
  } catch (e) {
    if (!(e && typeof e.message === 'string' && e.message.length)) {
      robust = false; robustDetail = 'compile threw a non-Error on: ' + JSON.stringify(junk.slice(0, 60));
      break;
    }
  }
  try {
    const r = G.gradeSync({ id: '00_first_drive' }, junk);
    if (!r || r.ok !== true) { robust = false; robustDetail = 'gradeSync not structured on junk'; break; }
  } catch (e) {
    robust = false;
    robustDetail = 'gradeSync THREW on junk ' + JSON.stringify(junk.slice(0, 60)) + ': ' + (e && e.message);
    break;
  }
}
check('120 junk programs: compiler errors are structured, grader never throws', robust, robustDetail);

// --- attack 3: storage corruption --------------------------------------------
const rndStore = mulberry32(424242);
function junkValue() {
  return pick(rndStore, [
    'not json at all', '{"half":', '[1,2,', '"', '{}', '[]', 'null', '0', '-1e999',
    '{"__proto__":{"polluted":true}}', ' ', '{"a":' + '9'.repeat(400) + '}',
    JSON.stringify({ kodroProject: 999, world: 42, programs: 'nope' }),
  ]);
}
let storageOk = true;
let storageDetail = '';
for (let round = 0; round < 30 && storageOk; round++) {
  const store = new Map();
  const storage = {
    getItem: (k) => (rndStore() < 0.5 ? junkValue() : (store.get(k) ?? null)),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const ctx = {};
  ctx.window = ctx;
  ctx.localStorage = storage;
  try {
    for (const f of ['project.js', 'pupil-store.js']) {
      new Function('window', 'localStorage', readFileSync(path.join(WEB, f), 'utf8'))(ctx, storage);
    }
    const P = ctx.window.KodroProject;
    const v = P.validate('{"kodroProject":1}');
    if (typeof v.ok !== 'boolean') { storageOk = false; storageDetail = 'validate not structured'; }
    P.serialize();            // reads every key through corrupted getItem
    const S = ctx.window.KodroPupilStore;
    if (S) { S.heatmap && S.heatmap(); }
  } catch (e) {
    storageOk = false;
    storageDetail = 'round ' + round + ': ' + (e && e.message);
  }
}
check('30 rounds of corrupted storage: every read degrades, nothing throws', storageOk, storageDetail);

// Object.prototype must be clean after the pollution attempts above.
check('no prototype pollution escaped the storage fuzz',
  !('polluted' in {}), 'Object.prototype was polluted');

if (fails.length) {
  console.error(`qa_fuzz: ${fails.length} FAILED, ${pass} passed`);
  fails.forEach((f) => console.error('  FAIL ' + f));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed (parity ${cases.length} cases across ${LESSONS.length} lessons, 120 junk, 30 storage rounds)`);
}
