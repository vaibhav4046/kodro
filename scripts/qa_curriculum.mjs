/* Focused regression gate: teaching plans must open real, passable challenges. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const web = 'src/kodro/assets/web/';
let states = [], cursor = 0, started;
const ctx = { console, React: {
  useState(init) { const i = cursor++; if (!(i in states)) states[i] = init; return [states[i], v => { states[i] = v; }]; },
  createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity) }; }
}};
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(web + 'vendor/babel.min.js', 'utf8'), ctx);
for (const name of ['motion-model.js', 'interpreter.js', 'lesson-grader.jsx']) vm.runInContext(fs.readFileSync(web + name, 'utf8'), ctx);
vm.runInContext(ctx.Babel.transform(fs.readFileSync(web + 'curriculum.jsx', 'utf8'), {presets:['react']}).code, ctx);
const lessons = JSON.parse(fs.readFileSync(web + 'lessons.json', 'utf8'));
const {blocks, planText} = ctx.KodroCurriculumData;
const ids = blocks.flatMap(b => b.lessons.map(l => l.id));
assert.equal(new Set(ids).size, lessons.length);
assert.equal(ids.length, lessons.length);
const scheme = fs.readFileSync('docs/teachers/scheme-of-work.md', 'utf8');
for (const b of blocks) {
  const text = planText(b, lessons);
  for (const step of b.lessons) {
    const lesson = lessons.find(l => l.id === step.id);
    assert.ok(lesson, step.id + ' missing');
    assert.ok(scheme.includes(step.objective), step.id + ' objective drift');
    assert.ok(scheme.includes(step.prior), step.id + ' prerequisite drift');
    assert.ok(step.minutes >= 30);
    assert.ok(text.includes(lesson.title));
    assert.ok(text.includes(lesson.intro.trim()));
    const verdict = ctx.KodroLessonGrader.gradeSync(lesson, lesson.solutionCode);
    assert.equal(verdict.passed, true, step.id + ': ' + JSON.stringify(verdict.reasons));
    assert.equal(ctx.KodroLessonGrader.gradeSync(lesson, '').passed, false, step.id + ' accepts empty code');
  }
}
function nodes(n) { return n && typeof n === 'object' ? [n, ...n.children.flatMap(nodes)] : []; }
function render(ls=lessons, results={}) { cursor=0; return nodes(ctx.KodroCurriculum({lessons:ls,results,onStart:l=>{started=l;}})); }
for (const b of blocks) {
  states=[b.id, ''];
  const tree=render();
  const buttons=tree.filter(n=>n.type==='button' && n.children.includes('Open challenge'));
  assert.equal(buttons.length,b.lessons.length);
  buttons.forEach((button,i)=>{button.props.onClick();assert.equal(started.id,b.lessons[i].id);});
}
states=['A',''];
assert.equal(render([]).filter(n=>n.type==='button' && n.children.includes('Open challenge')).every(n=>n.props.disabled),true);
const complete=render(lessons,{[ids[0]]:{passed:true}});
assert.equal(complete.filter(n=>n.type==='button' && n.children.includes('Revisit challenge')).length,1);
// Locate block controls by their pressed state and visible title fragments.
const blockB=complete.find(n=>n.type==='button' && n.children.includes(blocks[1].title));
blockB.props.onClick();
assert.equal(render().filter(n=>n.type==='button' && n.children.includes('Open challenge')).length,5);
let savedName, savedText;
ctx.Blob = class { constructor(parts) { savedText=parts.join(''); } };
ctx.URL = {createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}};
ctx.setTimeout = fn => fn();
ctx.document = {body:{appendChild:()=>{}},createElement:()=>({click(){savedName=this.download;},remove(){}})};
render().find(n=>n.type==='button' && n.children.includes('Download lesson plan')).props.onClick();
assert.equal(savedName,'kodro-block-b-lesson-plan.txt');
assert.ok(savedText.includes('Hello, Rover!'));
ctx.URL.createObjectURL=()=>{throw new Error('download unavailable');};
render().find(n=>n.type==='button' && n.children.includes('Download lesson plan')).props.onClick();
assert.ok(render().some(n=>n.props.role==='alert'));
console.log('PASS: 24 real challenges, solution/empty-code grading, four block flows, progress, downloads content, missing lessons and scheme parity.');
