/* Offline unit QA for the browser AI facade (ai-web.jsx).
 *
 * ai-web.jsx (window.KodroAI) carries critical PURE string logic that turns a
 * local model's raw text into runnable rover code:
 *   - normalizeApi : rewrites rover.X(...) object-method style into the bare
 *                    metre-based API, converting rover.forward(cm) -> the
 *                    equivalent move_forward(metres) so "tidying" never changes
 *                    a distance by 100x, and stripping prose the model leaks.
 *   - extractCode  : pulls the code out of a ```python fence (or returns the
 *                    whole text when there is no fence).
 *   - stripFences  : removes stray markdown fences from prose replies.
 *   - looksLikeCode: decides whether a reply is code or a clarifying question.
 *
 * Those four helpers are PRIVATE to the IIFE (only status/reviewCode/ask/
 * chatStart/chatPoll/... are exposed on window.KodroAI), so this harness does
 * NOT reach in and call them directly. It loads the SHIPPED ai-web.jsx under a
 * minimal window/fetch/localStorage shim -- the same way qa_interpreter.mjs
 * already does -- and drives the helpers through the smallest public surface
 * that exercises each one, with a canned model reply:
 *   - reviewCode() -> review.code == normalizeApi(extractCode(modelText))
 *   - ask()        -> ask.text    == stripFences(modelText)
 *   - chatStart()/chatPoll() -> result.type 'code' vs 'question' == looksLikeCode
 *
 * No network: fetch is mocked. No browser: the interpreter is loaded into the
 * shim so chatStart's validate() runs for real. Pure node, cross-platform, so
 * it is cheap to gate on every CI leg alongside qa_grader / qa_physics.
 */
import { readFileSync } from 'node:fs';

// --- load the shipped modules into one shared window shim -----------------
const web = (f) => readFileSync(new URL('../src/robolearn/assets/web/' + f, import.meta.url), 'utf8');

const win = {};
// Interpreter + motion model so chatStart's validate() (a real dry-run through
// window.RoverLang) exercises the actual compiler, not the absent-RoverLang
// short-circuit. Loaded exactly like qa_interpreter.mjs.
new Function('window', web('interpreter.js'))(win);
new Function('window', web('motion-model.js'))(win);

// A canned model reply the mock fetch hands back for the NEXT generate call.
// Each test sets this right before it drives a public entry point.
let nextGen = '';
function setGen(t) { nextGen = t; }

// A streamed body shim for chatStart's stream:true path: yields the whole
// reply as one Ollama NDJSON line { "response": "..." }, then done.
function streamBody(text) {
  const enc = new TextEncoder();
  const chunks = [enc.encode(JSON.stringify({ response: text }) + '\n')];
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          if (i < chunks.length) return Promise.resolve({ done: false, value: chunks[i++] });
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}

// Mock the ONLY network the facade uses: the local Ollama server. /api/tags
// advertises one model; /api/generate returns the canned reply, streamed or
// not depending on the request body (chatStart streams, reviewCode/ask do not).
async function mockFetch(url, options) {
  const u = String(url);
  if (u.includes('/api/tags')) {
    return { ok: true, json: async () => ({ models: [{ name: 'kodro-coder:latest' }] }) };
  }
  if (u.includes('/api/generate')) {
    let body = {};
    try { body = options && options.body ? JSON.parse(options.body) : {}; } catch (e) { void e; }
    if (body.stream) return { ok: true, body: streamBody(nextGen) };
    return { ok: true, json: async () => ({ response: nextGen }) };
  }
  throw new Error('unexpected fetch ' + u);
}
const lsStub = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// Load the facade against the shared shim (same pattern as qa_interpreter.mjs).
new Function('window', 'fetch', 'localStorage', web('ai-web.jsx'))(win, mockFetch, lsStub);
const AI = win.KodroAI;

// --- tiny assert harness (mirrors qa_interpreter.mjs) ---------------------
let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? '  -> ' + detail : '')); }
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '   [' + detail + ']' : ''));
}

