/* Measured vibe-generation QA.
 *
 * The deterministic engine has hard pass/fail gates (qa_interpreter.mjs, pytest) but
 * the AI assistant did not, so its reliability was unproven. This harness gives
 * it one: for a fixed set of realistic non-expert prompts it asks the local
 * model (Ollama, kodro-coder) for rover code, applies the SAME normaliser the
 * browser assistant uses (rewrites rover.x() method style to the bare functions
 * the interpreter accepts), then runs each result through the REAL vendored
 * interpreter and reports how many produce code that actually runs. Fully
 * offline; the only peer is the local Ollama server.
 *
 *   node scripts/qa_vibe.mjs            # default model kodro-coder:latest
 *   KODRO_VIBE_MODEL=gemma3:4b node scripts/qa_vibe.mjs
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..', 'src', 'robolearn', 'assets', 'web');
// Same evidence directory the performance and persona harnesses write to, so a
// live-model claim has a committed artefact behind it instead of a console line.
const OUT = path.join(HERE, '..', 'docs', 'eval', 'vibe_eval.json');
const OLLAMA = 'http://localhost:11434';
const MODEL = process.env.KODRO_VIBE_MODEL || 'kodro-coder:latest';

// --- load the real interpreter into a sandbox (same as qa_interpreter) ------
const ctx = { console };
ctx.self = ctx; ctx.window = ctx; ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, 'interpreter.js'), 'utf8'), ctx);
const RoverLang = ctx.window.RoverLang;

// --- mirror of ai-web.jsx normalizeApi + extractCode + validate -------------
const ALIAS = { forward: 'move_forward', backward: 'move_backward', left: 'turn_left', right: 'turn_right' };
function normalizeApi(code) {
  if (!code) return code;
  return code.replace(/\b(?:rover|robot|bot)\.([A-Za-z_]\w*)\s*\(/g, (m, n) => (ALIAS[n] || n) + '(');
}
function extractCode(t) {
  const fence = t.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : t).trim();
}
function validate(code) {
  try {
    const prog = RoverLang.compile(code);
    const host = {
      move() {}, turn() {}, sensor() { return 0; }, say() {}, led() {}, beep() {},
      setSpeed() {}, scan() {}, wait() {}, penDown() {}, penUp() {}, log() {}, place() {},
      collect() {}, drop() {}, clearProps() {},
    };
    const gen = prog.run(host);
    let n = 0;
    for (const _ev of gen) { if (++n > 4000) break; }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
}

const SYS = "You are Kodro's offline coding assistant for a simulated robot. The robot is programmed with BARE Python function calls, NEVER object methods. Use exactly: move_forward(metres), move_backward(metres), turn_left(degrees), turn_right(degrees), set_speed(percent), say(\"text\"), led(\"colour\"), beep(1), wait(seconds), scan(), pen_down(), pen_up(). Sensors are distance() and heading(). NEVER write rover.anything(). Distances are in METRES and the arena is small (about 15 metres from the centre to a wall), so a normal move is 1 to 5 metres: \"a few metres\" means move_forward(3), never 30 or 300. For repeated motion use a loop, for example \"for i in range(4):\" with an indented body. To stop before an obstacle, loop \"while distance() > 40:\" moving a small step like move_forward(1) inside. Keep programs short. Reply with only runnable code in a python fence.";

const PROMPTS = [
  'drive forward 3 metres then stop',
  'turn right 90 degrees then move forward 2 metres',
  'drive in a square, 2 metres a side',
  'set the speed to 50 and move forward 5 metres',
  'spin around 360 degrees',
  'move forward 2, say hello, then move back 1',
  'go forward until close to an obstacle using distance()',
  'draw a triangle with the pen down',
];

async function gen(prompt) {
  const r = await fetch(OLLAMA + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, system: SYS, prompt, stream: false, options: { temperature: 0.2, num_predict: 200 } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

// The artefact is the point of a live-model gate: a console line is not evidence
// a reader can audit, so every non-SKIP run writes the model identity, each
// prompt, the code the model actually produced and why it passed or failed.
function writeArtefact(report) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('wrote ' + path.relative(path.join(HERE, '..'), OUT).replace(/\\/g, '/'));
}

(async function () {
  let entry = null;
  try {
    const tags = await fetch(OLLAMA + '/api/tags').then((r) => r.json());
    entry = (tags.models || []).find((m) => m.name === MODEL) || null;
    if (!entry) { console.log('SKIP: model ' + MODEL + ' not installed. Pull it or set KODRO_VIBE_MODEL.'); process.exit(0); }
  } catch (e) {
    console.log('SKIP: Ollama not reachable at ' + OLLAMA + ' (' + ((e && e.message) || e) + ')'); process.exit(0);
  }
  let pass = 0;
  const results = [];
  for (const p of PROMPTS) {
    let raw = '';
    try { raw = await gen(p); } catch (e) {
      const msg = (e && e.message) || String(e);
      console.log('FAIL (gen) ', p, '->', msg);
      results.push({ prompt: p, ok: false, stage: 'generate', error: msg, code: null });
      continue;
    }
    const code = normalizeApi(extractCode(raw));
    const v = validate(code);
    results.push({ prompt: p, ok: v.ok, stage: 'interpret', error: v.ok ? null : v.error, code });
    if (v.ok) { pass++; console.log('PASS  ', p); }
    else { console.log('FAIL  ', p, '->', v.error); }
  }
  const pct = Math.round((pass / PROMPTS.length) * 100);
  writeArtefact({
    harness: 'qa_vibe',
    generatedAt: new Date().toISOString(),
    model: { name: MODEL, digest: entry.digest || null, size: entry.size || null, modified: entry.modified_at || null },
    endpoint: OLLAMA,
    options: { temperature: 0.2, num_predict: 200 },
    measures: 'Whether locally generated code compiles and runs in the real vendored interpreter. Not a measure of whether a person found the answer useful.',
    passed: pass,
    total: PROMPTS.length,
    percent: pct,
    results,
  });
  console.log('\n== VIBE QA: ' + pass + '/' + PROMPTS.length + ' (' + pct + '%) ran clean through the interpreter, model ' + MODEL + ' ==');
  // Pass floor: a real (non-SKIP) run must clear 60% of prompts or it fails CI.
  if (pass < Math.ceil(PROMPTS.length * 0.6)) process.exit(1);
})();
