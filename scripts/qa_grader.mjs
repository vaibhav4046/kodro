/* Offline functional QA for the browser lesson grader (WebBackend slice 2).
 *
 * Loads the SHIPPED interpreter.js + motion-model.js + lesson-grader.jsx
 * under Node (same window-shim technique as qa_interpreter.mjs) and asserts:
 *
 *  1. PARITY GATE - the LESSON_DATA table embedded in lesson-grader.jsx
 *     matches a fresh extraction of world/success_criteria/hints from every
 *     lessons/library/*.yaml. A lesson YAML edit without a regeneration
 *     fails here. Regenerate with: node scripts/qa_grader.mjs --emit
 *  2. GRADING - known-good solutions PASS and known-bad submissions FAIL
 *     with the exact pupil-facing reason strings grader.py produces.
 *
 * Exit 0 on all-pass, exit 1 on any failure.
 */
import { readFileSync, readdirSync } from 'node:fs';

// --- load the shipped modules with a window shim ---------------------------
const win = {};
for (const f of ['motion-model.js', 'interpreter.js', 'lesson-grader.jsx']) {
  const src = readFileSync(new URL('../src/kodro/assets/web/' + f, import.meta.url), 'utf8');
  new Function('window', src)(win);
}
const G = win.KodroLessonGrader;

// --- YAML-subset extractor ---------------------------------------------------
// Parses exactly the shapes the lesson YAMLs use (nested maps, block lists,
// flow [..]/{..}, quoted + bare scalars, "|" literal blocks) and THROWS on
// anything else, so an exotic YAML edit fails this gate loudly instead of
// being misparsed silently. Verified against the Python schema loader
// (kodro.lessons.schema.load_library): identical output for the full
// shipped library.
function parseYamlSubset(text) {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (/^\s*#/.test(t) || t.trim() === '') continue;
    lines.push({ indent: t.match(/^ */)[0].length, text: t.trim(), raw: t, no: i + 1 });
  }
  let pos = 0;

  function parseScalar(s) {
    s = s.trim();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if (s.startsWith('"') || s.startsWith("'")) {
      const q = s[0];
      if (!s.endsWith(q) || s.length < 2) throw new Error('unterminated string: ' + s);
      const body = s.slice(1, -1);
      if (q === '"') return body.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
      return body.replace(/''/g, "'");
    }
    return s; // bare string
  }

  function parseFlow(s) {
    let i = 0;
    const ws = () => { while (i < s.length && s[i] === ' ') i++; };
    function value() {
      ws();
      if (s[i] === '[') return list();
      if (s[i] === '{') return dict();
      if (s[i] === '"' || s[i] === "'") {
        const q = s[i];
        let j = i + 1;
        while (j < s.length && !(s[j] === q && s[j - 1] !== '\\')) j++;
        if (j >= s.length) throw new Error('unterminated flow string in: ' + s);
        const out = parseScalar(s.slice(i, j + 1));
        i = j + 1;
        return out;
      }
      let j = i;
      while (j < s.length && !',]}'.includes(s[j])) j++;
      const out = parseScalar(s.slice(i, j));
      i = j;
      return out;
    }
    function list() {
      i++;
      const out = [];
      ws();
      if (s[i] === ']') { i++; return out; }
      for (;;) {
        out.push(value());
        ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ']') { i++; return out; }
        throw new Error('bad flow list at ' + i + ' in: ' + s);
      }
    }
    function dict() {
      i++;
      const out = {};
      ws();
      if (s[i] === '}') { i++; return out; }
      for (;;) {
        ws();
        const j = s.indexOf(':', i);
        if (j < 0) throw new Error('bad flow dict in: ' + s);
        const key = s.slice(i, j).trim();
        i = j + 1;
        out[key] = value();
        ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === '}') { i++; return out; }
        throw new Error('bad flow dict at ' + i + ' in: ' + s);
      }
    }
    const v = value();
    ws();
    if (i !== s.length) throw new Error('trailing flow content: ' + s.slice(i));
    return v;
  }

  function parseValueInline(v, indent) {
    v = v.trim();
    if (v === '') return parseBlock(indent + 1);
    if (v === '|' || v === '|-') { // literal block: consume deeper-indented lines
      const parts = [];
      while (pos < lines.length && lines[pos].indent > indent) { parts.push(lines[pos].raw); pos++; }
      return parts.join('\n');
    }
    if (v.startsWith('[') || v.startsWith('{')) return parseFlow(v);
    return parseScalar(v);
  }

  function parseBlock(minIndent) {
    if (pos >= lines.length || lines[pos].indent < minIndent) return {};
    const indent = lines[pos].indent;
    if (lines[pos].text.startsWith('-')) {
      const out = [];
      while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith('-')) {
        const item = lines[pos].text.replace(/^-\s*/, '');
        pos++;
        if (item === '') { out.push(parseBlock(indent + 1)); continue; }
        const m = item.match(/^([A-Za-z_][A-Za-z0-9_]*):(?:\s+(.*))?$/);
        if (m) {
          const obj = {};
          obj[m[1]] = m[2] !== undefined ? parseValueInline(m[2], indent) : parseBlock(indent + 1);
          out.push(obj);
        } else {
          out.push(item.startsWith('[') || item.startsWith('{') ? parseFlow(item) : parseScalar(item));
        }
      }
      return out;
    }
    const out = {};
    while (pos < lines.length && lines[pos].indent === indent) {
      const t = lines[pos].text;
      if (t.startsWith('-')) break;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*):(?:\s*(.*))?$/);
      if (!m) throw new Error('unrecognised YAML line ' + lines[pos].no + ': ' + t);
      pos++;
      out[m[1]] = parseValueInline(m[2] || '', indent);
    }
    return out;
  }

  const doc = parseBlock(0);
  if (pos !== lines.length) throw new Error('unparsed YAML content at line ' + lines[pos].no);
  return doc;
}

