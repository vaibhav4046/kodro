/* Measured vibe-generation QA.
 *
 * The deterministic engine has hard numbers (21/21 interpreter, 854 pytest) but
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

const SYS = "You are Kodro's offline coding assistant for a simulated robot. The robot is programmed with BARE Python function calls, NEVER object methods. Use exactly: move_forward(metres), move_backward(metres), turn_left(degrees), turn_right(degrees), set_speed(percent), say(\"text\"), led(\"colour\"), beep(1), wait(seconds), scan(), pen_down(), pen_up(). Sensors are distance() and heading(). NEVER write rover.anything(). Reply with only runnable code in a python fence.";

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

(async function () {
  try {
    const tags = await fetch(OLLAMA + '/api/tags').then((r) => r.json());
    const have = (tags.models || []).some((m) => m.name === MODEL);
    if (!have) { console.log('SKIP: model ' + MODEL + ' not installed. Pull it or set KODRO_VIBE_MODEL.'); process.exit(0); }
  } catch (e) {
    console.log('SKIP: Ollama not reachable at ' + OLLAMA + ' (' + ((e && e.message) || e) + ')'); process.exit(0);
  }
  let pass = 0;
  for (const p of PROMPTS) {
    let raw = '';
    try { raw = await gen(p); } catch (e) { console.log('FAIL (gen) ', p, '->', (e && e.message) || e); continue; }
    const code = normalizeApi(extractCode(raw));
    const v = validate(code);
    if (v.ok) { pass++; console.log('PASS  ', p); }
    else { console.log('FAIL  ', p, '->', v.error); }
  }
  const pct = Math.round((pass / PROMPTS.length) * 100);
  console.log('\n== VIBE QA: ' + pass + '/' + PROMPTS.length + ' (' + pct + '%) ran clean through the interpreter, model ' + MODEL + ' ==');
  // Pass floor: a real (non-SKIP) run must clear 60% of prompts or it fails CI.
  if (pass < Math.ceil(PROMPTS.length * 0.6)) process.exit(1);
})();
