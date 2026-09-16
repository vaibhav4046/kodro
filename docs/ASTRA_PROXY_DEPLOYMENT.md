# Astra proxy deployment runbook

Kodro's browser build does not contain or accept an OpenAI API credential. The production Astra credential belongs only to the server runtime that hosts `api/astra.js`.

## Vercel production configuration

Target project: `kodro-ca2` (`https://kodro-ca2.vercel.app`).

Configure these outside source control:

- `OPENAI_API_KEY`: required server-only production secret.
- `KODRO_ALLOWED_ORIGINS`: optional comma-separated explicit development origins. The production Kodro origin `https://vaibhav4046.github.io` is already allowed by the function.

Never place `OPENAI_API_KEY` in GitHub source, GitHub Pages, browser localStorage, client environment variables, screenshots, logs, issues, pull requests, or chat messages.

## Abuse controls before public activation

CORS protects the browser boundary but is not caller authentication. Before funding the public proxy, configure deployment-level abuse controls such as Vercel Firewall/rate limiting and a conservative OpenAI project spend limit/alert. Keep the server request-size and output-token caps enabled.

## Release checks

1. Deploy the repository version containing `api/astra.js` to the `kodro-ca2` Vercel project.
2. Configure the production `OPENAI_API_KEY` through Vercel's encrypted environment settings, then redeploy if required by the platform.
3. Fetch `GET https://kodro-ca2.vercel.app/api/astra` from an allowed origin and confirm it reports `model: gpt-6-astra` and `configured: true` without returning the key.
4. Open the GitHub Pages Kodro build. It must start on Ollama and make no Astra request during boot.
5. Select `OpenAI GPT-6 Astra (server managed)`. The UI must show no API-key input and the model field must be read-only.
6. Generate a small structured fitted-robot program. In browser network inspection, confirm the request goes only to `https://kodro-ca2.vercel.app/api/astra`, contains no `Authorization` header and no credential material, and carries only normalized input/instructions/token/schema fields.
7. Confirm the returned structured JSON reaches Kodro's existing fitted-command compiler and runs through the deterministic simulator/grader.
8. Switch back to Ollama and confirm local generation remains unchanged.

## Automated evidence

Before release, require the same PR head SHA to pass:

- `node scripts/qa_astra_proxy.mjs`
- `node scripts/qa_astra_provider.mjs`
- `tests/unit/test_web_offline.py` through normal CI
- web bundle freshness and the remaining authoritative Kodro CI gates

A mocked contract pass is not evidence that a real paid Astra request succeeded. A real inference release check is valid only after the Vercel server secret and deployment are configured.