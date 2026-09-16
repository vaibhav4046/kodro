# Astra server-side proxy design

Date: 2026-09-16
Status: proposed for implementation
Branch: `astra-server-proxy`

## Purpose

Move GPT-6 Astra authentication and OpenAI traffic out of the browser. Kodro's public GitHub Pages build must never receive, persist, transmit, or be able to read `OPENAI_API_KEY`. Ollama remains the default provider and remains fully local/offline.

## Current problem

`src/kodro/assets/web/astra-provider.js` currently stores an Astra API key in browser `localStorage` and sends it from the GitHub Pages origin directly to `https://api.openai.com/v1/responses`. That exposes a long-lived secret to browser JavaScript. GitHub Pages cannot execute server code or hold private environment variables, so the authentication boundary needs a separate server runtime.

## Chosen architecture

Keep the existing GitHub Pages UI and static deployment. Add a Vercel serverless endpoint at `/api/astra` in the existing Kodro Vercel project. The canonical production proxy URL is `https://kodro-ca2.vercel.app/api/astra`. Vercel owns `OPENAI_API_KEY`; the browser never receives the value.

Data flow:

1. Kodro boots with Ollama exactly as today. No Astra/OpenAI request occurs on load.
2. The user explicitly selects `OpenAI GPT-6 Astra (server managed)`.
3. The Astra adapter sends a constrained JSON request to the Vercel proxy. It sends no API key and no OpenAI Authorization header.
4. The proxy verifies origin, method, content type, request shape and size.
5. The proxy constructs the OpenAI Responses API payload itself. `gpt-6-astra`, low reasoning, bounded output and `store:false` are server-controlled.
6. Only the proxy adds `Authorization: Bearer ${OPENAI_API_KEY}` and calls `https://api.openai.com/v1/responses`.
7. The proxy returns only `{ "output_text": "..." }`.
8. Kodro's existing `structuredProgram()` parses the JSON text and compiles only commands allowed by the fitted robot.

## Browser changes

`src/kodro/assets/web/astra-provider.js` will no longer read, write or transmit an Astra/OpenAI credential. It will contain no OpenAI Authorization header and no direct `api.openai.com` request path.

It may continue to persist the non-secret selected provider id and pinned model id. Astra configuration will advertise:

- provider: `astra`
- label: `OpenAI GPT-6 Astra (server managed)`
- local: `false`
- cloud model: `gpt-6-astra`
- no user key requirement
- proxy endpoint: `https://kodro-ca2.vercel.app/api/astra`

`setKey('astra', ...)` remains only for compatibility with the existing provider interface and must discard the supplied value without persisting it.

An older Kodro build may already have written `kodro_ai_key_astra`. The new adapter therefore includes a one-time cleanup that calls `localStorage.removeItem('kodro_ai_key_astra')`. This legacy key-name literal is permitted only for deletion: the adapter must never call `getItem` for it, assign its value to a variable, include it in a request, or write it again.

Selecting Astra must route generation to the proxy rather than silently falling back to Ollama. If the proxy is unavailable or lacks its server secret, Kodro surfaces that error and does not substitute another cloud model.

The existing Groq/OpenRouter/custom-provider BYOK behavior is outside this change. The regression guard is Astra-specific so this repair does not silently redesign unrelated providers.

## Server endpoint

Add `api/astra.js` as a Vercel serverless function using platform/Node APIs only.

### Methods

- `OPTIONS`: CORS preflight.
- `GET`: minimal health/configuration probe; reports whether Astra is configured without returning secret material.
- `POST`: generation.
- Everything else: `405`.

### Origin policy

Production browser requests are accepted from the exact Kodro origin `https://vaibhav4046.github.io`. Additional development origins may be supplied explicitly through `KODRO_ALLOWED_ORIGINS`. There is no arbitrary origin reflection and no wildcard allowlist.

The endpoint never accepts a browser-provided OpenAI credential.

### Browser request contract

```json
{
  "input": "Drive forward two metres, turn right, and stop.",
  "instructions": "Return the fitted robot program.",
  "max_output_tokens": 1024,
  "schema": {
    "type": "object",
    "properties": {
      "program": { "type": "array" }
    },
    "required": ["program"]
  }
}
```

