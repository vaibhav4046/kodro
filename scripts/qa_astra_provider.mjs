/* Deterministic QA for the opt-in GPT-6 Astra provider.
 * No real OpenAI request is made. This loads the shipped adapter, lets the
 * normal bundle-style assignment create KodroProviders, and inspects the exact
 * mocked Responses API request.
 */
import { readFileSync } from 'node:fs';

const web = (f) => readFileSync(new URL('../src/kodro/assets/web/' + f, import.meta.url), 'utf8');
const source = web('astra-provider.js');
const index = web('index.html');
const sw = web('sw.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) pass += 1;
  else { fail += 1; failures.push(name + (detail ? ': ' + detail : '')); }
  console.log((condition ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
}

const data = new Map();
const storage = {
  getItem: (k) => data.has(k) ? data.get(k) : null,
  setItem: (k, v) => data.set(k, String(v)),
  removeItem: (k) => data.delete(k),
};

const requests = [];
async function mockFetch(url, options = {}) {
  requests.push({ url: String(url), options });
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_qa', status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"program":[]}' }] }],
    }),
    text: async () => '',
  };
}

const win = { fetch: mockFetch, localStorage: storage };
new Function('window', source)(win);

// Stand-in for the provider object created later by bundle.js. The adapter's
// property setter must wrap this assignment before React reads provider config.
const base = {
  config: () => ({
    provider: storage.getItem('kodro_ai_provider') || 'ollama',
    label: 'Local', local: true, cloudReady: false, cloudModel: '', hasKey: false,
    endpoint: '', needsEndpoint: false,
    providers: [{ id: 'ollama', label: 'Local', local: true, hasKey: false }],
  }),
  setProvider(id) { storage.setItem('kodro_ai_provider', id); return this.config(); },
  setKey() { return this.config(); },
  setCloudModel() { return this.config(); },
  setEndpoint() { return this.config(); },
  listCloudModels: async () => [],
  cloudReady: () => false,
  isLocal: () => true,
  generate: async () => 'base-provider',
};
win.KodroProviders = base;
const P = win.KodroProviders;

check('adapter wraps bundle provider assignment', P !== base && P.__kodroAstraWrapped === true);
check('Astra appears as a first-class provider', P.config().providers.some((p) => p.id === 'astra'));
check('Kodro remains offline/local by default', P.config().provider === 'ollama' && P.isLocal() === true);
check('loading the adapter makes zero cloud requests', requests.length === 0, String(requests.length));

P.setProvider('astra');
check('Astra selection is explicit', P.config().provider === 'astra' && P.config().local === false);
check('Astra is not ready without a user key', P.cloudReady() === false);
check('Astra model is pinned', P.config().cloudModel === 'gpt-6-astra');
check('Astra model list does not silently drift', JSON.stringify(await P.listCloudModels()) === '["gpt-6-astra"]');

P.setKey('astra', 'sk-qa-not-real');
check('Astra becomes ready only after BYOK', P.cloudReady() === true && P.config().hasKey === true);

const schema = {
  type: 'object',
  properties: { program: { type: 'array', items: { type: 'object' } } },
  required: ['program'],
};
const out = await P.generate('make the rover stop', {
  system: 'Return the fitted robot program.',
  temperature: 0.9,
  num_predict: 400,
  format: schema,
}, 'local-fallback');
check('Responses API text is returned to the existing facade', out === '{"program":[]}');
check('exactly one request is made after explicit Astra use', requests.length === 1, String(requests.length));

const req = requests[0] || { url: '', options: {} };
let body = {};
try { body = JSON.parse(req.options.body || '{}'); } catch (e) { void e; }
check('request targets OpenAI Responses API', req.url === 'https://api.openai.com/v1/responses', req.url);
check('request uses GPT-6 Astra', body.model === 'gpt-6-astra', String(body.model));
check('request uses low reasoning effort', body.reasoning && body.reasoning.effort === 'low');
check('request has a bounded output budget', Number.isFinite(body.max_output_tokens) && body.max_output_tokens >= 1024 && body.max_output_tokens <= 4096, String(body.max_output_tokens));
check('unsupported temperature is omitted', !Object.prototype.hasOwnProperty.call(body, 'temperature'));
check('unsupported top_p is omitted', !Object.prototype.hasOwnProperty.call(body, 'top_p'));
check('structured program schema uses Responses text.format', body.text && body.text.format && body.text.format.type === 'json_schema');
check('request storage is disabled', body.store === false);
check('API key is only in Authorization header',
  req.options.headers && req.options.headers.Authorization === 'Bearer sk-qa-not-real'
    && !(req.options.body || '').includes('sk-qa-not-real'));

const astraPos = index.indexOf('<script src="astra-provider.js"></script>');
const bundlePos = index.indexOf('<script src="bundle.js"></script>');
check('Astra adapter loads before bundle.js', astraPos >= 0 && bundlePos > astraPos, astraPos + '/' + bundlePos);
check('service worker precaches Astra adapter', sw.includes("'./astra-provider.js'"));

P.setProvider('ollama');
check('switching back restores local provider behaviour', P.isLocal() === true);
check('non-Astra generation delegates unchanged', (await P.generate('x', {}, 'local')) === 'base-provider');
check('leaving Astra causes no extra OpenAI request', requests.length === 1, String(requests.length));

console.log(`\nAstra provider QA: ${pass} passed, ${fail} failed`);
if (fail) {
  console.error(failures.join('\n'));
  process.exit(1);
}
