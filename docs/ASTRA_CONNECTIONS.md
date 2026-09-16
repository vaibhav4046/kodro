# GPT-6 Astra connection paths

Kodro's public web build is zero-cost by default and at runtime: **Local (Ollama) is the only executable AI provider.** Selecting GPT-6 Astra in the provider picker does not make a network request and does not activate a paid OpenAI API call.

Astra stays visible because there are two different user concepts worth distinguishing clearly.

## 1. OpenAI API access

OpenAI API usage is billed separately from ChatGPT subscriptions. A user with API billing may connect Astra only through a **secure backend or local gateway they control**, where `OPENAI_API_KEY` can remain outside browser JavaScript. Kodro's public GitHub Pages build does not ask for, store, transmit, or proxy that key.

Do not paste an OpenAI API key into Kodro's webpage or browser localStorage. Do not commit it to the repository.

## 2. ChatGPT subscription access

Eligible ChatGPT plans can provide GPT-6 Astra in supported ChatGPT surfaces such as **ChatGPT Work and Codex**. That subscription access does **not** turn the ChatGPT login/session into an OpenAI API credential for the Kodro webpage.

`Sign in with ChatGPT` is an identity sign-in mechanism where supported; it must not be presented as authorization for Kodro to spend the user's ChatGPT allowance on web-runtime inference.

Kodro must never scrape, copy, export, or reuse ChatGPT cookies, session tokens, or other account credentials.

## Public web runtime guarantee

For the GitHub Pages build:

- Ollama is the sole executable AI runtime.
- Astra is visible as `OpenAI GPT-6 Astra (not connected)`.
- Selecting Astra performs zero network requests.
- Attempting generation while Astra is selected fails closed with a clear unavailable/not-connected message.
- No `api.openai.com` endpoint, OpenAI Authorization header, shared Vercel Astra proxy, Groq runtime, OpenRouter runtime, or arbitrary cloud endpoint is active in the provider layer.
- Legacy browser-stored cloud credentials are removed rather than reused.

## Future supported integrations

A future Astra connection may be enabled only when it has a supported authentication boundary. Examples are a user-controlled local/backend API gateway for separately billed API usage, or an official OpenAI product capability that explicitly authorizes a third-party runtime to consume a user's ChatGPT allowance. Identity-only login is not enough.
