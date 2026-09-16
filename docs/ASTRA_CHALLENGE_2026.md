# Kodro × GPT-6 Astra Challenge — September 2026

Kodro is an existing open-source robot design, simulation and computing-learning product. This document separates the pre-existing product from challenge-specific Astra exploration and avoids claiming an integration is live when the public runtime cannot authenticate it safely.

## Current public runtime

Kodro's public GitHub Pages build is **local-first and zero-cost**. Local Ollama is the only executable AI runtime.

GPT-6 Astra remains visible in the provider picker as **OpenAI GPT-6 Astra (not connected)** so the product can explain the available connection concepts without making a paid request or collecting an OpenAI credential in browser JavaScript.

Selecting Astra:

- makes zero network requests;
- exposes no active OpenAI or Kodro-paid proxy endpoint;
- stores no OpenAI API key;
- reports `cloudReady: false` / unavailable;
- fails closed if generation is attempted;
- leaves the user free to switch immediately back to local Ollama.

The previous experimental Vercel/OpenAI server proxy has been removed from the repository, so Kodro itself cannot spend the maintainer's OpenAI API balance.

## Astra connection concepts

### Separately billed API access

OpenAI API usage has its own billing. A user who has API access could connect Astra in a future supported integration through a secure backend or local gateway they control. The public Kodro webpage does not ask for, store, forward, or proxy the user's `OPENAI_API_KEY`.

### ChatGPT subscription access

Eligible ChatGPT plans can provide Astra in supported ChatGPT surfaces such as ChatGPT Work and Codex. That access is useful when working on or with Kodro from those products, but it does not make a ChatGPT subscription/session an API credential that the Kodro webpage can spend.

Kodro does not scrape or reuse ChatGPT cookies, session tokens or browser credentials. `Sign in with ChatGPT`, where available, is not represented as model-inference authorization for this webpage.

See `docs/ASTRA_CONNECTIONS.md` for the runtime/authentication boundary.

## Offline-first provider policy

The base web provider layer now exposes only Ollama. Older Groq, OpenRouter and arbitrary cloud-endpoint runtime paths have been removed from the public provider implementation. Legacy browser-stored cloud credential/endpoint entries are deleted rather than reused.

The Astra presentation adapter is loaded before the compiled application and is precached with the shell, but it contains no OpenAI fetch path. The deterministic simulator, interpreter, physics, grader and evidence systems remain independent of AI.

## Teacher curriculum mode

The challenge-era build also contains the teacher-facing curriculum layer merged through the repository's normal development history:

- progressive challenge flow across the 24 guided challenges;
- four classroom teaching blocks;
- objectives, prerequisites, timings, support and stretch guidance;
- downloadable lesson plans;
- direct launch into the simulator;
- saved learner progress.

## Why the boundary matters

Astra can be useful for language reasoning, code explanation and generating fitted-robot program ideas when a legitimate supported connection exists. It should not become the source of truth for robot execution. Kodro's deterministic interpreter, fitted-hardware constraints, simulator and grader retain that responsibility.

The public build therefore prefers an honest unavailable state over silently funding inference, exposing a browser API key, or presenting a ChatGPT subscription as an API entitlement.

## Public demo path

1. Open Kodro and show that **Local (Ollama, offline)** is the active provider.
2. Open the provider picker and show **OpenAI GPT-6 Astra (not connected)**.
3. Show the explanation for the two concepts: separately billed API access through a secure user-controlled gateway, or Astra usage from supported ChatGPT Work/Codex surfaces.
4. Select Astra and show that it is marked unavailable and does not ask for an API key.
5. Attempting generation must fail closed rather than create a cloud request.
6. Switch back to Ollama and run the normal local robot-program workflow.
7. Run the resulting program through Kodro's deterministic simulator/grader.

Do not demo a fake ChatGPT-subscription login or claim that a subscription funds Kodro web inference.

## Verification

`node scripts/qa_astra_provider.mjs` verifies the zero-cost runtime contract, including:

- Ollama is the default and sole executable web AI runtime;
- Groq, OpenRouter and arbitrary cloud endpoint implementations are absent from the base provider source;
- Astra remains visible but unavailable;
- Astra exposes no active endpoint;
- a stale Astra browser key is deleted without being read;
- selecting Astra makes zero network requests;
- generation while Astra is selected fails closed and still makes zero network requests;
- the Astra source contains no shared paid proxy URL, direct `api.openai.com` path, Authorization header or active fetch call;
- the repository contains no executable `api/astra.js` paid proxy;
- the UI accurately distinguishes separately billed API access from ChatGPT Work/Codex subscription access;
- switching back to Ollama restores the local provider path.

The repository's broader CI continues to cover simulator boot, browser privacy, generated-bundle freshness, UI behaviour/layout/modals, interpreter, physics, lesson grading, curriculum, accessibility-related checks and cross-engine fuzzing.

## Official references

- Product Hunt challenge: https://www.producthunt.com/p/gpt-6-astra-challenge
- GPT-6 Astra model: https://developers.openai.com/api/docs/models/gpt-6-astra
- OpenAI model guide: https://developers.openai.com/api/docs/guides/latest-model
- API-key safety: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
- ChatGPT/API billing separation: https://help.openai.com/en/articles/9039756

## Provenance

Kodro predates this challenge. Challenge-specific work should be reviewed through Git history. This repository does not represent pre-existing functionality as newly created with Astra and does not describe an unavailable paid runtime as live.
