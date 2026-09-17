# Provenance

"This record distinguishes GPT-6 Astra work from other AI-assisted engineering. Kodro does not attribute Union Alpha or other model output to Astra."

## 2026-09-17 window (`release/astra-final-2026-09-17`)

- Starting commit: `87d38e7`.
- Worker: Union Alpha — Muse Spark (model `opencode/muse-spark-1.3-contributor-free`),
  operating as coding/orchestrator agent in this sandbox. No Astra session
  was available or used; no credentials were sought, extracted, or stored.
- Tasks performed:
  1. Repo-wide stale-claim audit (3 parallel read-only subagents; findings
     in `docs/ASTRA_VERIFICATION.md`, "unsupported claims removed").
  2. Genesis experiment loop: `src/kodro/genesis.py` + `kodro-genesis`
     entry + `tests/unit/test_genesis.py` (7) + `tests/unit/test_genesis_cli.py`
     (5) + `docs/genesis.md`. Test-first: lib tests written before the
     module; CLI tests lock exit codes and file outputs.
  3. Truthfulness fix: dead Groq/OpenRouter/BYOK affordances removed from
     `panels.jsx`, `README.md`, `docs/mcp.md`; `bundle.js` rebuilt from
     source; guarded by `test_no_dead_cloud_provider_affordance`.
  4. Release docs: `docs/FINAL_BASELINE_2026-09-17.md`,
     `docs/ASTRA_VERIFICATION.md`, `docs/FINAL_BUG_BURNDOWN.md`, this file,
     CHANGELOG `[Unreleased]`.
- Verification run by the same worker, same session: full pytest 1905
  passed / 0 failed (92% coverage), ruff + format clean, mypy 76 files
  clean, 25/25 Node QA gates, MCP smoke 2/2, finale CHAIN CLEAN, qa_web
  5/5, mkdocs --strict built, secrets 42 passed. Raw outputs were
  session-temp files; the commands and results are in
  `docs/FINAL_BASELINE_2026-09-17.md`.
- Resulting commit: recorded at merge time (see PR).

## Astra checkpoints (mission §35)

- Checkpoint A (architecture), B (real contribution), C (MCP operation),
  D (final adversarial review): **NOT AVAILABLE** — no authenticated
  Codex/Astra surface exists in this sandbox, and the mission forbids
  unofficial credential routes. The independent-regression role was
  covered by read-only audit subagents (no implementation rights) plus
  the pinned MCP finale gate, which asserts exact documented values
  against the live server.

## Historical

Prior-window CA1/CA2 evidence and dissertation AI-disclosure text under
`docs/ca1`, `docs/ca2`, `dissertation`, `.kodro/` are preserved untouched.