const CRIT_FIELDS = ['samples_collected', 'max_battery_used', 'no_collisions',
  'uses_construct', 'returns_to_base', 'max_steps', 'min_distance_travelled',
  'calls_in_order'];

function extractLessonData() {
  const libUrl = new URL('../src/kodro/lessons/library/', import.meta.url);
  const out = {};
  for (const f of readdirSync(libUrl).filter((f) => f.endsWith('.yaml')).sort()) {
    const doc = parseYamlSubset(readFileSync(new URL(f, libUrl), 'utf8'));
    const w = doc.world;
    const hints = doc.hints || {};
    out[doc.id] = {
      world: {
        base: w.base.map(Number),
        samples: (w.samples || []).map((s) => s.map(Number)),
        obstacles: (w.obstacles || []).map((o) => ({ x: Number(o.x), y: Number(o.y), r: Number(o.r) })),
        width: Number(w.width === undefined ? 10.0 : w.width),
        height: Number(w.height === undefined ? 10.0 : w.height),
      },
      criteria: (Array.isArray(doc.success_criteria) ? doc.success_criteria : []).map((c) => {
        const entry = {};
        for (const k of CRIT_FIELDS) if (c[k] !== undefined && c[k] !== null) entry[k] = c[k];
        return entry;
      }),
      hints: {
        onFailure: (hints.on_failure || []).map(String),
        onSuccess: (hints.on_success || []).map(String),
      },
    };
  }
  return out;
}

// --emit: print the fresh LESSON_DATA literal for pasting into
// lesson-grader.jsx after a lesson YAML change.
if (process.argv.includes('--emit')) {
  const data = extractLessonData();
  let out = '';
  for (const id of Object.keys(data)) {
    out += '    ' + JSON.stringify(id) + ': ' + JSON.stringify(data[id]) + ',\n';
  }
  process.stdout.write(out);
  process.exit(0);
}

// --- check harness -----------------------------------------------------------
let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? '  -> ' + detail : '')); }
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '   [' + detail + ']' : ''));
}

