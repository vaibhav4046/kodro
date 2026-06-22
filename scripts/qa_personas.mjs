/* Simulated persona evaluation (LLM-based) — measured, offline, NOT human subjects.
 *
 * HONESTY CONTRACT (read before citing any number from this file):
 *   The "personas" here are LLM-simulated, not real people. This harness does
 *   NOT and CANNOT stand in for a human-subjects study. It is a reproducible
 *   proxy for one question only: how robustly does Kodro's OFFLINE assistant
 *   turn varied, non-expert phrasings of a goal into a program that actually
 *   compiles, runs, and does the task, within a few correction turns. Every
 *   number it prints is measured deterministically by the REAL vendored
 *   interpreter (RoverLang) and the REAL self-test (KodroSelfTest) — the model
 *   only writes code; success is judged by execution, never by an LLM and never
 *   by hand. Report results in the dissertation as "simulated persona
 *   evaluation" with the limitations paragraph. Do not describe it as a human
 *   study.
 *
 * Fully offline: the only peer is the local Ollama server.
 *
 *   node scripts/qa_personas.mjs                          # default kodro-coder:latest
 *   KODRO_PERSONA_MODEL=kodro-tutor:latest node scripts/qa_personas.mjs
 *   KODRO_PERSONA_TURNS=3 node scripts/qa_personas.mjs    # max correction turns
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..', 'src', 'robolearn', 'assets', 'web');
const OUT_DIR = path.join(HERE, '..', 'docs', 'eval');
const OLLAMA = 'http://localhost:11434';
const MODEL = process.env.KODRO_PERSONA_MODEL || 'kodro-coder:latest';
const MAX_TURNS = Math.max(1, parseInt(process.env.KODRO_PERSONA_TURNS || '3', 10));

// --- load the REAL interpreter + self-test into one sandbox -----------------
const ctx = { console };
ctx.self = ctx; ctx.window = ctx; ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, 'interpreter.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, 'selftest.jsx'), 'utf8'), ctx);
const RoverLang = ctx.window.RoverLang;
const KodroSelfTest = ctx.window.KodroSelfTest;
if (!RoverLang || !KodroSelfTest) { console.error('FATAL: interpreter or self-test failed to load'); process.exit(2); }

// --- mirror of the browser assistant's normaliser + extractor ---------------
const ALIAS = { forward: 'move_forward', backward: 'move_backward', left: 'turn_left', right: 'turn_right', speed: 'set_speed', scan: 'scan', distance: 'distance', heading: 'heading', battery: 'battery', stop: 'stop' };
function normalizeApi(code) {
  if (!code) return code;
  // Strip any remaining markdown fences or markers the extractor missed.
  code = code.replace(/^```(?:python|py)?\s*/gim, '').replace(/```\s*$/gim, '');
  // rover.robot.bot.method(...) -> method(...)
  code = code.replace(/\b(?:rover|robot|bot)\.([A-Za-z_]\w*)\s*\(/g, (m, n) => (ALIAS[n] || n) + '(');
  // rover.robot.bot.method without parens (e.g. in a comment or assignment) -> bare name
  code = code.replace(/\b(?:rover|robot|bot)\.([A-Za-z_]\w*)\b/g, (m, n) => ALIAS[n] || n);
  // Common bare aliases -> canonical names (forward -> move_forward etc.)
  code = code.replace(/\bforward\s*\(/g, 'move_forward(');
  code = code.replace(/\bbackward\s*\(/g, 'move_backward(');
  code = code.replace(/\bleft\s*\(/g, 'turn_left(');
  code = code.replace(/\bright\s*\(/g, 'turn_right(');
  return code;
}
function extractCode(t) {
  if (!t) return '';
  // Try fenced code block (greedy: last fence wins, models sometimes emit prose then code).
  const fences = [...t.matchAll(/```(?:python|py)?\s*([\s\S]*?)```/gi)];
  if (fences.length) return fences[fences.length - 1][1].trim();
  // No fence: strip obvious prose lines and keep the rest.
  const lines = t.split('\n').filter((l) => {
    const s = l.trim();
    return s && !s.match(/^(here|sure|okay|this|the|to|you|i|let|now|below|that|your)\b/i) || s.match(/^\s*(move_|turn_|set_|say|led|beep|wait|scan|pen_|for |while |if |#)/i);
  });
  return lines.join('\n').trim();
}

// --- assistant grounding (the same contract the shipped assistant uses) ------
const SYS = "You are Kodro's offline coding assistant for a simulated robot. The robot is programmed with BARE Python function calls, NEVER object methods. Use exactly: move_forward(metres), move_backward(metres), turn_left(degrees), turn_right(degrees), set_speed(percent), say(\"text\"), led(\"colour\"), beep(1), wait(seconds), scan(), pen_down(), pen_up(). Sensors are distance() and heading(). NEVER write rover.anything() or robot.anything(). Distances are in METRES and the arena is small (about 15 metres from the centre to a wall), so a normal move is 1 to 5 metres: \"a few metres\" means move_forward(3), never 30 or 300. For repeated motion use a loop, for example \"for i in range(4):\" with an indented body. To stop before an obstacle, loop \"while distance() > 40:\" moving a small step like move_forward(1) inside. Keep programs short. Output ONLY runnable Python code in a single ```python fence. No prose before or after the fence. No explanations. No comments unless asked.";

// --- the 4 simulated personas: distinct, non-expert phrasing styles ----------
// Each templates a task's plain/precise goal into that persona's voice. The
// phrasing is fixed (not model-generated) so the measured variable is the
// assistant's robustness to how different users ask, not LLM phrasing noise.
const PERSONAS = [
  { id: 'beginner', name: 'Maya (KS3 beginner, no code)', phrase: (g) => 'i want the robot to ' + g.plain + '. i have never coded before, can you write it for me' },
  { id: 'teacher', name: 'Mr Okafor (teacher, class demo)', phrase: (g) => 'For a class demonstration, make the robot ' + g.plain + '. Keep it simple enough to explain to year 8s.' },
  { id: 'maker', name: 'Sam (hobbyist maker, precise)', phrase: (g) => g.precise },
  { id: 'access', name: 'Priya (low vision, voice-first)', phrase: (g) => 'Make the robot ' + g.plain + ', and have it say out loud what it is doing so I can follow without watching closely.' },
];

// --- the 5 tasks, each with a deterministic success predicate over the -------
// REAL self-test result {ok, moves, turns, hitWall, endPos, steps, summary}.
function dist(p) { return p ? Math.hypot(p.x || 0, p.y || 0) : 0; }
const TASKS = [
  { id: 'forward', plain: 'drive forwards a few metres', precise: 'Drive forward 3 metres and stop.',
    ok: (t) => t.ok && t.moves >= 1 && !t.hitWall && dist(t.endPos) > 50 },
  { id: 'turn_move', plain: 'turn and then drive a little way', precise: 'Turn right 90 degrees, then drive forward 2 metres.',
    ok: (t) => t.ok && t.turns >= 1 && t.moves >= 1 && !t.hitWall },
  { id: 'square', plain: 'drive around in a square', precise: 'Drive in a square 2 metres on each side using a loop.',
    ok: (t) => t.ok && t.turns >= 3 && t.moves >= 3 && !t.hitWall },
  { id: 'obstacle', plain: 'drive forward but stop before it bumps into anything', precise: 'Drive forward while distance() is greater than 40, then stop so it does not hit the wall.',
    ok: (t, code) => t.ok && !t.hitWall && t.moves >= 1 && /distance\s*\(/.test(code) },
  { id: 'loop', plain: 'do a little drive and beep, a few times over', precise: 'Repeat 3 times: move forward 1 metre then beep.',
    ok: (t, code) => t.ok && t.moves >= 2 && /\b(for|while|repeat)\b/.test(code) },
];

async function gen(messages) {
  // messages: [{role, content}] -> single prompt string (Ollama /generate with system).
  const prompt = messages.map((m) => (m.role === 'user' ? 'USER: ' + m.content : 'ASSISTANT: ' + m.content)).join('\n\n') + '\n\nASSISTANT:';
  const r = await fetch(OLLAMA + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, system: SYS, prompt, stream: false, options: { temperature: 0.2, num_predict: 220 } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

// One persona attempts one task, up to MAX_TURNS, feeding the self-test summary
// back as a correction the way a real user would. Returns the measured funnel.
async function attempt(persona, task) {
  const messages = [{ role: 'user', content: persona.phrase(task) }];
  const res = { compiled: false, ran: false, safe: false, didTask: false, turns: 0, lastError: '' };
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    res.turns = turn;
    let raw = '';
    try { raw = await gen(messages); } catch (e) { res.lastError = 'gen ' + ((e && e.message) || e); return res; }
    const code = normalizeApi(extractCode(raw));
    messages.push({ role: 'assistant', content: '```python\n' + code + '\n```' });
    const t = KodroSelfTest(code);
    res.compiled = t.stage !== 'compile' && t.stage !== 'load';
    res.ran = t.ok;
    res.safe = t.ok && !t.hitWall;
    res.didTask = !!task.ok(t, code);
    res.lastError = t.ok ? (t.hitWall ? 'hit the wall' : '') : (t.summary || t.error || 'did not run');
    if (res.didTask) return res;
    // correction turn: tell the assistant what actually happened, as a user would
    const fb = t.ok
      ? (t.hitWall ? 'It drove into the wall. Stop it before it hits anything.' : 'It ran but did not do the task: ' + (t.summary || '') + ' Please fix it.')
      : 'That did not work: ' + (t.summary || t.error || 'error') + ' Please fix it.';
    messages.push({ role: 'user', content: fb });
  }
  return res;
}

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

(async function () {
  try {
    const tags = await fetch(OLLAMA + '/api/tags').then((r) => r.json());
    const have = (tags.models || []).some((m) => m.name === MODEL);
    if (!have) { console.log('SKIP: model ' + MODEL + ' not installed. Pull it or set KODRO_PERSONA_MODEL.'); process.exit(0); }
  } catch (e) {
    console.log('SKIP: Ollama not reachable at ' + OLLAMA + ' (' + ((e && e.message) || e) + '). No data produced (honest skip).'); process.exit(0);
  }

  console.log('== SIMULATED PERSONA EVALUATION (LLM-based, offline) ==');
  console.log('model ' + MODEL + ', up to ' + MAX_TURNS + ' correction turns. NOT a human study.\n');

  const cells = [];
  for (const persona of PERSONAS) {
    for (const task of TASKS) {
      const r = await attempt(persona, task);
      cells.push({ persona: persona.id, task: task.id, ...r });
      console.log(
        (r.didTask ? 'DONE ' : r.safe ? 'ran  ' : r.compiled ? 'cmp  ' : 'fail ') +
        persona.id.padEnd(9) + ' ' + task.id.padEnd(9) +
        ' turns=' + r.turns + (r.didTask ? '' : '  (' + r.lastError + ')')
      );
    }
  }

  const N = cells.length;
  const sum = (k) => cells.filter((c) => c[k]).length;
  const done = cells.filter((c) => c.didTask);
  const meanTurns = done.length ? (done.reduce((a, c) => a + c.turns, 0) / done.length) : 0;

  console.log('\n-- funnel over ' + N + ' persona x task cells --');
  console.log('compiled:       ' + sum('compiled') + '/' + N + ' (' + pct(sum('compiled'), N) + '%)');
  console.log('ran clean:      ' + sum('ran') + '/' + N + ' (' + pct(sum('ran'), N) + '%)');
  console.log('safe (no wall): ' + sum('safe') + '/' + N + ' (' + pct(sum('safe'), N) + '%)');
  console.log('task complete:  ' + done.length + '/' + N + ' (' + pct(done.length, N) + '%)  mean turns-to-success ' + meanTurns.toFixed(2));

  console.log('\n-- task completion by persona --');
  for (const p of PERSONAS) {
    const cc = cells.filter((c) => c.persona === p.id);
    const d = cc.filter((c) => c.didTask).length;
    console.log('  ' + p.id.padEnd(9) + ' ' + d + '/' + cc.length + ' (' + pct(d, cc.length) + '%)');
  }
  console.log('\n-- task completion by task --');
  for (const t of TASKS) {
    const cc = cells.filter((c) => c.task === t.id);
    const d = cc.filter((c) => c.didTask).length;
    console.log('  ' + t.id.padEnd(9) + ' ' + d + '/' + cc.length + ' (' + pct(d, cc.length) + '%)');
  }

  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, 'persona_eval_results.json');
    fs.writeFileSync(outPath, JSON.stringify({
      method: 'simulated persona evaluation (LLM-based); NOT human subjects',
      model: MODEL, maxTurns: MAX_TURNS, cellCount: N,
      funnel: { compiled: sum('compiled'), ran: sum('ran'), safe: sum('safe'), taskComplete: done.length },
      meanTurnsToSuccess: Number(meanTurns.toFixed(2)),
      byPersona: PERSONAS.map((p) => { const cc = cells.filter((c) => c.persona === p.id); return { persona: p.id, name: p.name, done: cc.filter((c) => c.didTask).length, of: cc.length }; }),
      byTask: TASKS.map((t) => { const cc = cells.filter((c) => c.task === t.id); return { task: t.id, done: cc.filter((c) => c.didTask).length, of: cc.length }; }),
      cells,
    }, null, 2));
    console.log('\nwrote ' + outPath);
  } catch (e) { console.log('(could not write results json: ' + ((e && e.message) || e) + ')'); }
})();
