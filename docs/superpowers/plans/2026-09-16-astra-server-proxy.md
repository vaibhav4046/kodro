# Astra Server Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move GPT-6 Astra authentication and Responses API traffic behind a Vercel server function so no OpenAI credential is stored, read, or transmitted by Kodro's browser build.

**Architecture:** The existing static GitHub Pages client keeps Ollama as its default and calls `https://kodro-ca2.vercel.app/api/astra` only after Astra is explicitly selected. `api/astra.js` validates the normalized client payload, reads `OPENAI_API_KEY` only in the server runtime, constructs the pinned Responses API request, and returns only `output_text`.

**Tech Stack:** Vanilla browser JavaScript, Node.js 20-compatible Vercel Function, Node deterministic QA scripts, pytest privacy guards, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-astra-server-proxy-design.md`

## Global Constraints

- Ollama remains the default/offline provider; app boot performs zero Astra/OpenAI requests.
- Canonical browser proxy endpoint: `https://kodro-ca2.vercel.app/api/astra`.
- The browser must never read, write, transmit, or log an OpenAI credential.
- The legacy literal `kodro_ai_key_astra` is allowed only in `localStorage.removeItem(...)` migration cleanup.
- Only the server may read `OPENAI_API_KEY`, add `Authorization`, or call `https://api.openai.com/v1/responses`.
- The server pins model `gpt-6-astra`, `reasoning.effort="low"`, `store=false`, and clamps output tokens to 1024-4096.
- No new runtime dependency is required.
- Existing Groq/OpenRouter/custom BYOK behavior is out of scope.
- Never commit or print a real secret.

---

### Task 1: Lock the new security boundary in failing tests

**Files:**
- Modify: `scripts/qa_astra_provider.mjs`
- Create: `scripts/qa_astra_proxy.mjs`
- Modify: `tests/unit/test_web_offline.py`
- Modify: `.github/workflows/astra-provider.yml`

**Interfaces:**
- Consumes: current `window.KodroProviders` wrapper behavior and current privacy scan.
- Produces: executable client contract `node scripts/qa_astra_provider.mjs` and server contract `node scripts/qa_astra_proxy.mjs`.

- [ ] **Step 1: Change the browser contract first.** Seed fake legacy storage with `kodro_ai_key_astra=legacy-secret`, load the shipped adapter, and assert initialization deletes that entry without any `getItem('kodro_ai_key_astra')` access. After selecting Astra, assert `cloudReady() === true`, `hasKey === false`, label is `OpenAI GPT-6 Astra (server managed)`, and endpoint is `https://kodro-ca2.vercel.app/api/astra`. Call `setKey('astra', 'must-not-persist')` and prove storage never contains it. Generate with a robot schema and assert exactly one POST goes to the proxy with `Content-Type: application/json`, no `Authorization` header, no credential in body, and body exactly carries `input`, optional `instructions`, bounded `max_output_tokens`, and optional `schema`.

```js
check('legacy Astra key is deleted', !data.has('kodro_ai_key_astra'));
check('Astra is server managed', P.config().hasKey === false && P.cloudReady() === true);
check('browser uses only proxy', req.url === 'https://kodro-ca2.vercel.app/api/astra');
check('browser sends no Authorization', !Object.keys(req.options.headers || {}).some((k) => k.toLowerCase() === 'authorization'));
check('browser sends no credential', !String(req.options.body || '').includes('legacy-secret') && !String(req.options.body || '').includes('must-not-persist'));
```

- [ ] **Step 2: Add the server contract before the server exists.** `qa_astra_proxy.mjs` must fail clearly when `api/astra.js` is absent, then exercise the exported Vercel handler with synthetic request/response objects and a mocked `global.fetch`. Cover `OPTIONS` CORS, `GET` health without secret disclosure, disallowed origin `403`, missing secret `503`, malformed/oversized input, model pinning, low reasoning, token clamping, `store:false`, schema translation, server-only Authorization, output extraction, empty output `502`, upstream error sanitization, and timeout handling.

