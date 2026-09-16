/* Kodro GPT-6 Astra provider adapter.
 *
 * Loaded before bundle.js. The compiled bundle assigns window.KodroProviders;
 * this adapter intercepts that assignment and adds Astra without changing the
 * default: Ollama remains local/offline until a user explicitly selects Astra.
 *
 * Astra is server managed. The browser never reads, stores, or transmits an
 * OpenAI credential and never calls OpenAI directly. It sends only a normalized
 * prompt/schema request to Kodro's server proxy.
 */
(function (window, fetch, localStorage) {
  'use strict';

  if (!window || typeof fetch !== 'function') return;

  var PROVIDER_ID = 'astra';
  var MODEL = 'gpt-6-astra';
  var PROXY_ENDPOINT = 'https://kodro-ca2.vercel.app/api/astra';
  var PROVIDER_KEY = 'kodro_ai_provider';
  var MODEL_KEY = 'kodro_ai_cloud_model';
  var TIMEOUT_MS = 120000;

  function lsGet(key) {
    try { return localStorage && localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try {
      if (!localStorage) return;
      if (value == null || value === '') localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { void e; }
  }

  // One-way migration from the original browser-BYOK experiment. The literal
  // is intentionally used ONLY for deletion: never read the old value into JS.
  try { if (localStorage) localStorage.removeItem('kodro_ai_key_astra'); } catch (e) { void e; }

  function selected() { return lsGet(PROVIDER_KEY) === PROVIDER_ID; }

  async function astraGenerate(prompt, opts) {
    opts = opts || {};
    var requested = Number(opts.num_predict) || 400;
    var maxOutput = Math.max(1024, Math.min(4096, requested * 2));
    var body = {
      input: String(prompt == null ? '' : prompt),
      max_output_tokens: maxOutput,
    };
    if (opts.system) body.instructions = String(opts.system);
    if (opts.format) body.schema = opts.format;

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    var res;
    try {
      res = await fetch(PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('GPT-6 Astra proxy took too long, try again');
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      var detail = '';
      try { detail = (await res.text()).slice(0, 240); } catch (e) { void e; }
      throw new Error('Astra proxy ' + res.status + (detail ? ': ' + detail : ''));
    }
    var json = await res.json();
    if (json && json.error) throw new Error('Astra proxy: ' + (json.error.message || json.error || 'request failed'));
    var text = json && typeof json.output_text === 'string' ? json.output_text.trim() : '';
    if (!text) throw new Error('GPT-6 Astra returned no text');
    return text;
  }

  function wrap(base) {
    if (!base || base.__kodroAstraWrapped) return base;

    var wrapped = Object.assign({}, base);
    wrapped.__kodroAstraWrapped = true;

    wrapped.config = function () {
      var cfg = base.config();
      var providers = (cfg.providers || []).filter(function (p) { return p && p.id !== PROVIDER_ID; });
      providers.push({
        id: PROVIDER_ID,
        label: 'OpenAI GPT-6 Astra (server managed)',
        local: false,
        hasKey: false,
        serverManaged: true,
      });
      if (!selected()) return Object.assign({}, cfg, { providers: providers });
      return Object.assign({}, cfg, {
        provider: PROVIDER_ID,
        label: 'OpenAI GPT-6 Astra (server managed)',
        local: false,
        cloudReady: true,
        cloudModel: MODEL,
        hasKey: false,
        serverManaged: true,
        endpoint: PROXY_ENDPOINT,
        needsEndpoint: false,
        providers: providers,
      });
    };

    wrapped.setProvider = function (id) {
      if (id === PROVIDER_ID) {
        lsSet(PROVIDER_KEY, PROVIDER_ID);
        lsSet(MODEL_KEY, MODEL);
        return wrapped.config();
      }
      return base.setProvider(id);
    };
    wrapped.setKey = function (id, value) {
      if (id === PROVIDER_ID) {
        void value;
        return wrapped.config();
      }
      return base.setKey(id, value);
    };
    wrapped.setCloudModel = function (model) {
      if (selected()) {
        void model;
        lsSet(MODEL_KEY, MODEL);
        return wrapped.config();
      }
      return base.setCloudModel(model);
    };
    wrapped.listCloudModels = async function () {
      if (selected()) return [MODEL];
      return base.listCloudModels();
    };
    wrapped.cloudReady = function () {
      if (selected()) return true;
      return base.cloudReady();
    };
    wrapped.isLocal = function () {
      if (selected()) return false;
      return base.isLocal();
    };
    wrapped.generate = async function (prompt, opts, ollamaModel) {
      if (selected()) return astraGenerate(prompt, opts);
      return base.generate(prompt, opts, ollamaModel);
    };

    return wrapped;
  }

  var captured = window.KodroProviders;
  if (captured) captured = wrap(captured);
  try {
    Object.defineProperty(window, 'KodroProviders', {
      configurable: true,
      enumerable: true,
      get: function () { return captured; },
      set: function (value) { captured = wrap(value); },
    });
  } catch (e) {
    if (captured) window.KodroProviders = captured;
  }
})(window, window.fetch ? window.fetch.bind(window) : null, window.localStorage);
