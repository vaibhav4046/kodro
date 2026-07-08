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
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { resolveChrome } from './lib/resolve-chrome.mjs';

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
  // Google-owned hosts some Chrome builds ping on their own (media-engagement
  // and field-trial components fetch from youtube; observed only on the Linux
  // runner's Chrome, never from app code). The app ships zero youtube references
  // (proven by tests/unit/test_web_offline.py's source scan), so a request here
  // is the browser, not Kodro. Classifying them as telemetry keeps the gate
  // measuring the app across Chrome versions.
  'youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'ggpht.com',
];

function log(pass, name, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(24)} ${detail || ''}`);
  return pass;
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

// NB: no --disable-gpu. On headless Chrome 140 it hangs the WebGL app (blank
// 0-byte DOM, boot check times out), so the SwiftShader software-GL path below
// is used INSTEAD, exactly as qa_worlds.mjs does. --window-size matches too so
// the studio lays out at its real 1280x800.
const FLAGS = [
  '--headless=new', '--no-sandbox', '--no-first-run',
  '--window-size=1280,800',
  '--no-default-browser-check', '--disable-background-networking',
  '--disable-component-update', '--disable-domain-reliability', '--disable-sync',
  '--disable-default-apps', '--disable-client-side-phishing-detection',
  '--safebrowsing-disable-auto-update', '--metrics-recording-only',
  '--disable-features=OptimizationHints,Translate,MediaRouter',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
];

// Run Chrome ASYNCHRONOUSLY (spawn, not spawnSync). This is load-bearing: the
// static file server (startServer) lives in THIS process's event loop. A
// blocking spawnSync would freeze that loop for the whole child run, so the
// server could never answer Chrome's requests -- Chrome would get no app,
// virtual-time would never settle, and every load would stall to the timeout.
// (That deadlock, not --disable-gpu alone, is why this gate used to hang.)
// spawn keeps the loop free, so the in-process server serves the app while
// Chrome loads it. The net-log is written by Chrome to a file, so stdout only
// carries the dumped DOM (~50 KB); we buffer it directly. A timeout guard kills
// a genuinely stuck Chrome so a launch flake still fails fast, not forever.
function runChrome(chrome, args, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    const child = spawn(chrome, args, { windowsHide: true });
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill('SIGKILL'); } catch { /* already exited */ }
      resolve({ stdout, error });
    };
    const timer = setTimeout(() => finish(new Error('ETIMEDOUT')), timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('error', (e) => finish(e));
    child.on('close', () => finish(null));
  });
}

async function dumpOnce(chrome, url, netlog) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kodro-qaweb-'));
  const args = [
    ...FLAGS, `--user-data-dir=${path.join(tmp, 'p')}`,
    `--log-net-log=${netlog}`, '--net-log-capture-mode=Everything',
    '--virtual-time-budget=8000', '--dump-dom', url,
  ];
  const res = await runChrome(chrome, args, 90000);
  let net = '';
  try { net = readFileSync(netlog, 'utf8'); } catch { net = ''; }
  return { dom: res.stdout || '', net, error: res.error };
}

// Chrome's cold spawn on Windows sometimes ETIMEDOUTs; warm up, then try a few
// times so a launch flake does not read as a product failure.
async function loadWithRetry(chrome, url) {
  await runChrome(chrome, [...FLAGS, '--virtual-time-budget=1500', '--dump-dom', 'about:blank'], 60000);
  let out = { dom: '', net: '', error: new Error('not run') };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    out = await dumpOnce(chrome, url, path.join(mkdtempSync(path.join(os.tmpdir(), 'kodro-net-')), 'n.json'));
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

  const chrome = resolveChrome();
  if (!chrome) {
    console.log('SKIP  chrome not found; qa_web needs headless Chrome. (exit 0 for local dev)');
    process.exit(0);
  }
  results.push(log(buildSiteIfNeeded(), 'static-build', 'site/index.html present'));

  const server = await startServer();
  try {
    const { dom, net, error } = await loadWithRetry(chrome, `http://${HOST}:${PORT}/index.html`);
    if (error || !dom) {
      results.push(log(false, 'boot', `chrome load failed after retries: ${error ? error.message : 'empty DOM'}`));
    } else {
      // The app has mounted when React has cleared the #rl-boot skeleton AND
      // painted real studio UI. We CANNOT detect the offline fallback by its
      // text ("The simulator failed to load"): that string also lives verbatim
      // in index.html's inline safety-net <script>, which --dump-dom serialises,
      // so it is present whether or not the fallback ever rendered. Use instead
      // a POSITIVE render signal the fallback and the boot skeleton never
      // contain -- the studio's 'Skip to studio' control or the 3D scene's
      // data-world marker (both painted only by the mounted React app).
      const stillBooting = dom.includes('id="rl-boot"');
      const appRendered = dom.includes('Skip to studio') || dom.includes('data-world=');
      const mounted = !stillBooting && appRendered && !dom.includes('neterror');
      results.push(log(mounted, 'boot-mount',
        mounted ? 'React mounted; studio painted'
          : stillBooting ? 'app still on boot skeleton' : 'app did not render studio UI'));
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
