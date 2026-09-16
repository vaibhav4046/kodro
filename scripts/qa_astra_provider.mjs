/* Deterministic QA for the browser side of GPT-6 Astra.
 * The browser must never own an OpenAI credential. It may select Astra and send
 * a normalized request only to the Kodro server proxy.
 */
import { readFileSync } from 'node:fs';

const web = (f) => readFileSync(new URL('../src/kodro/assets/web/' + f, import.meta.url), 'utf8');
const source = web('astra-provider.js');
const index = web('index.html');
const sw = web('sw.js');
const PROXY = 'https://kodro-ca2.vercel.app/api/astra';
const LEGACY_KEY = 'kodro_ai_key_astra';

let pass = 0, fail = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) pass += 1;
  else { fail += 1; failures.push(name + (detail ? ': ' + detail : '')); }
  console.log((condition ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
}

const data = new Map([[LEGACY_KEY, 'legacy-secret']]);
const reads = [];
const writes = [];
const removals = [];
const storage = {
  getItem(k) { reads.push(k); return data.has(k) ? data.get(k) : null; },
  setItem(k, v) { writes.push([k, String(v)]); data.set(k, String(v)); },
  removeItem(k) { removals.push(k); data.delete(k); },
};

const requests = [];
async function mockFetch(url, options = {}) {
  requests.push({ url: String(url), options });
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: '{"program":[]}' }),
    text: async () => '',
  };
}

const win = { fetch: mockFetch, localStorage: storage };
new Function('window', source)(win);

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
check('legacy Astra key is deleted on initialization', removals.includes(LEGACY_KEY) && !data.has(LEGACY_KEY));
check('legacy Astra key is never read', !reads.includes(LEGACY_KEY), reads.join(','));
check('loading the adapter makes zero network requests', requests.length === 0, String(requests.length));
check('Astra appears as a first-class provider', P.config().providers.some((p) => p.id === 'astra'));
check('Kodro remains offline/local by default', P.config().provider === 'ollama' && P.isLocal() === true);

P.setProvider('astra');
const astraCfg = P.config();
check('Astra selection is explicit', astraCfg.provider === 'astra' && astraCfg.local === false);
check('Astra is server managed and ready without a browser key', P.cloudReady() === true && astraCfg.cloudReady === true && astraCfg.hasKey === false);
check('Astra label describes server management', astraCfg.label === 'OpenAI GPT-6 Astra (server managed)', astraCfg.label);
check('Astra model is pinned in the UI', astraCfg.cloudModel === 'gpt-6-astra');
check('Astra proxy endpoint is fixed', astraCfg.endpoint === PROXY, astraCfg.endpoint);
check('Astra model list does not silently drift', JSON.stringify(await P.listCloudModels()) === '["gpt-6-astra"]');

P.setKey('astra', 'must-not-persist');
check('setKey compatibility path never persists an Astra secret',
  !Array.from(data.values()).includes('must-not-persist') && !writes.some(([, v]) => v === 'must-not-persist'));

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
check('proxy output text is returned to the existing facade', out === '{"program":[]}');
check('exactly one request is made after explicit Astra use', requests.length === 1, String(requests.length));

const req = requests[0] || { url: '', options: {} };
let body = {};
try { body = JSON.parse(req.options.body || '{}'); } catch (e) { void e; }
const headerNames = Object.keys(req.options.headers || {}).map((k) => k.toLowerCase());
check('browser request targets only the Kodro Astra proxy', req.url === PROXY, req.url);
check('browser sends no Authorization header', !headerNames.includes('authorization'));
check('browser sends no credential material',
  !(req.options.body || '').includes('legacy-secret') && !(req.options.body || '').includes('must-not-persist'));
check('browser sends normalized input', body.input === 'make the rover stop');
check('browser sends normalized instructions', body.instructions === 'Return the fitted robot program.');
check('browser sends bounded output budget', body.max_output_tokens === 1024, String(body.max_output_tokens));
check('browser sends schema as schema, not OpenAI text.format', JSON.stringify(body.schema) === JSON.stringify(schema) && !body.text);
check('browser does not control model', !Object.prototype.hasOwnProperty.call(body, 'model'));
check('browser does not control reasoning', !Object.prototype.hasOwnProperty.call(body, 'reasoning'));
check('browser does not control storage', !Object.prototype.hasOwnProperty.call(body, 'store'));
check('unsupported temperature is omitted', !Object.prototype.hasOwnProperty.call(body, 'temperature'));
check('source has no direct OpenAI API host', !source.includes('api.openai.com'));
check('source has no browser Authorization header', !/Authorization\s*:/.test(source));

const astraPos = index.indexOf('<script src="astra-provider.js"></script>');
const bundlePos = index.indexOf('<script src="bundle.js"></script>');
check('Astra adapter loads before bundle.js', astraPos >= 0 && bundlePos > astraPos, astraPos + '/' + bundlePos);
check('service worker precaches Astra adapter', sw.includes("'./astra-provider.js'"));

P.setProvider('ollama');
check('switching back restores local provider behaviour', P.isLocal() === true);
check('non-Astra generation delegates unchanged', (await P.generate('x', {}, 'local')) === 'base-provider');
check('leaving Astra causes no extra proxy request', requests.length === 1, String(requests.length));

console.log(`\nAstra browser proxy QA: ${pass} passed, ${fail} failed`);
if (fail) {
  console.error(failures.join('\n'));
  process.exit(1);
}
