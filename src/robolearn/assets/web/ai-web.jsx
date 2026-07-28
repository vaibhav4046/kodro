/* window.KodroAI -- one assistant facade for both run modes (offline).
 *
 * The desktop build talks to the local model through the pywebview bridge
 * (window.RoboLearn.ai*). But when the studio runs in a plain browser (for
 * example `python scripts/demo.py`, which serves over http with no pywebview),
 * that bridge does not exist, so the assistant and vibe coding read as "AI
 * unavailable / no model" even though Ollama is running with a model installed.
 *
 * This facade closes that gap. If the pywebview bridge is present it delegates
 * to it unchanged. Otherwise it talks DIRECTLY to the local Ollama server at
 * http://localhost:11434 with fetch -- which Ollama allows from a localhost web
 * origin (CORS), and which is still 100% offline: the only peer permitted is
 * localhost, enforced below, exactly like the Python client's _require_local.
 *
 * So vibe coding, the reviewer and the grounded Ask all work whether Kodro runs
 * as the packaged desktop app or in a browser, with no account and no cloud.
 */
(function () {
  'use strict';

  const OLLAMA = 'http://localhost:11434';
  // Offline guarantee: the ONLY network peer allowed is the local Ollama server.
  const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+/i;
  function localOnly(url) {
    if (!LOCAL_RE.test(url)) throw new Error('refusing non-local URL (offline): ' + url);
    return url;
  }

  // Time budgets for the local fetches. Generation can pay a 10 to 30s cold
  // model load, so it gets a generous cap; listing installed models is a quick
  // metadata call, so it gets a short one. Both stop an unreachable or stuck
  // Ollama from hanging the UI forever.
  const GEN_TIMEOUT_MS = 120000;
  const TAGS_TIMEOUT_MS = 8000;

  // Wrap a non-streamed fetch in an AbortController plus timer so a stuck or
  // cold-loading model cannot hang forever. The timer is cleared on success and
  // on failure, and an aborted request surfaces one clear, honest error.
  function fetchTimeout(url, options, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, ms);
    const opts = Object.assign({}, options || {}, { signal: ctrl.signal });
    return fetch(url, opts).then(
      function (r) { clearTimeout(timer); return r; },
      function (e) {
        clearTimeout(timer);
        if (e && e.name === 'AbortError') throw new Error('the model took too long, it may still be loading, try again');
        throw e;
      }
    );
  }

  function bridge() {
    return (typeof window !== 'undefined' && window.RoboLearn && window.RoboLearn.isAvailable && window.RoboLearn.isAvailable())
      ? window.RoboLearn : null;
  }

  // Explain, in one honest and origin-appropriate line, why the local Ollama
  // server could not be reached, so EVERY assistant entry point (status, vibe
  // chat, reviewer, Ask) gives the SAME diagnosis instead of a flat "not
  // running". The two failure modes read very differently to the user: on a
  // hosted page (an http/https origin that is NOT localhost) the browser blocks
  // the request to the local Ollama server by CORS, so Ollama is likely running
  // and just refuses this origin (the fix is to allow the origin). On a local
  // origin (localhost, 127.0.0.1, [::1], or a file:// page) the request is
  // allowed, so a failure means Ollama is simply not running. Returns a machine
  // `reason` code plus a copy-pasteable, origin-aware human `hint`, with the
  // real origin computed at runtime.
  function ollamaUnavailableReason() {
    let origin = '';
    try { origin = (typeof window !== 'undefined' && window.location && window.location.origin) || ''; } catch (er) { void er; }
    const httpOrigin = /^https?:\/\//i.test(origin);
    const localHost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(origin);
    if (httpOrigin && !localHost) {
      return {
        reason: 'blocked-origin',
        hint: 'Your browser blocked the local AI (Ollama refuses this origin). Start Ollama allowing this page: set OLLAMA_ORIGINS=' + origin + ' then run ollama serve. Or use the desktop app, or connect a cloud key in the Vibe panel.',
      };
    }
    return {
      reason: 'not-running',
      hint: 'Ollama is not running. Start the Ollama app (or run: ollama serve), then reopen this panel. Or connect a cloud key in the Vibe panel.',
    };
  }

  let override = null;
  try { override = localStorage.getItem('kodro_web_model') || null; } catch (e) { void e; }

  async function tags() {
    const r = await fetchTimeout(localOnly(OLLAMA + '/api/tags'), { method: 'GET' }, TAGS_TIMEOUT_MS);
    if (!r.ok) throw new Error('tags ' + r.status);
    const j = await r.json();
    return (j.models || []).map(function (m) { return m && m.name; }).filter(Boolean);
  }

  // Mirror the Python picker. Measured stock models come before the legacy
  // Kodro fine-tunes, which mixed centimetres into the metre movement API.
  // Within a family choose the largest installed parameter variant.
  function pick(models) {
    if (!models || !models.length) return null;
    if (override && models.indexOf(override) >= 0) return override;
    const sizeOf = function (name) {
      const m = String(name || '').toLowerCase().match(/:(\d+(?:\.\d+)?)b\b/);
      return m ? parseFloat(m[1]) : 0;
    };
    const prefixes = ['qwen2.5-coder', 'qwen', 'codegemma', 'gemma3', 'gemma', 'llama', 'kodro-coder', 'kodro-tutor', 'robolearn'];
    for (let i = 0; i < prefixes.length; i++) {
      const candidates = models.filter(function (n) { return n.toLowerCase().indexOf(prefixes[i]) === 0; });
      if (candidates.length) return candidates.reduce(function (best, n) { return sizeOf(n) > sizeOf(best) ? n : best; });
    }
    const coder = models.find(function (n) { return /coder|code|qwen|deepseek|llama|gemma|mistral/i.test(n); });
    if (coder) return coder;
    const noEmbed = models.filter(function (n) { return !/embed/i.test(n); });
    return noEmbed[0] || models[0] || null;
  }

  async function genOnce(model, prompt, opts) {
    opts = opts || {};
    // Route through the provider layer when a cloud provider (BYOK) is selected
    // and holding a key; otherwise fall through to the offline Ollama path.
    if (typeof window !== 'undefined' && window.KodroProviders && window.KodroProviders.cloudReady()) {
      return window.KodroProviders.generate(prompt, opts, model);
    }
    const body = {
      model: model, prompt: prompt, stream: false,
      // keep_alive holds the model in RAM between requests; without it Ollama
      // unloads after ~5 min idle and the next reply pays a 10 to 30s reload.
      keep_alive: '30m',
      options: { temperature: opts.temperature != null ? opts.temperature : 0.3, num_predict: opts.num_predict || 400 },
    };
    if (opts.system) body.system = opts.system;
    // Structured output: a JSON schema is compiled by Ollama into a decoding
    // grammar, so the model cannot emit tokens outside it (used by
    // structuredProgram to constrain generation to the fitted command set).
    if (opts.format) body.format = opts.format;
    const r = await fetchTimeout(localOnly(OLLAMA + '/api/generate'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, GEN_TIMEOUT_MS);
    if (!r.ok) throw new Error('generate ' + r.status);
    const j = await r.json();
    return (j.response || '').trim();
  }

  // Grammar-constrained program generation. Builds a JSON schema whose command
  // enum is EXACTLY the fitted set (KodroCommands.commandNames), so the local
  // model's structured decoder can only emit in-set commands -- it cannot
  // invent rover.forward() or call a sensor the build lacks. The returned JSON
  // program is compiled to the canonical bare-metre Kodro code. Pure + testable:
  // buildCommandSchema and compileProgram have no I/O.
  var ARG_NONE = { set_speed: false, wait: false, stop: true, say: false, led: false, beep: false,
    pen_down: true, pen_up: true, scan: true, distance: true, heading: true };
  function buildCommandSchema(names) {
    return {
      type: 'object',
      properties: {
        program: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              cmd: { type: 'string', enum: names.slice() },
              arg: { type: 'number' },
              text: { type: 'string' },
            },
            required: ['cmd'],
          },
        },
      },
      required: ['program'],
    };
  }
  function compileProgram(parsed, names) {
    var allow = {};
    names.forEach(function (n) { allow[n] = true; });
    var steps = (parsed && Array.isArray(parsed.program)) ? parsed.program : [];
    var lines = [];
    steps.forEach(function (s) {
      var cmd = s && s.cmd;
      if (!cmd || !allow[cmd]) return; // defence in depth: never emit an out-of-set call
      if (cmd === 'say' || cmd === 'led') {
        var txt = (s.text != null ? String(s.text) : (cmd === 'led' ? 'cyan' : 'hello')).replace(/"/g, '');
        lines.push(cmd + '("' + txt + '")');
      } else if (ARG_NONE[cmd] === true) {
        lines.push(cmd + '()');
      } else {
        var n = Number(s.arg);
        if (!isFinite(n)) n = (cmd === 'set_speed') ? 60 : 1;
        lines.push(cmd + '(' + (Math.round(n * 100) / 100) + ')');
      }
    });
    return lines.join('\n');
  }
  // structuredProgram(prompt, model?) -> { code, commands } (or throws on gen error).
  async function structuredProgram(prompt, model) {
    var robot = (typeof window !== 'undefined' && window.getKodroRobot) ? window.getKodroRobot() : null;
    var names = (window.KodroCommands && window.KodroCommands.commandNames)
      ? window.KodroCommands.commandNames(robot)
      : ['move_forward', 'move_backward', 'turn_left', 'turn_right', 'set_speed', 'wait', 'stop'];
    var schema = buildCommandSchema(names);
    var sys = 'You output a robot program as JSON only. Use ONLY these commands: ' + names.join(', ')
      + '. Distances are in metres (a normal move is 1 to 5), turns in degrees (90 for a right angle), '
      + 'set_speed is a percent 0 to 100. Do not invent commands.';
    var raw = await genOnce(model || 'gemma3:1b', prompt, { system: sys, format: schema, num_predict: 512, temperature: 0 });
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { throw new Error('structured output was not valid JSON'); }
    return { code: compileProgram(parsed, names), commands: names };
  }

  // OPP-7: ONE bounded, grammar-constrained tool call. The format schema
  // forces {tool, arg} with tool drawn from the whitelist (plus "none" for
  // "no action"), so the model cannot invent an action shape. The model only
  // PROPOSES; resolveToolCall below validates the argument against the live
  // registry ids and the caller applies or refuses. No loop, no chaining:
  // a single call per message, and every failure path returns null so chat
  // falls back to the deterministic intent parse.
  async function toolCall(text, tools) {
    var names = Object.keys(tools || {});
    if (!names.length) return null;
    var st;
    try { st = await status(); } catch (e) { return null; }
    if (!st || !st.available || !st.models || !st.models.length) return null;
    var model = pick(st.models);
    if (!model) return null;
    var schema = {
      type: 'object',
      properties: {
        tool: { type: 'string', enum: names.concat(['none']) },
        arg: { type: 'string' },
      },
      required: ['tool', 'arg'],
    };
    var sys = 'You drive one optional tool call for a robot studio. Tools: '
      + names.map(function (n) { return n + '(' + ((tools[n] && tools[n].hint) || 'id') + ')'; }).join(', ')
      + '. Reply {"tool":"none","arg":""} unless the user clearly asks for one of the tools.';
    try {
      var raw2 = await genOnce(model, text, { system: sys, format: schema, num_predict: 96, temperature: 0 });
      var obj = JSON.parse(raw2);
      if (!obj || typeof obj.tool !== 'string' || obj.tool === 'none' || names.indexOf(obj.tool) < 0) return null;
      return { tool: obj.tool, arg: String(obj.arg == null ? '' : obj.arg) };
    } catch (e) { return null; }
  }

  // Pure decision for the ONE whitelisted tool: validate a proposed set_world
  // call against the known world/site ids. {apply:true} carries the id to
  // switch to; {apply:false} carries the readable refusal (or null message
  // when the proposal was not a set_world call at all).
  function resolveToolCall(tc, knownIds) {
    if (!tc || tc.tool !== 'set_world') return { apply: false, id: null, message: null };
    var id = String(tc.arg || '').toLowerCase().trim();
    if (Array.isArray(knownIds) && knownIds.indexOf(id) >= 0) {
      return { apply: true, id: id, message: 'Switched the world to ' + id + '.' };
    }
    var sample = (knownIds || []).slice(0, 8).join(', ');
    return {
      apply: false, id: id,
      message: 'The model asked for world "' + id + '", which is not one I have, so nothing changed. Try one of: ' + sample + '.',
    };
  }

  function looksLikeCode(t) {
    return /(```|\brover\.|move_forward|move_backward|turn_left|turn_right|set_speed|\bfor\s+\w+\s+in\b|\bwhile\b|\bdef\s|\bif\s+.*:)/.test(t);
  }
  function extractCode(t) {
    const fence = t.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
    return (fence ? fence[1] : t).trim();
  }
  function stripFences(t) { return t.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim(); }

  // The command surface depends on the parts fitted to the CURRENT robot, so
  // ground the reviewer and the grounded Ask in the same fitted-command list the
  // vibe chat uses (hooks.jsx unshifts KodroCommands.groundingText into the chat
  // history). Guarded so a missing global just degrades to no prefix.
  function grounding() {
    try {
      if (typeof window !== 'undefined' && window.KodroCommands && window.KodroCommands.groundingText && window.getKodroRobot) {
        const g = window.KodroCommands.groundingText(window.getKodroRobot());
        if (g) return g + '\n\n';
      }
    } catch (e) { void e; }
    return '';
  }

  function currentCommandNames() {
    try {
      if (typeof window !== 'undefined' && window.KodroCommands && window.KodroCommands.commandNames && window.getKodroRobot) {
        return window.KodroCommands.commandNames(window.getKodroRobot()).slice();
      }
    } catch (e) { void e; }
    return ['move_forward', 'move_backward', 'turn_left', 'turn_right', 'set_speed', 'wait', 'stop'];
  }

  // Hardware-aware postcondition shared by chat, review and Ask. The runtime
  // catches syntax and sandbox errors; this catches runnable code that still
  // calls a drive or sensor missing from the active Robot Lab build.
  function validateForBuild(code) {
    const allowed = currentCommandNames();
    const has = function (name) { return allowed.indexOf(name) >= 0; };
    const rules = {
      move_forward: 'move_forward', move_backward: 'move_backward',
      turn_left: 'turn_left', turn_right: 'turn_right',
      distance: 'distance', read_distance: 'distance', obstacle_ahead: 'distance', scan: 'distance',
      heading: 'heading', read_heading: 'heading', tilt: 'heading', on_line: 'on_line',
    };
    for (const name in rules) {
      if (!has(rules[name]) && new RegExp('\\b' + name + '\\s*\\(').test(String(code || ''))) {
        return { ok: false, error: name + '() is not available on the current robot build.' };
      }
    }
    return { ok: true };
  }

  // The CANONICAL robot API is bare, metre-based function calls. rover.*(...)
  // still runs as a deprecated centimetre-based compatibility alias, but the
  // model must not use it: mixing the two dialects in one program is a 100x
  // unit trap. The prompt is explicit, the output is gated, and normalizeApi
  // below converts stray rover.forward(cm) into the equivalent bare METRE
  // call (value included) so a rewrite never silently changes distances.
  const API_HINT = 'The robot is programmed with BARE Python function calls, NEVER object methods. Use exactly: move_forward(metres), move_backward(metres), turn_left(degrees), turn_right(degrees), set_speed(percent), say("text"), led("colour"), beep(1), wait(seconds), scan(), pen_down(), pen_up(). Sensors are distance() and heading(). distance() returns CENTIMETRES to the nearest wall (0 to 4000); to stop near a wall loop while distance() > 40 and move a small step inside. NEVER write rover.anything() or robot.anything() or create any object. Distances are in METRES and the arena is small (about 15 metres from the centre to a wall), so a normal move is 1 to 5 metres: "a few metres" means move_forward(3), never 30 or 300. A turn is 90 degrees for a right angle, 180 to face back. A beep is beep(1). A wait is wait(1) for one second. For repeated motion use a loop, for example "for i in range(4):" with an indented body. To stop before an obstacle, loop "while distance() > 40:" moving a small step like move_forward(1) inside. Keep programs short. Output ONLY runnable Python code, no prose, no explanations.\n\nExamples of correct code:\n# Example 1: move forward 3m, turn right 90, then move 2m\nmove_forward(3)\nturn_right(90)\nmove_forward(2)\n\n# Example 2: draw a square of side 2m\nfor i in range(4):\n    move_forward(2)\n    turn_right(90)\n\n# Example 3: drive forward until close to a wall\nwhile distance() > 40:\n    move_forward(1)';

  // The fine-tuned model strongly prefers object-method style (rover.move_forward,
  // rover.forward, rover.right) which the interpreter's bare-function surface does
  // not all accept. Rewrite those forms to the equivalent working bare call, so
  // its output runs regardless of how stubbornly it writes rover.x(...).
  function normalizeApi(code) {
    if (!code) return code;
    var alias = { forward: 'move_forward', backward: 'move_backward', left: 'turn_left', right: 'turn_right', speed: 'set_speed', scan: 'scan', distance: 'distance', heading: 'heading', battery: 'battery', stop: 'stop' };
    // Strip any stray markdown fences the model emits inside its code.
    var out = code.replace(/^```(?:python|py)?\s*/gim, '').replace(/```\s*$/gim, '');
    // Strip prose prefixes the model emits before code ("Here is ...", "Sure, ...").
    // Only drop a line if it does NOT contain a Python keyword or a function call,
    // so we never eat an actual line of code that happens to start with these words.
    var PY_KW = /\b(for|while|if|elif|else|def|return|import|from|in|not|and|or|True|False|None|break|continue|pass|with|try|except|finally|class|lambda|yield|raise|assert|del|global|nonlocal|is|as)\b/;
    var CALL = /[A-Za-z_]\w*\s*\(/;
    var PROSE_RE = /^[ \t]*(Here|Sure|This|The robot|To make|This code|This will|You can|Let me|I'll|Below)\b[^\n]*$/gmi;
    out = out.replace(PROSE_RE, function (line) {
      if (PY_KW.test(line) || CALL.test(line)) return line;
      return '';
    });
    // rover.forward(100) is CENTIMETRES; move_forward(1) is METRES. Convert
    // literal distances during the rewrite so "tidying" cannot silently turn
    // a 1 m drive into a clamped 40 m one (bugs D9: a ~100x behaviour change).
    // Non-literal args fall through to the plain rename below; models emit
    // literals in practice, and the validator gate still runs the result.
    out = out.replace(/\b(?:rover|robot|bot)\.(forward|backward)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)/g, function (m, name, num) {
      var metres = Math.round((parseFloat(num) / 100) * 1000) / 1000;
      return (name === 'forward' ? 'move_forward' : 'move_backward') + '(' + metres + ')';
    });
    // rover.robot.bot.method(...) -> method(...)
    out = out.replace(/\b(?:rover|robot|bot)\.([A-Za-z_]\w*)\s*\(/g, function (m, name) {
      return (alias[name] || name) + '(';
    });
    // rover.robot.bot.method without parens -> bare name
    out = out.replace(/\b(?:rover|robot|bot)\.([A-Za-z_]\w*)\b/g, function (m, name) {
      return alias[name] || name;
    });
    // Bare aliases -> canonical names
    out = out.replace(/\bforward\s*\(/g, 'move_forward(');
    out = out.replace(/\bbackward\s*\(/g, 'move_backward(');
    out = out.replace(/\bleft\s*\(/g, 'turn_left(');
    out = out.replace(/\bright\s*\(/g, 'turn_right(');
    // Drop a dangling bare object token on its own line.
    out = out.replace(/^[ \t]*(?:rover|robot|bot)[ \t]*$/gm, '');
    return out;
  }

  // Run a program through the real interpreter with deterministic sensor
  // readings and retain its observable actions. This is a semantic gate for AI
  // suggestions and an explanation aid, not a second physics engine.
  function programTrace(code, distanceCm) {
    try {
      if (typeof window === 'undefined' || !window.RoverLang) {
        return { ok: true, complete: true, actions: [] };
      }
      const prog = window.RoverLang.compile(code);
      const host = {
        move: function () {}, turn: function () {},
        sensor: function (name) {
          if (name === 'distance_m') return distanceCm / 100;
          if (name === 'distance') return distanceCm;
          if (name === 'battery') return 100;
          if (name === 'speed') return 50;
          return 0;
        },
        say: function () {}, led: function () {}, beep: function () {}, setSpeed: function () {},
        scan: function () {}, wait: function () {}, penDown: function () {}, penUp: function () {},
        log: function () {}, place: function () {}, collect: function () {}, drop: function () {}, clearProps: function () {},
      };
      const gen = prog.run(host);
      const actions = [];
      let n = 0;
      for (const ev of gen) {
        n += 1;
        if (n > 4000) {
          return { ok: false, complete: false, actions: actions, error: 'The program did not finish within 4,000 interpreter steps.' };
        }
        if (!ev || ev.type === 'step') continue;
        const action = { type: ev.type, line: ev.line || null };
        ['dir', 'distance', 'deg', 'value', 'seconds', 'down', 'color', 'text'].forEach(function (key) {
          if (ev[key] !== undefined) action[key] = ev[key];
        });
        actions.push(action);
        if (actions.length > 500) {
          return { ok: false, complete: false, actions: actions, error: 'The program produced too many actions to review safely.' };
        }
      }
      return { ok: true, complete: true, actions: actions };
    } catch (e) {
      return { ok: false, complete: false, actions: [], error: (e && e.message) || String(e) };
    }
  }

  function actionSignature(actions) {
    return JSON.stringify((actions || []).map(function (a) {
      const clean = {};
      Object.keys(a).forEach(function (key) { if (key !== 'line') clean[key] = a[key]; });
      return clean;
    }));
  }

  // "Keep the same behaviour" is a product guarantee, not prompt
  // decoration. Compare blocked and clear sensor cases before offering Apply.
  function reviewSemantics(original, proposed) {
    for (const distanceCm of [0, 1000]) {
      const before = programTrace(original, distanceCm);
      const after = programTrace(proposed, distanceCm);
      if (!after.ok) return { ok: false, error: after.error };
      if (before.ok && actionSignature(before.actions) !== actionSignature(after.actions)) {
        return {
          ok: false,
          error: 'The proposed rewrite changes what the robot does, so Kodro kept your original program.',
        };
      }
    }
    return { ok: true };
  }

  function actionWords(action) {
    if (!action) return 'does an instruction';
    if (action.type === 'move') return (action.dir < 0 ? 'moves backward ' : 'moves forward ') + ((action.distance || 0) / 100) + ' m';
    if (action.type === 'turn') return 'turns ' + (action.deg < 0 ? 'left ' : 'right ') + Math.abs(action.deg || 0) + ' degrees';
    if (action.type === 'speed') return 'sets speed to ' + action.value + '%';
    if (action.type === 'wait') return 'waits ' + action.seconds + ' s';
    if (action.type === 'print') return 'prints ' + JSON.stringify(action.text || '');
    if (action.type === 'say') return 'says ' + JSON.stringify(action.text || '');
    if (action.type === 'halt') return 'stops';
    return String(action.type || 'instruction').replace(/_/g, ' ');
  }

  // Exact, model-free explanation for the current editor program. Two traces
  // make the important obstacle/no-obstacle branch explicit.
  function verifiedProgramExplanation(code) {
    const blocked = programTrace(code, 0);
    const clear = programTrace(code, 1000);
    if (!blocked.ok || !clear.ok) return null;
    const describe = function (run) {
      if (!run.actions.length) return 'no observable robot action';
      return run.actions.map(function (a) {
        return (a.line ? 'line ' + a.line + ' ' : '') + actionWords(a);
      }).join(', then ');
    };
    const lines = String(code || '').split(/\r?\n/);
    const indentationFacts = [];
    lines.forEach(function (line, i) {
      if (!/^\s*(move_forward|move_backward|turn_left|turn_right|stop)\s*\(/.test(line)) return;
      if (!/^\s+/.test(line) && lines.slice(0, i).some(function (prior) { return /^\s*if\b.*:\s*$/.test(prior); })) {
        indentationFacts.push('Line ' + (i + 1) + ' is not indented, so it runs after the if block whichever answer the sensor gives.');
      }
    });
    return 'Verified from the current program:\n'
      + '• If an obstacle is ahead: ' + describe(blocked) + '.\n'
      + '• If the path is clear: ' + describe(clear) + '.'
      + (indentationFacts.length ? '\n• ' + indentationFacts.join(' ') : '')
      + '\nThis trace comes from Kodro’s interpreter, not from the language model guessing.';
  }

  function explainCurrentProgram(query, code) {
    const q = String(query || '');
    const codeQuestion = /\b(current|this|my)\s+(program|code)\b|what\s+does\s+(?:this|my)\s+(?:program|code)\s+do|explain\s+(?:exactly\s+)?(?:what|why|how)|line[- ]by[- ]line|obstacle_ahead|why.*\b(if|move|turn|stop)\b/i.test(q);
    if (!codeQuestion || !String(code || '').trim()) return null;
    const verified = verifiedProgramExplanation(code);
    if (!verified) return null;
    return {
      ok: true, text: verified, answer: verified, model: 'Kodro interpreter',
      grounded: true,
      sources: [{ source: 'Verified current program', text: String(code).slice(0, 1200) }],
      answerChecked: true, deterministic: true, source: 'interpreter',
    };
  }

  // Dry-run generated code through the real JS interpreter. A program that
  // exceeds the bounded trace is rejected rather than silently accepted.
  function validate(code) {
    const fitted = validateForBuild(code);
    if (!fitted.ok) return fitted;
    const traced = programTrace(code, 1000);
    return traced.ok ? { ok: true } : { ok: false, error: traced.error };
  }

  // --- streamed chat (start a job, poll for live text + final result) -------
  const jobs = {};
  let jid = 0;

  async function chatStart(history, lessonId) {
    const b = bridge();
    if (b && b.aiChatStart) return b.aiChatStart(history, lessonId, currentCommandNames());
    const cloud = (typeof window !== 'undefined' && window.KodroProviders && window.KodroProviders.cloudReady());
    let model;
    if (cloud) {
      model = window.KodroProviders.config().cloudModel;
    } else {
      let models;
      // Same origin-aware diagnosis as status(): a hosted page gets the
      // OLLAMA_ORIGINS fix, a local page gets "start Ollama". The "no models"
      // case below stays distinct (Ollama is reachable, just empty).
      try { models = await tags(); }
      catch (e) { void e; return { ok: false, reason: ollamaUnavailableReason().hint }; }
      model = pick(models);
      if (!model) return { ok: false, reason: 'Ollama has no models. Pull one (e.g. ollama pull qwen2.5-coder:3b), or connect a cloud key in the Vibe panel.' };
    }
    // Evict finished/orphaned jobs so a cancelled chat (whose poller stopped
    // before marking the job done) does not accumulate in the map across a
    // session (browser mode). Completed jobs from a prior turn are swept here.
    for (const k in jobs) { if (jobs[k] && jobs[k].done) delete jobs[k]; }
    const id = 'wj' + (++jid);
    const job = { done: false, text: '', result: null };
    jobs[id] = job;
    const sys = grounding() + 'You are Kodro\'s coding assistant for a simulated robot. The only fitted commands you may use are: '
      + currentCommandNames().join(', ') + '. ' + API_HINT
      + ' Reply with EITHER one short clarifying question OR only runnable code using the fitted bare functions, in a python fence, no prose around it.';
    const prompt = (history || []).map(function (m) {
      return (m.role === 'user' ? 'User: ' : 'Assistant: ') + (m.text || '');
    }).join('\n') + '\nAssistant:';
    (async function () {
      try {
        if (typeof window !== 'undefined' && window.KodroProviders && window.KodroProviders.cloudReady()) {
          // Cloud provider (BYOK): one non-streamed request, then the same
          // post-processing (code detection, normalise, self-test) as Ollama.
          job.text = await window.KodroProviders.generate(prompt, { system: sys, num_predict: 400, temperature: 0.3 }, model);
        } else {
          // Streamed generation: the AbortController guards the WHOLE read, not
          // just the initial response, so a model that stalls mid-stream (or
          // never produces a first token) is cut off with a clear error instead
          // of hanging the panel. The timer is cleared once the stream ends.
          const ctrl = new AbortController();
          const timer = setTimeout(function () { ctrl.abort(); }, GEN_TIMEOUT_MS);
          try {
            const r = await fetch(localOnly(OLLAMA + '/api/generate'), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: model, prompt: prompt, system: sys, stream: true, keep_alive: '30m', options: { temperature: 0.3, num_predict: 400 } }),
              signal: ctrl.signal,
            });
            if (!r.ok || !r.body) throw new Error('generate ' + (r && r.status));
            const reader = r.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            for (;;) {
              const out = await reader.read();
              if (out.done) break;
              buf += dec.decode(out.value, { stream: true });
              let nl;
              while ((nl = buf.indexOf('\n')) >= 0) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line) continue;
                try { const c = JSON.parse(line); if (c.response) job.text += c.response; } catch (e) { void e; }
              }
            }
          } catch (eStream) {
            if (eStream && eStream.name === 'AbortError') throw new Error('the model took too long, it may still be loading, try again');
            throw eStream;
          } finally {
            clearTimeout(timer);
          }
        }
        const full = job.text.trim();
        if (looksLikeCode(full)) {
          let code = normalizeApi(extractCode(full));
          const v = validate(code);
          let validated = v.ok;
          if (!v.ok) {
            // One repair round, feeding the real interpreter error back, so the
            // browser ships code that actually runs (mirrors the desktop gate).
            try {
              const fix = await genOnce(model, prompt + '\n\nThat code failed to run with this error: ' + v.error + '\nThe code must use ONLY bare function calls like move_forward(3), NOT rover.move_forward(3). Fix the syntax and return only the corrected code. ' + API_HINT, { system: sys, num_predict: 400, temperature: 0.2 });
              const fixed = normalizeApi(extractCode(fix));
              if (fixed && validate(fixed).ok) { code = fixed; validated = true; }
            } catch (e2) { void e2; }
          }
          if (!validated) {
            // Grammar-constrained backstop: free-form generation + the repair
            // round still produced code that will not run (typically an invented
            // command or a call to a sensor the build lacks). Regenerate through
            // structuredProgram, whose JSON-schema decoder can ONLY emit the
            // fitted command set, so the result is in-set by construction. Use it
            // only if it actually validates -- never silently replace with worse.
            try {
              const sp = await structuredProgram(prompt, model);
              if (sp && sp.code && validate(sp.code).ok) { code = sp.code; validated = true; }
            } catch (e3) { void e3; }
          }
          if (validated) {
            job.result = { ok: true, done: true, type: 'code', code: code, model: model };
          } else {
            // Fail closed: known-broken code is useful diagnostic evidence, but
            // it must never become an applicable editor action.
            job.result = {
              ok: false,
              reason: 'The model\'s program was rejected by Kodro\'s safety check.',
              rejectedCode: code,
              validationError: v.error,
              model: model,
            };
          }
        } else {
          job.result = { ok: true, done: true, type: 'question', text: stripFences(full), model: model };
        }
        job.done = true;
      } catch (e) {
        job.result = { ok: false, reason: 'AI generation failed: ' + ((e && e.message) || e) };
        job.done = true;
      }
    })();
    return { ok: true, jobId: id };
  }

  async function chatPoll(id) {
    const b = bridge();
    if (b && b.aiChatPoll) return b.aiChatPoll(id);
    const job = jobs[id];
    if (!job) return { ok: false, reason: 'job not found' };
    if (job.done) { const res = job.result; delete jobs[id]; return res; }
    return { ok: true, done: false, text: job.text };
  }

  // Fire-and-forget model warm-up: an empty generate makes Ollama load the
  // model into RAM at app start, so the FIRST real request does not pay the
  // 10 to 30s cold load. Once per model per session; failures are ignored.
  const warmed = {};
  function warm(model) {
    if (!model || warmed[model]) return;
    warmed[model] = true;
    try {
      fetch(localOnly(OLLAMA + '/api/generate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, prompt: '', stream: false, keep_alive: '30m', options: { num_predict: 1 } }),
      }).catch(function () {});
    } catch (e) { void e; }
  }

  async function status() {
    const b = bridge();
    if (b && b.aiStatus) return b.aiStatus();
    // A ready BYOK cloud provider makes the assistant available regardless of
    // whether Ollama is running.
    if (typeof window !== 'undefined' && window.KodroProviders && window.KodroProviders.cloudReady()) {
      const cfg = window.KodroProviders.config();
      return { available: true, model: cfg.cloudModel, models: [cfg.cloudModel], override: override, source: cfg.provider };
    }
    try {
      const ms = await tags();
      const chosen = pick(ms);
      if (chosen) warm(chosen);
      return { available: ms.length > 0, model: chosen, models: ms, override: override, source: 'browser' };
    } catch (e) {
      void e;
      // tags() failed. Tell the two failure modes apart via the shared
      // ollamaUnavailableReason(), and hand the UI both the machine code
      // (`reason`) and the copy-pasteable, origin-aware fix (`hint`, rendered by
      // panels.jsx). The vibe chat, reviewer and Ask now surface this SAME hint.
      const u = ollamaUnavailableReason();
      return {
        available: false, model: null, models: [], override: override, source: 'browser',
        reason: u.reason,
        hint: u.hint,
      };
    }
  }

  function setModel(name) {
    const choice = (name || '').trim() || null;
    override = choice;
    try { if (choice) localStorage.setItem('kodro_web_model', choice); else localStorage.removeItem('kodro_web_model'); } catch (e) { void e; }
    const b = bridge();
    if (b && b.setAiModel) return b.setAiModel(name || '');
    return Promise.resolve({ ok: true, model: choice });
  }

  async function reviewCode(src, lessonId) {
    const b = bridge();
    if (b && b.aiReviewCode) return b.aiReviewCode(src, lessonId, currentCommandNames());
    const cloud = (typeof window !== 'undefined' && window.KodroProviders && window.KodroProviders.cloudReady());
    let model;
    if (cloud) { model = window.KodroProviders.config().cloudModel; }
    else {
      let models;
      try { models = await tags(); } catch (e) { void e; return { ok: false, reason: ollamaUnavailableReason().hint }; }
      model = pick(models);
      if (!model) return { ok: false, reason: 'Ollama has no models (or connect a cloud key in the Vibe panel).' };
    }
    const sys = grounding() + 'You are a careful code reviewer for a simulated robot in Python. Return a tidied, runnable version of the user code in a python fence, then one or two short plain lines of what you changed and why. Keep the same behaviour.';
    try {
      const out = await genOnce(model, 'Review and tidy this rover program:\n\n' + src, { system: sys, num_predict: 500 });
      const code = normalizeApi(extractCode(out));
      const notes = stripFences(out.replace(/```[\s\S]*?```/g, '')).trim();
      const check = code ? validate(code) : { ok: true };
      const semantic = (code && check.ok) ? reviewSemantics(src, code) : { ok: check.ok, error: check.error };
      const revised = !!code && code !== src.trim() && check.ok && semantic.ok;
      // The review panel renders `issues`; the desktop bridge fills it from
      // Python but this facade never did, so a browser review ALWAYS said
      // "No problems spotted" while presenting a rewrite (bugs D3). Surface
      // the model's own notes as the issue lines, and never pair a rewrite
      // with an all-clear.
      const issues = notes ? notes.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
      if (!issues.length && revised) issues.push('The reviewer suggests a tidied rewrite - read the diff below before applying.');
      if (!check.ok) issues.unshift('Kodro rejected the proposed rewrite: ' + check.error);
      else if (!semantic.ok) issues.unshift(semantic.error);
      return { ok: true, revised: revised, code: revised ? code : src.trim(), notes: notes || 'Reviewed.', issues: issues, model: model, source: cloud ? window.KodroProviders.config().provider : 'local', validated: check.ok && semantic.ok };
    } catch (e) { return { ok: false, reason: 'Review failed: ' + ((e && e.message) || e) }; }
  }

  async function ask(query, context) {
    context = context || {};
    const directExplanation = explainCurrentProgram(query, context.code);
    if (directExplanation) return directExplanation;
    const b = bridge();
    if (b && b.aiAsk) return b.aiAsk(query, currentCommandNames(), context.lessonId || null);
    const cloud = (typeof window !== 'undefined' && window.KodroProviders && window.KodroProviders.cloudReady());
    let model;
    if (cloud) { model = window.KodroProviders.config().cloudModel; }
    else {
      let models;
      try { models = await tags(); } catch (e) { void e; return { ok: false, reason: ollamaUnavailableReason().hint }; }
      model = pick(models);
      if (!model) return { ok: false, reason: 'Ollama has no models (or connect a cloud key in the Vibe panel).' };
    }
    const sources = (typeof window !== 'undefined' && window.RoboLearn && window.RoboLearn.searchLessonNotes)
      ? await window.RoboLearn.searchLessonNotes(query, 3, context.lessonId || null) : [];
    if (!sources.length) {
      return { ok: false, reason: 'I could not find this in Kodro\'s built-in lesson notes, so I will not guess.' };
    }
    const evidence = sources.map(function (s, i) { return '[' + (i + 1) + '] ' + s.source + ': ' + s.text; }).join('\n\n');
    const sys = grounding() + 'Answer using ONLY the numbered Kodro lesson notes below. Cite the supporting note number. If the notes do not answer the question, say so. Use only fitted commands and never invent an object method.\n\n' + evidence;
    try {
      const answer = normalizeApi(stripFences(await genOnce(model, query, { system: sys, num_predict: 350 })));
      const checked = validateForBuild(answer);
      if (!checked.ok) {
        return { ok: true, answer: 'That command is not available on the current robot build. Fit the required drive or sensor in Robot Lab, then ask again.', text: 'That command is not available on the current robot build. Fit the required drive or sensor in Robot Lab, then ask again.', model: model, grounded: true, sources: sources, answerChecked: false, answerWarning: checked.error, source: cloud ? window.KodroProviders.config().provider : 'local' };
      }
      return { ok: true, text: answer, answer: answer, model: model, grounded: true, sources: sources, answerChecked: true, source: cloud ? window.KodroProviders.config().provider : 'local' };
    } catch (e) { return { ok: false, reason: 'Ask failed: ' + ((e && e.message) || e) }; }
  }

  async function available() {
    const b = bridge();
    if (b) return true;
    if (typeof window !== 'undefined' && window.KodroProviders && window.KodroProviders.cloudReady()) return true;
    try { const ms = await tags(); return ms.length > 0; } catch (e) { return false; }
  }

  if (typeof window !== 'undefined') {
    window.KodroAI = { status: status, setModel: setModel, chatStart: chatStart, chatPoll: chatPoll, reviewCode: reviewCode, ask: ask, available: available, pick: pick,
      explainCurrentProgram: explainCurrentProgram,
      structuredProgram: structuredProgram, buildCommandSchema: buildCommandSchema, compileProgram: compileProgram,
      toolCall: toolCall, resolveToolCall: resolveToolCall };
  }
})();
