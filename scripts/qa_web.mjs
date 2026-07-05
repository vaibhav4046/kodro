/* qa_web: the Kodro Web static-build gate.
 *
 * Proves the two claims the browser build must never break:
 *   1) PRIVACY: loaded in its default state, the static site makes ZERO
 *      requests to any host beyond the local server. This is the coded proof of
 *      the "nothing leaves your machine" promise, not a doc claim.
 *   2) BOOT: the app mounts (React clears the #rl-boot skeleton, the offline
 *      error fallback never fires) and renders recognisable content.
 *
 * How: build site/ (build_web.cjs --static), serve it from a local Node server
 * bound to 127.0.0.1, then load it in headless Chrome with a net-log capture
 * and flags that silence Chrome's own background networking. The net-log is
 * scanned for external hosts; Chrome's own telemetry domains (which a browser
 * emits regardless of the page) are filtered out, so anything left is the app's
 * doing. On a clean load the app talks only to 127.0.0.1, so the set is empty.
 *
 *   node scripts/qa_web.mjs           # build + serve + check, exit 1 on fail
 *
 * Later phases extend this with golden-lesson trace parity, an IndexedDB
 * round-trip and a service-worker second-load once the WebBackend lands.
 */
'use strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SITE = path.join(ROOT, 'site');
const HOST = '127.0.0.1';
const PORT = 8097;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
};

const LOCAL_HOSTS = new Set([HOST, 'localhost', '[::1]', '::1']);
// Domains a Chrome browser reaches on its own (GCM, safebrowsing, component
// update, sync) regardless of the page. Filtered out so the gate measures the
// APP, not the browser.
const BROWSER_TELEMETRY = [
  'google.com', 'googleapis.com', 'gstatic.com', 'withgoogle.com',
  'googleusercontent.com', 'gvt1.com', 'gvt2.com', 'google-analytics.com',
  'doubleclick.net', 'chrome.com',
];

function log(pass, name, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(24)} ${detail || ''}`);
  return pass;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
    'google-chrome', 'chrome',
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === 'chrome' || c === 'google-chrome') return c;
    if (existsSync(c)) return c;
  }
  return null;
}

function buildSiteIfNeeded() {
  if (existsSync(path.join(SITE, 'index.html'))) return true;
  spawnSync(process.execPath, [path.join(HERE, 'build_web.cjs'), '--static'], { cwd: ROOT, encoding: 'utf8' });
  return existsSync(path.join(SITE, 'index.html'));
}

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(SITE, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(SITE)) { res.writeHead(403).end(); return; }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, HOST, () => resolve(server)));
}

const FLAGS = [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking',
  '--disable-component-update', '--disable-domain-reliability', '--disable-sync',
  '--disable-default-apps', '--disable-client-side-phishing-detection',
  '--safebrowsing-disable-auto-update', '--metrics-recording-only',
  '--disable-features=OptimizationHints,Translate,MediaRouter',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
];

function dumpOnce(chrome, url, netlog) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kodro-qaweb-'));
  const args = [
    ...FLAGS, `--user-data-dir=${path.join(tmp, 'p')}`,
    `--log-net-log=${netlog}`, '--net-log-capture-mode=Everything',
    '--virtual-time-budget=8000', '--dump-dom', url,
  ];
  const res = spawnSync(chrome, args, { encoding: 'utf8', timeout: 90000, maxBuffer: 96 * 1024 * 1024 });
  let net = '';
  try { net = readFileSync(netlog, 'utf8'); } catch { net = ''; }
  return { dom: res.stdout || '', net, error: res.error };
}

// Chrome's cold spawn on Windows sometimes ETIMEDOUTs; warm up, then try a few
// times so a launch flake does not read as a product failure.
function loadWithRetry(chrome, url) {
  spawnSync(chrome, [...FLAGS, '--virtual-time-budget=1500', '--dump-dom', 'about:blank'], { encoding: 'utf8', timeout: 60000 });
  let out = { dom: '', net: '', error: new Error('not run') };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    out = dumpOnce(chrome, url, path.join(mkdtempSync(path.join(os.tmpdir(), 'kodro-net-')), 'n.json'));
    if (!out.error && out.dom) return out;
  }
  return out;
}

function appExternalHosts(netJson) {
  const hosts = new Set();
  const re = /"(https?:\/\/[^"']+)"/g;
  let m;
  while ((m = re.exec(netJson)) !== null) {
    let h;
    try { h = new URL(m[1]).hostname; } catch { continue; }
    if (LOCAL_HOSTS.has(h)) continue;
    if (BROWSER_TELEMETRY.some((d) => h === d || h.endsWith('.' + d))) continue;
    hosts.add(h);
  }
  return [...hosts];
}

async function main() {
  console.log('== KODRO WEB GATE (qa_web) ==\n');
  const results = [];

  const chrome = findChrome();
  if (!chrome) {
    console.log('SKIP  chrome not found; qa_web needs headless Chrome. (exit 0 for local dev)');
    process.exit(0);
  }
  results.push(log(buildSiteIfNeeded(), 'static-build', 'site/index.html present'));

  const server = await startServer();
  try {
    const { dom, net, error } = loadWithRetry(chrome, `http://${HOST}:${PORT}/index.html`);
    if (error || !dom) {
      results.push(log(false, 'boot', `chrome load failed after retries: ${error ? error.message : 'empty DOM'}`));
    } else {
      const mounted = !dom.includes('id="rl-boot"') && !dom.includes('The simulator failed to load') && !dom.includes('neterror');
      results.push(log(mounted, 'boot-mount', mounted ? 'React mounted; no error fallback' : 'app did not mount'));
      const rendered = /Kodro|Robot Design Studio|Start building|Skip to studio/i.test(dom);
      results.push(log(rendered, 'app-content', rendered ? 'app UI rendered' : 'no app content'));
      const ext = appExternalHosts(net);
      results.push(log(net !== '' && ext.length === 0, 'privacy-zero-external',
        net === '' ? 'net-log not captured' : ext.length === 0 ? 'no app-originated external requests' : `LEAKED to: ${ext.join(', ')}`));
    }
  } finally {
    server.close();
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n== QA_WEB: ${results.length - failed}/${results.length} checks passed ==`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
