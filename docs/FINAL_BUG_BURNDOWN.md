# Final bug burn-down — 2026-09-17 window

P0 = launch blocker / truthfulness / security / broken judge flow.
P1 = meaningful judge-visible weakness. P2 = polish with measurable value.

## Closed in-window

| ID | Severity | Surface | Reproduction | Root cause | Fix | Test | Status |
|---|---|---|---|---|---|---|---|
| B1 | P0 | Vibe panel hint | Open Code-with-AI without Ollama → "pick Groq or OpenRouter above and paste a free key" | Stale copy; picker has no such options | Hint rewritten to Local-only truth | `test_no_dead_cloud_provider_affordance` (failed pre-fix in `panels.jsx` + `bundle.js`, green post-fix + rebuild) | CLOSED |
| B2 | P1 | README (2 passages) | Readme promised Groq/OpenRouter key path | Stale copy; no such runtime | Both passages state Local-only | read-back verified; offline + provider gates still 32/32 | CLOSED |
| B3 | P1 | Provider-picker comment | `panels.jsx:834-836` described BYOK/server-managed backends | Stale comment | Comment states Local + unavailable-Astra truth | bundle rebuilt, `--check` green | CLOSED |
| B4 | P2 | `docs/mcp.md` install note | "part of the `robolearn` package" | Renamed package, prose not updated | Says `kodro` | read-back verified | CLOSED |
| B5 | P1 (new) | Genesis budgets | 10-candidate / runs=0 batches possible in a naive loop | No loop existed | `genesis.py` enforces ≤4 candidates, 1–10 runs, 20k chars pre-simulation | 7 lib + 5 CLI tests, incl. budget rejections | CLOSED |

## Open (documented, not blocking)

| ID | Severity | Note |
|---|---|---|
| O1 | P1 | No genuine Astra→Codex→MCP session exists (no Codex CLI in this environment). Webpage Astra copy is honest about this; demo must not imply otherwise. |
| O2 | P2 | Dead unreachable `serverManaged`/`custom` provider branches and BYOK comments remain in `ai-web.jsx`/`panels.jsx`. Unreachable today; removal deferred to avoid destabilising the assessed UI. |
| O3 | P2 | `docs/launch/README.md` still DRAFT with checklist unchecked; launch kit must be rehearsed before any public publish. |
| O4 | P3 | macOS CI leg is informational (Tk segfaults, platform limitation); Linux + Windows gate the build. |

## Counts

P0 remaining: **0**. P1 remaining: **0 blocking** (O1 is an environment
limitation with honest UI copy, not a product defect). Full suite at close:
1905 passed, 0 failed.
