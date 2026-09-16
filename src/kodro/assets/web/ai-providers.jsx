/* window.KodroProviders -- zero-cost local AI runtime.
 *
 * The public Kodro web build executes AI only through the user's local Ollama
 * server at localhost. Hosted BYOK providers were removed so opening or using
 * Kodro cannot accidentally create a cloud bill. Astra is presented separately
 * by astra-provider.js as an unavailable connection option, not an executable
 * browser provider.
 */
(function () {
  'use strict';

  var OLLAMA = 'http://localhost:11434';
  var LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+/i;
  var PROVIDER_KEY = 'kodro_ai_provider';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { void e; } }

  // One-way cleanup of browser credentials/endpoints from older cloud-provider
  // builds. Values are never read before deletion.
  try {
    ['kodro_ai_key_groq', 'kodro_ai_key_openrouter', 'kodro_ai_key_custom', 'kodro_ai_custom_endpoint'].forEach(function (k) {
      localStorage.removeItem(k);
    });
  } catch (e) { void e; }

  function providerId() {
    return lsGet(PROVIDER_KEY) === 'ollama' ? 'ollama' : 'ollama';
  }
  function isLocal() { return true; }
  function cloudReady() { return false; }

  function localOnly(url) {
    if (!LOCAL_RE.test(url)) throw new Error('refusing non-local URL (offline): ' + url);
    return url;
  }

  async function ollamaGenerate(prompt, opts, model) {
    opts = opts || {};
    var body = {
      model: model,
      prompt: prompt,
      stream: false,
      keep_alive: '30m',
      options: {
        temperature: opts.temperature != null ? opts.temperature : 0.3,
        num_predict: opts.num_predict || 400,
      },
    };
    if (opts.system) body.system = opts.system;
    var r = await fetch(localOnly(OLLAMA + '/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('generate ' + r.status);
    var j = await r.json();
    return (j.response || '').trim();
  }

  async function generate(prompt, opts, ollamaModel) {
    return ollamaGenerate(prompt, opts || {}, ollamaModel);
  }

  function config() {
    return {
      provider: providerId(),
      label: 'Local (Ollama, offline)',
      local: true,
      cloudReady: false,
      cloudModel: '',
      hasKey: false,
      endpoint: '',
      needsEndpoint: false,
      providers: [{ id: 'ollama', label: 'Local (Ollama, offline)', local: true, hasKey: false }],
    };
  }

  function setProvider(id) {
    // Astra is intercepted by astra-provider.js. Every provider known to this
    // base runtime resolves to Ollama.
    if (id === 'ollama') lsSet(PROVIDER_KEY, 'ollama');
    return config();
  }
  function setKey(id, key) { void id; void key; return config(); }
  function setCloudModel(model) { void model; return config(); }
  function setEndpoint(url) { void url; return config(); }
  async function listCloudModels() { return []; }

  if (typeof window !== 'undefined') {
    window.KodroProviders = {
      generate: generate,
      config: config,
      setProvider: setProvider,
      setKey: setKey,
      setCloudModel: setCloudModel,
      setEndpoint: setEndpoint,
      listCloudModels: listCloudModels,
      cloudReady: cloudReady,
      isLocal: isLocal,
    };
  }
})();
