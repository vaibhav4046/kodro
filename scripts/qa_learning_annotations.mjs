/* Deterministic Learning Studio gate.
 *
 * Proves that selected-code explanations cite source/trace evidence, variable
 * values come from the real interpreter, notebook notes persist locally,
 * scoped edits cannot alter unselected text, and natural-language robot
 * requirements are previewed without mutating the saved design.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const web = (name) => readFileSync(new URL('../src/kodro/assets/web/' + name, import.meta.url), 'utf8');
let pass = 0;
const failed = [];
function check(name, condition, detail) {
  if (condition) pass += 1;
  else failed.push(name + (detail ? ' -> ' + detail : ''));
}

const memory = Object.create(null);
const localStorage = {
  getItem: (key) => Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null,
  setItem: (key, value) => { memory[key] = String(value); },
  removeItem: (key) => { delete memory[key]; },
};
const win = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
new Function('window', web('interpreter.js'))(win);
new Function('window', 'localStorage', 'CustomEvent', web('learning-annotations.js'))(
  win,
  localStorage,
  function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
);
const A = win.KodroAnnotations;

// --- runtime-grounded line annotations ------------------------------------
const program = [
  'total = 0',
  'for step in range(3):',
  '    total += step',
  'move_forward(total)',
].join('\n');
const events = [];
for (const event of win.RoverLang.compile(program).run({ sensor: () => 1000 })) {
  events.push(Object.assign({ n: events.length + 1, desc: event.type + ' on line ' + event.line }, event));
}
check('interpreter events carry bounded variable snapshots',
  events.some((event) => event.vars && event.vars.total === 3 && event.vars.step === 2),
  JSON.stringify(events.slice(-3)));

const start = program.indexOf('for step');
const end = program.indexOf('move_forward');
const annotation = A.create({
  action: 'values',
  code: program,
  selection: { start, end },
  trace: events,
  context: 'Loop lesson',
});
check('selection maps to the visible line range',
  annotation.selection.startLine === 2 && annotation.selection.endLine === 3,
  JSON.stringify(annotation.selection));
check('loop explanation is deterministic',
  annotation.claims.some((claim) => /repeats the indented block/.test(claim.text)),
  JSON.stringify(annotation.claims));
check('every explanation claim has its own source',
  annotation.claims.length > 0 && annotation.claims.every((claim) => /^.+/.test(claim.source || '')),
  JSON.stringify(annotation.claims));
const values = Object.fromEntries(annotation.values.map((row) => [row.name, row.value]));
check('recorded values include the final loop variable', values.step === '2', JSON.stringify(values));
check('recorded values include the computed total', values.total === '3', JSON.stringify(values));
check('each variable value cites a recorded step',
  annotation.values.every((row) => /Recorded run · step \d+/.test(row.source)),
  JSON.stringify(annotation.values));

// The exact control-flow failure from the audit: line 3 is not in the if.
const branchCode = 'if obstacle_ahead():\n    turn_left(90)\nmove_forward(3)';
const branch = A.create({
  action: 'explain',
  code: branchCode,
  selection: { start: 0, end: branchCode.indexOf('\n') },
  trace: [],
});
check('if annotation states the indentation boundary',
  branch.claims.some((claim) => /Line 3 is back at the same indentation/.test(claim.text)),
  JSON.stringify(branch.claims));
check('if annotation never claims the unindented move is skipped',
  !branch.claims.some((claim) => /skip(s|ped)? the move/i.test(claim.text)),
  JSON.stringify(branch.claims));

const failure = A.create({
  action: 'failure',
  code: program,
  selection: { start: 0, end: 9 },
  trace: events,
  failure: 'Travelled 1.0 m (minimum 3.0 m).',
  failureSource: 'Lesson grader · last attempt',
});
check('failure annotation cites the exact grader reason',
  failure.claims.some((claim) => claim.text === 'Travelled 1.0 m (minimum 3.0 m).' && /Lesson grader/.test(claim.source)),
  JSON.stringify(failure.claims));

const hint = A.create({
  action: 'hint',
  code: program,
  selection: { start: 0, end: 9 },
  hint: 'Increase the distance by one metre.',
  hintSource: 'Active lesson · authored hint',
});
check('hint annotation cites the authored lesson hint',
  hint.claims.some((claim) => claim.text === 'Increase the distance by one metre.' && /authored hint/.test(claim.source)),
  JSON.stringify(hint.claims));

// --- local notebook --------------------------------------------------------
let notes = A.save(annotation, 'The loop ends with total = 3.');
check('annotation saves to the local notebook', notes.length === 1, JSON.stringify(notes));
check('learner note persists with the evidence', notes[0].note === 'The loop ends with total = 3.', notes[0].note);
notes = A.updateNote(annotation.id, 'Try range(4) next.');
check('learner note can be revised', notes[0].note === 'Try range(4) next.', notes[0].note);
notes = A.remove(annotation.id);
check('one notebook entry can be removed without clearing storage', notes.length === 0, JSON.stringify(notes));

// --- guarded "change only this section" ----------------------------------
const editProgram = 'speed = 20\nmove_forward(1)\nprint(speed)';
const selectedStart = editProgram.indexOf('move_forward');
const selectedEnd = selectedStart + 'move_forward(1)'.length;
const scope = A.makeEditScope(editProgram, { start: selectedStart, end: selectedEnd });
const applied = A.applyScopedEdit(editProgram, scope, 'move_forward(2)');
check('scoped edit compiles and applies', applied.ok === true, JSON.stringify(applied));
check('scoped edit preserves every character before the selection',
  applied.ok && applied.code.slice(0, scope.before.length) === scope.before, applied.code);
check('scoped edit preserves every character after the selection',
  applied.ok && applied.code.slice(applied.code.length - scope.after.length) === scope.after, applied.code);
check('scoped edit changes only the requested fragment',
  applied.ok && applied.code === 'speed = 20\nmove_forward(2)\nprint(speed)', applied.code);
check('stale selection is refused',
  A.applyScopedEdit(editProgram + '\n# newer work', scope, 'move_forward(2)').ok === false, '');
check('invalid scoped result is refused',
  A.applyScopedEdit(editProgram, scope, 'move_forward(').ok === false, '');

// --- structured robot requirement preview --------------------------------
const robotCtx = {
  window: {},
  console,
  localStorage,
  document: { createElement: () => ({}) },
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
};
robotCtx.window.dispatchEvent = () => {};
robotCtx.window.addEventListener = () => {};
robotCtx.React = {
  createElement: () => null,
  Fragment: 'Fragment',
  useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
};
vm.createContext(robotCtx);
vm.runInContext(web('motion-model.js'), robotCtx, { filename: 'motion-model.js' });
vm.runInContext(web('RobotLab.jsx'), robotCtx, { filename: 'RobotLab.jsx' });
const beforePreview = memory.kodro_robot_v2 || null;
const preview = robotCtx.window.RobotLab.previewFromText(
  'Build a Mars exploration rover with four motors, ultrasonic, camera, a 30 minute battery, and carry 2 kg payload',
);
check('robot preview does not mutate the saved build', (memory.kodro_robot_v2 || null) === beforePreview, '');
check('robot preview fits four motors', preview.spec.actuators.includes('motors4') && !preview.spec.actuators.includes('motors2'), JSON.stringify(preview.spec));
check('robot preview fits requested sensors', preview.spec.sensors.includes('ultrasonic') && preview.spec.sensors.includes('camera'), JSON.stringify(preview.spec));
check('robot preview parses runtime as structured data', preview.requirements.runtimeMin === 30, JSON.stringify(preview.requirements));
check('robot preview parses payload as structured data', preview.requirements.payloadKg === 2, JSON.stringify(preview.requirements));
check('every parsed requirement has a visible status',
  preview.checks.length >= 5 && preview.checks.every((row) => ['met', 'unmet', 'unresolved'].includes(row.status)),
  JSON.stringify(preview.checks));
check('unsupported payload is disclosed, not silently claimed',
  preview.checks.some((row) => row.id === 'payload' && row.status === 'unresolved'),
  JSON.stringify(preview.checks));

if (failed.length) {
  console.error(`qa_learning_annotations: ${failed.length} failed, ${pass} passed`);
  failed.forEach((failureName) => console.error('FAIL  ' + failureName));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed`);
}
