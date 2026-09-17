/* Kodro GPT-6 Astra provider presentation.
 *
 * Loaded before bundle.js. Astra is intentionally NOT an executable provider in
 * the public web build: Ollama is the only active runtime. We still expose
 * Astra in the provider picker so users can understand the two legitimate
 * connection concepts without Kodro pretending a ChatGPT subscription is an
 * API credential or making a paid request on the user's behalf.
 *
 * API access is separately billed and must be connected through a secure
 * user-controlled backend/local gateway. ChatGPT subscription access to Astra
 * belongs in supported ChatGPT surfaces such as Work or Codex; it does not
 * authorize this webpage to call the OpenAI API.
 */
(function (window, localStorage) {
  'use strict';

  if (!window) return;

  var PROVIDER_ID = 'astra';
  var MODEL = 'gpt-6-astra';
  var PROVIDER_KEY = 'kodro_ai_provider';
  var MODEL_KEY = 'kodro_ai_cloud_model';

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

  // Delete legacy browser-BYOK state without ever reading its value into JS.
  try { if (localStorage) localStorage.removeItem('kodro_ai_key_astra'); } catch (e) { void e; }

  function selected() { return lsGet(PROVIDER_KEY) === PROVIDER_ID; }

  function unavailableConfig(cfg, providers) {
    return Object.assign({}, cfg, {
      provider: PROVIDER_ID,
      label: 'OpenAI GPT-6 Astra (not connected)',
      local: false,
      cloudReady: false,
      cloudModel: MODEL,
      hasKey: false,
      serverManaged: false,
      unavailable: true,
      endpoint: '',
      needsEndpoint: false,
      connectionOptions: ['api', 'chatgpt'],
      providers: providers,
    });
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
        label: 'OpenAI GPT-6 Astra (not connected)',
        local: false,
        hasKey: false,
        unavailable: true,
        connectionOptions: ['api', 'chatgpt'],
      });
      if (!selected()) return Object.assign({}, cfg, { providers: providers });
      return unavailableConfig(cfg, providers);
    };

    wrapped.setProvider = function (id) {
      if (id === PROVIDER_ID) {
        lsSet(PROVIDER_KEY, PROVIDER_ID);
        lsSet(MODEL_KEY, MODEL);
        return wrapped.config();
      }
      return base.setProvider(id);
    };

    // Compatibility no-op: never accept or persist an OpenAI key in the web UI.
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
      if (selected()) return false;
      return base.cloudReady();
    };
    wrapped.isLocal = function () {
      if (selected()) return false;
      return base.isLocal();
    };
    wrapped.generate = async function (prompt, opts, ollamaModel) {
      if (selected()) {
        void prompt; void opts; void ollamaModel;
        throw new Error('GPT-6 Astra is not connected in this web runtime. Use Local (Ollama), or connect Astra through a supported user-controlled API/ChatGPT workflow.');
      }
      return base.generate(prompt, opts, ollamaModel);
    };

    // Static connection guide. Pure data: no fetch, no endpoint, no secret
    // fields. The webpage can render these steps and let the user copy the
    // MCP server entry into their own client. A ChatGPT subscription is used
    // in the user's own Codex surface; a separately billed API key, if they
    // have one, lives in their own client or gateway. Neither ever enters
    // this page, which is why this guide contains nowhere to type one.
    wrapped.connectSetup = function () {
      return {
        steps: [
          'Install Kodro locally (pip install -e .) so the MCP server exists on your machine.',
          'Verify it: run kodro-mcp --list-tools and confirm the 8 tools.',
          'In Codex (ChatGPT subscription) or any MCP-capable client, add a stdio server named kodro with command kodro-mcp. Copy the JSON below.',
          'Ask Astra to open a lesson, run the starter, read the grade, fix the failure, and re-prove with prove_contracts. Your API billing, if any, stays in your own client or gateway; a ChatGPT subscription does not authorize this webpage.'
        ],
        mcp: { name: 'kodro', command: 'kodro-mcp', transport: 'stdio' },
      };
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
})(window, window.localStorage);
