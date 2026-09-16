'use strict';

/* Server-only GPT-6 Astra proxy for Kodro.
 *
 * The public browser never receives an OpenAI credential. This Vercel Function
 * accepts only Kodro's small normalized request shape, constructs the Responses
 * API payload here, and injects OPENAI_API_KEY only at the server boundary.
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-6-astra';
const PROD_ORIGIN = 'https://vaibhav4046.github.io';
const TIMEOUT_MS = 120000;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_INPUT_CHARS = 20000;
const MAX_INSTRUCTIONS_CHARS = 8000;
const ALLOWED_FIELDS = new Set(['input', 'instructions', 'max_output_tokens', 'schema']);

function allowedOrigins() {
  const out = new Set([PROD_ORIGIN]);
  String(process.env.KODRO_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => out.add(value));
  return out;
}

function requestOrigin(req) {
  return String((req.headers && (req.headers.origin || req.headers.Origin)) || '').trim();
}

function setCors(res, origin) {
  if (!origin || !allowedOrigins().has(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function reply(res, status, payload) {
  res.status(status);
  if (status === 204) return res.end();
  return res.json(payload);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function validateBody(raw) {
  if (!isPlainObject(raw)) return { status: 400, error: 'JSON object body required' };

  let serialized;
  try { serialized = JSON.stringify(raw); } catch (e) { return { status: 400, error: 'body must be JSON serializable' }; }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REQUEST_BYTES) return { status: 413, error: 'request too large' };

  const unknown = Object.keys(raw).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length) return { status: 400, error: 'unsupported request field' };

  if (typeof raw.input !== 'string' || !raw.input.trim()) return { status: 400, error: 'input must be a non-empty string' };
  if (raw.input.length > MAX_INPUT_CHARS) return { status: 413, error: 'input too large' };

  if (raw.instructions != null && typeof raw.instructions !== 'string') return { status: 400, error: 'instructions must be a string' };
  if (typeof raw.instructions === 'string' && raw.instructions.length > MAX_INSTRUCTIONS_CHARS) return { status: 413, error: 'instructions too large' };

  if (raw.schema != null && !isPlainObject(raw.schema)) return { status: 400, error: 'schema must be a JSON object' };

  const requested = Number(raw.max_output_tokens);
  const maxOutput = Math.max(1024, Math.min(4096, Number.isFinite(requested) && requested > 0 ? requested : 1024));
  return {
    value: {
      input: raw.input,
      instructions: raw.instructions,
      max_output_tokens: maxOutput,
      schema: raw.schema,
    },
  };
}

function responseText(payload) {
  if (!payload) return '';
  if (typeof payload.output_text === 'string') return payload.output_text.trim();
  const pieces = [];
  (payload.output || []).forEach((item) => {
    ((item && item.content) || []).forEach((part) => {
      if (part && part.type === 'output_text' && typeof part.text === 'string') pieces.push(part.text);
    });
  });
  return pieces.join('').trim();
}

function boundedUpstreamMessage(text) {
  return String(text || 'request failed').replace(/\s+/g, ' ').trim().slice(0, 180) || 'request failed';
}

module.exports = async function handler(req, res) {
  const origin = requestOrigin(req);
  const originAllowed = !origin || allowedOrigins().has(origin);
  if (originAllowed) setCors(res, origin);

  if (req.method === 'OPTIONS') {
    if (!originAllowed) return reply(res, 403, { error: 'origin not allowed' });
    return reply(res, 204);
  }

  if (!originAllowed) return reply(res, 403, { error: 'origin not allowed' });

  if (req.method === 'GET') {
    return reply(res, 200, {
      ok: true,
      model: MODEL,
      configured: !!String(process.env.OPENAI_API_KEY || '').trim(),
    });
  }

  if (req.method !== 'POST') return reply(res, 405, { error: 'method not allowed' });

  const checked = validateBody(req.body);
  if (checked.error) return reply(res, checked.status || 400, { error: checked.error });

  const secret = String(process.env.OPENAI_API_KEY || '').trim();
  if (!secret) return reply(res, 503, { error: 'Astra proxy is not configured' });

  const input = checked.value;
  const body = {
    model: MODEL,
    input: input.input,
    reasoning: { effort: 'low' },
    max_output_tokens: input.max_output_tokens,
    store: false,
  };
  if (input.instructions) body.instructions = input.instructions;
  if (input.schema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: 'kodro_program',
        strict: false,
        schema: input.schema,
      },
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + secret,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') return reply(res, 504, { error: 'Astra request timed out' });
    return reply(res, 502, { error: 'Astra upstream request failed' });
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    let detail = '';
    try { detail = await upstream.text(); } catch (e) { void e; }
    const status = upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502;
    return reply(res, status, { error: 'Astra upstream ' + status + ': ' + boundedUpstreamMessage(detail) });
  }

  let payload;
  try { payload = await upstream.json(); } catch (e) { return reply(res, 502, { error: 'Astra returned invalid JSON' }); }
  const output = responseText(payload);
  if (!output) return reply(res, 502, { error: 'Astra returned no text' });
  return reply(res, 200, { output_text: output });
};