function deepEq(a, b, path) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return path + ' length ' + a.length + ' vs ' + b.length;
    for (let i = 0; i < a.length; i++) {
      const r = deepEq(a[i], b[i], path + '[' + i + ']');
      if (r) return r;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join(',') !== kb.join(',')) return path + ' keys [' + ka + '] vs [' + kb + ']';
    for (const k of ka) {
      const r = deepEq(a[k], b[k], path + '.' + k);
      if (r) return r;
    }
    return null;
  }
  return Object.is(a, b) ? null : path + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b);
}

console.log('== PARITY GATE: LESSON_DATA vs lessons/library/*.yaml ==');
{
  const fresh = extractLessonData();
  const shipped = G.LESSON_DATA;
  check('grader module loaded (window.KodroLessonGrader)', !!G && typeof G.gradeSync === 'function', '');
  check('lesson count matches the YAML library', Object.keys(shipped).length === Object.keys(fresh).length,
    Object.keys(shipped).length + ' shipped vs ' + Object.keys(fresh).length + ' in library');
  const diff = deepEq(fresh, shipped, '');
  check('embedded LESSON_DATA matches a fresh YAML extraction',
    diff === null, diff ? diff + ' (regenerate: node scripts/qa_grader.mjs --emit)' : 'identical');
}

const grade = (id, src) => G.gradeSync({ id: id, terrain: 'earth' }, src);

