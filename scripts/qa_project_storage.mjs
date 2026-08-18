/* Gate: opening a project must never claim success after a partial write.
 *
 * KodroProject.apply() writes thirteen storage keys through a helper that
 * swallowed every exception, then returned ok:true unconditionally. On a
 * device with a full or disabled localStorage an arbitrary subset of the
 * document landed, the UI announced "Project loaded" and force-reloaded the
 * studio into a mixture of the old and new projects.
 *
 * Driven behaviourally against the real module with a storage that refuses
 * writes, so a future rewrite has to actually notice the failure rather than
 * match a particular shape of code.
 *
 * Run: node scripts/qa_project_storage.mjs
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
function check(name, cond, detail) {
  if (cond) pass++;
  else fails.push(name + (detail ? '  -> ' + detail : ''));
}

/** Build a fresh module context whose storage fails after `allow` writes. */
function load(allow) {
  const data = new Map();
  let writes = 0;
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (writes++ >= allow) {
        const e = new Error('QuotaExceededError');
        e.name = 'QuotaExceededError';
        throw e;
      }
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
  };
  const ctx = { console, JSON, Date, Math, String, Number, Object, Array, Error };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.localStorage = storage;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(WEB, 'project.js'), 'utf8'), ctx, {
    filename: 'project.js',
  });
  return { P: ctx.window.KodroProject, data };
}

// A minimal valid document. serialize() on a blank store gives us one that the
// module's own validator accepts, which avoids hand-writing a schema here.
const seed = load(Infinity);
const DOC = seed.P.serialize();
check('module exposes apply/serialize', typeof seed.P.apply === 'function' && DOC.length > 0);

// ---- healthy storage: success is still success ------------------------------
{
  const { P } = load(Infinity);
  const r = P.apply(DOC);
  check('healthy storage still reports ok', r.ok === true, JSON.stringify(r.errors || []));
  check('healthy storage reports no partial flag', !r.partial, String(r.partial));
  check('healthy storage lists no failed keys', (r.failedKeys || []).length === 0);
}

// ---- storage refuses everything --------------------------------------------
{
  const { P } = load(0);
  const r = P.apply(DOC);
  check('total storage failure is NOT reported as ok', r.ok === false, JSON.stringify(r));
  check('total storage failure is flagged partial', r.partial === true);
  check('total storage failure names the dropped keys', (r.failedKeys || []).length > 0);
  const msg = (r.errors || []).join(' ');
  check('total storage failure explains itself to a human',
    /storage/i.test(msg) && /full|disabled/i.test(msg), msg);
  check('total storage failure does not claim the file was invalid',
    !/not a kodro|invalid|corrupt/i.test(msg), msg);
}

// ---- storage dies PART WAY through: the dangerous case -----------------------
// Some keys landed and some did not. This is the state that used to be
// announced as "Project loaded" and then reloaded into.
{
  const { P } = load(4);
  const r = P.apply(DOC);
  check('partial write is NOT reported as ok', r.ok === false, JSON.stringify(r));
  check('partial write is flagged partial', r.partial === true);
  check('partial write reports fewer failures than the total key count',
    (r.failedKeys || []).length > 0 && (r.failedKeys || []).length < 13,
    String((r.failedKeys || []).length));
}

// ---- the caller must not announce success or reload on a partial ------------
const hooks = readFileSync(path.join(WEB, 'hooks.jsx'), 'utf8');
const applyFn = hooks.slice(hooks.indexOf('function applyProjectText'),
  hooks.indexOf('async function openProjectClick'));
check('caller branches on the partial flag', /r\.partial/.test(applyFn), 'applyProjectText');
check('caller does not call "Project loaded" before checking ok',
  applyFn.indexOf('Project loaded') > applyFn.indexOf('if (!r.ok)'),
  'the success message must sit after the failure guard');
check('caller does not mislabel a partial write as a bad file',
  /partial[\s\S]{0,400}out of storage/i.test(applyFn), 'expected a storage-specific message');

// The reload is what commits the user to the half-applied mixture, so it must
// be unreachable when the write failed. It sits after the early return.
check('reload happens only on the success path',
  applyFn.indexOf('location.reload') > applyFn.indexOf('return;'),
  'location.reload must be after the failure return');

if (fails.length) {
  console.error(`qa_project_storage: ${fails.length} FAILED, ${pass} passed`);
  fails.forEach((f) => console.error('  FAIL ' + f));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed`);
}
