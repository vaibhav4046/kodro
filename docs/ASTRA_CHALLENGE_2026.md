# Kodro × GPT-6 Astra Challenge — September 2026

Kodro is an existing open-source robot design, simulation and computing-learning product. This document deliberately separates the pre-existing product from the work added for the Product Hunt GPT-6 Astra Challenge. It is evidence of the challenge integration, not a claim that all of Kodro was created during the event.

## What was added for the challenge

### 1. First-class GPT-6 Astra provider

Kodro exposes **OpenAI GPT-6 Astra (server managed)** inside the existing AI-provider layer.

- Model: `gpt-6-astra`
- Browser endpoint: `POST https://kodro-ca2.vercel.app/api/astra`
- Server upstream: OpenAI Responses API, `POST https://api.openai.com/v1/responses`
- Reasoning: `low` for interactive classroom latency
- Storage: `store: false`
- Structured robot-program generation: Responses API `text.format` JSON Schema, constructed server-side
- Unsupported Astra sampling parameters such as `temperature` and `top_p` are deliberately omitted.
- The model alias is pinned on the server so the browser cannot silently drift to another OpenAI model.

The browser integration lives in `src/kodro/assets/web/astra-provider.js`. It wraps Kodro's existing provider abstraction before the compiled application mounts, so existing AI surfaces that route through `KodroProviders.generate(...)` can use Astra without replacing Kodro's simulator, interpreter, grader or evidence systems.

The OpenAI security boundary lives in `api/astra.js`. Only that server function may read `OPENAI_API_KEY`, add an OpenAI Authorization header or contact `api.openai.com`. The static browser build receives no OpenAI credential.

### 2. Offline-first behaviour is preserved

Astra is **opt-in**, not the default. Kodro still starts on local Ollama and makes no Astra/OpenAI request merely by loading the application. A user must explicitly select Astra before any proxy request occurs. Switching back to Ollama restores the local path.

The browser no longer asks for or stores an Astra/OpenAI API key. On startup the Astra adapter deletes the legacy `kodro_ai_key_astra` localStorage entry from the earlier challenge integration without reading its value. The browser then sends only normalized prompt/schema data to the server proxy.

The service worker never intercepts cross-origin AI requests and precaches the small Astra adapter so the application shell remains offline-capable after first load.

### 3. Teacher curriculum mode

The challenge build also integrates the teacher-facing curriculum layer merged in PR #45:

- progressive challenge flow across the 24 guided challenges,
- four classroom teaching blocks,
- objectives, prerequisites, timings, support and stretch guidance,
- downloadable lesson plans,
- direct launch into the simulator,
- saved learner progress.

This turns the simulator into a clearer classroom journey while preserving Kodro's existing deterministic lesson grading.

## Why Astra is useful here

Astra is not the physics engine and it is not allowed to decide whether a program actually passed a challenge. Kodro keeps those jobs deterministic.

Astra is used where language reasoning is valuable: helping a learner turn an intent into code constrained to the fitted robot, reviewing/explaining code, and supporting the product's existing assistant surfaces. Generated code is still checked by Kodro's interpreter and hardware-aware command constraints before it can be treated as a valid robot program.

That split is intentional: the model helps with reasoning and language; Kodro's simulator, interpreter, physics, grader and evidence pipeline remain the source of truth for execution.

## Judge demo path

The Astra step requires the production Vercel project to have its server-only `OPENAI_API_KEY` configured before the demo. The key is never entered into Kodro's browser UI.

1. Open Kodro and enter the coding/Companion experience.
2. In **AI provider**, select **OpenAI GPT-6 Astra (server managed)**.
3. Ask for a small fitted-robot program, for example: `Drive forward 2 metres, turn right, and stop.`
4. Show the returned structured program and apply/run it in the simulator rather than merely displaying model text.
5. Open a guided lesson and show the progressive challenge / teacher-plan layer.
6. Switch the provider back to local Ollama to demonstrate that Astra is additive and Kodro's offline-first mode remains intact.

## Security and deployment boundary

Production server configuration:

- `OPENAI_API_KEY` is an encrypted/server-only Vercel environment variable; never commit it and never put it in browser localStorage.
- `KODRO_ALLOWED_ORIGINS` may add explicit development origins. Production always permits the exact Kodro GitHub Pages origin.
- `GET https://kodro-ca2.vercel.app/api/astra` is a health/configuration probe that may report whether the server secret is configured but never returns the value.
- CORS/origin validation is a browser boundary, not complete authentication against scripted clients. Before public production use, the proxy should also have deployment-level abuse controls such as Vercel Firewall/rate limiting and an OpenAI project spend cap.

## Verification

`node scripts/qa_astra_provider.mjs` is the deterministic browser contract. It verifies that:

- Kodro remains local/offline by default;
- loading the adapter makes zero network requests;
- a stale Astra browser key is deleted without being read or rewritten;
- Astra is server-managed and does not require/persist a browser key;
- the browser calls only `https://kodro-ca2.vercel.app/api/astra`;
- the browser sends no Authorization header, model override, reasoning override or response-storage control;
- structured robot schema is sent only as normalized `schema` data;
- the browser source contains no direct `api.openai.com` path;
- the runtime adapter loads before `bundle.js` and the service worker precaches it;
- switching back to Ollama delegates to the existing local provider path.

`node scripts/qa_astra_proxy.mjs` is the deterministic server contract. With mocked upstream networking it verifies:

- CORS and origin policy;
- missing-secret and payload-validation failures;
- only the server adds the OpenAI Authorization header;
- endpoint/model pinning, low reasoning, bounded output and `store:false`;
- server-side Responses `text.format` JSON Schema construction;
- output-text extraction and bounded upstream errors;
- timeout behavior and explicit development-origin configuration.

The repository also retains its broader CI gates for simulator boot, browser privacy, UI paint/behaviour/layout/modals, interpreter, physics, lesson grading, curriculum, pupil-facing errors, accessibility-related checks and cross-engine fuzzing.

## Official references

- Product Hunt challenge: https://www.producthunt.com/p/gpt-6-astra-challenge
- GPT-6 Astra model: https://developers.openai.com/api/docs/models/gpt-6-astra
- OpenAI GPT-6.0 migration/model guide: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses

## Provenance

Kodro predates this challenge. The challenge-specific work should be reviewed through Git history and the files above. This repository does not represent pre-existing features as newly created with Astra.