```js
const handler = require('../api/astra.js');
process.env.OPENAI_API_KEY = 'server-test-secret';
await invoke('POST', {
  origin: 'https://vaibhav4046.github.io',
  body: { input: 'stop', max_output_tokens: 50, schema: { type: 'object' } },
});
check('server pins model', upstreamBody.model === 'gpt-6-astra');
check('server clamps tokens', upstreamBody.max_output_tokens === 1024);
check('server owns auth', upstreamHeaders.Authorization === 'Bearer server-test-secret');
```

- [ ] **Step 3: Tighten the privacy gate.** Keep `api.groq.com` and `openrouter.ai` as BYOK hosts, allow `kodro-ca2.vercel.app` only for `astra-provider.js`, and assert `api.openai.com` is no longer a browser-host allowlist member.

```python
_BYOK_ALLOWED_HOSTS = {"api.groq.com", "openrouter.ai"}
_ASTRA_PROXY_HOSTS = {"kodro-ca2.vercel.app"}
allowed = _ASTRA_PROXY_HOSTS if name == "astra-provider.js" else (_BYOK_ALLOWED_HOSTS if name in {"ai-providers.jsx", "ai-web.jsx"} else _CITATION_HOSTS.get(name, set()))
```

- [ ] **Step 4: Make Actions run both focused contracts.** Add `node scripts/qa_astra_proxy.mjs` after the browser contract in `.github/workflows/astra-provider.yml`.

- [ ] **Step 5: Commit the RED state.** Commit only tests/workflow changes, then inspect PR #53 CI. Expected: browser contract fails against direct-BYOK behavior and server contract fails because `api/astra.js` does not exist.

---

### Task 2: Implement the server-only Astra boundary

**Files:**
- Create: `api/astra.js`
- Test: `scripts/qa_astra_proxy.mjs`

**Interfaces:**
- Consumes: POST `{input:string, instructions?:string, max_output_tokens?:number, schema?:object}` from the browser.
- Produces: Vercel handler `module.exports = async function handler(req, res)` returning `{output_text:string}` on success.

- [ ] **Step 1: Verify the server test is RED for the missing function.** Run `node scripts/qa_astra_proxy.mjs`; expected failure names `api/astra.js` as missing.

- [ ] **Step 2: Implement method/origin/CORS and health handling.** Build an allowlist containing `https://vaibhav4046.github.io` plus comma-separated `KODRO_ALLOWED_ORIGINS`. Never reflect an unapproved origin. `GET` returns `{ok:true, model:'gpt-6-astra', configured:Boolean(process.env.OPENAI_API_KEY)}`; `OPTIONS` returns 204; unsupported methods return 405.

```js
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-6-astra';
const PROD_ORIGIN = 'https://vaibhav4046.github.io';
```

- [ ] **Step 3: Implement normalized payload validation.** Reject non-object bodies, unknown credentials/authorization fields, empty/non-string input, input above 20,000 characters, instructions above 8,000 characters, serialized body above 64 KiB, and schema values that are not plain JSON objects. Clamp requested output tokens with `Math.max(1024, Math.min(4096, Number(value) || 1024))`.

- [ ] **Step 4: Construct OpenAI request only on the server.** Read `process.env.OPENAI_API_KEY`; if missing return 503. Construct only the pinned request fields; add `text.format` only when schema exists. Use an `AbortController` with a 120-second timer and `fetch(OPENAI_ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+secret}, body:JSON.stringify(body), signal})`.

- [ ] **Step 5: Return a minimal response.** Extract top-level `output_text` first, otherwise join nested `output[].content[]` parts of type `output_text`. Return `{output_text}` only. Return bounded JSON errors for timeout/upstream/empty-output conditions and never echo upstream Authorization or request headers.

- [ ] **Step 6: Verify GREEN.** Run `node scripts/qa_astra_proxy.mjs`; expected all server contract checks pass.

- [ ] **Step 7: Commit the server implementation.** Commit `api/astra.js` separately so its security boundary is independently reviewable.

---

### Task 3: Replace browser BYOK with proxy-only Astra

**Files:**
- Modify: `src/kodro/assets/web/astra-provider.js`
- Test: `scripts/qa_astra_provider.mjs`
- Test: `tests/unit/test_web_offline.py`

