# What changed during the eligible window (2026-08-26 → present)

Written explanation for the "New & Existing" rule. Every entry resolves to
commits on `main` (52 commits in-window at time of writing).

## New systems (not resubmitted interfaces)

- **Genesis experiment loop** (`8fcb240`, 2026-09-17): `kodro-genesis` CLI +
  `kodro.genesis` library comparing up to 4 candidate controllers through
  the deterministic Prove engine — shared contracts/seeds, deterministic
  ranking, failure diagnosis, byte-stable manifests. 12 tests. The closed
  loop Goal → Generate → Simulate → Observe → Modify → Re-simulate → Prove
  now runs as one command with evidence artefacts.
- **EarthProof evidence engine** (PR #46, #48, #49): auditable
  environmental-evidence gate with byte-reproducible output, judge-surface
  contract, before/after comparison CLI — surfaced at Build as the
  pre-hardware decision point.
- **Classroom loop** (PR #45): 24 graded challenges wired to teacher lesson
  plans; lesson library drives the deterministic grader pupils and agents share.

## Challenge-truthfulness work

- **Astra integration** (PR #51) + **provider hardening** (`87d38e7`,
  `c2fe080`, PR #54): Ollama-only executable web runtime; Astra visible but
  unavailable and failing closed (32/32 zero-cost contract); dead
  Groq/OpenRouter/BYOK affordances removed from UI + README; MCP server
  pinned at 8 deterministic tools with an exact-value finale gate.
- **Release evidence** (`8413a75`, PR #54): frozen baseline, claim→evidence
  verification table, bug burn-down (P0 = 0), provenance record; full suite
  1905 passed; scripted 90-second golden-journey demo recorded from the
  merged build (7/7 on-screen assertions, zero external requests).

## Still required for the Nebius submission (honest gap list)

- A runtime call to Token Factory (or AI Cloud compute) with an NVIDIA
  open-source model in the loop — designed, not yet built; needs claimed
  credits + a human-owned Nebius account. See `docs/NEBIUS_GAP_ANALYSIS.md`.
- Narrated <3 min cut of the demo with ≥1 min of key modules in action.
- Devpost text + track selection + feedback section (human-submitted).
