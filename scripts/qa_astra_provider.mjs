/* Deterministic QA for Kodro's zero-cost Astra presentation.
 *
 * Ollama is the only executable runtime in the public web app. Astra remains
 * visible so users understand the supported connection paths, but selecting it
 * must never trigger a network request or imply that a ChatGPT subscription is
 * an API credential.
 */
import { existsSync, readFileSync } from 'node:fs';

const web = (f) => readFileSync(new URL('../src/kodro/assets/web/' + f, import.meta.url), 'utf8');
const source = web('astra-provider.js');
const baseSource = web('ai-providers.jsx');
const panels = web('panels.jsx');
const index = web('index.html');
const sw = web('sw.js');
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
  throw new Error('zero-cost runtime must never fetch Astra');
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
check('Astra remains visible as a first-class provider', P.config().providers.some((p) => p.id === 'astra'));
check('Kodro remains offline/local by default', P.config().provider === 'ollama' && P.isLocal() === true);
check('base provider source exposes no Groq runtime', !baseSource.includes('api.groq.com') && !baseSource.includes("id: 'groq'"));
check('base provider source exposes no OpenRouter runtime', !baseSource.includes('openrouter.ai') && !baseSource.includes("id: 'openrouter'"));
check('base provider source exposes no arbitrary cloud endpoint runtime', !baseSource.includes("id: 'custom'"));

P.setProvider('astra');
const astraCfg = P.config();
check('Astra selection is explicit', astraCfg.provider === 'astra');
check('Astra is clearly unavailable in the public web runtime',
  astraCfg.unavailable === true && astraCfg.cloudReady === false && P.cloudReady() === false);
check('Astra label says it is not connected', astraCfg.label === 'OpenAI GPT-6 Astra (not connected)', astraCfg.label);
check('Astra exposes no active endpoint', !astraCfg.endpoint, String(astraCfg.endpoint || ''));
check('Astra has no browser credential state', astraCfg.hasKey === false);
check('Astra connection metadata distinguishes API and ChatGPT paths',
  Array.isArray(astraCfg.connectionOptions) && astraCfg.connectionOptions.includes('api') && astraCfg.connectionOptions.includes('chatgpt'));
check('selecting Astra makes zero network requests', requests.length === 0, String(requests.length));

P.setKey('astra', 'must-not-persist');
check('setKey compatibility path never persists an Astra secret',
  !Array.from(data.values()).includes('must-not-persist') && !writes.some(([, v]) => v === 'must-not-persist'));

let astraError = '';
try {
  await P.generate('make the rover stop', { num_predict: 400 }, 'local-fallback');
} catch (e) {
  astraError = String(e && e.message ? e.message : e);
}
check('Astra generation fails closed instead of making a paid request',
  /not connected|unavailable/i.test(astraError), astraError);
check('attempting Astra generation still makes zero network requests', requests.length === 0, String(requests.length));

check('Astra source contains no Kodro paid proxy URL', !source.includes('kodro-ca2.vercel.app/api/astra'));
check('Astra source contains no direct OpenAI API host', !source.includes('api.openai.com'));
check('Astra source contains no browser Authorization header', !/Authorization\s*:/.test(source));
check('Astra source has no active fetch call', !/\bfetch\s*\(/.test(source));
check('public repo contains no executable Astra server proxy',
  !existsSync(new URL('../api/astra.js', import.meta.url)));

// Product copy must be truthful about both user connection concepts. A ChatGPT
// subscription can provide Astra in supported ChatGPT surfaces, but it is not an
// API credential for the Kodro webpage; API access has separate billing.
check('provider UI marks Astra unavailable in the web runtime',
  panels.includes('Astra is not connected in this web runtime'));
check('provider UI explains separately billed API access',
  panels.includes('API access') && panels.includes('separately billed'));
check('provider UI explains ChatGPT subscription path without claiming web inference',
  panels.includes('ChatGPT subscription') && panels.includes('Work or Codex') && panels.includes('does not authorize this webpage'));

const astraPos = index.indexOf('<script src="astra-provider.js"></script>');
const bundlePos = index.indexOf('<script src="bundle.js"></script>');
check('Astra adapter loads before bundle.js', astraPos >= 0 && bundlePos > astraPos, astraPos + '/' + bundlePos);
check('service worker precaches Astra adapter', sw.includes("'./astra-provider.js'"));

P.setProvider('ollama');
check('switching back restores local provider behaviour', P.isLocal() === true);
check('non-Astra generation delegates unchanged', (await P.generate('x', {}, 'local')) === 'base-provider');

// Connect assistance: the panel may guide the user to their own Codex/MCP
// or API surfaces, but it must never collect a secret or promise web inference.
check('adapter exposes a static Codex/MCP setup guide', typeof P.connectSetup === 'function');
const setup = typeof P.connectSetup === 'function' ? P.connectSetup() : null;
const setupText = JSON.stringify(setup);
check('setup guide carries no secret-shaped fields',
  !/key|token|password|secret|authorization/i.test(setupText),
  setupText.slice(0, 120));
check('setup MCP entry is the local stdio server',
  setup && setup.mcp && setup.mcp.command === 'kodro-mcp' && setup.mcp.transport === 'stdio',
  JSON.stringify((setup && setup.mcp) || null));
check('setup steps route ChatGPT users to Codex without claiming web inference',
  Array.isArray(setup.steps) && setup.steps.join(' ').includes('Codex')
  && setup.steps.join(' ').includes('does not authorize this webpage'));
check('setup guide makes zero network requests', requests.length === 0, String(requests.length));
check('entire QA run made zero Astra/OpenAI network requests', requests.length === 0, String(requests.length));

console.log(`\nAstra zero-cost runtime QA: ${pass} passed, ${fail} failed`);
if (fail) {
  console.error(failures.join('\n'));
  process.exit(1);
}
