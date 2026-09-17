# Astra verification

What Astra is in Kodro, what it is not, and how to reproduce every claim.
Statuses: **VERIFIED** · **PARTIALLY VERIFIED** · **NOT AVAILABLE** ·
**HISTORICAL**. No ambiguous claims.

## Direct answers

- **What exactly did Astra build?** Nothing in this tree. Every change in
  the 2026-09-17 window (Genesis loop, cloud-copy fix, this document) was
  built by Union Alpha (Muse Spark) and is recorded in
  `provenance/PROVENANCE.md`. No Astra output is attributed anywhere.
- **How was Astra accessed?** It was not accessed in this session: no
  Codex CLI, no funded API access, no ChatGPT session in this sandbox.
  Nothing was scraped, no credential was sought or stored.
- **How is Astra connected to Kodro?** Through the documented user-operated
  path only: a user with ChatGPT/Codex attaches the local Kodro MCP server
  (`kodro-mcp` over stdio) and Astra reasons over deterministic tool
  results. There is no webpage inference path and no maintained proxy.
- **What MCP tools exist?** Eight: `list_lessons`, `get_lesson`,
  `run_program`, `grade_program`, `check_api`, `validate_robot_spec`,
  `prove_contracts`, `pupil_progress`. See `docs/mcp.md`.
- **How can a judge reproduce the connection?** `pip install -e .`,
  `kodro-mcp --list-tools`, then attach the stdio server in any
  MCP-capable client per `docs/mcp.md`; `python scripts/smoke_mcp.py`
  proves the wire. The Codex-specific click path is NOT AVAILABLE below.
- **What requires ChatGPT/Codex?** Any genuine Astra reasoning.
- **What requires API billing?** Any OpenAI API call; Kodro makes none.
- **What works completely offline?** The whole product: simulator, grader,
  lessons, Prove, Genesis, and Ollama-mode assistance.
- **What is deterministic?** Simulation, grading, Prove manifests, Genesis
  experiments (byte-stable, `--verify-reproducible`).
- **Where is the provenance?** `provenance/PROVENANCE.md`.
- **Exact commits?** Baseline `87d38e7`; window work uncommitted at time
  of writing (see `docs/FINAL_BASELINE_2026-09-17.md`).

## Claim → evidence table

| Claim | Source | Test / human reproduction | Status |
|---|---|---|---|
| Selecting Astra in the webpage never makes a paid request | `src/kodro/assets/web/astra-provider.js` (`generate()` throws) | `node scripts/qa_astra_provider.mjs` — 32/32, 2026-09-17 | VERIFIED |
| Astra selection never silently falls back to Ollama | provider adapter `unavailable:true`, `generate()` throws | same 32/32 gate | VERIFIED |
| No OpenAI key in browser storage | `ai-providers.jsx` one-way delete of legacy keys | `test_astra_legacy_key_is_delete_only`, secrets gate 42 passed | VERIFIED |
| No remote AI host in shipped web code | provider files contain only localhost fetch | `test_no_network_apis_in_app_code`, `qa_web` privacy check 5/5 | VERIFIED |
| MCP tools are deterministic, same verdict as the app | `src/kodro/mcp/tools.py` over `run_against_lesson`/`grade` | `tests/unit/test_mcp_server.py`, `qa_mcp_finale.py` CHAIN CLEAN | VERIFIED |
| Webpage copy offers no nonexistent cloud providers | `panels.jsx` hint fixed 2026-09-17 | `test_no_dead_cloud_provider_affordance` (failed before fix) | VERIFIED |
| Genuine Astra→Codex→MCP→simulator loop demonstrated | — (no Codex CLI in this environment) | cannot run; must not be claimed | NOT AVAILABLE |
| Astra-authored product contribution in-window | — (no Astra session available) | `provenance/PROVENANCE.md` records absence | NOT AVAILABLE |
| "Astra reasons. Kodro proves." as architecture | `docs/mcp.md` + agent recipe in `docs/genesis.md` | reproducible with any MCP client, but no Astra ran it | PARTIALLY VERIFIED |
| Nebius / Nemotron / Tavily integration | zero matches repo-wide (audited 2026-09-17) | correctly unclaimed | NOT AVAILABLE |
| CA1/CA2 demo transcripts and dissertation AI disclosure | `docs/ca1`, `docs/ca2`, `dissertation` | dated records, preserved untouched | HISTORICAL |

## Unsupported claims removed in-window

- README "connect a free-tier key (Groq/OpenRouter)" passages (2).
- Vibe-panel "pick Groq or OpenRouter above and paste a free key" hint.
- Provider-picker comment describing BYOK/server-managed runtimes.
- `docs/mcp.md` "robolearn package" install note.
