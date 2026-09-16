# Astra server-side proxy design

Date: 2026-09-16
Status: proposed for implementation
Branch: `astra-server-proxy`

## Purpose

Move GPT-6 Astra authentication and OpenAI traffic out of the browser. Kodro's public GitHub Pages build must never receive, persist, transmit, or be able to read `OPENAI_API_KEY`. Ollama remains the default provider and remains fully local/offline.

## Current problem

`src/kodro/assets/web/astra-provider.js` currently stores an Astra API key in browser `localStorage` and sends it from the GitHub Pages origin directly to `https://api.openai.com/v1/responses`. That exposes a long-lived secret to browser JavaScript and makes a static deployment responsible for an API credential.

GitHub Pages cannot execute server code or hold private environment variables, so the authentication boundary needs a separate server runtime.

## Chosen architecture

Keep the existing GitHub Pages UI and static deployment. Add a small Vercel serverless endpoint at `/api/astra` and deploy it with the existing Kodro Vercel project. The Vercel runtime owns `OPENAI_API_KEY`; the browser never receives the value.

Data flow:

1. Kodro starts with Ollama exactly as it does today. No Astra or OpenAI request occurs during boot.
2. The user explicitly selects `OpenAI GPT-6 Astra (server managed)`.
3. Kodro's Astra adapter sends a constrained JSON request to the configured HTTPS proxy URL. It sends no API key and no OpenAI Authorization header.
4. The Vercel function verifies the request origin, method, content type, shape, and size.
5. The function constructs the OpenAI Responses API payload server-side. The model is pinned to `gpt-6-astra`; the client cannot override it. Reasoning remains `low`, output tokens are bounded, `store` is `false`, and optional structured output is passed as JSON Schema only after shape validation.
6. The function adds `Authorization: Bearer ${OPENAI_API_KEY}` server-side and calls `https://api.openai.com/v1/responses`.
7. The function extracts only the response text and returns `{ "output_text": "..." }` to Kodro. It does not return the OpenAI key or forward unnecessary response metadata.
8. The existing `structuredProgram()` path parses that text as JSON and compiles only commands allowed by the fitted robot.

## Browser changes

`src/kodro/assets/web/astra-provider.js` will no longer contain an Astra key name, key reader, key writer, Authorization header, or direct `api.openai.com` URL.

It may continue to persist the non-secret selected provider id and pinned model id because those are preferences, not credentials. Astra configuration will advertise:

- provider: `astra`
- label: `OpenAI GPT-6 Astra (server managed)`
- local: `false`
- cloud model: `gpt-6-astra`
- no user key requirement
- fixed proxy endpoint

`setKey('astra', ...)` will be a no-op/delegation-safe path for compatibility with the existing provider interface; it must never persist the supplied value. Any stale `kodro_ai_key_astra` left by an older Kodro build will be actively removed during adapter initialization as a one-time migration.

Selecting Astra must route generation to the proxy rather than silently falling back to Ollama. If the proxy is unavailable or lacks its server secret, Kodro surfaces the server error and does not substitute a different cloud model.

The existing Groq/OpenRouter/custom-provider BYOK behavior is outside this change. The regression guard will be Astra-specific so this security repair does not silently redesign unrelated providers.

## Server endpoint

Add `api/astra.js` as a Vercel serverless function using only platform/Node APIs; no new runtime dependency is required.

### Accepted methods

- `OPTIONS` for CORS preflight.
- `GET` as a minimal health/configuration probe. It returns availability/model metadata but never secret material.
- `POST` for generation.
- Other methods return `405`.

### Origin policy

Production browser requests are accepted only from the exact Kodro origin `https://vaibhav4046.github.io`. Local development origins may be allowed explicitly through an environment variable such as `KODRO_ALLOWED_ORIGINS`; there is no wildcard `*` for credentialed application traffic.

The endpoint does not accept a browser-provided OpenAI credential. It also never reflects arbitrary origins.