console.log('\n== GRADING: known-good solutions PASS ==');
{
  // 01_hello_rover: the starter IS a valid solution (2 m = 2.2% battery <= 5,
  // no obstacles to hit). This is the task's named smoke case.
  const r = grade('01_hello_rover', 'move_forward(2)\nbeep(1)\nlog("hello rover")\n');
  check('01_hello_rover good solution passes', r.ok === true && r.passed === true, JSON.stringify(r.reasons));
  check('01_hello_rover pass scores 100', r.score === 100, r.score + '/100');
  check('01_hello_rover pass carries no hint (no on_success bank)', r.hint === null, JSON.stringify(r.hint));
  check('01_hello_rover response mirrors the bridge shape',
    r.graded === true && r.lessonId === '01_hello_rover' && Array.isArray(r.events)
    && Array.isArray(r.achievements) && r.recommended === null,
    Object.keys(r).join(','));
  check('01_hello_rover trace counts 3 API calls (move, beep, log)',
    r.events.length === 3 && r.events.map((e) => e.name).join(',') === 'move_forward,beep,log',
    r.events.map((e) => e.name).join(','));
}
{
  // 02_move_turn: starter route + collect_sample() lands exactly on (4, 4).
  // Exercises the Python-frame kinematics (turn_left = anticlockwise).
  const r = grade('02_move_turn', 'move_forward(3)\nturn_left(90)\nmove_forward(3)\ncollect_sample()\n');
  check('02_move_turn solution collects the sample and passes', r.passed === true, JSON.stringify(r.reasons));
  const collect = r.events.find((e) => e.name === 'collect_sample');
  check('02_move_turn collect_sample traced as a sample event with result true',
    !!collect && collect.kind === 'sample' && collect.result === true, JSON.stringify(collect));
}
{
  // 04_selection: dodge the rock at (3,1) via y=2, grab the sample at (5,1).
  // Uses `if` for the construct criterion and obstacle_ahead() on a clear lane.
  const src = [
    'if obstacle_ahead():',
    '    turn_left(90)',
    'move_forward(1)',
    'turn_left(90)',
    'move_forward(1)',
    'turn_right(90)',
    'move_forward(3)',
    'turn_right(90)',
    'move_forward(1)',
    'turn_left(90)',
    'collect_sample()',
  ].join('\n');
  const r = grade('04_selection', src);
  check('04_selection dodge solution passes (sample + no collision + if)',
    r.passed === true && r.score === 100, JSON.stringify(r.reasons));
}
{
  // 14_counting: while + sample_detected() + collect_sample() -- the three
  // lesson verbs the interpreter routes through host.lessonApi. Fails without
  // the hook (sample_detected would be hard-coded false).
  const src = [
    'count = 0',
    'while count < 3:',
    '    move_forward(2)',
    '    if sample_detected(0.6):',
    '        collect_sample()',
    '        count = count + 1',
  ].join('\n');
  const r = grade('14_counting', src);
  check('14_counting while+sample_detected solution passes', r.passed === true, JSON.stringify(r.reasons));
}
{
  // 07_sensors: read_distance() must be METRES (Python read_distance), so the
  // guard stops one metre before the east wall, right on the sample at (5,1).
  const src = [
    'while read_distance() > 1.0:',
    '    move_forward(0.5)',
    'collect_sample()',
  ].join('\n');
  const r = grade('07_sensors', src);
  check('07_sensors metre-unit read_distance guard passes', r.passed === true, JSON.stringify(r.reasons));
}
{
  // 08_pathfinding: out around the rock, collect at (9,5), retrace home.
  // Exercises returns_to_base on the PASS side and def/function calls.
  const src = [
    'def dodge_up():',
    '    turn_left(90)',
    '    move_forward(1.5)',
    '    turn_right(90)',
    'def dodge_down():',
    '    turn_right(90)',
    '    move_forward(1.5)',
    '    turn_left(90)',
    'move_forward(2)',
    'dodge_up()',
    'move_forward(4)',
    'dodge_down()',
    'move_forward(2)',
    'collect_sample()',
    'turn_left(180)',
    'move_forward(2)',
    'dodge_down()',
    'move_forward(4)',
    'dodge_up()',
    'move_forward(2)',
  ].join('\n');
  const r = grade('08_pathfinding', src);
  // The GEOMETRY of this route is still correct: it collects the sample, avoids
  // the rock and comes home, so the three world criteria all pass. It is kept
  // for exactly that reason, as the pin on returns_to_base.
  //
  // What it no longer does is satisfy the lesson. 08 names iteration, selection
  // and decomposition; this route decomposes but never loops and never branches,
  // so it now fails on those two by name. A route that dodges a rock it cannot
  // sense is a route the pupil computed by hand, which is not pathfinding.
  check('08_pathfinding hand-computed route still solves the world',
    ['Collected', 'return to base', 'collision'].every((frag) =>
      !r.reasons.some((x) => x.indexOf(frag) >= 0)), JSON.stringify(r.reasons));
  check('08_pathfinding hand-computed route fails iteration and selection',
    r.passed === false
    && r.reasons.some((x) => x.indexOf("required 'while'") >= 0)
    && r.reasons.some((x) => x.indexOf("required 'if'") >= 0),
    JSON.stringify(r.reasons));
}
{
  // 09_recursion: the shipped starter (a recursive spiral) must pass, proving
  // the recursion detector walks def bodies like grader.py _has_recursion.
  const src = [
    'def spiral(step):',
    '    if step < 0.5:',
    '        return',
    '    move_forward(step)',
    '    turn_left(90)',
    '    spiral(step - 0.5)',
    '',
    'spiral(3.0)',
  ].join('\n');
  const r = grade('09_recursion', src);
  check('09_recursion spiral starter passes (recursion detected)', r.passed === true, JSON.stringify(r.reasons));
  check('sourceUses flags recursion / rejects its absence',
    G.sourceUses(src, 'recursion') === true && G.sourceUses('def f():\n    pass\nf()', 'recursion') === false, '');
}
{
  // 08_pathfinding names iteration, selection AND decomposition, and until now
  // checked none of them: a hard-coded list of moves scored 100/100. The taught
  // solution is a sensor-driven while loop, an if that calls a dodge() function,
  // and the same loop reused for the journey home.
  const DODGE = [
    'def dodge():',
    '    turn_left(90)',
    '    move_forward(1.5)',
    '    turn_right(90)',
    '    move_forward(2)',
    '    turn_right(90)',
    '    move_forward(1.5)',
    '    turn_left(90)',
    '',
  ].join('\n');
  const OUT = [
    'while not sample_detected():',
    '    if obstacle_ahead(1.0):',
    '        dodge()',
    '    else:',
    '        move_forward(0.5)',
    '',
    'collect_sample()',
    '',
  ].join('\n');
  const HOME = [
    'turn_left(180)',
    '',
    'while not at_base():',
    '    if obstacle_ahead(1.0):',
    '        dodge()',
    '    else:',
    '        move_forward(0.5)',
    '',
  ].join('\n');
  const starter = grade('08_pathfinding', DODGE + OUT);
  check('08_pathfinding starter fails ONLY on the return journey',
    starter.passed === false && starter.reasons.length === 1
    && starter.reasons[0] === 'Rover did not return to base.',
    JSON.stringify(starter.reasons));
  const solved = grade('08_pathfinding', DODGE + OUT + HOME);
  check('08_pathfinding taught solution passes 100/100',
    solved.passed === true && solved.score === 100, JSON.stringify(solved.reasons));
  // The bypass this lesson used to allow: a fixed route with no loop, no branch
  // and no function. It must now fail the three construct criteria by name.
  const hardCoded = [
    'for _ in range(4):', '    move_forward(1)', 'turn_right(90)', 'move_forward(1)',
    'turn_left(90)', 'move_forward(2)', 'turn_left(90)', 'move_forward(1)',
    'turn_right(90)', 'for _ in range(3):', '    move_forward(1)', 'collect_sample()',
    'turn_left(180)', 'for _ in range(8):', '    move_forward(1)',
  ].join('\n');
  const fixed = grade('08_pathfinding', hardCoded);
  check('08_pathfinding rejects a hard-coded route on all three constructs',
    fixed.passed === false
    && ['while', 'if', 'function_def'].every((c) =>
      fixed.reasons.some((x) => x.indexOf("required '" + c + "'") >= 0)),
    JSON.stringify(fixed.reasons));
}

