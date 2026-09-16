/* Kodro GPT-6 Astra provider adapter.
 *
 * Loaded before bundle.js. The compiled bundle assigns window.KodroProviders;
 * this adapter intercepts that one assignment and extends the existing provider
 * layer without changing Kodro's default: Ollama remains local/offline unless a
 * user explicitly selects Astra and supplies their own OpenAI API key.
 *
 * Astra uses the OpenAI Responses API. The adapter intentionally does NOT send
 * temperature/top_p, which GPT-6 Astra does not accept. Keys remain in this
 * browser's localStorage and are sent only to api.openai.com when Astra is
 * selected. No OpenAI request is made merely by loading Kodro.
 */
(function (window, fetch, localStorage) {
  'use strict';

  if (!window || typeof fetch !== 'function') return;

  var PROVIDER_ID = 'astra';
  var MODEL = 'gpt-6-astra';
  var ENDPOINT = 'https://api.openai.com/v1/responses';
  var PROVIDER_KEY = 'kodro_ai_provider';
  var MODEL_KEY = 'kodro_ai_cloud_model';
  var API_KEY = 'kodro_ai_key_astra';
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
  function selected() { return lsGet(PROVIDER_KEY) === PROVIDER_ID; }
  function key() { return (lsGet(API_KEY) || '').trim(); }

  function responseText(payload) {
    if (!payload) return '';
    if (typeof payload.output_text === 'string') return payload.output_text.trim();
    var pieces = [];
    (payload.output || []).forEach(function (item) {
      (item && item.content || []).forEach(function (part) {
        if (part && part.type === 'output_text' && typeof part.text === 'string') pieces.push(part.text);
      });
    });
    return pieces.join('').trim();
  }

  async function astraGenerate(prompt, opts) {
    opts = opts || {};
    var secret = key();
    if (!secret) throw new Error('OpenAI API key required for GPT-6 Astra');

    var requested = Number(opts.num_predict) || 400;
    // max_output_tokens includes reasoning tokens. Keep enough headroom for low
    // reasoning effort while retaining a hard cap for classroom-sized replies.
    var maxOutput = Math.max(1024, Math.min(4096, requested * 2));
    var body = {
      model: MODEL,
      input: String(prompt == null ? '' : prompt),
      reasoning: { effort: 'low' },
      max_output_tokens: maxOutput,
      store: false,
    };
    if (opts.system) body.instructions = String(opts.system);
    if (opts.format) {
      body.text = {
        format: {
          type: 'json_schema',
          name: 'kodro_program',
          strict: false,
          schema: opts.format,
        },
      };
    }

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    var res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + secret,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('GPT-6 Astra took too long, try again');
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 240));
    var json = await res.json();
    if (json && json.error) throw new Error('OpenAI: ' + (json.error.message || 'request failed'));
    var text = responseText(json);
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
        label: 'OpenAI GPT-6 Astra (your API key)',
        local: false,
        hasKey: !!key(),
      });
      if (!selected()) return Object.assign({}, cfg, { providers: providers });
      return Object.assign({}, cfg, {
        provider: PROVIDER_ID,
        label: 'OpenAI GPT-6 Astra (your API key)',
        local: false,
        cloudReady: !!key(),
        cloudModel: MODEL,
        hasKey: !!key(),
        endpoint: ENDPOINT,
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
        lsSet(API_KEY, (value || '').trim());
        return wrapped.config();
      }
      return base.setKey(id, value);
    };
    wrapped.setCloudModel = function (model) {
      if (selected()) {
        // The challenge integration is deliberately pinned to the Astra alias.
        // Do not silently drift to a different OpenAI model.
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
      if (selected()) return !!key();
      return base.cloudReady();
    };
    wrapped.isLocal = function () {
      if (selected()) return false;
      return base.isLocal();
    };
    wrapped.generate = async function (prompt, opts, ollamaModel) {
      if (selected() && key()) return astraGenerate(prompt, opts);
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
    // Very old embedded browsers may refuse redefining the property. In that
    // case preserve the existing provider object rather than breaking boot.
    if (captured) window.KodroProviders = captured;
  }
})(window, window.fetch ? window.fetch.bind(window) : null, window.localStorage);