// review.code == normalizeApi(extractCode(modelReply)). src is irrelevant to
// the output (the rewrite runs on the MODEL reply), so a placeholder is fine.
async function reviewedCode(modelReply) {
  setGen(modelReply);
  const r = await AI.reviewCode('placeholder', null);
  if (!r || !r.ok) throw new Error('reviewCode failed: ' + (r && r.reason));
  return r;
}
async function asked(modelReply) {
  setGen(modelReply);
  const r = await AI.ask('placeholder');
  if (!r || !r.ok) throw new Error('ask failed: ' + (r && r.reason));
  return r;
}
// Drive the streamed chat job to completion and return its final result.
async function chatted(modelReply) {
  setGen(modelReply);
  const start = await AI.chatStart([{ role: 'user', text: 'placeholder' }], null);
  if (!start || !start.ok) throw new Error('chatStart failed: ' + (start && start.reason));
  for (let i = 0; i < 400; i++) {
    const r = await AI.chatPoll(start.jobId);
    if (r && r.done) return r;
    await new Promise((res) => setTimeout(res, 5));
  }
  throw new Error('chat job did not complete');
}

console.log('== FACADE LOADED ==');
check('window.KodroAI facade loaded', !!(AI && typeof AI.reviewCode === 'function'), '');
check('interpreter (RoverLang) loaded into shim', !!(win.RoverLang && win.RoverLang.compile), '');

console.log('\n== normalizeApi + extractCode (via reviewCode) ==');
{
  // rover.forward(cm) -> move_forward(metres): 100 cm == 1 m (rename + unit fix).
  const r1 = await reviewedCode('```python\nrover.forward(100)\n```');
  check('rover.forward(100) -> move_forward(1)', r1.code.trim() === 'move_forward(1)', JSON.stringify(r1.code));

  // rover.left / rover.right are pure renames (degrees, no unit conversion).
  const r2 = await reviewedCode('```python\nrover.left(90)\n```');
  check('rover.left(90) -> turn_left(90)', r2.code.trim() === 'turn_left(90)', JSON.stringify(r2.code));
  const r3 = await reviewedCode('```python\nrover.right(90)\n```');
  check('rover.right(90) -> turn_right(90)', r3.code.trim() === 'turn_right(90)', JSON.stringify(r3.code));

  // rover.backward(cm) -> move_backward(metres): 300 cm == 3 m.
  const r4 = await reviewedCode('```python\nrover.backward(300)\n```');
  check('rover.backward(300) -> move_backward(3)', r4.code.trim() === 'move_backward(3)', JSON.stringify(r4.code));

  // The unit-trap guard both directions:
  //   rover.forward(200) IS converted 200 cm -> 2 m ...
  const r5 = await reviewedCode('```python\nrover.forward(200)\n```');
  check('cm->m applied: rover.forward(200) -> move_forward(2)', r5.code.trim() === 'move_forward(2)', JSON.stringify(r5.code));
  //   ... but an ALREADY-bare move_forward(2) is NOT re-divided into 0.02.
  const r6 = await reviewedCode('```python\nmove_forward(2)\n```');
  check('cm->m NOT double-applied: bare move_forward(2) stays move_forward(2)',
    r6.code.trim() === 'move_forward(2)', JSON.stringify(r6.code));

  // Non-literal argument falls through to a plain rename (no unit maths).
  const r7 = await reviewedCode('```python\nrover.forward(step)\n```');
  check('non-literal arg: rover.forward(step) -> move_forward(step) (rename only)',
    r7.code.trim() === 'move_forward(step)', JSON.stringify(r7.code));

  // extractCode pulls the body out of a ```python fence, backticks gone.
  const r8 = await reviewedCode('Here is a tidy version:\n```python\nmove_forward(1)\n```\ndone');
  check('extractCode: ```python fence yields inner code, no backticks',
    r8.code.trim() === 'move_forward(1)' && !r8.code.includes('`'), JSON.stringify(r8.code));

  // A plain ``` fence (no language tag) is extracted too.
  const r9 = await reviewedCode('```\nmove_forward(1)\n```');
  check('extractCode: plain ``` fence (no lang) yields inner code',
    r9.code.trim() === 'move_forward(1)' && !r9.code.includes('`'), JSON.stringify(r9.code));

  // No fence at all: normalizeApi strips a leading prose line the model leaked.
  const r10 = await reviewedCode('This will draw a line\nmove_forward(3)');
  check('prose line stripped, code kept',
    /move_forward\(3\)/.test(r10.code) && !/This will/.test(r10.code), JSON.stringify(r10.code));

  // A full rover.* program is normalized line-by-line (rename + cm->m).
  const r11 = await reviewedCode('```python\nrover.forward(300)\nrover.right(90)\n```');
  check('multi-line rover.* program fully normalized to bare API',
    /move_forward\(3\)/.test(r11.code) && /turn_right\(90\)/.test(r11.code) && !/rover\./.test(r11.code),
    JSON.stringify(r11.code));
}