console.log('\n== SOLVABILITY: every lesson ships an answer that passes HERE too ==');
{
  // The browser half of tests/unit/test_lesson_solutions.py. That gate proves
  // each shipped solution scores 100 in the PYTHON engine; this one proves the
  // same source scores 100 in the engine the browser actually marks with.
  //
  // Both are needed. A solution that passes in one and fails in the other is
  // precisely the divergence this release was spent removing, and it would be
  // invisible to either gate alone. It is also the worst possible bug for a
  // pupil: they would be shown an answer, type it in, and be marked wrong.
  const raw = JSON.parse(readFileSync(new URL('../src/kodro/assets/web/lessons.json', import.meta.url), 'utf8'));
  const shipped = Array.isArray(raw) ? raw : (raw.lessons || []);
  check('every lesson ships a worked solution',
    shipped.length > 0 && shipped.every((l) => typeof l.solutionCode === 'string' && l.solutionCode.trim()),
    shipped.filter((l) => !l.solutionCode).map((l) => l.id).join(', ') || '');
  let solved = 0;
  const broken = [];
  for (const l of shipped) {
    if (!l.solutionCode) continue;
    const r = grade(l.id, l.solutionCode);
    if (r.passed === true && r.score === 100) solved++;
    else broken.push(l.id + ': ' + JSON.stringify(r.reasons));
  }
  check(`all ${shipped.length} shipped solutions pass in the browser grader`,
    broken.length === 0, broken.join(' | '));
  check('the browser agrees with the Python gate on every lesson',
    solved === shipped.length, `${solved}/${shipped.length}`);
}

