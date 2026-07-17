/* Reproducible browser performance evidence for Kodro's real shipped 3D view.
 *
 * This is deliberately not a "240 FPS guarantee". Browser animation is capped
 * by the display and scheduler. The renderer publishes two different facts:
 * actual rAF cadence, and render-submission work against the 4.17 ms budget a
 * 240 Hz display would require. Both are kept so they cannot be conflated.
 *
 * Usage: node scripts/qa_performance.mjs
 * Output: docs/eval/performance_eval.json
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChrome } from './lib/resolve-chrome.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const WEB = path.join(REPO, 'src', 'robolearn', 'assets', 'web');
const OUT = path.join(REPO, 'docs', 'eval', 'performance_eval.json');
const TMP = path.join(REPO, 'tmp', 'performance-eval');
const PORT = 8117;
const HOST = '127.0.0.1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
async function serverReady() {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`http://${HOST}:${PORT}/cap.html`); if (r.ok) return true; } catch { /* retry */ }
    await sleep(100);
  }
  return false;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (event) => reject(new Error('DevTools WebSocket failed: ' + (event && event.message || 'unknown error')));
  });
}

function makeClient(ws) {
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (!message.id || !pending.has(message.id)) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  };
  return (method, params = {}) => {
    const requestId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      ws.send(JSON.stringify({ id: requestId, method, params }));
      setTimeout(() => {
        if (!pending.has(requestId)) return;
        pending.delete(requestId);
        reject(new Error(method + ' timed out'));
      }, 30000);
    });
  };
}

async function devtoolsTarget(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://${HOST}:${port}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* Chrome is still starting. */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint did not start');
}

async function runTier(chrome, quality, port) {
  const profile = path.join(TMP, 'profile-' + quality);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  const url = `http://${HOST}:${PORT}/cap.html?world=city&robot=rover&q=${quality}&view=3d`;
  const args = [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-first-run', '--disable-extensions', '--disable-default-apps',
    '--disable-component-extensions-with-background-pages', '--disable-background-networking',
    '--run-all-compositor-stages-before-draw', `--remote-debugging-port=${port}`,
    '--user-data-dir=' + profile, 'about:blank',
  ];
  const started = Date.now();
  const child = spawn(chrome, args, { windowsHide: true });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-16000); });
  let ws;
  let metrics = null;
  let pageState = null;
  let error = null;
  try {
    const target = await devtoolsTarget(port);
    ws = await connect(target.webSocketDebuggerUrl);
    const send = makeClient(ws);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url });
    // Poll instead of sleeping a guessed duration. The component publishes
    // only after a complete 120-frame rolling sample from the real render loop.
    for (let attempt = 0; attempt < 50; attempt++) {
      await sleep(400);
      const evaluated = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
          report: window.KodroPerformance || null,
          view3d: !!document.querySelector('.viewport3d'),
          canvas: !!document.querySelector('.viewport3d canvas'),
          visibility: document.visibilityState,
          error: document.querySelector('.error-boundary')?.textContent || ''
        })`,
        returnByValue: true,
      });
      pageState = JSON.parse(evaluated.result.value || '{}');
      if (pageState.report) { metrics = pageState.report; break; }
    }
  } catch (caught) {
    error = String(caught && caught.message || caught);
  } finally {
    try { if (ws) ws.close(); } catch { /* already closed */ }
    try { child.kill('SIGKILL'); } catch { /* already stopped */ }
  }
  return {
    qualityRequested: quality,
    url,
    processStatus: metrics ? 0 : null,
    timedOut: !metrics && !error,
    elapsedMs: Date.now() - started,
    metrics,
    pageState: metrics ? undefined : pageState,
    error,
    stderrTail: stderr.split(/\r?\n/).filter(Boolean).slice(-8),
  };
}

const chrome = resolveChrome();
if (!chrome) {
  console.log('SKIP: Chrome not found; no performance claim produced.');
  process.exit(0);
}

mkdirSync(TMP, { recursive: true });
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python.exe' : 'python3');
const server = spawn(python, ['-m', 'http.server', String(PORT), '--bind', HOST, '--directory', WEB], {
  cwd: REPO, stdio: 'ignore', windowsHide: true,
});

try {
  if (!(await serverReady())) throw new Error('local static server did not start');
  const runs = [];
  for (const [index, quality] of ['low', 'high'].entries()) {
    runs.push(await runTier(chrome, quality, 9417 + index));
  }
  const captured = runs.filter((r) => r.metrics).length;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    method: 'headless Chrome requestAnimationFrame cadence plus in-render submission timing on the shipped Three.js scene',
    chrome,
    platform: { platform: process.platform, arch: process.arch, node: process.version },
    artifactHashes: {
      bundleSha256: sha256(path.join(WEB, 'bundle.js')),
      harnessSha256: sha256(fileURLToPath(import.meta.url)),
    },
    target240HzFrameMs: 4.17,
    interpretation: {
      measuredFps: 'Observed requestAnimationFrame cadence in this browser environment; bounded by its virtual display.',
      p95RenderSubmissionMs: 'CPU-side render submission duration. It is not a GPU completion time or a promise of displayed FPS.',
      highRefreshSubmissionReady: 'True only when p95 submission work is at or below 4.17 ms in this run.',
      guarantee: 'No universal FPS guarantee is made. Hardware, display refresh, browser scheduling, driver and scene all matter.',
    },
    runs,
    verdict: captured === runs.length ? 'MEASURED' : captured ? 'PARTIAL' : 'UNAVAILABLE',
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('== KODRO PERFORMANCE EVIDENCE ==');
  for (const run of runs) {
    if (!run.metrics) console.log(`${run.qualityRequested.padEnd(5)} UNAVAILABLE`);
    else console.log(`${run.qualityRequested.padEnd(5)} ${run.metrics.measuredFps} fps observed, p95 frame ${run.metrics.p95FrameIntervalMs} ms, p95 submission ${run.metrics.p95RenderSubmissionMs} ms, 240 Hz work budget ${run.metrics.highRefreshSubmissionReady ? 'MET' : 'NOT MET'}`);
  }
  console.log('verdict ' + report.verdict + '; wrote ' + OUT);
  if (report.verdict === 'UNAVAILABLE') process.exitCode = 1;
} finally {
  try { server.kill(); } catch { /* already gone */ }
}