console.log('\n== stripFences (via ask) ==');
{
  // ask() applies stripFences directly to the model text, so it isolates the
  // helper: a fenced reply comes back as bare text with the fences removed.
  const a1 = await asked('```python\nmove_forward(1)\n```');
  check('stripFences removes ```python opening and ``` closing',
    a1.text === 'move_forward(1)' && !a1.text.includes('`'), JSON.stringify(a1.text));

  // Plain prose (no fences) is returned unchanged (trimmed).
  const a2 = await asked('Use move_forward to drive ahead.');
  check('stripFences leaves fence-free prose unchanged',
    a2.text === 'Use move_forward to drive ahead.', JSON.stringify(a2.text));
}

console.log('\n== looksLikeCode (via chatStart/chatPoll) ==');
{
  // A reply that looks like code routes to type 'code' AND is normalized +
  // validated through the real interpreter before the job resolves.
  const c1 = await chatted('move_forward(3)');
  check('code reply -> looksLikeCode true (result.type == code)', c1.type === 'code', JSON.stringify(c1.type));
  check('code reply normalized+validated code returned', c1.code && c1.code.trim() === 'move_forward(3)', JSON.stringify(c1 && c1.code));

  // A reply with no code signature routes to type 'question' (a clarifier),
  // and its text is preserved.
  const c2 = await chatted('What shape would you like to draw?');
  check('question reply -> looksLikeCode false (result.type == question)', c2.type === 'question', JSON.stringify(c2.type));
  check('question reply preserves the question text',
    c2.text === 'What shape would you like to draw?', JSON.stringify(c2 && c2.text));
}

console.log('\n== BOUNDED TOOL CALL (OPP-7) ==');
{
  const KNOWN = ['earth', 'mars', 'city', 'sahara'];
  const TOOLS = { set_world: { hint: 'world or site id' } };

  // Valid proposal: the model names a real world; resolveToolCall applies it,
  // and the caller contract mutates state from r.id (asserted via a spy).
  setGen('{"tool":"set_world","arg":"mars"}');
  const t1 = await AI.toolCall('take me somewhere red and dusty', TOOLS);
  check('valid tool call parsed from the constrained output', !!t1 && t1.tool === 'set_world' && t1.arg === 'mars', JSON.stringify(t1));
  const applied = [];
  const r1 = AI.resolveToolCall(t1, KNOWN);
  if (r1.apply) applied.push(r1.id);
  check('valid arg applies and mutates state (spy)', r1.apply === true && applied.join() === 'mars', JSON.stringify(applied));
  check('apply message says what changed', /Switched the world to mars/.test(r1.message || ''), r1.message || '');

  // Invalid arg: refused readably, nothing applied.
  setGen('{"tool":"set_world","arg":"atlantis"}');
  const t2 = await AI.toolCall('go to atlantis', TOOLS);
  const r2 = AI.resolveToolCall(t2, KNOWN);
  check('invalid arg refused (no apply)', !!t2 && r2.apply === false, JSON.stringify(r2));
  check('refusal is readable and names the bad id + real options',
    /"atlantis"/.test(r2.message || '') && /nothing changed/i.test(r2.message || '') && /earth/.test(r2.message || ''), r2.message || '');

  // "none" and malformed outputs both fall through to plain chat (null).
  setGen('{"tool":"none","arg":""}');
  check('tool "none" falls through (null)', (await AI.toolCall('hello there', TOOLS)) === null, '');
  setGen('this is not json at all');
  check('malformed model output falls through (null)', (await AI.toolCall('go somewhere', TOOLS)) === null, '');
  // A tool outside the whitelist is rejected even if well-formed.
  setGen('{"tool":"delete_everything","arg":"now"}');
  check('non-whitelisted tool rejected (null)', (await AI.toolCall('do it', TOOLS)) === null, '');
}

console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
if (fail) { console.log('FAILURES:'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