console.log('\n== FADED EXAMPLES: the step between a hint and the answer ==');
{
  // A completed worked example is read passively. A faded one still requires the
  // pupil to make the choice the lesson is about, which is the form the
  // worked-example literature finds actually transfers. So the fading has to
  // remove the DECISION and keep the STRUCTURE, and this asserts it does both.
  const appSrc = readFileSync(new URL('../src/kodro/assets/web/app.jsx', import.meta.url), 'utf8');
  const start = appSrc.indexOf('    function fadeSolution(code) {');
  const endIdx = appSrc.indexOf('      return { text: out.join(', start);
  const end = appSrc.indexOf('\n    }', endIdx) + '\n    }'.length;
  check('fadeSolution is present in app.jsx', start >= 0 && endIdx > start, '');
  const fade = new Function(appSrc.slice(start, end).trim() + '\nreturn fadeSolution;')();

  const raw = JSON.parse(readFileSync(new URL('../src/kodro/assets/web/lessons.json', import.meta.url), 'utf8'));
  const shipped = Array.isArray(raw) ? raw : (raw.lessons || []);
  const noBlanks = [], sameShape = [], lostComment = [], unchanged = [];
  for (const l of shipped) {
    const full = String(l.solutionCode || '').trimEnd();
    if (!full) continue;
    const r = fade(full);
    // Every lesson must have something worth blanking, or the faded step is a
    // second copy of the answer wearing a different label.
    if (r.blanks === 0) noBlanks.push(l.id);
    if (r.text === full) unchanged.push(l.id);
    // Structure survives: same number of lines, same indentation on each.
    const a = full.split('\n'), b = r.text.split('\n');
    if (a.length !== b.length) sameShape.push(l.id);
    else {
      for (let i = 0; i < a.length; i++) {
        const ia = (/^(\s*)/.exec(a[i]) || ['', ''])[1];
        const ib = (/^(\s*)/.exec(b[i]) || ['', ''])[1];
        if (ia !== ib) { sameShape.push(l.id); break; }
      }
    }
    // A comment is scaffolding, not a decision. Blanking it removes the help.
    for (const line of a) {
      if (line.trim().startsWith('#') && r.text.indexOf(line) < 0) { lostComment.push(l.id); break; }
    }
  }
  check('every shipped solution has something to blank', noBlanks.length === 0, noBlanks.join(', '));
  check('the faded form is never identical to the answer', unchanged.length === 0, unchanged.join(', '));
  check('fading preserves line count and indentation', sameShape.length === 0, sameShape.join(', '));
  check('fading never blanks a comment', lostComment.length === 0, lostComment.join(', '));

  // The specific behaviours, on a program written to exercise each branch.
  const probe = fade([
    '# a comment stays',
    'move_forward(3)',
    'if obstacle_ahead(1.0):',
    '    turn_left(90)',
    'for i in range(4):',
    '    beep()',
    'collect_sample()',
  ].join('\n'));
  check('a call argument is blanked', probe.text.indexOf('move_forward(____)') >= 0, probe.text);
  check('an if condition is blanked', probe.text.indexOf('if ____:') >= 0, probe.text);
  check('a for range is blanked but the loop variable kept',
    probe.text.indexOf('for i in ____:') >= 0, probe.text);
  check('a comment is untouched', probe.text.indexOf('# a comment stays') >= 0, probe.text);
  check('a call with no argument is left alone',
    probe.text.indexOf('collect_sample()') >= 0 && probe.text.indexOf('collect_sample(____)') < 0, probe.text);
}

