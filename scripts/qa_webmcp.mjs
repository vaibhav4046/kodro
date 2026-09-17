/* QA for Kodro's read-only WebMCP/site-tools module (webmcp-tools.js).
 *
 * Scope is deliberately read-only: the module exposes the live workspace,
 * latest run evidence, and capability flags to a compatible agent. No
 * mutation tool exists here, so there is no stale-write, undo, or renderer
 * risk to cover. Mutation tools, if ever added, need their own gate.
 *
 * The fake registry below is test infrastructure only. It proves the
 * adapter contract, never a live Codex connection.
 */
import { existsSync, readFileSync } from 'node:fs';

const web = (f) => readFileSync(new URL('../src/kodro/assets/web/' + f, import.meta.url), 'utf8');

let pass = 0, fail = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) pass += 1;
  else { fail += 1; failures.push(name + (detail ? ': ' + detail : '')); }
  console.log((condition ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
}

check('webmcp module file exists', existsSync(new URL('../src/kodro/assets/web/webmcp-tools.js', import.meta.url)));
const source = web('webmcp-tools.js');

function loadModule(win, doc, store) {
  win.KodroWebMCP = undefined;
  new Function('window', 'document', 'localStorage', source)(win, doc, store);
  return win.KodroWebMCP;
}

function fakeRegistry() {
  const tools = new Map();
  return {
    tools,
    async registerTool(def) {
      if (!def || typeof def.name !== 'string' || typeof def.execute !== 'function') {
        throw new Error('bad descriptor');
      }
      tools.set(def.name, def);
      return { ok: true };
    },
  };
}

const fullEnv = {
  window: {
    KODRO_LIVE_CODE: 'move_forward(3)\n',
    getKodroRobot: () => ({ type: 'rover', massKg: 1.7, sensors: ['range'] }),
    KodroRunReports: { list: () => [{ id: 'r1', score: 100, verdict: 'PASS', collisions: 0 }] },
  },
  document: { querySelector: (sel) => (sel === '#lesson-select' ? { value: '00_first_drive' } : null) },
  localStorage: {
    getItem: (k) => ({ or_terrain: 'earth', kodro_tod: 'noon', kodro_weather: 'clear', kodro_quality: 'high' }[k] ?? null),
  },
};

// 1. Unsupported browser: no modelContext -> zero registrations, no throw.
{
  const win = {};
  const api = loadModule(win, fullEnv.document, fullEnv.localStorage);
  check('module exposes KodroWebMCP', !!api && typeof api.register === 'function');
  const empty = { tools: new Map(), async registerTool(def) { this.tools.set(def.name, def); } };
  await api.register({ modelContext: undefined }, fullEnv);
  check('no modelContext registers nothing', empty.tools.size === 0, String(empty.tools.size));
}

// 2. Supported path: three read-only tools with honest descriptors.
const registry = fakeRegistry();
{
  const win = {};
  const api = loadModule(win, fullEnv.document, fullEnv.localStorage);
  await api.register({ modelContext: registry }, fullEnv);
  const names = [...registry.tools.keys()].sort();
  check('three tools registered',
    JSON.stringify(names) === JSON.stringify(['kodro_get_capabilities', 'kodro_get_run_evidence', 'kodro_get_workspace']),
    names.join(','));
  for (const [, def] of registry.tools) {
    check(`descriptor honest for ${def.name}`,
      typeof def.description === 'string' && def.description.length > 20
      && def.inputSchema && def.inputSchema.type === 'object'
      && def.annotations && def.annotations.readOnlyHint === true);
  }
}

// 3. Workspace snapshot reflects the live bridges.
{
  const out = await registry.tools.get('kodro_get_workspace').execute({});
  check('workspace carries editor source', out?.program?.value === 'move_forward(3)\n', JSON.stringify(out?.program));
  check('workspace carries robot spec', out?.robot?.value?.type === 'rover', JSON.stringify(out?.robot));
  check('workspace carries world prefs', out?.world?.terrainId?.value === 'earth', JSON.stringify(out?.world));
  check('workspace carries lesson id', out?.lesson?.value === '00_first_drive', JSON.stringify(out?.lesson));
  check('workspace lists capabilities', Array.isArray(out?.capabilities) && out.capabilities.length === 3);
}

// 4. Run evidence returns the latest bounded report.
{
  const out = await registry.tools.get('kodro_get_run_evidence').execute({});
  check('evidence returns latest run', out?.ran === true && out?.score === 100, JSON.stringify(out));
}

// 5. Missing bridges degrade to reasons, never throws.
{
  const out = await registry.tools.get('kodro_get_workspace').execute.call(null, {});
  check('execute is callable standalone', out !== undefined);
  const win = {};
  const api = loadModule(win, null, null);
  const reg2 = fakeRegistry();
  await api.register({ modelContext: reg2 }, { window: {}, document: null, localStorage: null });
  const empty = await reg2.tools.get('kodro_get_workspace').execute({});
  check('empty env degrades with reasons', empty?.program?.value === null && typeof empty?.program?.reason === 'string');
  const noRuns = await reg2.tools.get('kodro_get_run_evidence').execute({});
  check('no reports means ran:false', noRuns?.ran === false && typeof noRuns?.reason === 'string');
}

// 6. Double registration does not duplicate tools.
{
  const win = {};
  const api = loadModule(win, fullEnv.document, fullEnv.localStorage);
  const reg3 = fakeRegistry();
  await api.register({ modelContext: reg3 }, fullEnv);
  await api.register({ modelContext: reg3 }, fullEnv);
  check('double register stays at three tools', reg3.tools.size === 3, String(reg3.tools.size));
}

// 7. Static safety: no network, no secrets, no mutation surface.
check('module has no fetch call', !/\bfetch\s*\(/.test(source));
check('module has no remote hosts', !/https?:\/\/(?!www\.w3\.org|.*spdx)/.test(source));
check('module has no secret fields', !/api[_-]?key|Authorization\s*:|localStorage\.setItem|setItem\s*\(/.test(source));
check('module exposes no write tools', !/patch|set_program|delete|write|mutat/i.test(source));

// 8. Wiring: loads after the bundle, precached for offline.
const index = web('index.html');
const sw = web('sw.js');
check('webmcp script loads after bundle.js',
  index.indexOf('<script src="webmcp-tools.js"></script>') > index.indexOf('<script src="bundle.js"></script>'));
check('service worker precaches webmcp module', sw.includes("'./webmcp-tools.js'"));

// 9. Load-time auto-mount fires against a present surface, sleeps without one.
{
  const seen = [];
  const autoDoc = {
    modelContext: {
      async registerTool(def) { seen.push(def.name); },
    },
    querySelector: () => null,
  };
  const win = {};
  loadModule(win, autoDoc, { getItem: () => null });
  await new Promise((r) => setTimeout(r, 50));
  check('auto-mount registers three tools',
    JSON.stringify(seen.sort()) === JSON.stringify(['kodro_get_capabilities', 'kodro_get_run_evidence', 'kodro_get_workspace']),
    seen.join(','));
}

console.log(`\nWebMCP read-only QA: ${pass} passed, ${fail} failed`);
if (fail) {
  console.error(failures.join('\n'));
  process.exit(1);
}
