import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/kodro/assets/web/panels.jsx';
let text = readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error('Astra UI patch anchor missing: ' + label);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error('Astra UI patch anchor duplicated: ' + label);
  text = text.slice(0, first) + after + text.slice(first + before.length);
}

replaceOnce(
`  // ---- Vibe coding (Code with AI) ----
  // Choose the AI backend: Local (Ollama, offline default) or a bring-your-own-key
  // FREE-TIER provider (Groq free tier, OpenRouter free models). The key stays in
  // this browser and is sent only to the chosen provider; Local keeps the app
  // fully offline.`,
`  // ---- Vibe coding (Code with AI) ----
  // Choose the AI backend: Local (Ollama, offline default), a browser BYOK
  // provider (Groq/OpenRouter/custom), or a server-managed provider such as
  // Astra. Server-managed credentials never enter this browser; Local keeps the
  // app fully offline.`,
'provider description');

replaceOnce(
`          {isCloud && <span style={{ fontSize: 11, color: cfg.cloudReady ? 'var(--success)' : 'var(--fg-3)' }}>{cfg.cloudReady ? 'connected' : (cfg.needsEndpoint ? 'needs an endpoint' : 'needs a key')}</span>}`,
`          {isCloud && <span style={{ fontSize: 11, color: cfg.cloudReady ? 'var(--success)' : 'var(--fg-3)' }}>{cfg.serverManaged ? (cfg.cloudReady ? 'server managed' : 'server unavailable') : (cfg.cloudReady ? 'connected' : (cfg.needsEndpoint ? 'needs an endpoint' : 'needs a key'))}</span>}`,
'connection status');

replaceOnce(
`            <input type="password" aria-label="API key" value={keyInput} placeholder={cfg.hasKey ? 'key saved (type to replace)' : (cfg.provider === 'custom' ? 'API key (optional)' : 'paste your API key')}
              onChange={e => { setKeyInput(e.target.value); P.setKey(cfg.provider, e.target.value); bump(); }}
              style={{ flex: '1 1 180px', background: 'var(--navy)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />
            <input type="text" aria-label="Cloud model id" value={cfg.cloudModel} placeholder="model id"
              onChange={e => { P.setCloudModel(e.target.value); bump(); }}
              style={{ flex: '0 1 160px', background: 'var(--navy)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />`,
`            {isCloud && !cfg.serverManaged && (
              <input type="password" aria-label="API key" value={keyInput} placeholder={cfg.hasKey ? 'key saved (type to replace)' : (cfg.provider === 'custom' ? 'API key (optional)' : 'paste your API key')}
                onChange={e => { setKeyInput(e.target.value); P.setKey(cfg.provider, e.target.value); bump(); }}
                style={{ flex: '1 1 180px', background: 'var(--navy)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />
            )}
            <input type="text" aria-label="Cloud model id" value={cfg.cloudModel} placeholder="model id" readOnly={!!cfg.serverManaged}
              onChange={e => { if (!cfg.serverManaged) { P.setCloudModel(e.target.value); bump(); } }}
              style={{ flex: '0 1 160px', background: 'var(--navy)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />`,
'credential and model controls');

replaceOnce(
`        {isCloud && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Your key stays in this browser and is sent only to the provider you pick. Switch to Local for fully offline use.</p>}`,
`        {cfg.serverManaged
          ? <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Server-managed connection. No API key is stored in this browser; prompts are sent through Kodro's server proxy. Switch to Local for fully offline use.</p>
          : isCloud && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Your key stays in this browser and is sent only to the provider you pick. Switch to Local for fully offline use.</p>}`,
'privacy copy');

writeFileSync(path, text, 'utf8');
console.log('Applied server-managed Astra ProviderPicker source migration.');
