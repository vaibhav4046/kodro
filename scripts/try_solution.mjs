/* Grade one candidate program against one lesson, headlessly.
 *
 * The lessons each ship a worked solution (`solution_code`), and a lesson whose
 * own solution does not pass is a lesson nobody can finish. Writing those
 * solutions means running them, repeatedly, against the real grader; doing that
 * through the browser is slow and through a hand-rolled snippet is a second code
 * path. This is the same module the browser loads, driven from the shell.
 *
 * Usage:
 *   node scripts/try_solution.mjs <lessonId> <file>
 *   node scripts/try_solution.mjs <lessonId> -        # program on stdin
 *   node scripts/try_solution.mjs <lessonId>          # the lesson's own solution_code
 *
 * Exit code 0 when the program passes 100/100, 1 otherwise, so it composes with
 * shell loops. Prints the verdict either way.
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
for (const f of ['motion-model.js', 'interpreter.js', 'lesson-grader.jsx']) {
  vm.runInContext(readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
}
const G = ctx.window.KodroLessonGrader;

const lessonId = process.argv[2];
const srcArg = process.argv[3];
if (!lessonId) {
  console.error('usage: node scripts/try_solution.mjs <lessonId> [file|-]');
  process.exit(2);
}

const lessons = JSON.parse(readFileSync(path.join(WEB, 'lessons.json'), 'utf8'));
const list = Array.isArray(lessons) ? lessons : lessons.lessons || [];
const lesson = list.find((l) => l.id === lessonId);
if (!lesson) {
  console.error(`unknown lesson: ${lessonId}`);
  process.exit(2);
}

let source;
if (!srcArg) {
  source = lesson.solutionCode || lesson.solution_code || '';
  if (!source) {
    console.error(`${lessonId} has no solution_code`);
    process.exit(2);
  }
} else if (srcArg === '-') {
  source = readFileSync(0, 'utf8');
} else {
  source = readFileSync(srcArg, 'utf8');
}

const r = G.gradeSync({ id: lessonId, terrain: lesson.terrain }, source);
const ok = r.passed === true && r.score === 100;
console.log(`${lessonId}  ${ok ? 'PASS' : 'FAIL'}  ${r.score}/100`);
for (const reason of r.reasons || []) console.log('   - ' + reason);
process.exit(ok ? 0 : 1);
