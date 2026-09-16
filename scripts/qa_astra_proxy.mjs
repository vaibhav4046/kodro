/* Deterministic contract for api/astra.js. No real OpenAI request is made. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) pass += 1;
  else { fail += 1; failures.push(name + (detail ? ': ' + detail : '')); }
  console.log((condition ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
}

let handler;
try {
  handler = require('../api/astra.js');
} catch (e) {
  console.error('FAIL Astra server function exists [api/astra.js is required before this contract can pass]');
  process.exit(1);
}

function makeReq(method, { origin = 'https://vaibhav4046.github.io', body = undefined, headers = {} } = {}) {
  return { method, body, headers: Object.assign({ origin, 'content-type': 'application/json' }, headers) };
}
function makeRes() {
  return {
    statusCode: 200, headers: {}, payload: undefined, ended: false,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = String(v); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; this.ended = true; return this; },
    send(value) { this.payload = value; this.ended = true; return this; },
    end(value) { this.payload = value; this.ended = true; return this; },
  };
}
async function invoke(method, opts) {
  const req = makeReq(method, opts);
  const res = makeRes();
  await handler(req, res);
  return res;
}

const originalFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalOrigins = process.env.KODRO_ALLOWED_ORIGINS;
const upstream = [];
global.fetch = async (url, options = {}) => {
  upstream.push({ url: String(url), options });
  return {
    ok: true, status: 200,
    json: async () => ({
      id: 'resp_test',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"program":[{"cmd":"stop"}]}' }] }],
    }),
    text: async () => '',
  };
};

try {
  delete process.env.OPENAI_API_KEY;
  delete process.env.KODRO_ALLOWED_ORIGINS;

  let res = await invoke('OPTIONS');
  check('preflight succeeds', res.statusCode === 204);
  check('preflight allows only expected request headers', (res.headers['access-control-allow-headers'] || '').toLowerCase().includes('content-type'));
  check('production origin is explicitly allowed', res.headers['access-control-allow-origin'] === 'https://vaibhav4046.github.io');

  res = await invoke('GET');
  check('health reports unconfigured without exposing secret', res.statusCode === 200 && res.payload && res.payload.configured === false && res.payload.model === 'gpt-6-astra');
  check('health response contains no secret field', !JSON.stringify(res.payload).includes('OPENAI_API_KEY'));

  res = await invoke('POST', { origin: 'https://evil.example', body: { input: 'stop' } });
  check('disallowed origin is refused', res.statusCode === 403);
  check('disallowed origin is not reflected', res.headers['access-control-allow-origin'] !== 'https://evil.example');

  res = await invoke('POST', { body: { input: 'stop' } });
  check('missing server secret returns 503', res.statusCode === 503);
  check('missing secret makes no upstream request', upstream.length === 0, String(upstream.length));

  process.env.OPENAI_API_KEY = 'server-test-secret';
  res = await invoke('POST', { body: { input: '' } });
  check('empty input is rejected', res.statusCode === 400);
  res = await invoke('POST', { body: { input: 'x'.repeat(20001) } });
  check('oversized input is rejected', res.statusCode === 413 || res.statusCode === 400);
  res = await invoke('POST', { body: { input: 'stop', schema: [] } });
  check('non-object schema is rejected', res.statusCode === 400);
  res = await invoke('POST', { body: { input: 'stop', authorization: 'browser-secret' } });
  check('browser credential fields are rejected', res.statusCode === 400);

  const schema = {
    type: 'object',
    properties: { program: { type: 'array', items: { type: 'object' } } },
    required: ['program'],
  };
  res = await invoke('POST', {
    body: {
      input: 'stop',
      instructions: 'Return a fitted program.',
      max_output_tokens: 50,
      schema,
      model: 'client-must-not-control-this',
    },
  });
  check('unknown OpenAI control fields are rejected', res.statusCode === 400);

  res = await invoke('POST', {
    body: { input: 'stop', instructions: 'Return a fitted program.', max_output_tokens: 50, schema },
  });
  check('valid proxy request succeeds', res.statusCode === 200);
  check('proxy returns only output_text', JSON.stringify(Object.keys(res.payload || {}).sort()) === '["output_text"]');
  check('nested OpenAI output is extracted', res.payload && res.payload.output_text === '{"program":[{"cmd":"stop"}]}');
  check('exactly one valid request reached OpenAI', upstream.length === 1, String(upstream.length));

  const call = upstream[0] || { url: '', options: {} };
  let body = {};
  try { body = JSON.parse(call.options.body || '{}'); } catch (e) { void e; }
  check('server alone calls OpenAI Responses API', call.url === 'https://api.openai.com/v1/responses', call.url);
  check('server alone adds Authorization', call.options.headers && call.options.headers.Authorization === 'Bearer server-test-secret');
  check('server pins GPT-6 Astra', body.model === 'gpt-6-astra', String(body.model));
  check('server pins low reasoning', body.reasoning && body.reasoning.effort === 'low');
  check('server clamps output tokens', body.max_output_tokens === 1024, String(body.max_output_tokens));
  check('server disables response storage', body.store === false);
  check('server maps schema to Responses text.format', body.text && body.text.format && body.text.format.type === 'json_schema' && JSON.stringify(body.text.format.schema) === JSON.stringify(schema));
  check('server omits unsupported sampling controls', !('temperature' in body) && !('top_p' in body));

  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ output: [] }), text: async () => '' });
  res = await invoke('POST', { body: { input: 'stop' } });
  check('empty upstream output returns 502', res.statusCode === 502);

  global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited upstream detail that must stay bounded' });
  res = await invoke('POST', { body: { input: 'stop' } });
  check('upstream status is surfaced safely', res.statusCode === 429 && JSON.stringify(res.payload).length < 400);
  check('upstream error never exposes server secret', !JSON.stringify(res.payload).includes('server-test-secret'));

  global.fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  res = await invoke('POST', { body: { input: 'stop' } });
  check('OpenAI timeout maps to 504', res.statusCode === 504);

  process.env.KODRO_ALLOWED_ORIGINS = 'http://localhost:8000';
  res = await invoke('GET', { origin: 'http://localhost:8000' });
  check('explicit development origin can be allowed', res.statusCode === 200 && res.headers['access-control-allow-origin'] === 'http://localhost:8000');
} finally {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  if (originalOrigins === undefined) delete process.env.KODRO_ALLOWED_ORIGINS; else process.env.KODRO_ALLOWED_ORIGINS = originalOrigins;
}

console.log(`\nAstra server proxy QA: ${pass} passed, ${fail} failed`);
if (fail) {
  console.error(failures.join('\n'));
  process.exit(1);
}
