// Headless probe of the RoboLearn workspace grid at boundary window sizes.
// Uses Chrome via CDP (no puppeteer dependency) by launching with remote debugging.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = 'file:///' + path.resolve('qa_resize_repro.html').replace(/\\/g, '/');
const PORT = 9333;

function get(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }).on('error', rej);
  });
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async () => {
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    '--window-size=1024,640', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + path.resolve('.qa_chrome_profile'),
    FILE
  ], { stdio: 'ignore' });

  // wait for devtools
  let target;
  for (let i=0;i<50;i++){
    try {
      const list = JSON.parse(await get(`http://127.0.0.1:${PORT}/json`));
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
    } catch(e){}
    await sleep(200);
  }
  if (!target){ console.error('NO_TARGET'); proc.kill(); process.exit(1); }

  const WebSocket = require('ws');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate:false, maxPayload: 256*1024*1024 });
  let id = 0; const pending = new Map();
  ws.on('message', m => {
    const msg = JSON.parse(m);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  function cmd(method, params={}) {
    return new Promise((resolve) => { const i=++id; pending.set(i, resolve); ws.send(JSON.stringify({id:i, method, params})); });
  }
  await new Promise(r => ws.on('open', r));
  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await sleep(400);

  async function evalJS(expr) {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails };
    return r.result && r.result.result ? r.result.result.value : r.result;
  }

  // Override device metrics to simulate exact window inner sizes the OS would allow.
  async function setViewport(w, h) {
    await cmd('Emulation.setDeviceMetricsOverride', { width:w, height:h, deviceScaleFactor:1, mobile:false });
    await sleep(120);
  }

  const scenarios = [
    // [winW, winH, editorW, teleW, note]
    [1024, 640, 404, 318, 'min window, default panels'],
    [1024, 640, 640, 460, 'min window, BOTH panels dragged to MAX'],
    [1024, 640, 640, 318, 'min window, editor MAX only'],
    [1280, 800, 640, 460, 'typical window, both panels MAX'],
    [1400, 900, 404, 318, 'default geometry, default panels'],
    [800,  600, 404, 318, 'BELOW min_size (if OS ignored it / web preview)'],
    [3840, 2160, 640, 460, 'huge 4K window, panels MAX'],
  ];

  const out = [];
  for (const [w,h,ew,tw,note] of scenarios) {
    await setViewport(w,h);
    await evalJS(`window.__setW(${ew}, ${tw})`);
    await sleep(120);
    const rep = await evalJS(`JSON.stringify(window.__report(${JSON.stringify(note)}))`);
    out.push({ scenario:[w,h,ew,tw], note, ...JSON.parse(rep) });
  }
  console.log(JSON.stringify(out, null, 2));
  ws.close(); proc.kill();
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