**Interfaces:**
- Consumes: existing `window.KodroProviders` assignment/wrapper interface.
- Produces: Astra provider that is explicitly selected, server-managed, keyless in-browser, and routes only to `https://kodro-ca2.vercel.app/api/astra`.

- [ ] **Step 1: Verify browser contract is RED before production edit.** Run `node scripts/qa_astra_provider.mjs`; expected failures include legacy key persistence/direct OpenAI endpoint/browser Authorization.

- [ ] **Step 2: Remove browser credential behavior.** Delete Astra key readers/writers and direct OpenAI URL. On adapter initialization execute only `localStorage.removeItem('kodro_ai_key_astra')` for migration. `setKey('astra', value)` discards `value` and returns config without persistence.

- [ ] **Step 3: Switch provider configuration to server-managed.** Use `PROXY_ENDPOINT='https://kodro-ca2.vercel.app/api/astra'`, label `OpenAI GPT-6 Astra (server managed)`, `hasKey:false`, `cloudReady:true` when Astra is selected, `cloudModel:'gpt-6-astra'`, and `needsEndpoint:false`.

- [ ] **Step 4: Normalize browser generation request.** Send only `{input, instructions?, max_output_tokens, schema?}` to the proxy. Do not send model, reasoning settings, `store`, `temperature`, `top_p`, key material, or an Authorization header. Parse `{output_text}` and return that text to the existing facade. When Astra is selected, proxy failure must throw rather than fall back to Ollama.

- [ ] **Step 5: Verify browser and privacy GREEN.** Run `node scripts/qa_astra_provider.mjs` and `pytest tests/unit/test_web_offline.py -q`. Expected: both pass; the browser host set includes the Vercel proxy but excludes OpenAI.

- [ ] **Step 6: Commit client implementation and privacy guard.** Keep this commit scoped to the adapter/privacy behavior.

---

### Task 4: Documentation, authoritative CI, and deployment readiness

**Files:**
- Modify: `docs/ASTRA_CHALLENGE_2026.md`
- Modify as required by generated-asset gate: `src/kodro/assets/web/sw.js`
- Verify: `scripts/build_web.cjs`, `.github/workflows/ci.yml`, `.github/workflows/astra-provider.yml`

**Interfaces:**
- Consumes: completed keyless browser adapter and server proxy.
- Produces: reviewable challenge/security documentation and exact-head CI evidence for PR #53.

- [ ] **Step 1: Update Astra documentation.** Replace instructions to enter a local API key with the server-managed flow. State that `OPENAI_API_KEY` exists only in Vercel project settings and must not be put in GitHub/JavaScript/localStorage. Document proxy health endpoint and explicit production origin.

- [ ] **Step 2: Run the focused contracts together.** Run `node scripts/qa_astra_provider.mjs && node scripts/qa_astra_proxy.mjs`; expected both report zero failures.

- [ ] **Step 3: Run the authoritative build/privacy gates.** Run the exact commands represented by CI for bundle freshness, web boot/privacy, secret scan, tests, and generated service-worker/cache integrity. Do not interpret a printed `SKIP` as a pass.

- [ ] **Step 4: Push final branch head and verify PR #53 exact-head Actions.** Require the Astra provider workflow and full CI to complete successfully for the same head SHA before marking the PR ready.

- [ ] **Step 5: Review the PR diff for secret regressions.** Confirm no real key/token value exists, browser source has no `Authorization` or `api.openai.com`, and only `api/astra.js` reads `OPENAI_API_KEY`.

- [ ] **Step 6: Mark PR #53 ready only after all checks are green.** Do not merge a red or stale head.

- [ ] **Step 7: Deployment release check.** Deploy the repository to the Vercel project when project linkage/tooling permits. Configure `OPENAI_API_KEY` using Vercel's encrypted environment-variable UI/API outside source control. Verify `GET https://kodro-ca2.vercel.app/api/astra` reports configured without returning the secret, then verify a real structured robot-program request only after the secret exists. Never paste the secret into chat.
