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
  const src = readFileSync(new URL('../src/robolearn/assets/web/' + f, import.meta.url), 'utf8');
  new Function('window', src)(win);
}
const G = win.KodroLessonGrader;

// --- YAML-subset extractor ---------------------------------------------------
// Parses exactly the shapes the lesson YAMLs use (nested maps, block lists,
// flow [..]/{..}, quoted + bare scalars, "|" literal blocks) and THROWS on
// anything else, so an exotic YAML edit fails this gate loudly instead of
// being misparsed silently. Verified against the Python schema loader
// (robolearn.lessons.schema.load_library): identical output for the full
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
  'uses_construct', 'returns_to_base', 'max_steps', 'min_distance_travelled'];

function extractLessonData() {
  const libUrl = new URL('../src/robolearn/lessons/library/', import.meta.url);
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
  check('08_pathfinding around-the-rock round trip passes (returns_to_base)',
    r.passed === true, JSON.stringify(r.reasons));
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

console.log('\n== GRADING: known-bad submissions FAIL with grader.py reasons ==');
{
  // 01_hello_rover bad: drives into the east wall. 5 m travelled = 5.5%
  // battery + 1% collision = 6.5% > 5% limit, plus the collision itself.
  const r = grade('01_hello_rover', 'move_forward(10)\n');
  check('01_hello_rover wall-crash fails', r.ok === true && r.passed === false, JSON.stringify(r));
  check('01_hello_rover crash reasons match grader.py text',
    deepEq(r.reasons, [
      'Battery used 6.5% (limit 5.0%).',
      'Recorded 1 collision(s); none were expected.',
    ], '') === null, JSON.stringify(r.reasons));
  check('01_hello_rover crash scores 60 (two failed criteria)', r.score === 60, r.score + '/100');
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
  const r = grade('00c_look_first', 'if obstacle_ahead():\n    turn_left(90)\nmove_forward(3)\n');
  // From (1,1) heading east, the rock is NORTH at (1,2.2) -- obstacle_ahead
  // is false, the if does not fire, and the eastward drive is clear: passes.
  check('00c clear-lane drive passes (ray does not see the off-axis rock)',
    r.passed === true, JSON.stringify(r.reasons));
  const r2 = grade('00c_look_first', 'turn_left(90)\nmove_forward(3)\n');
  // Now the drive is NORTH into the rock: one collision, stopped short.
  check('00c northward drive registers exactly one collision',
    r2.passed === false && r2.reasons.some((s) => s.indexOf('Recorded 1 collision(s)') === 0),
    JSON.stringify(r2.reasons));
}

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) {
  console.log('FAILURES:');
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
