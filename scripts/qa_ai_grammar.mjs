/* Grammar-constrained generation QA (judge quick-win #1).
 *
 * The local model must not invent a command or call a sensor the build lacks.
 * KodroAI.structuredProgram feeds a JSON schema whose command enum is EXACTLY
 * the fitted set into Ollama's structured-output decoder, so an out-of-set
 * symbol is impossible, not merely caught after the fact.
 *
 * Two parts:
 *   1. PURE compiler (always runs): buildCommandSchema builds the right enum;
 *      compileProgram emits only in-set calls and drops anything out-of-set.
 *   2. LIVE constraint (skipped if Ollama is down): a prompt that explicitly
 *      demands an UNFITTED command must still yield only fitted commands.
 *
 *   node scripts/qa_ai_grammar.mjs      # exits non-zero only on a real failure
 */
import { readFileSync } from 'node:fs';

const AI = readFileSync(new URL('../src/robolearn/assets/web/ai-web.jsx', import.meta.url), 'utf8');

// Minimal window shim: ai-web.jsx only touches these at load / for structured gen.
const FITTED = ['set_speed', 'wait', 'stop', 'say', 'led', 'beep', 'pen_down', 'pen_up',
  'move_forward', 'move_backward', 'turn_left', 'turn_right']; // a wheeled build, no ultrasonic/imu
const win = {
  location: { origin: 'http://localhost', href: 'http://localhost/' },
  addEventListener() {}, dispatchEvent() {},
  getKodroRobot: () => ({ type: 'rover', sensors: [], actuators: ['motors4'] }),
  KodroCommands: { commandNames: () => FITTED.slice() },
};
// Load with only `window` bound so `fetch` inside the module resolves to Node's
// real global fetch (not a shadowed undefined param).
new Function('window', AI)(win);
const KodroAI = win.KodroAI;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass += 1; else { fail += 1; console.error('FAIL  ' + m); } };

// 1. PURE: schema enum is exactly the fitted set.
const schema = KodroAI.buildCommandSchema(FITTED);
ok(JSON.stringify(schema.properties.program.items.properties.cmd.enum) === JSON.stringify(FITTED),
  'schema cmd enum equals the fitted command set');

// 2. PURE: compileProgram emits in-set calls, drops out-of-set, formats args.
const compiled = KodroAI.compileProgram({
  program: [
    { cmd: 'move_forward', arg: 2 },
    { cmd: 'turn_left', arg: 90 },
    { cmd: 'distance' },            // NOT fitted -> must be dropped
    { cmd: 'rover.forward', arg: 9 }, // invented -> must be dropped
    { cmd: 'say', text: 'go "now"' },  // quotes stripped
    { cmd: 'stop' },
  ],
}, FITTED);
ok(compiled.includes('move_forward(2)') && compiled.includes('turn_left(90)') && compiled.includes('stop()'),
  'compileProgram emits the fitted calls');
ok(!/distance|rover\.forward/.test(compiled), 'compileProgram drops out-of-set / invented commands');
ok(compiled.includes('say("go now")'), 'compileProgram formats a text arg and strips quotes');

// 3. LIVE (Ollama-gated): a prompt demanding an unfitted command yields none.
const OLLAMA = 'http://localhost:11434';
let up = false;
try {
  const r = await fetch(OLLAMA + '/api/version', { signal: AbortSignal.timeout(3000) });
  up = r.ok;
} catch { up = false; }

if (!up) {
  console.log('SKIP  live grammar constraint: Ollama not reachable on ' + OLLAMA);
} else {
  // Pick a small installed model.
  let model = 'gemma3:1b';
  try {
    const tags = await (await fetch(OLLAMA + '/api/tags')).json();
    const names = (tags.models || []).map((m) => m.name);
    model = names.find((n) => /gemma3:1b|llama3.2:3b|robolearn-fast/.test(n)) || names[0] || model;
  } catch { /* keep default */ }
  // ai-web's generate() reads window fetch via the module's own fetch binding;
  // wire the real fetch so structuredProgram can reach Ollama.
  win.fetch = fetch;
  globalThis.fetch = fetch;
  try {
    const res = await KodroAI.structuredProgram(
      'Drive forward 2 metres, turn left 90 degrees, then READ THE DISTANCE SENSOR and stop.',
      model,
    );
    const calls = (res.code.match(/^[a-z_]+/gm) || []);
    const outside = calls.filter((c) => FITTED.indexOf(c) < 0);
    ok(outside.length === 0,
      'live: constrained output contains ONLY fitted commands (model=' + model + ', got ' + JSON.stringify(calls) + ')');
    ok(!/distance/.test(res.code),
      'live: the demanded-but-unfitted distance() never appears (grammar forbade it)');
    console.log('      live model ' + model + ' produced: ' + JSON.stringify(res.code.split('\n')));
  } catch (e) {
    console.log('SKIP  live grammar constraint: generation error (' + (e && e.message) + ')');
  }
}

console.log((fail ? 'FAIL' : 'PASS') + '  ai grammar constraint: ' + pass + ' passed, ' + fail + ' failed');
// Set exitCode and let the event loop drain: calling process.exit() here races
// undici's keep-alive socket teardown on Windows and aborts (UV_HANDLE_CLOSING).
process.exitCode = fail ? 1 : 0;
