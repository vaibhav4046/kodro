import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/kodro/assets/web/panels.jsx';
const full = readFileSync(path, 'utf8');
const start = full.indexOf('  function ProviderPicker({ onChange }) {');
const end = full.indexOf('\n  // Plain-English reasons for the recogniser', start);
if (start < 0 || end < 0) throw new Error('ProviderPicker bounds not found');
let s = full.slice(start, end);

function once(from, to, label) {
  if (!s.includes(from)) throw new Error('migration marker missing: ' + label);
  s = s.replace(from, to);
}

once(
  "    const isCloud = cfg.provider !== 'ollama';",
  "    const isCloud = cfg.provider !== 'ollama';\n    const isUnavailable = !!cfg.unavailable;",
  'unavailable state'
);
once(
  "{isCloud && <span style={{ fontSize: 11, color: cfg.cloudReady ? 'var(--success)' : 'var(--fg-3)' }}>{cfg.serverManaged ? (cfg.cloudReady ? 'server managed' : 'server unavailable') : (cfg.cloudReady ? 'connected' : (cfg.needsEndpoint ? 'needs an endpoint' : 'needs a key'))}</span>}",
  "{isCloud && <span style={{ fontSize: 11, color: cfg.cloudReady ? 'var(--success)' : 'var(--fg-3)' }}>{isUnavailable ? 'unavailable' : (cfg.serverManaged ? (cfg.cloudReady ? 'server managed' : 'server unavailable') : (cfg.cloudReady ? 'connected' : (cfg.needsEndpoint ? 'needs an endpoint' : 'needs a key')))}</span>}",
  'status'
);
once(
  "{cfg.provider === 'custom' && (",
  "{!isUnavailable && cfg.provider === 'custom' && (",
  'custom endpoint'
);
once(
  "{isCloud && (\n          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>",
  "{isCloud && !isUnavailable && (\n          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>",
  'cloud controls'
);
once(
  "        {cfg.serverManaged\n          ? <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Server-managed connection. No API key is stored in this browser; prompts are sent through Kodro's server proxy. Switch to Local for fully offline use.</p>\n          : isCloud && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Your key stays in this browser and is sent only to the provider you pick. Switch to Local for fully offline use.</p>}",
  "        {isUnavailable\n          ? <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Astra is not connected in this web runtime. API access uses a separately billed OpenAI API account and must run through a secure backend or local gateway. A ChatGPT subscription can use Astra in ChatGPT Work or Codex, but it does not authorize this webpage to make API requests.</p>\n          : cfg.serverManaged\n            ? <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Server-managed connection. No API key is stored in this browser. Switch to Local for fully offline use.</p>\n            : isCloud && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>This cloud provider requires its own connection. Switch to Local for fully offline use.</p>}",
  'connection explanation'
);

writeFileSync(path, full.slice(0, start) + s + full.slice(end));
console.log('Patched ProviderPicker for zero-cost Astra presentation');
