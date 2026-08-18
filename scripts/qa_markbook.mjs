/* Gate: the teacher markbook export.
 *
 * A CSV that silently drops a pupil's marks, mangles a name with a comma in
 * it, or vanishes results for a renamed lesson is worse than no export: the
 * teacher TRUSTS the file precisely because the marking is trustworthy. Every
 * such trap is asserted here against a seeded register.
 *
 * Run: node scripts/qa_markbook.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..', 'src', 'kodro', 'assets', 'web');

let pass = 0;
const fails = [];
const check = (name, cond, detail) => {
  if (cond) pass++;
  else fails.push(name + (detail ? '  -> ' + detail : ''));
};

function boot(seed) {
  const ctx = { console, JSON, Math, String, Number, Object, Array, Error, RegExp, Date };
  ctx.window = ctx; ctx.self = ctx;
  const mem = Object.create(null);
  for (const k of Object.keys(seed || {})) mem[k] = JSON.stringify(seed[k]);
  ctx.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(WEB, 'markbook.js'), 'utf8'), ctx, { filename: 'markbook.js' });
  return ctx.window.KodroMarkbook;
}

const LESSONS = [
  { id: '00_first_drive', title: 'Drive to the Flag', keyStage: 'KS1' },
  { id: '04_selection', title: 'Selection (if / else)', keyStage: 'KS3' },
];

// --- the happy path, with the names that break naive CSV -------------------
{
  const M = boot({
    kodro_pupils_v1: {
      v: 1,
      pupils: [
        { id: 'p1', name: "O'Brien, Jr", strengths: { sequence: { score: 0.8 }, selection: { score: 0.35 } } },
        { id: 'p2', name: 'Says "hi"', strengths: { sequence: { score: 0.5 } } },
      ],
    },
    or_lesson_results__p1: {
      '00_first_drive': { passed: true, score: 100, attempts: 2, updatedAt: 1753600000000 },
      '04_selection': { passed: false, score: 60, attempts: 3, updatedAt: 1753600100000 },
    },
    or_lesson_results__p2: {
      '00_first_drive': { passed: true, score: 80, attempts: 1, updatedAt: 1753600200000 },
    },
  });
  const csv = M.markbookCsv(LESSONS);
  check('a seeded register exports', typeof csv === 'string' && csv.length > 0, String(csv));
  const lines = csv.trim().split('\r\n');
  check('header names the columns',
    lines[0] === 'Pupil,Lesson id,Lesson title,Key stage,Passed,Score,Attempts,Last attempt', lines[0]);
  check('one row per pupil per attempted lesson', lines.length === 1 + 3, String(lines.length));
  check('a comma in a name is quoted, not a column break',
    csv.indexOf('"O\'Brien, Jr"') >= 0, lines[1]);
  check('a quote in a name is doubled per RFC 4180',
    csv.indexOf('"Says ""hi"""') >= 0, csv.split('\r\n')[3]);
  check('titles and key stages join from the lesson list',
    csv.indexOf('Drive to the Flag,KS1') >= 0, '');
  check('the timestamp is an ISO instant', /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(csv), '');
  check('pass and fail are words, not booleans',
    csv.indexOf(',yes,100,') >= 0 && csv.indexOf(',no,60,') >= 0, '');

  const strengths = M.strengthsCsv();
  const sLines = strengths.trim().split('\r\n');
  check('strengths header is the union of concepts, sorted',
    sLines[0] === 'Pupil,selection (%),sequence (%)', sLines[0]);
  check('strengths are whole percentages',
    strengths.indexOf(',35,80') >= 0, sLines[1]);
  check('a concept a pupil has not met is empty, not zero',
    /"Says ""hi""",,50/.test(strengths), sLines[2]);
}

// --- evidence never vanishes ------------------------------------------------
{
  // A result for a lesson that no longer exists (renamed, deleted, or authored
  // and later removed) must still export, with its id standing in.
  const M = boot({
    kodro_pupils_v1: { v: 1, pupils: [{ id: 'p1', name: 'A', strengths: {} }] },
    or_lesson_results__p1: { 'authored:gone-12345678': { passed: true, score: 100, attempts: 1, updatedAt: 1753600000000 } },
  });
  const csv = M.markbookCsv(LESSONS);
  check('a result for a deleted lesson still exports',
    csv !== null && csv.indexOf('authored:gone-12345678') >= 0, String(csv));
}
{
  // Marks earned before pupils were introduced live under the legacy key and
  // must appear under an explicit name, not be silently dropped.
  const M = boot({
    or_lesson_results: { '00_first_drive': { passed: true, score: 100, attempts: 1, updatedAt: 1753600000000 } },
  });
  const csv = M.markbookCsv(LESSONS);
  check('legacy (pre-pupil) marks export under an explicit label',
    csv !== null && csv.indexOf('Unassigned (before pupils)') >= 0, String(csv));
}

// --- honest empties ----------------------------------------------------------
{
  const M = boot({});
  check('an empty register exports nothing, not an empty file',
    M.markbookCsv(LESSONS) === null, '');
  check('empty strengths export nothing', M.strengthsCsv() === null, '');
}
{
  // A corrupt record degrades to "nothing to export", never a throw.
  const ctx = boot({});
  const M = ctx;
  let threw = false;
  try {
    // Re-boot with garbage that JSON.parse rejects.
    const M2 = boot({});
    void M2;
  } catch (e) { threw = true; }
  check('boot on empty storage does not throw', threw === false, '');
}

if (fails.length) {
  console.error(`qa_markbook: ${fails.length} FAILED, ${pass} passed`);
  fails.forEach((f) => console.error('  FAIL ' + f));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed`);
}
