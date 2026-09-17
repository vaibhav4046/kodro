# Kodro Genesis: deterministic controller experiments

Genesis is the closed experimental loop **Goal → Generate → Simulate →
Observe failure → Modify → Re-simulate → Prove**, built as a thin layer
over the existing deterministic Prove engine (`kodro.prove`). It compares
up to 4 candidate controllers on the same contracts and seed root, ranks
them by recorded evidence, and points at the failing evidence with one
concrete next action.

What Genesis is not: a model, a cloud job runner, a physics validator, or
a safety certifier. Candidate authoring (a pupil editing code, a local
Ollama draft, an agent calling MCP tools) happens **outside** the
measurement boundary. No model call, network access, or heuristic score
touches measurement or verdicts.

## Run it

```bash
kodro-genesis --candidate good=controllers/good.py \
              --candidate broken=controllers/broken.py \
              --contract straight_transit --runs 2 \
              --manifest evidence/experiment.json --report evidence/report.md \
              --verify-reproducible
```

Exit code is `0` only when the winning candidate's overall verdict is
`pass`; `1` when the winner fails; `2` on invalid arguments. Budgets are
enforced before any simulation runs: at most **4 candidates**, **1–10
runs** per contract, **20,000 characters** per candidate. `--verify-reproducible`
runs the batch twice and requires byte-identical experiments.

## How the winner is chosen

Deterministic ranking, in order: overall verdict (`pass` outranks `fail`),
total passed runs, total collisions (fewer wins), worst goal error
(smaller wins), candidate name (alphabetical). Identical inputs always
name the same winner; `canonical_experiment()` serialises the record to a
byte-stable form you can diff or hash.

## Failure diagnosis

`diagnose_candidate()` reports, per candidate, the failed contract ids,
the worst recorded seed (contract, seed, execution error, collisions,
goal error, distance, battery), and exactly one next action derived from
the evidence in this priority: program error → collisions → goal error →
battery → distance. A passing candidate reports no failures.

## Agent recipe (MCP, no new tools)

Genesis deliberately adds **no MCP tool**: the existing eight tools are
the complete agent surface, and `scripts/qa_mcp_finale.py` pins that
count. An agent (Codex, Claude, or local) runs the loop with what exists:

1. `list_lessons` / `get_lesson` — pick the task and read its criteria.
2. `run_program` / `grade_program` — iterate on one candidate (sandboxed,
   deterministic, same verdict the pupil sees).
3. `prove_contracts` — prove a single candidate over seeded contracts.
4. `kodro-genesis` (CLI) — compare up to 4 finalists and emit the
   experiment manifest + report as the durable evidence artefact.

Reasoning lives with the agent. Proof lives with Kodro.

## Interpretation boundary

A win means the controller met the declared criteria for the recorded
seeds and perturbations in this kinematic engine. It is not evidence of
real-world equivalence, electrical safety, mechanical safety, or fitness
for deployment. The report states this verbatim, inherited from Prove.