### Request contract

The browser sends a normalized payload rather than an arbitrary OpenAI request:

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

The server enforces conservative size/length limits, clamps `max_output_tokens` to 1024-4096, requires strings where strings are expected, and rejects malformed schema payloads rather than forwarding arbitrary request objects.

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

Unsupported sampling parameters such as `temperature` and `top_p` are not forwarded. The OpenAI endpoint is a server constant, not client input.

## Error handling

- Missing `OPENAI_API_KEY`: `503` with a short configuration error and no secret data.
- Disallowed browser origin: `403`.
- Invalid/malformed/oversized request: `400` or `413`.
- OpenAI timeout: `504`.
- OpenAI non-success: preserve a useful status where safe, but return a bounded/sanitized message rather than raw upstream headers or secrets.
- Empty Astra output: `502`.

Neither server nor browser logs request Authorization values.

## Service worker and privacy boundary

The service worker continues to precache the static Astra adapter. It must not cache `/api/astra` responses. Because the proxy is cross-origin from GitHub Pages, the existing same-origin service-worker guard already excludes it; tests will preserve this property.

The browser privacy regression test will specifically assert that the Astra adapter:

- contains no `kodro_ai_key_astra` persistence after the migration cleanup path executes,
- sends no Authorization header,
- never calls `api.openai.com` directly,
- calls only the documented Astra proxy when Astra is selected,
- makes zero Astra network calls on initial app load.

The server test will assert that only the server adds the OpenAI Authorization header.

## Tests

Behavioral changes will be test-first.

1. Update `scripts/qa_astra_provider.mjs` so its initial failing expectations describe the new boundary: no client key, explicit Astra selection, proxy request only, normalized structured schema, no browser Authorization header, and no direct OpenAI hostname.
2. Add a deterministic server contract test for `api/astra.js` with mocked `fetch` and environment variables. Cover CORS, missing secret, payload validation, model pinning, low reasoning, bounded output, `store:false`, structured output, Authorization only on the server, response extraction, and upstream failures.
3. Keep existing web boot/privacy, bundle freshness, secret scan, and platform CI green.
4. Build the static site and verify the generated service worker/cache fingerprint includes the updated adapter.
5. After deployment, fetch the live GitHub Pages adapter and Vercel health endpoint. A real authenticated Astra inference is a separate release check that requires `OPENAI_API_KEY` to be configured in Vercel; the credential itself must never be pasted into chat, committed, or exposed to the browser.

## Deployment

The repository can contain the proxy function and client wiring, but the actual secret is operational configuration, not source code.

Vercel production configuration requires:

- `OPENAI_API_KEY` = server-only secret
- optional `KODRO_ALLOWED_ORIGINS` = extra explicit development origins; production Kodro origin remains allowed by code/config

The connected Vercel tooling currently exposes deployment/project inspection but not an environment-secret write action. Therefore implementation can deploy code as far as available permissions allow, while secret creation must use a supported Vercel environment-variable control outside the repository. No fallback will place the key in GitHub, JavaScript, committed files, or localStorage.

## Acceptance criteria

The change is complete only when all of the following are true:

- Ollama is still the default and makes no external request on boot.
- Selecting Astra no longer asks the browser to retain an OpenAI key.
- The browser contains no usable OpenAI credential and sends no OpenAI Authorization header.
- Stale `kodro_ai_key_astra` data from old releases is deleted on initialization.
- Browser Astra generation goes only to the configured Vercel proxy.
- The server alone reads `OPENAI_API_KEY` and calls the Responses API.
- The server pins `gpt-6-astra`, low reasoning, bounded output, `store:false`, and structured JSON Schema behavior.
- Structured robot-program responses still reach `structuredProgram()` and compile through Kodro's fitted-command allowlist.
- Focused client and server regression tests pass, followed by the repository's authoritative CI gates.
- No secret is committed, printed in test output, or shipped in the static Pages artifact.