console.log('\n== GRADING: known-bad submissions FAIL with grader.py reasons ==');
{
  // 01_hello_rover bad: drives into the east wall. 5 m travelled = 5.5%
  // battery + 1% collision = 6.5% > 5% limit, plus the collision itself.
  const r = grade('01_hello_rover', 'move_forward(10)\n');
  check('01_hello_rover wall-crash fails', r.ok === true && r.passed === false, JSON.stringify(r));
  check('01_hello_rover crash reasons match grader.py text',
    deepEq(r.reasons, [
      'The program does not call move_forward(), beep(), log(), in that order.',
      'Battery used 6.5% (limit 5.0%).',
      'Recorded 1 collision(s); none were expected.',
    ], '') === null, JSON.stringify(r.reasons));
  check('01_hello_rover crash scores 40 (three failed criteria)', r.score === 40, r.score + '/100');
  // The criterion the lesson is ABOUT. Deleting the two taught lines used to
  // pass at 100/100, because nothing checked the sequence the intro describes.
  const seqOnly = grade('01_hello_rover', 'move_forward(2)\n');
  check('01_hello_rover cannot be passed by deleting beep and log',
    seqOnly.passed === false && seqOnly.reasons.some((x) => x.indexOf('does not call move_forward()') >= 0),
    JSON.stringify(seqOnly.reasons));
  const seqFull = grade('01_hello_rover', 'move_forward(2)\nbeep(1)\nlog("hello rover")\n');
  check('01_hello_rover taught sequence passes', seqFull.passed === true, JSON.stringify(seqFull.reasons));
  const seqWrong = grade('01_hello_rover', 'beep(1)\nmove_forward(2)\nlog("hello rover")\n');
  check('01_hello_rover rejects the taught calls in the wrong order',
    seqWrong.passed === false, JSON.stringify(seqWrong.reasons));
  check('01_hello_rover crash surfaces the first on_failure hint',
    !!r.hint && r.hint.ruleName === 'lesson_on_failure'
    && r.hint.message === 'Check that you call all three functions, in this exact order: move_forward, beep, log.',
    JSON.stringify(r.hint));
}
{
  // 00b_repeat_square without a for-loop: the uses_construct criterion fails
  // with the exact grader.py message.
  const r = grade('00b_repeat_square', 'move_forward(2)\nturn_right(90)\nmove_forward(2)\n');
  check('00b straight-line code fails the for-construct criterion',
    r.passed === false && r.reasons.includes("Code did not use the required 'for' construct."),
    JSON.stringify(r.reasons));
}
{
  // 02_move_turn starter (no collect_sample): fails ONLY the samples criterion.
  const r = grade('02_move_turn', 'move_forward(3)\nturn_left(90)\nmove_forward(3)\n');
  check('02_move_turn starter fails with the samples reason',
    r.passed === false && r.reasons.length === 1 && r.reasons[0] === 'Collected 0 of 1 samples.',
    JSON.stringify(r.reasons));
  check('02_move_turn starter scores 80 (one failed criterion)', r.score === 80, r.score + '/100');
}
{
  // 08_pathfinding blind charge: hits the rock and never returns -- both the
  // collision and returns_to_base reasons must appear.
  const r = grade('08_pathfinding', 'for _ in range(8):\n    move_forward(1)\ncollect_sample()\n');
  check('08_pathfinding blind charge fails with sample + base + collision reasons',
    r.passed === false
    && r.reasons.includes('Collected 0 of 1 samples.')
    && r.reasons.includes('Rover did not return to base.')
    && r.reasons.some((s) => /^Recorded \d+ collision\(s\); none were expected\.$/.test(s)),
    JSON.stringify(r.reasons));
}
{
  // 00_first_drive with no driving at all: min_distance_travelled fails with
  // the exact grader.py wording.
  const r = grade('00_first_drive', 'beep(1)\n');
  check('00_first_drive stationary code fails min_distance_travelled',
    r.passed === false && r.reasons.includes('Travelled 0.0 m (minimum 3.0 m).'),
    JSON.stringify(r.reasons));
}
{
  // max_steps: no shipped lesson uses it, so pin the message on a synthetic
  // entry (injected + removed around the check).
  G.LESSON_DATA.__qa_max_steps = {
    world: { base: [1, 1], samples: [], obstacles: [], width: 6, height: 6 },
    criteria: [{ max_steps: 2 }],
    hints: { onFailure: ['Fewer calls.'], onSuccess: [] },
  };
  const r = grade('__qa_max_steps', 'beep(1)\nbeep(1)\nbeep(1)\n');
  delete G.LESSON_DATA.__qa_max_steps;
  check('max_steps criterion counts API calls with grader.py wording',
    r.passed === false && r.reasons.includes('Used 3 API calls (limit 2).'),
    JSON.stringify(r.reasons));
}

