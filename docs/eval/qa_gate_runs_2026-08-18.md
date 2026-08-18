# Offline QA gate run log, 18 August 2026

This is a **hand-recorded transcript**, not a machine-emitted artefact, and it
follows the same rule as its predecessor `qa_gate_runs_2026-08-14.md`: each row
holds the exact command that was run and the summary line the harness printed.
No harness writes this file. To check a figure, re-run the command in the first
column and compare its last line against the second. Every gate below exited 0.

It exists because two of the nine figures recorded on 14 August have moved, and
a dissertation that points a reader at a transcript has to point at one whose
numbers a reader can reproduce today.

**What changed since 14 August.** Two things, both upward:

1. `qa_honesty` grew from 121 checks to 122. The gate has gained assertions as
   the claim surface has grown; this is the same drift the 14 August log records
   between the 17 July audit (107) and that session (121).
2. `qa_ai_grammar` ran its **live half** for the first time in a recorded
   session. On 14 August the local model server was not running, the gate
   printed `SKIP  live grammar constraint: Ollama not reachable` and passed its
   four offline checks only, and the dissertation therefore claimed no live
   figure. On 18 August Ollama 0.32.13 was up on `http://localhost:11434` with
   `robolearn-fast:latest` installed, both live assertions ran against the real
   model, and the gate printed 6 of 6.

The other seven gates reproduced their 14 August figures exactly, which is the
result worth recording about them.

## Environment

| Field | Value |
| --- | --- |
| Date | 18 August 2026 |
| Commit | `1887b07` |
| Working tree | clean (`git status --porcelain` empty at the time of the run) |
| Node | v24.12.0, run from the repository root as `node scripts/<name>.mjs` |
| Ollama | 0.32.13 on `http://localhost:11434`, model `robolearn-fast:latest` |
| External services | none; the only network traffic is loopback to Ollama |

The clean working tree matters here in a way it did not on 14 August, when the
tree was dirty. These figures describe a committed state, so a reader who checks
out `1887b07` is running the same source.

## The nine gates

| Command | Printed result | 14 Aug | Change |
| --- | --- | --- | --- |
| `node scripts/qa_physics.mjs` | `== RESULT: 25 passed, 0 failed ==` | 25 | same |
| `node scripts/qa_interp_fixes.mjs` | `PASS  interpreter fixes: 13 passed, 0 failed` | 13 | same |
| `node scripts/qa_parts.mjs` | `PASS  parts database: 40 passed, 0 failed` | 40 | same |
| `node scripts/qa_memgraph.mjs` | `PASS  memory-graph builder: 22 passed, 0 failed` | 22 | same |
| `node scripts/qa_project_storage.mjs` | `16 passed` | 16 | same |
| `node scripts/qa_gpucaps.mjs` | `46 passed` | 46 | same |
| `node scripts/qa_ai_web.mjs` | `== RESULT: 51 passed, 0 failed ==` | 51 | same |
| `node scripts/qa_honesty.mjs` | `PASS  honesty: 122 passed, 0 failed` | 121 | +1 |
| `node scripts/qa_ai_grammar.mjs` | `PASS  ai grammar constraint: 6 passed, 0 failed` | 4 offline, live skipped | live half ran |

What each gate covers is recorded in the 14 August log and has not changed. That
file stays as it is; this one records the re-run, not a replacement.

25 + 13 + 40 + 22 + 16 + 46 + 51 + 122 = **335** across the eight gates that have
no live component. With the grammar gate's 6, all nine total **341**.

## The live half of the grammar gate, in full

This is the only genuinely new evidence in this session, so it gets the detail.

Printed output, complete, reproduced identically on three consecutive runs:

```
      live model robolearn-fast:latest produced: ["move_forward(1)","turn_left(1)"]
PASS  ai grammar constraint: 6 passed, 0 failed
```

The gate is in two halves, and `scripts/qa_ai_grammar.mjs` says so in its header
comment at line 11. The offline half, four checks, drives the schema and the
compiler as pure functions: the fitted command set reaches the JSON schema's
`enum` intact, the compiler emits the calls it should, it drops out-of-set and
invented commands, and it formats a text argument correctly.

The live half, two checks, is the one that had never run in a recorded session.
It probes `http://localhost:11434/api/version` with a three second timeout, and
skips with exit 0 if nothing answers. When a server does answer it picks an
installed model, sends a prompt that **explicitly demands a command the build
does not fit**, and asserts two things about what comes back:

1. `live: constrained output contains ONLY fitted commands` - the generated
   program contains no call outside the set the active build declares.
2. `live: the demanded-but-unfitted distance() never appears` - the specific
   command the prompt demanded, which this build has no sensor for, is absent.

The second is the load-bearing one. The prompt asks for `distance()` by name.
The model was given a command set that does not include it. The grammar
constraint is what stops the model from complying. A gate that only checked
"the output parses" would pass on a program that called a sensor the robot does
not have.

**What this does and does not establish.** It establishes that on this host, with
this model, a prompt that explicitly asked for an unfitted command produced a
program that did not contain it, three times running. It does not establish a
rate, because two assertions on one prompt is not a sample. It does not
generalise to other models, and the model name is recorded above precisely so
that nobody reads it as a claim about local models in general. The dissertation
states it in those terms.

## Not run in this session

| Gate | Reason | Where its figure comes from instead |
| --- | --- | --- |
| `qa_personas` | Long-running synthetic-persona sweep; not part of the nine-gate group and its figure is already emitted as an artefact. | `docs/eval/persona_eval_results.json`, tracked in git. |
| `qa_vibe` | Same. | `docs/eval/vibe_eval.json`, tracked in git. |
| `qa_worlds` | Needs the static fixture server on port 8099 and roughly thirty minutes on an uncontended machine. Unchanged since 14 August. | The 14 August log, which records two independent clean sweeps at 61 of 61. |

Both `qa_personas` and `qa_vibe` could have run in this session, since Ollama was
up. They were not, because their figures are emitted artefacts rather than
transcribed lines and re-running them would have rewritten those artefacts
without a reason to. That is a deliberate choice and is recorded so it is not
mistaken for an environment failure, which is what stopped them on 14 August.