The server enforces conservative request/field limits, requires strings where strings are expected, clamps `max_output_tokens` to 1024-4096, and validates that any schema is a plain JSON object before forwarding it. It never accepts an arbitrary OpenAI request object.

### OpenAI request contract

The server alone constructs:

```json
{
  "model": "gpt-6-astra",
  "input": "...",
  "instructions": "...",
  "reasoning": { "effort": "low" },
  "max_output_tokens": 1024,
  "store": false,
  "text": {
    "format": {
      "type": "json_schema",
      "name": "kodro_program",
      "strict": false,
      "schema": {}
    }
  }
}
```

Unsupported sampling parameters such as `temperature` and `top_p` are not forwarded. Endpoint and model are server constants, not client input.

## Error handling

- Missing `OPENAI_API_KEY`: `503` with a short configuration error and no secret data.
- Disallowed origin: `403`.
- Invalid/malformed request: `400`; oversized request: `413`.
- OpenAI timeout: `504`.
- OpenAI failure: bounded/sanitized error text; no upstream headers or secret material.
- Empty Astra output: `502`.

Neither server nor browser logs Authorization values.

## Service worker and privacy boundary

The service worker continues to precache the static Astra adapter. It must not cache `/api/astra` responses. The proxy is cross-origin from GitHub Pages, so the existing same-origin service-worker guard excludes it.

Browser regression coverage must prove that the Astra adapter:

- deletes a stale `kodro_ai_key_astra` entry without reading or rewriting it,
- persists no new Astra/OpenAI credential,
- sends no Authorization header,
- never calls `api.openai.com` directly,
- calls only the documented Astra proxy when Astra is selected,
- makes zero Astra network calls on initial app load.

Server tests prove that only `api/astra.js` reads `OPENAI_API_KEY` and adds the OpenAI Authorization header.

## Tests

Behavioral changes are test-first.

1. Change `scripts/qa_astra_provider.mjs` first so it fails against the current client and describes the new boundary: legacy-key deletion, no client credential, explicit Astra selection, proxy-only request, normalized structured schema, no browser Authorization header and no direct OpenAI hostname.
2. Add a deterministic server contract test for `api/astra.js` with mocked `fetch` and environment variables. Cover CORS, missing secret, payload validation, model pinning, low reasoning, bounded output, `store:false`, structured output, server-only Authorization, response extraction and upstream failures.
3. Keep web boot/privacy, bundle freshness, secret scan and cross-platform CI green.
4. Build the static site and verify the generated service-worker cache fingerprint includes the changed adapter.
5. After deployment, fetch the live GitHub Pages adapter and Vercel health endpoint. A real authenticated Astra inference is a separate release check after the server environment secret is configured.

## Deployment

Vercel production configuration requires:

- `OPENAI_API_KEY`: server-only secret.
- optional `KODRO_ALLOWED_ORIGINS`: explicit extra development origins.

The connected Vercel tools can inspect/deploy projects but do not currently expose an environment-secret write action. Therefore repository implementation and deployment can proceed as far as available permissions allow, but secret creation must use a supported Vercel environment-variable control outside source code. No fallback may place the secret in GitHub, JavaScript, committed files or localStorage.

## Acceptance criteria

The change is complete only when all of the following are true:

- Ollama remains the default and makes no external request on boot.
- Selecting Astra no longer asks for or stores an OpenAI key in the browser.
- The browser contains no usable OpenAI credential and sends no OpenAI Authorization header.
- Legacy `kodro_ai_key_astra` data is deleted without being read or transmitted.
- Browser Astra generation goes only to `https://kodro-ca2.vercel.app/api/astra`.
- Only the server reads `OPENAI_API_KEY` and calls the Responses API.
- The server pins `gpt-6-astra`, low reasoning, bounded output, `store:false` and structured JSON Schema behavior.
- Structured robot-program responses still reach `structuredProgram()` and compile through Kodro's fitted-command allowlist.
- Focused client/server regression tests pass, followed by authoritative repository CI.
- No secret is committed, printed in test output or shipped in the static Pages artifact.