console.log('\n== ERROR PATHS mirror BridgeAPI.submit_attempt ==');
{
  const r = grade('01_hello_rover', 'move_forward(');
  check('syntax error grades as a 0-score fail', r.ok === true && r.passed === false && r.score === 0,
    JSON.stringify(r));
  check('syntax error reason carries the kind prefix', /^syntax: /.test(r.reasons[0] || ''), r.reasons[0]);
  check('syntax error still surfaces the failure hint', !!r.hint && !!r.hint.message, JSON.stringify(r.hint));
}
{
  const r = grade('01_hello_rover', 'while True:\n    pass\n');
  check('non-terminating loop grades as a 0-score fail (guard trips)',
    r.ok === true && r.passed === false && r.score === 0 && r.reasons.length === 1,
    JSON.stringify(r.reasons));
}
{
  const r = grade('no_such_lesson', 'move_forward(1)\n');
  check('unknown lesson id degrades to ok:false with a reason',
    r.ok === false && /unknown lesson/.test(r.reason || ''), JSON.stringify(r));
}

console.log('\n== ENGINE PARITY SPOT-CHECKS (Python rover semantics) ==');
{
  // Battery ledger: 12 m + 360 deg on the shared constants = 14.64% used,
  // the same golden square test_golden_traces.py pins for both engines.
  const r = grade('09_recursion', 'for i in range(4):\n    move_forward(3)\n    turn_right(90)\n');
  check('golden square grades clean in the 10x10 arena (from base 5,5)',
    r.ok === true && r.passed === false // fails only the recursion criterion
    && deepEq(r.reasons, ["Code did not use the required 'recursion' construct."], '') === null,
    JSON.stringify(r.reasons));
}
{
  // Obstacle sweep: driving at the 00c rock from the base must stop AT the
  // contact point and record exactly one collision (swept circle, grown by
  // the 0.3 m rover radius), like engine/rover.py Rover.move.
  // These two assertions previously PINNED the lesson's bug: the rock sat at
  // (1, 2.2), due north of a rover facing east, so obstacle_ahead() was never
  // true, the taught if-body was dead code, and the gate asserted exactly
  // that ("ray does not see the off-axis rock"). The rock now sits ahead at
  // (1.8, 1), so the assertions check what the lesson actually teaches.
  const r = grade('00c_look_first', 'if obstacle_ahead():\n    turn_left(90)\nmove_forward(3)\n');
  // The sensor sees the rock (0.40 m, inside the 0.5 m default), the rover
  // turns north into open arena and drives clear: the taught answer passes.
  check('00c taught starter senses the rock, turns away and passes',
    r.passed === true, JSON.stringify(r.reasons));
  const r2 = grade('00c_look_first', 'move_forward(3)\n');
  // Driving east WITHOUT the check is the mistake the lesson exists to teach:
  // one collision against the rock, stopped at the contact point.
  check('00c unguarded eastward drive registers exactly one collision',
    r2.passed === false && r2.reasons.some((s) => s.indexOf('Recorded 1 collision(s)') === 0),
    JSON.stringify(r2.reasons));
}
{
  // Touch, then back off: a rover the sweep stopped at the contact point must
  // be able to reverse away, free and uncounted, exactly as motion_model.py's
  // touch-not-trapped rule allows. The old segmentCircleHit collapsed every
  // from-contact move to t=0, so the browser grade trapped the rover at the
  // rock forever (counting a collision per attempt) while the desktop let it
  // back off. Found by the cross-engine fuzz (scripts/qa_fuzz.mjs), which
  // stays the broad net; this pins the minimal case with a name.
  const r = grade('04_selection', 'move_forward(2.0)\nmove_backward(1.0)\n');
  // One collision from the drive into the rock; the reverse is free.
  check('a rover stopped at contact can back off freely (touch, not trapped)',
    r.reasons.some((s) => s.indexOf('Recorded 1 collision(s)') === 0),
    JSON.stringify(r.reasons));
}

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) {
  console.log('FAILURES:');
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
