/* Gate: an error a pupil sees must be one they can act on.
 *
 * The interpreter's own messages are accurate and useless to a child. This gate
 * drives REAL programs through the REAL interpreter, catches whatever it
 * actually raises, and asserts the translation layer turns it into something
 * actionable. Hand-written expected strings would prove only that the table
 * matches itself.
 *
 * Two rules are asserted as hard invariants, because both are ways this feature
 * could quietly become a liar:
 *
 *   1. An unrecognised message passes through UNCHANGED. Inventing a friendly
 *      explanation for an error we did not identify would be worse than the raw
 *      text, because it would be confidently wrong.
 *   2. A suggested spelling correction must name a command that actually
 *      exists. "Did you mean move_forwards?" sends a child in a circle.
 *
 * Run: node scripts/qa_pupil_errors.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..', 'src', 'kodro', 'assets', 'web');

const ctx = { console, JSON, Math, String, Number, Object, Array, Error, RegExp, Date };
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['interpreter.js', 'pupil-errors.js']) {
  vm.runInContext(readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
}
const RL = ctx.window.RoverLang;
const E = ctx.window.KodroPupilErrors;

let pass = 0;
const fails = [];
const check = (name, cond, detail) => {
  if (cond) pass++;
  else fails.push(name + (detail ? '  -> ' + detail : ''));
};

check('pupil-errors.js is loaded', !!E);

// Run a program and return whatever the interpreter actually raised.
function errorFrom(src) {
  const host = { sensor: () => 0, lessonApi: () => null };
  try {
    const gen = RL.compile(src).run(host);
    let n = 0;
    for (const ev of gen) { if (++n > 200000) break; void ev; }
    return null;
  } catch (e) {
    return (e && e.message) ? e.message : String(e);
  }
}

// [program, what the explanation must contain, what the hint must contain]
const CASES = [
  ['move_forward(3',                     /bracket is missing/i,        /Every \( needs a \)/i],
  ['move_forward(1))',                   /one \) too many/i,           /Count the brackets/i],
  ['if True\n    move_forward(1)',       /if line needs a colon/i,     /Type a :/i],
  ['for i in range(3)\n    move_forward(1)', /for line needs a colon/i, /Type a :/i],
  ['x = ',                               /stops before it is finished/i, /missing/i],
  ['move_foward(2)',                     /does not know a command/i,   /Did you mean move_forward\?/],
  ['collect_smaple()',                   /does not know a command/i,   /Did you mean collect_sample\?/],
  ['turn_lft(90)',                       /does not know a command/i,   /Did you mean turn_left\?/],
  ['while True:\n    pass',              /still going after a very long time/i, /loop is probably never finishing/i],
];

for (const [src, wantText, wantHint] of CASES) {
  const raw = errorFrom(src);
  const label = JSON.stringify(src.slice(0, 26));
  if (!raw) { check(`${label} raises an error at all`, false, 'program ran clean'); continue; }
  const r = E.explain(raw, { readingAge: 6 });
  check(`${label} is translated`, r.matched === true, `raw was: ${raw}`);
  check(`${label} explains it`, wantText.test(r.text), r.text);
  check(`${label} says what to do`, wantHint.test(r.hint), r.hint);
  // The original must survive, so a teacher can still see the real message.
  check(`${label} keeps the original`, r.original === raw, r.original);
}

// INVARIANT 1: never invent an explanation.
{
  const odd = 'some error nobody has written a rule for yet';
  const r = E.explain(odd);
  check('an unrecognised error passes through unchanged',
    r.matched === false && r.text === odd && r.hint === '', JSON.stringify(r));
}

// INVARIANT 2: a suggestion must name a real command.
{
  const bad = [];
  for (const typo of ['move_foward', 'move_forwrd', 'turn_lft', 'turn_rihgt', 'collect_smaple',
    'colect_sample', 'obstacle_ahed', 'read_distnce', 'sampl_detected', 'beeep']) {
    const s = E.nearestCommand(typo);
    if (s && E.PUPIL_API.indexOf(s) < 0) bad.push(typo + ' -> ' + s);
  }
  check('every suggested spelling is a real command', bad.length === 0, bad.join(', '));
}

// A word nothing like a command must get NO suggestion rather than a wild one.
{
  const wild = ['zzqqxx', 'banana', 'qwertyuiop'];
  const wrong = wild.filter((w) => E.nearestCommand(w) !== null);
  check('a word unlike any command gets no suggestion', wrong.length === 0,
    wrong.map((w) => w + ' -> ' + E.nearestCommand(w)).join(', '));
}

// Short names must not be "corrected" into each other: led/len/log are all real
// and one letter apart, so a threshold that ignored length would be actively
// harmful.
{
  const realShort = ['led', 'log', 'len', 'say', 'int', 'str', 'abs', 'min', 'max'];
  const moved = realShort.filter((w) => E.nearestCommand(w) !== null);
  check('real short commands are never "corrected"', moved.length === 0,
    moved.map((w) => w + ' -> ' + E.nearestCommand(w)).join(', '));
}

// Every name the cheatsheet documents must be suggestible, or a pupil who
// misspells it gets no help.
{
  const doc = readFileSync(path.join(HERE, '..', 'docs', 'pupils', 'api-cheatsheet.md'), 'utf8');
  const documented = [...doc.matchAll(/`([a-z_]+)\(/g)].map((m) => m[1]);
  const missing = [...new Set(documented)].filter((n) => E.PUPIL_API.indexOf(n) < 0);
  check('every documented command is in the spelling dictionary',
    missing.length === 0, missing.join(', '));
}

if (fails.length) {
  console.error(`qa_pupil_errors: ${fails.length} FAILED, ${pass} passed`);
  fails.forEach((f) => console.error('  FAIL ' + f));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed`);
}
