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

  function bridge() {
    return (typeof window !== 'undefined' && window.RoboLearn && window.RoboLearn.isAvailable && window.RoboLearn.isAvailable())
      ? window.RoboLearn : null;
  }

  let override = null;
  try { override = localStorage.getItem('kodro_web_model') || null; } catch (e) { void e; }

  async function tags() {
    const r = await fetch(localOnly(OLLAMA + '/api/tags'), { method: 'GET' });
    if (!r.ok) throw new Error('tags ' + r.status);
    const j = await r.json();
    return (j.models || []).map(function (m) { return m && m.name; }).filter(Boolean);
  }

  // Mirror the Python picker: prefer the locally fine-tuned Kodro models, then
  // any coder-style model, then any non-embedding model.
  function pick(models) {
    if (!models || !models.length) return null;
    if (override && models.indexOf(override) >= 0) return override;
    const prefixes = ['kodro-coder', 'kodro-fast', 'kodro-tutor', 'robolearn'];
    for (let i = 0; i < prefixes.length; i++) {
      const m = models.find(function (n) { return n.toLowerCase().indexOf(prefixes[i]) === 0; });
      if (m) return m;
    }
    const coder = models.find(function (n) { return /coder|code|qwen|deepseek|llama|gemma|mistral/i.test(n); });
    if (coder) return coder;
    const noEmbed = models.filter(function (n) { return !/embed/i.test(n); });
    return noEmbed[0] || models[0] || null;
  }

  async function genOnce(model, prompt, opts) {
    opts = opts || {};
    const body = {
      model: model, prompt: prompt, stream: false,
      options: { temperature: opts.temperature != null ? opts.temperature : 0.3, num_predict: opts.num_predict || 400 },
    };
    if (opts.system) body.system = opts.system;
    const r = await fetch(localOnly(OLLAMA + '/api/generate'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('generate ' + r.status);
    const j = await r.json();
    return (j.response || '').trim();
  }

  function looksLikeCode(t) {
    return /(```|\brover\.|move_forward|move_backward|turn_left|turn_right|set_speed|\bfor\s+\w+\s+in\b|\bwhile\b|\bdef\s|\bif\s+.*:)/.test(t);
  }
  function extractCode(t) {
    const fence = t.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
    return (fence ? fence[1] : t).trim();
  }
  function stripFences(t) { return t.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim(); }

  // --- streamed chat (start a job, poll for live text + final result) -------
  const jobs = {};
  let jid = 0;

  async function chatStart(history, lessonId) {
    const b = bridge();
    if (b && b.aiChatStart) return b.aiChatStart(history, lessonId);
    let models;
    try { models = await tags(); }
    catch (e) { return { ok: false, reason: 'Ollama is not running. Start the Ollama app, then try again.' }; }
    const model = pick(models);
    if (!model) return { ok: false, reason: 'Ollama has no models. Pull one, e.g. ollama pull qwen2.5-coder:3b.' };
    const id = 'wj' + (++jid);
    const job = { done: false, text: '', result: null };
    jobs[id] = job;
    const sys = 'You are Kodro\'s offline coding assistant for a simulated robot. Reply with EITHER one short clarifying question OR runnable rover Python that uses only the commands the build supports. Prefer code. Put code in a python fence and add no prose around it.';
    const prompt = (history || []).map(function (m) {
      return (m.role === 'user' ? 'User: ' : 'Assistant: ') + (m.text || '');
    }).join('\n') + '\nAssistant:';
    (async function () {
      try {
        const r = await fetch(localOnly(OLLAMA + '/api/generate'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model, prompt: prompt, system: sys, stream: true, options: { temperature: 0.3, num_predict: 400 } }),
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
        const full = job.text.trim();
        job.result = looksLikeCode(full)
          ? { ok: true, done: true, type: 'code', code: extractCode(full), model: model }
          : { ok: true, done: true, type: 'question', text: stripFences(full), model: model };
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

  async function status() {
    const b = bridge();
    if (b && b.aiStatus) return b.aiStatus();
    try {
      const ms = await tags();
      return { available: ms.length > 0, model: pick(ms), models: ms, override: override, source: 'browser' };
    } catch (e) { return { available: false, model: null, models: [], override: override, source: 'browser' }; }
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
    if (b && b.aiReviewCode) return b.aiReviewCode(src, lessonId);
    let models;
    try { models = await tags(); } catch (e) { return { ok: false, reason: 'Ollama is not running.' }; }
    const model = pick(models);
    if (!model) return { ok: false, reason: 'Ollama has no models.' };
    const sys = 'You are a careful code reviewer for a simulated robot in Python. Return a tidied, runnable version of the user code in a python fence, then one or two short plain lines of what you changed and why. Keep the same behaviour.';
    try {
      const out = await genOnce(model, 'Review and tidy this rover program:\n\n' + src, { system: sys, num_predict: 500 });
      const code = extractCode(out);
      const notes = stripFences(out.replace(/```[\s\S]*?```/g, '')).trim();
      return { ok: true, revised: !!code && code !== src.trim(), code: code, notes: notes || 'Reviewed.', model: model };
    } catch (e) { return { ok: false, reason: 'Review failed: ' + ((e && e.message) || e) }; }
  }

  async function ask(query) {
    const b = bridge();
    if (b && b.aiAsk) return b.aiAsk(query);
    let models;
    try { models = await tags(); } catch (e) { return { ok: false, reason: 'Ollama is not running.' }; }
    const model = pick(models);
    if (!model) return { ok: false, reason: 'Ollama has no models.' };
    const sys = 'You are Kodro\'s offline assistant. Answer briefly and concretely about designing and programming the simulated robot. If unsure, say so.';
    try {
      const text = await genOnce(model, query, { system: sys, num_predict: 350 });
      return { ok: true, text: stripFences(text), answer: stripFences(text), model: model };
    } catch (e) { return { ok: false, reason: 'Ask failed: ' + ((e && e.message) || e) }; }
  }

  async function available() {
    const b = bridge();
    if (b) return true;
    try { const ms = await tags(); return ms.length > 0; } catch (e) { return false; }
  }

  // Speak through the desktop bridge if present, else the browser's built-in
  // speech synthesis, so spoken replies work in browser mode too. Best-effort.
  function speak(text, gender, rate) {
    const b = bridge();
    if (b && b.speak) { try { return b.speak(text, gender, rate); } catch (e) { void e; } return; }
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis && text) {
        const u = new window.SpeechSynthesisUtterance(String(text));
        if (rate) u.rate = 1 + (rate / 10);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch (e) { void e; }
  }

  if (typeof window !== 'undefined') {
    window.KodroAI = { status: status, setModel: setModel, chatStart: chatStart, chatPoll: chatPoll, reviewCode: reviewCode, ask: ask, available: available, speak: speak, pick: pick };
  }
})();
