# Kodro × GPT-6 Astra Challenge — September 2026

Kodro is an existing open-source robot design, simulation and computing-learning product. This document deliberately separates the pre-existing product from the work added for the Product Hunt GPT-6 Astra Challenge. It is evidence of the challenge integration, not a claim that all of Kodro was created during the event.

## What was added for the challenge

### 1. First-class GPT-6 Astra provider

Kodro now exposes **OpenAI GPT-6 Astra (your API key)** inside the existing AI-provider picker.

- Model: `gpt-6-astra`
- API: OpenAI Responses API, `POST https://api.openai.com/v1/responses`
- Reasoning: `low` for interactive classroom latency
- Storage: `store: false`
- Structured robot-program generation: Responses API `text.format` JSON Schema
- Unsupported Astra sampling parameters such as `temperature` and `top_p` are deliberately omitted.
- The model alias is pinned so the challenge path cannot silently drift to another OpenAI model.

The integration lives in `src/kodro/assets/web/astra-provider.js`. It wraps Kodro's existing provider abstraction before the compiled application mounts, so all existing AI surfaces that route through `KodroProviders.generate(...)` can use the Astra path without replacing Kodro's simulator, interpreter, grader or evidence systems.

### 2. Offline-first behaviour is preserved

Astra is **opt-in**, not a new default.

Kodro still starts on local Ollama and makes no OpenAI request merely by loading the application. A user must explicitly select Astra and supply their own OpenAI API key. The key stays in that browser's local storage and is sent in the Authorization header only when the user invokes the selected Astra provider. Switching back to Ollama restores the local path.

The service worker never intercepts cross-origin AI requests and now precaches the small Astra adapter so the application shell remains offline-capable after first load.

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

1. Open Kodro and enter the coding/Companion experience.
2. In **AI provider**, select **OpenAI GPT-6 Astra (your API key)**.
3. Paste an OpenAI API key. The UI should show the provider as connected.
4. Ask for a small fitted-robot program, for example: `Drive forward 2 metres, turn right, and stop.`
5. Apply/run the generated program and show that Kodro executes it in the simulator rather than merely displaying model text.
6. Open a guided lesson and show the progressive challenge / teacher-plan layer.
7. Switch the provider back to local Ollama to demonstrate that Astra is additive and Kodro's offline-first mode remains intact.

## Verification

`node scripts/qa_astra_provider.mjs` is a deterministic, no-network contract test. It verifies that:

- Kodro remains local/offline by default;
- Astra is exposed as a provider but makes zero cloud requests on load;
- Astra requires an explicit user key;
- the exact request targets the Responses API with model `gpt-6-astra`;
- `temperature` and `top_p` are absent;
- reasoning is explicitly configured;
- structured output uses Responses `text.format` JSON Schema;
- response storage is disabled;
- the API key is in the Authorization header and not the JSON body;
- the runtime adapter loads before `bundle.js`;
- the service worker precaches the adapter;
- switching back to Ollama delegates to the existing local provider path.

The repository also retains its broader CI gates for simulator boot, browser privacy, UI paint/behaviour/layout/modals, interpreter, physics, lesson grading, curriculum, pupil-facing errors, accessibility-related checks and cross-engine fuzzing.

## Official references

- Product Hunt challenge: https://www.producthunt.com/p/gpt-6-astra-challenge
- GPT-6 Astra model: https://developers.openai.com/api/docs/models/gpt-6-astra
- OpenAI GPT-6.0 migration/model guide: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses

## Provenance

Kodro predates this challenge. The challenge-specific work should be reviewed through Git history and the files above. This repository does not represent pre-existing features as newly created with Astra.
