/* window.KodroProviders -- pluggable AI backend for the assistant.
 *
 * Kodro is OFFLINE BY DEFAULT: the default provider is the local Ollama server
 * at http://localhost:11434, and with no other provider selected the app makes
 * ZERO external network calls. A user who wants a stronger model may connect
 * their OWN key (bring-your-own-key) for Anthropic Claude or OpenAI. That key
 * lives only in this browser's localStorage, is sent only to that one provider,
 * and is never logged, uploaded, or shared. Switching back to Ollama (or simply
 * not entering a key) restores the fully offline guarantee.
 *
 * This module owns provider config + a single generate(prompt, opts) entry the
 * assistant facade (ai-web.jsx) routes through, so the rest of the app does not
 * care which model answered.
 */
(function () {
  'use strict';

  var OLLAMA = 'http://localhost:11434';
  var LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+/i;

  // Provider registry. `local:true` providers are the offline guarantee and use
  // the localhost-only guard; cloud providers require an explicit user key and
  // are never contacted until one is set AND the provider is selected.
  var PROVIDERS = {
    ollama: { id: 'ollama', label: 'Local (Ollama, offline)', local: true },
    anthropic: {
      id: 'anthropic', label: 'Anthropic (Claude, your key)', local: false,
      endpoint: 'https://api.anthropic.com/v1/messages',
      defaultModel: 'claude-3-5-sonnet-latest',
    },
    openai: {
      id: 'openai', label: 'OpenAI (GPT, your key)', local: false,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4o-mini',
    },
    groq: {
      id: 'groq', label: 'Groq (fast LPU, your key)', local: false,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      defaultModel: 'llama-3.3-70b-versatile',
    },
  };

  var KEYS = {
    provider: 'kodro_ai_provider',
    cloudModel: 'kodro_ai_cloud_model',
    key: function (id) { return 'kodro_ai_key_' + id; },
  };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { void e; } }

  function providerId() {
    var p = lsGet(KEYS.provider);
    return (p && PROVIDERS[p]) ? p : 'ollama';
  }
  function isLocal() { return !!(PROVIDERS[providerId()] || {}).local; }
  function keyFor(id) { return lsGet(KEYS.key(id)) || ''; }
  function cloudModel() {
    var id = providerId();
    var pr = PROVIDERS[id] || {};
    return lsGet(KEYS.cloudModel) || pr.defaultModel || '';
  }

  // A cloud provider is USABLE only when selected AND holding a key. Otherwise
  // the app silently falls back to the offline path, so a half-configured cloud
  // provider never blocks the assistant and never leaks a request.
  function cloudReady() {
    var id = providerId();
    var pr = PROVIDERS[id];
    return !!(pr && !pr.local && keyFor(id));
  }

  function localOnly(url) {
    if (!LOCAL_RE.test(url)) throw new Error('refusing non-local URL (offline): ' + url);
    return url;
  }

  // Time budget for a cloud (BYOK) generate. A cloud API that hangs (network
  // stall, provider outage, a request that never returns) would otherwise leave
  // the vibe/review/Ask panel spinning forever, so every cloud request is
  // wrapped in an AbortController plus timer. The timer is cleared on success
  // AND on failure, and an aborted request surfaces one clear, honest error.
  // Mirrors the local Ollama fetch guard (fetchTimeout) in ai-web.jsx.
  var CLOUD_TIMEOUT_MS = 120000;

  function fetchTimeout(url, options, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    var opts = Object.assign({}, options || {}, { signal: ctrl.signal });
    return fetch(url, opts).then(
      function (r) { clearTimeout(timer); return r; },
      function (e) {
        clearTimeout(timer);
        if (e && e.name === 'AbortError') throw new Error('the cloud model took too long, try again');
        throw e;
      }
    );
  }

  // --- cloud generate (BYOK) -------------------------------------------------
  async function anthropicGenerate(prompt, opts, key, model) {
    var body = {
      model: model,
      max_tokens: opts.num_predict || 400,
      messages: [{ role: 'user', content: prompt }],
    };
    if (opts.system) body.system = opts.system;
    if (opts.temperature != null) body.temperature = opts.temperature;
    var r = await fetchTimeout(PROVIDERS.anthropic.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Anthropic requires this opt-in header to allow a direct browser call.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    }, CLOUD_TIMEOUT_MS);
    if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
    var j = await r.json();
    var parts = (j.content || []).filter(function (c) { return c && c.type === 'text'; });
    return parts.map(function (c) { return c.text; }).join('').trim();
  }

  // OpenAI-compatible chat/completions, shared by OpenAI and Groq (Groq exposes
  // the identical /openai/v1 surface). `label` only shapes the error message.
  async function openaiCompatibleGenerate(endpoint, label, prompt, opts, key, model) {
    var messages = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });
    var body = { model: model, messages: messages, max_tokens: opts.num_predict || 400 };
    if (opts.temperature != null) body.temperature = opts.temperature;
    var r = await fetchTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
    }, CLOUD_TIMEOUT_MS);
    if (!r.ok) throw new Error(label + ' ' + r.status + ': ' + (await r.text()).slice(0, 200));
    var j = await r.json();
    return (((j.choices || [])[0] || {}).message || {}).content ? j.choices[0].message.content.trim() : '';
  }

  function openaiGenerate(prompt, opts, key, model) {
    return openaiCompatibleGenerate(PROVIDERS.openai.endpoint, 'OpenAI', prompt, opts, key, model);
  }

  // Ollama non-streaming generate (the offline default).
  async function ollamaGenerate(prompt, opts, model) {
    var body = {
      model: model, prompt: prompt, stream: false, keep_alive: '30m',
      options: { temperature: opts.temperature != null ? opts.temperature : 0.3, num_predict: opts.num_predict || 400 },
    };
    if (opts.system) body.system = opts.system;
    var r = await fetch(localOnly(OLLAMA + '/api/generate'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('generate ' + r.status);
    var j = await r.json();
    return (j.response || '').trim();
  }

  // The single entry the assistant routes through. `ollamaModel` is the resolved
  // local model name (the facade already picks it); cloud providers use the
  // user's configured cloud model. When a cloud provider is selected but not
  // ready (no key), we fall back to Ollama, preserving the offline default.
  async function generate(prompt, opts, ollamaModel) {
    opts = opts || {};
    var id = providerId();
    var pr = PROVIDERS[id];
    if (pr && !pr.local && cloudReady()) {
      var key = keyFor(id);
      var model = cloudModel();
      if (id === 'anthropic') return anthropicGenerate(prompt, opts, key, model);
      if (id === 'openai') return openaiGenerate(prompt, opts, key, model);
      if (id === 'groq') return openaiCompatibleGenerate(PROVIDERS.groq.endpoint, 'Groq', prompt, opts, key, model);
    }
    return ollamaGenerate(prompt, opts, ollamaModel);
  }

  // List selectable models for the active provider (best effort). Ollama and
  // OpenAI can list; Anthropic has no simple list endpoint, so we offer a small
  // curated set the user can still override with a free-text model id.
  async function listCloudModels() {
    var id = providerId();
    if (id === 'openai' && keyFor('openai')) {
      try {
        var r = await fetch(PROVIDERS.openai.endpoint.replace('/chat/completions', '/models'), {
          headers: { Authorization: 'Bearer ' + keyFor('openai') },
        });
        if (r.ok) {
          var j = await r.json();
          return (j.data || []).map(function (m) { return m.id; }).filter(function (x) { return /gpt|o1|o3|o4/i.test(x); }).sort();
        }
      } catch (e) { void e; }
      return ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'];
    }
    if (id === 'groq' && keyFor('groq')) {
      try {
        var rg = await fetch(PROVIDERS.groq.endpoint.replace('/chat/completions', '/models'), {
          headers: { Authorization: 'Bearer ' + keyFor('groq') },
        });
        if (rg.ok) {
          var jg = await rg.json();
          return (jg.data || []).map(function (m) { return m.id; }).sort();
        }
      } catch (e) { void e; }
      return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-2.5-coder-32b'];
    }
    if (id === 'anthropic') {
      return ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'];
    }
    return [];
  }

  function config() {
    var id = providerId();
    var pr = PROVIDERS[id] || {};
    return {
      provider: id,
      label: pr.label || id,
      local: !!pr.local,
      cloudReady: cloudReady(),
      cloudModel: cloudModel(),
      hasKey: !!keyFor(id),
      providers: Object.keys(PROVIDERS).map(function (k) {
        return { id: k, label: PROVIDERS[k].label, local: !!PROVIDERS[k].local, hasKey: !!keyFor(k) };
      }),
    };
  }

  function setProvider(id) { if (PROVIDERS[id]) { lsSet(KEYS.provider, id); lsSet(KEYS.cloudModel, ''); } return config(); }
  function setKey(id, key) { if (PROVIDERS[id] && !PROVIDERS[id].local) lsSet(KEYS.key(id), (key || '').trim()); return config(); }
  function setCloudModel(model) { lsSet(KEYS.cloudModel, (model || '').trim()); return config(); }

  if (typeof window !== 'undefined') {
    window.KodroProviders = {
      generate: generate,
      config: config,
      setProvider: setProvider,
      setKey: setKey,
      setCloudModel: setCloudModel,
      listCloudModels: listCloudModels,
      cloudReady: cloudReady,
      isLocal: isLocal,
    };
  }
})();
