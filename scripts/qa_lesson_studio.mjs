/* Gate: the Lesson Studio's document, validator and on-device store.
 *
 * Authored lessons are the one part of Kodro whose input comes from outside the
 * project. A built-in lesson was written by us and reviewed; an authored one
 * arrives as a file from a stranger, or from a teacher who mistyped a number, or
 * from a browser whose storage is full. Every one of those has to end in a
 * refusal with a reason rather than a broken lesson or a thrown exception.
 *
 * The rule the whole design rests on, asserted here: an authored lesson is
 * graded by exactly the same code as a shipped one. Not similar code. The same
 * dispatch, the same failure strings, the same scoring. If that ever stops being
 * true, an authored lesson becomes a second-class thing that looks like a lesson
 * and marks like nothing in particular.
 *
 * Runs headlessly in a bare vm with a fake localStorage, so the branches a
 * browser will not reproduce on demand (quota exhausted, corrupt record) are
 * driven directly.
 *
 * Run: node scripts/qa_lesson_studio.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WEB = path.join(ROOT, 'src', 'kodro', 'assets', 'web');

let pass = 0;
const fails = [];
const check = (name, cond, detail) => {
  if (cond) pass++;
  else fails.push(name + (detail ? '  -> ' + detail : ''));
};

// Build a fresh sandbox with a storage shim. `writeBudget` lets a test starve
// the store mid-save, which is the only honest way to assert we report the
// failure instead of pretending the lesson was kept.
function boot(writeBudget) {
  const ctx = { console, JSON, Math, String, Number, Object, Array, Error, RegExp, Date };
  ctx.window = ctx;
  ctx.self = ctx;
  const mem = Object.create(null);
  let writes = 0;
  ctx.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => {
      if (writeBudget !== undefined && writes >= writeBudget) {
        const e = new Error('QuotaExceededError');
        e.name = 'QuotaExceededError';
        throw e;
      }
      writes++;
      mem[k] = String(v);
    },
    removeItem: (k) => { delete mem[k]; },
  };
  // Deterministic clock so ids are stable and the gate cannot flake on time.
  ctx.KODRO_NOW = () => 1700000000000;
  vm.createContext(ctx);
  for (const f of ['motion-model.js', 'interpreter.js', 'lesson-grader.jsx', 'lesson-studio.js']) {
    vm.runInContext(readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  }
  return { ctx, S: ctx.window.KodroLessonStore, G: ctx.window.KodroLessonGrader, mem };
}

const { S, G } = boot();
check('lesson-studio.js exposes KodroLessonStore', !!S);
check('the grader exposes the authored-lesson seam',
  !!(G && G.getEntry && G.registerAuthored && G.unregisterAuthored));

// --- the default document is itself a working lesson ---------------------
// The Studio opens on this. If it is not valid and passable, the first thing a
// teacher sees is a broken example.
{
  const doc = S.blank(1);
  const v = S.validate(doc);
  check('the blank lesson is valid', v.ok, JSON.stringify(v.errors));
  const saved = S.save(doc);
  check('the blank lesson saves', saved.ok, JSON.stringify(saved.errors));
  const r = G.gradeSync({ id: doc.id, terrain: doc.terrain }, doc.solutionCode);
  check('the blank lesson is passed by its own worked solution',
    r.passed === true && r.score === 100, JSON.stringify(r.reasons));
  const starter = G.gradeSync({ id: doc.id, terrain: doc.terrain }, doc.starterCode);
  check('the blank lesson is NOT already passed by its starter',
    starter.passed === false, JSON.stringify(starter.reasons));
}

// --- identical grading to a built-in --------------------------------------
// The load-bearing claim. An authored lesson with the same world and criteria as
// a shipped one must produce verdicts indistinguishable from it, on both the
// pass and the fail side, or "graded by the same engine" is marketing.
{
  const { S: S2, G: G2 } = boot();
  const twin = {
    kodroLesson: 1, savedAt: 0,
    id: 'authored:twin-of-00b-1a2b3c4d',
    title: 'Twin of the square lesson', keyStage: 'KS2', concepts: ['iteration'],
    terrain: 'earth', intro: 'Drive a square.', starterCode: 'move_forward(1)\n',
    solutionCode: 'for side in range(4):\n    move_forward(2)\n    turn_right(90)\n',
    readingAge: null, glossary: {}, maxLines: 40,
    world: { base: [3, 3], samples: [], obstacles: [], width: 8, height: 8 },
    criteria: [{ min_distance_travelled: 6 }, { uses_construct: 'for' }, { no_collisions: true }],
    hints: { onFailure: ['Use a for loop.'], onSuccess: [] },
  };
  const saved = S2.save(twin);
  check('a hand-written authored lesson saves', saved.ok, JSON.stringify(saved.errors));
  const good = 'for side in range(4):\n    move_forward(2)\n    turn_right(90)\n';
  const bad = 'move_forward(6)\n';
  for (const [label, src] of [['a passing program', good], ['a failing program', bad]]) {
    const builtIn = G2.gradeSync({ id: '00b_repeat_square' }, src);
    const authored = G2.gradeSync({ id: twin.id }, src);
    check(`${label} grades identically on the authored twin`,
      builtIn.passed === authored.passed
      && builtIn.score === authored.score
      && JSON.stringify(builtIn.reasons) === JSON.stringify(authored.reasons),
      `builtin ${builtIn.score} ${JSON.stringify(builtIn.reasons)} vs authored ${authored.score} ${JSON.stringify(authored.reasons)}`);
  }
  check('a built-in lesson still wins the id lookup',
    G2.getEntry('00b_repeat_square') === G2.LESSON_DATA['00b_repeat_square']);
}

// --- every validator rule fires, by name ----------------------------------
{
  const base = () => JSON.parse(JSON.stringify(S.blank(2)));
  const cases = [
    ['not an object', 'nope', /does not contain a lesson/],
    ['missing version stamp', (() => { const d = base(); delete d.kodroLesson; return d; })(), /not a Kodro lesson/],
    ['wrong version stamp', (() => { const d = base(); d.kodroLesson = 99; return d; })(), /different version/],
    ['bad id', (() => { const d = base(); d.id = 'my-lesson'; return d; })(), /Lesson id must look like/],
    ['built-in id', (() => { const d = base(); d.id = '00_first_drive'; return d; })(), /Lesson id must look like|built-in/],
    ['no title', (() => { const d = base(); d.title = ''; return d; })(), /needs a title/],
    ['bad key stage', (() => { const d = base(); d.keyStage = 'KS9'; return d; })(), /Key stage must be/],
    ['no computing concept', (() => { const d = base(); d.concepts = []; return d; })(), /main computing concept/],
    ['unknown computing concept', (() => { const d = base(); d.concepts = ['telepathy']; return d; })(), /Computing concepts must be/],
    ['unsupported world', (() => { const d = base(); d.terrain = 'city'; return d; })(), /World must be one of/],
    ['no intro', (() => { const d = base(); d.intro = ''; return d; })(), /needs an introduction/],
    ['no starter', (() => { const d = base(); d.starterCode = ''; return d; })(), /needs a starter program/],
    ['no criteria', (() => { const d = base(); d.criteria = []; return d; })(), /needs at least one goal/],
    ['unknown criterion', (() => { const d = base(); d.criteria = [{ nonsense: 1 }]; return d; })(), /unknown rule/],
    ['unknown construct', (() => { const d = base(); d.criteria = [{ uses_construct: 'goto' }]; return d; })(), /unknown construct/],
    ['two keys in one goal', (() => { const d = base(); d.criteria = [{ no_collisions: true, max_steps: 4 }]; return d; })(), /exactly one thing/],
    ['sample outside the arena', (() => { const d = base(); d.world.samples = [[99, 99]]; return d; })(), /outside the arena/],
    ['base outside the arena', (() => { const d = base(); d.world.base = [99, 99]; return d; })(), /base is outside/],
    ['rock with no radius', (() => { const d = base(); d.world.obstacles = [{ x: 2, y: 2, r: 0 }]; return d; })(), /radius between/],
    ['rock on the base', (() => { const d = base(); d.world.obstacles = [{ x: 1, y: 1, r: 0.5 }]; return d; })(), /on top of the base/],
    ['rock crossing a wall', (() => { const d = base(); d.world.obstacles = [{ x: 0.2, y: 5, r: 0.5 }]; return d; })(), /crosses the arena wall/],
    ['sample inside a rock', (() => { const d = base(); d.world.obstacles = [{ x: 4, y: 1, r: 0.5 }]; return d; })(), /cannot collect it/],
    ['two samples on top of each other', (() => { const d = base(); d.world.samples = [[4, 1], [4, 1]]; d.criteria = [{ samples_collected: 2 }]; return d; })(), /on top of sample/],
    ['arena too small', (() => { const d = base(); d.world.width = 0.5; return d; })(), /width must be between/],
    ['more samples wanted than placed', (() => { const d = base(); d.criteria = [{ samples_collected: 5 }]; return d; })(), /only has 1/],
  ];
  for (const [name, doc, re] of cases) {
    const v = S.validate(doc);
    check(`refuses: ${name}`, v.ok === false && v.errors.some((e) => re.test(e)),
      JSON.stringify(v.errors));
  }
  // A lesson with no hints is allowed but must be called out, because the pupil
  // who needs one has nothing to fall back on.
  const noHints = base();
  noHints.hints = { onFailure: [], onSuccess: [] };
  const vh = S.validate(noHints);
  check('warns (not refuses) when a lesson has no hints',
    vh.ok === true && vh.warnings.some((w) => /nothing to fall back on/.test(w)),
    JSON.stringify(vh.warnings));

  const repeatedGoal = base();
  repeatedGoal.criteria = [{ no_collisions: true }, { no_collisions: true }];
  const vg = S.validate(repeatedGoal);
  check('warns when the same goal is repeated',
    vg.ok === true && vg.warnings.some((w) => /repeats/.test(w)),
    JSON.stringify(vg.warnings));
}

// --- file in, file out ----------------------------------------------------
{
  const doc = S.blank(3);
  const text = S.serialize(doc);
  const back = S.parse(text);
  check('a serialised lesson parses back', back.ok, JSON.stringify(back.errors));
  check('the round trip preserves the document',
    JSON.stringify(back.doc) === JSON.stringify(doc));
  check('the filename is derived from the title',
    /\.kodrolesson$/.test(S.fileName(doc)), S.fileName(doc));

  check('non-JSON is refused with a readable reason',
    S.parse('this is not json').errors.some((e) => /not readable/.test(e)));
  check('an oversized file is refused',
    S.parse('{"kodroLesson":1,"pad":"' + 'x'.repeat(300000) + '"}').errors.some((e) => /larger than 256 KB/.test(e)));

  // A file with an extra field is not trusted, but the user is told what was
  // dropped rather than left to wonder why their field vanished.
  const withExtra = JSON.parse(text);
  withExtra.somethingElse = { run: 'rm -rf' };
  const parsed = S.parse(JSON.stringify(withExtra));
  check('unknown fields are dropped and reported',
    parsed.ok === true
    && parsed.doc.somethingElse === undefined
    && parsed.warnings.some((w) => /Ignored unrecognised field/.test(w)),
    JSON.stringify(parsed.warnings));
}

// --- storage honesty ------------------------------------------------------
{
  // Budget 0: every write throws. The save must fail loudly and must NOT claim
  // the lesson was kept. Losing a teacher's own work silently is the single
  // worst outcome this feature has.
  const { S: S3 } = boot(0);
  const r = S3.save(S3.blank(4));
  check('a refusing store makes save() fail', r.ok === false, JSON.stringify(r));
  check('the failure names the problem and suggests exporting',
    r.errors.some((e) => /would not store|storage/i.test(e)) && r.errors.some((e) => /Export it to a file/.test(e)),
    JSON.stringify(r.errors));
  check('nothing is listed after a failed save', S3.list().length === 0);
}
{
  // A corrupt record must degrade to "no lessons", not throw on every render.
  const { S: S4, ctx } = boot();
  ctx.localStorage.setItem(S4.STORAGE_KEY, '{not json at all');
  let threw = false;
  let listed = null;
  try { listed = S4.list(); } catch (e) { threw = true; }
  check('a corrupt record does not throw', threw === false);
  check('a corrupt record reads as empty', Array.isArray(listed) && listed.length === 0);
}
{
  // The cap is real, and hitting it is explained rather than silently ignored.
  const { S: S5 } = boot();
  let lastErr = [];
  for (let i = 0; i < S5.MAX_LESSONS + 2; i++) {
    const d = S5.blank(1000 + i);
    const r = S5.save(d);
    if (!r.ok) lastErr = r.errors;
  }
  check('the on-device library is capped', S5.list().length === S5.MAX_LESSONS, String(S5.list().length));
  check('hitting the cap explains what to do',
    lastErr.some((e) => /Delete one first/.test(e)), JSON.stringify(lastErr));
}

// --- hydrate: never half-register ------------------------------------------
{
  const { S: S6, G: G6, ctx } = boot();
  const good = S6.blank(5);
  const bad = JSON.parse(JSON.stringify(S6.blank(6)));
  bad.criteria = [];                       // ungradable: everything would pass
  // Write both straight past the validator, as a corrupted or downgraded file
  // would arrive.
  ctx.localStorage.setItem(S6.STORAGE_KEY, JSON.stringify({ v: 1, lessons: [good, bad] }));
  const h = S6.hydrate();
  check('hydrate registers the good lesson', h.registered.indexOf(good.id) >= 0, JSON.stringify(h.registered));
  check('hydrate rejects the ungradable one', h.rejected.some((x) => x.id === bad.id), JSON.stringify(h.rejected));
  check('the rejected lesson is NOT known to the grader', G6.getEntry(bad.id) === null);
  check('the good lesson IS known to the grader', !!G6.getEntry(good.id));
  // The exact bug this guards: a criteria-free lesson marks every submission
  // 100/100, so a pupil "passes" without writing anything.
  const sneak = G6.gradeSync({ id: bad.id }, '');
  check('an ungradable lesson cannot mark anything', sneak.ok === false, JSON.stringify(sneak));
}

// --- remove ---------------------------------------------------------------
{
  const { S: S7, G: G7 } = boot();
  const doc = S7.blank(7);
  S7.save(doc);
  check('a saved lesson is gradable', !!G7.getEntry(doc.id));
  check('remove reports success', S7.remove(doc.id) === true);
  check('a removed lesson is gone from the library', S7.list().length === 0);
  check('a removed lesson is gone from the grader', G7.getEntry(doc.id) === null);
  check('removing something absent reports false', S7.remove('authored:nope-00000000') === false);
}

// --- lesson packs ---------------------------------------------------------
//
// One lesson per file is right for one idea and wrong for a term of work. The
// pack is deliberately just a list of the SAME documents, so a lesson cannot be
// valid inside a pack and invalid outside it, and a half-broken pack must give
// up its good lessons rather than being refused whole.
{
  const { S: SP } = boot();
  const a = SP.blank(101);
  const b = SP.blank(102);
  b.title = 'Second lesson';
  b.id = SP.makeId(b.title, 102);
  const text = SP.packSerialize('Autumn term', [a, b]);

  const parsed = SP.packParse(text);
  check('a pack round-trips', parsed.ok === true, JSON.stringify(parsed.errors));
  check('the pack keeps its name', parsed.name === 'Autumn term', parsed.name);
  check('every lesson in the pack is accepted', parsed.accepted.length === 2, String(parsed.accepted.length));
  check('the pack filename is derived from its name',
    /\.kodropack$/.test(SP.packFileName('Autumn term')), SP.packFileName('Autumn term'));

  const installed = SP.packInstall(parsed.accepted);
  check('installing a pack saves every lesson', installed.saved.length === 2, JSON.stringify(installed.failed));
  check('the installed lessons are in the library', SP.list().length === 2, String(SP.list().length));

  // A single lesson handed to the pack reader, and vice versa, must be told
  // which one it is rather than failing with a generic parse error.
  const single = SP.packParse(SP.serialize(SP.blank(103)));
  check('a single lesson opened as a pack says so',
    single.ok === false && single.errors.some((e) => /single lesson, not a pack/.test(e)),
    JSON.stringify(single.errors));
  check('a pack opened as a single lesson is refused',
    SP.parse(text).ok === false, '');

  // The important one: a pack carrying one broken lesson must still yield the
  // good ones, and must name what it dropped.
  const mixed = JSON.parse(text);
  mixed.lessons.push({ kodroLesson: 1, id: 'authored:broken-00000000', title: 'Broken one', criteria: [] });
  const partial = SP.packParse(JSON.stringify(mixed));
  check('a pack with one bad lesson still yields the good ones',
    partial.ok === true && partial.accepted.length === 2, String(partial.accepted.length));
  check('the bad lesson is named, not silently dropped',
    partial.rejected.length === 1 && partial.rejected[0].title === 'Broken one'
    && partial.rejected[0].errors.length > 0,
    JSON.stringify(partial.rejected));

  check('an empty pack is refused',
    SP.packParse(JSON.stringify({ kodroPack: 1, name: 'x', lessons: [] })).ok === false, '');
  check('a wrong pack version is refused',
    SP.packParse(JSON.stringify({ kodroPack: 99, lessons: [a] })).ok === false, '');
  check('a non-JSON pack is refused with a readable reason',
    SP.packParse('nope').errors.some((e) => /not readable/.test(e)), '');
}

// --- the criterion vocabulary cannot drift --------------------------------
{
  // The Studio offers exactly the criteria the grader implements. If someone
  // adds a criterion to one side only, the form offers a goal that is silently
  // never checked, or checks one the form cannot express.
  const graderSrc = readFileSync(path.join(WEB, 'lesson-grader.jsx'), 'utf8');
  const missing = S.CRITERION_KEYS.filter((k) => graderSrc.indexOf('criterion.' + k) < 0);
  check('every criterion the Studio offers is implemented by the grader',
    missing.length === 0, missing.join(', '));
  const pySrc = readFileSync(path.join(ROOT, 'src', 'kodro', 'lessons', 'grader.py'), 'utf8');
  const missingPy = S.CRITERION_KEYS.filter((k) => pySrc.indexOf('criterion.' + k) < 0);
  check('every criterion the Studio offers is implemented by the Python grader',
    missingPy.length === 0, missingPy.join(', '));
}

// --- authoring UI contracts -----------------------------------------------
// Static contracts keep the precision editor and pupil-preview path from being
// accidentally removed while the data model continues to pass headless tests.
{
  const studioUi = readFileSync(path.join(WEB, 'lesson-studio.jsx'), 'utf8');
  check('the Studio exposes four connected authoring stages',
    /ls-pipeline/.test(studioUi) && /Check and try/.test(studioUi));
  check('map markers can be selected and edited precisely',
    /ls-inspector/.test(studioUi) && /Select to edit/.test(studioUi));
  check('a checked lesson can be saved and opened as a pupil',
    /Save and try as a pupil/.test(studioUi) && /props\.onOpen/.test(studioUi));
  check('goal options have distinct accessible labels',
    /Limit battery use to/.test(studioUi) && /Limit program to/.test(studioUi));
}

if (fails.length) {
  console.error(`qa_lesson_studio: ${fails.length} FAILED, ${pass} passed`);
  fails.forEach((f) => console.error('  FAIL ' + f));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed`);
}
