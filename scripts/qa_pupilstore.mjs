/* Unit test for the on-device pupil register (window.KodroPupilStore).
 *
 * The browser register must match the desktop Python store's behaviour: a
 * concept's strength is an exponential moving average (alpha = 0.3) over
 * pass(1)/fail(0) samples, the first sample sets the score verbatim, and the
 * dashboard model (heatmap) has the exact shape TeacherModal renders. This
 * loads the REAL shipped module in a fake window with an in-memory store and
 * asserts the numbers, the shape, and persistence.
 *
 *   node scripts/qa_pupilstore.mjs      # exits non-zero on any failed assertion
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'kodro', 'assets', 'web', 'pupil-store.js');

// Fake window: an in-memory localStorage-shaped store + a no-op event surface.
const backing = {};
let events = 0;
// CustomEvent is a browser global (runreport.js / memory.jsx use it bare); expose
// it both as a context global and on window so the real module's announce() works.
function FakeCustomEvent(t) { this.type = t; }
const ctx = {
  CustomEvent: FakeCustomEvent,
  window: {
    KODRO_PROJECT_STORE: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(backing, k) ? backing[k] : null),
      setItem: (k, v) => { backing[k] = String(v); },
      removeItem: (k) => { delete backing[k]; },
    },
    dispatchEvent: () => { events += 1; return true; },
    CustomEvent: FakeCustomEvent,
  },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(SRC, 'utf8'), ctx, { filename: 'pupil-store.js' });
const PS = ctx.window.KodroPupilStore;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass += 1; } else { fail += 1; console.error('FAIL  ' + msg); }
}
function near(a, b, msg) { ok(Math.abs(a - b) < 1e-9, msg + ' (got ' + a + ', want ' + b + ')'); }
function eq(a, b, msg) { ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

// 0. Alpha must match the desktop store so mastery matches across surfaces.
eq(PS.ALPHA, 0.3, 'alpha matches store.py update_concept_strength');

// 1. Fresh register: nothing to show, dashboard renders its empty state.
{
  const h = PS.heatmap();
  eq(h.ok, false, 'fresh: heatmap not ok');
  eq(h.concepts.length, 0, 'fresh: no concepts');
  eq(h.pupils.length, 0, 'fresh: no pupils');
}

// 2. First pass seeds a learner and sets score verbatim to 1.0.
{
  PS.record(['sequence', 'iteration'], true);
  const h = PS.heatmap();
  eq(h.ok, true, 'after one pass: heatmap ok');
  eq(JSON.stringify(h.concepts), JSON.stringify(['iteration', 'sequence']), 'concepts are the sorted union');
  eq(h.pupils.length, 1, 'one implicit on-device learner');
  eq(h.pupils[0].name, 'This device', 'learner is the on-device register');
  eq(h.pupils[0].active, true, 'learner is active');
  near(h.pupils[0].scores.sequence, 1.0, 'first pass sets sequence verbatim');
  near(h.pupils[0].scores.iteration, 1.0, 'first pass sets iteration verbatim');
}

// 3. A later fail blends via EMA: 0.3*0 + 0.7*1.0 = 0.7 (iteration untouched).
{
  PS.record(['sequence'], false);
  const h = PS.heatmap();
  near(h.pupils[0].scores.sequence, 0.7, 'fail blends EMA down to 0.7');
  near(h.pupils[0].scores.iteration, 1.0, 'untouched concept unchanged');
  const s = PS.load().pupils[0].strengths.sequence;
  eq(s.successes, 1, 'sequence success count');
  eq(s.failures, 1, 'sequence failure count');
}

// 4. Multi-step EMA parity: 1 -> 0.7 -> 0.49 on a fresh concept.
{
  PS.record(['functions'], true);   // 1.0
  PS.record(['functions'], false);  // 0.7
  PS.record(['functions'], false);  // 0.3*0 + 0.7*0.7 = 0.49
  const h = PS.heatmap();
  near(h.pupils[0].scores.functions, 0.49, 'three graded attempts: EMA = 0.49');
  eq(JSON.stringify(h.concepts), JSON.stringify(['functions', 'iteration', 'sequence']), 'union grows and stays sorted');
}

// 5. Empty / bogus concept lists are no-ops (no phantom learner, no throw).
{
  const before = JSON.stringify(PS.load());
  PS.record([], true);
  PS.record(null, true);
  eq(JSON.stringify(PS.load()), before, 'empty concept list records nothing');
}

// 6. Persistence: the model reads back from the injected store on every call.
{
  const h1 = JSON.stringify(PS.heatmap());
  const h2 = JSON.stringify(PS.heatmap());
  eq(h1, h2, 'heatmap is stable across reads (persisted)');
  ok(events > 0, 'record/reset announce a change event');
}

// 7. Corrupt store never throws -- falls back to an empty register.
{
  backing[PS.KEY] = '{not valid json';
  const h = PS.heatmap();
  eq(h.ok, false, 'corrupt store: safe empty heatmap');
}

// 8. reset() clears the register back to the empty state.
{
  delete backing[PS.KEY];
  PS.record(['abstraction'], true);
  ok(PS.heatmap().ok, 'seeded before reset');
  PS.reset();
  eq(PS.heatmap().ok, false, 'reset clears the register');
}

console.log(
  (fail === 0 ? 'PASS' : 'FAIL') +
  '  pupil-store: ' + pass + ' passed, ' + fail + ' failed'
);
process.exit(fail === 0 ? 0 : 1);
