# Offline QA gate run log — 14 August 2026

This is a **hand-recorded transcript**, not a machine-emitted artefact. Each row
holds the exact command that was run and the summary line the harness printed.
No harness writes this file; if you want to check a figure, re-run the command
in the first column and compare its last line against the second. Every gate
below exited 0.

The gates in the first table are the ones that had no figure quoted anywhere in
the dissertation before this run. They are cited in the "Automated verification"
section as a group of nine. The other harnesses in `scripts/` already had a
figure in the document, an emitted JSON artefact under `docs/eval/`, or both;
the fifteen of those that were re-run are in the second table.

## Environment

| Field | Value |
| --- | --- |
| Date | 14 August 2026 |
| Working tree | dirty (uncommitted dissertation and doc edits against `02dd047`) |
| Node | run from the repository root, `node scripts/<name>.mjs` |
| External services | none; every gate below runs offline |

## Gates recorded

| Command | Printed result | What the gate covers |
| --- | --- | --- |
| `node scripts/qa_physics.mjs` | `== RESULT: 25 passed, 0 failed ==` | The extracted `sim-physics.js` module under Node with a bare window shim: collision geometry, wall ray, coverage and trapezoidal velocity, pinned so the extraction out of `hooks.jsx` stays behaviour-exact. |
| `node scripts/qa_interp_fixes.mjs` | `PASS  interpreter fixes: 13 passed, 0 failed` | Regression pins for the 2026-07-11 interpreter hardening pass: function-local scope, multi-local recursion, `global` write-through, `+=` on an undefined name raising `NameError`, stray `break`/`continue`/`return` diagnostics, `Object.prototype` members not being callable builtins, escaped-backslash tokenisation, `min`/`max` stack safety, and O(n) list repeat. |
| `node scripts/qa_parts.mjs` | `PASS  parts database: 40 passed, 0 failed` | The offline parts catalogue: every motor carries a source URL and access date, the kg-cm to N-m conversion is exact, and every derived KRS field lands inside the schema's validated range. |
| `node scripts/qa_memgraph.mjs` | `PASS  memory-graph builder: 22 passed, 0 failed` | The shipped `KodroMemoryGraph.build` loaded in a fake window: every node and edge derivable from stored reflections and skills, deterministic layout, and robustness on sparse input. |
| `node scripts/qa_project_storage.mjs` | `16 passed` | Driven behaviourally against the real module with a storage that refuses writes, so a partial `KodroProject.apply()` cannot report `ok:true`. |
| `node scripts/qa_gpucaps.mjs` | `46 passed` | The first-run quality-tier classifier driven directly as a pure string function, with no browser in the loop. |
| `node scripts/qa_ai_web.mjs` | `== RESULT: 51 passed, 0 failed ==` | The shipped `ai-web.jsx` browser model facade loaded under a Node shim, driven through its public surface only: API normalisation (a `rover.forward(cm)` rewrite must not change a distance by a factor of one hundred), code extraction from fences, code-versus-question classification, and the lesson-aware memory rule that an incomplete lesson is never recorded as a successful program. |
| `node scripts/qa_honesty.mjs` | `PASS  honesty: 121 passed, 0 failed` | The claim-boundary sweep. Was 107 at the 17 July integrity audit; the gate has grown since. |
| `node scripts/qa_ai_grammar.mjs` | `SKIP  live grammar constraint: Ollama not reachable on http://localhost:11434` then `PASS  ai grammar constraint: 4 passed, 0 failed` | The offline half of the grammar-constraint gate. **The live half did not run.** No live figure is claimed from this session. |

## Gates re-run that already had a figure in the document

These reproduced their existing figures exactly, which is itself the result
worth recording:

| Command | Printed result | Matches the figure already in the dissertation |
| --- | --- | --- |
| `node scripts/qa_interpreter.mjs` | `== RESULT: 180 passed, 0 failed ==` | yes |
| `node scripts/qa_web.mjs` | `== QA_WEB: 5/5 checks passed ==` | yes |
| `node scripts/qa_contrast.mjs` | `PASS  contrast + responsive: 61 passed, 0 failed` (ten themes) | yes |
| `node scripts/qa_worlds.mjs` (with the fixture server up) | `== WORLD SWEEP RESULT: 61 passed, 0 failed ==`, run twice, independently, both clean | yes |
| `node scripts/qa_ui.mjs` | `== UI ALL: 6/6 flows clean · 47/47 behaviour or layout asserts pass · 13/13 modals render ==`, zero FAIL lines, exit 0; regenerated `docs/eval/ui_eval.json` at 66/66 | yes |

### The ten classroom gates behind the 303-check table

Each was run from the repository root as `node scripts/<name>.mjs`. All ten
exited 0. Their totals sum to 303, which is the figure the dissertation quotes,
and every one reproduced its existing number exactly.

| Command | Printed result | Matches the figure already in the dissertation |
| --- | --- | --- |
| `node scripts/qa_grader.mjs` | `== RESULT: 55 passed, 0 failed ==` | yes |
| `node scripts/qa_lesson_studio.mjs` | `79 passed` | yes |
| `node scripts/qa_construct_liveness.mjs` | `30 passed` | yes |
| `node scripts/qa_markbook.mjs` | `16 passed` | yes |
| `node scripts/qa_pupilstore.mjs` | `PASS  pupil-store: 23 passed, 0 failed` | yes |
| `node scripts/qa_pupil_errors.mjs` | `42 passed` | yes |
| `node scripts/qa_parsons.mjs` | `13 passed` | yes |
| `node scripts/qa_learning_annotations.mjs` | `28 passed` | yes |
| `node scripts/qa_scenario_parity.mjs` | `PASS  scenario collision parity: 8 passed, 0 failed` | yes |
| `node scripts/qa_fuzz.mjs` | `9 passed (parity 120 cases across 3 lessons, 120 junk, 30 storage rounds)` | yes |

55 + 79 + 30 + 16 + 23 + 42 + 13 + 28 + 8 + 9 = 303.

## Not run in this session, and why

| Gate | Reason | Where its figure comes from instead |
| --- | --- | --- |
| `qa_personas` | Needs a local Ollama server at `http://localhost:11434`, which was not running. | `docs/eval/persona_eval_results.json`, which **is** tracked in git. |
| `qa_vibe` | Same. | `docs/eval/vibe_eval.json`, which **is** tracked in git. |

### The artefact-tracking gap, now closed

An earlier version of this section said that `docs/eval/test_suite.json`,
`docs/eval/ui_eval.json` and `docs/eval/vibe_eval.json` had never entered
version control. That was true when it was written and is no longer true. All
three were committed in `706f93d`:

```
$ for f in test_suite ui_eval vibe_eval; do git log --oneline -1 -- docs/eval/$f.json; done
706f93d feat: MCP server, voice layer, project interop and CA2 evidence
706f93d feat: MCP server, voice layer, project interop and CA2 evidence
706f93d feat: MCP server, voice layer, project interop and CA2 evidence
```

The paragraph is corrected in place rather than deleted, because the
dissertation points a reader at this file and a reader who found the old text
would have been told the evidence was untracked when it is tracked.

One related file stays untracked on purpose. `docs/eval/ui_eval_behaviour.json`
is ignored by `.gitignore:76`, and correctly so, because `scripts/qa_ui.mjs:78`
writes that filename only for a narrowed `--suite=behaviour` run. It is
partial-run scratch by construction, not an evidence artefact, and three
siblings (`ui_eval_layout.json`, `ui_eval_modals.json`, `ui_eval_paint.json`)
sit beside it under the same rule. The dissertation sentence that once listed it
as evidence has been corrected.

## A hazard worth knowing about, found while producing this log — now closed

`scripts/qa_worlds.mjs` fetches `cap.html` from a static server on port 8099. If
that server is absent the harness printed a SKIP line and **exited 0**, so a
green exit did not prove any assertion had run.

That was a deliberate design decision rather than an oversight: the header of the
file says so at line 23, "Environment-missing cases (no Chrome, no static server)
SKIP with exit 0 so a GPU-less box never breaks a pipeline; real failures exit
1." The tradeoff is defensible for a developer machine without a GPU. It is not
defensible for a gate whose total is being quoted as evidence, because the same
green exit covered both "61 checks passed" and "nothing ran".

The fix keeps the default and adds an opt-in: `--strict`, or
`KODRO_QA_WORLDS_REQUIRED=1`, turns each of the three missing-fixture skips into
a failure. The environment variable is named to match its sibling — `qa_ui.mjs`
already gates the same skip on `KODRO_QA_UI_REQUIRED=1` — so the two harnesses
now take the same shape. Verified with the server stopped, run back to back:

```
### 1. non-strict, fixture down ###
SKIP: static server not serving cap.html on :8099 (got no connection).
      Start it with:  cd src/robolearn/assets/web && python -m http.server 8099
EXIT=0

### 2. --strict, fixture down ###
FAIL: static server not serving cap.html on :8099 (got no connection).
      Start it with:  cd src/robolearn/assets/web && python -m http.server 8099
      --strict is on: a missing fixture counts as a failure, because zero assertions ran.
EXIT=1

### 3. KODRO_QA_WORLDS_REQUIRED=1, fixture down ###
FAIL: static server not serving cap.html on :8099 (got no connection).
      Start it with:  cd src/robolearn/assets/web && python -m http.server 8099
      --strict is on: a missing fixture counts as a failure, because zero assertions ran.
EXIT=1
```

`--strict` with the fixture **up** was also checked, to be sure the new flag does
not fail a healthy run: the sweep cleared all three guards and began normally
(`== WORLD SWEEP: 6 worlds x 6 robots through cap.html (headless Chrome) ==`,
then PASS lines). Only the Chrome-missing guard was not exercised directly; the
same `bail()` call handles all three, and the other two were exercised.

The fixture still has to be started before a real run:

```
cd src/robolearn/assets/web && python -m http.server 8099
```

## The sweep is load-sensitive, and that is not visible from a clean run

Two **complete** sweeps were run today, independently, and both printed
`== WORLD SWEEP RESULT: 61 passed, 0 failed ==` with exit 0. That is the figure
the dissertation quotes.

Two further **truncated** probes were run afterwards to test the new flag, each
cut off after 75 to 90 seconds. Each surfaced one transient failure, at a
different combination:

```
FAIL  city x arm                   no screenshot written (page never painted)
```
```
FAIL  room x default               no screenshot written (page never painted)
```

The failure moves, so it reports the machine rather than the product — the same
class of contention sensitivity `qa_ui.mjs` documents. It is recorded here
because a reader who runs this gate on a loaded box may see it, and because
"both complete runs were clean" is a weaker claim than "the gate is
deterministic". No orphan Chrome processes were left behind by either probe
(checked: zero). The full sweep takes roughly thirty minutes; a 560-second run
reached 12 of the 36 world-by-robot combinations before being cut off. Run it on
an uncontended machine and read the printed total, not just the exit code.

## Gate added after the sweep above

`scripts/qa_encoding.mjs` did not exist when the two tables above were recorded,
so it is deliberately not counted in either of them. The nine-gate group cited in
the dissertation's "Automated verification" section is the first table as written
and is unaffected by this addition.

| Command | Printed result | What the gate covers |
| --- | --- | --- |
| `node scripts/qa_encoding.mjs` | `10 passed (393 files, 100 protected characters)` | Text-encoding integrity across `src`, `scripts`, `docs` and `tests`: every scanned file is valid UTF-8 with no byte order mark, no code file carries a U+FFFD replacement character, and no file contains double-encoded text. |

It was written in response to a defect it then found: nine characters across
`app.jsx` and `hooks.jsx` had been written as UTF-8, read back as Windows-1252
and written out again, so a middle dot had become two characters, an en dash
three, and a close-button glyph three more. Four of the nine were on screens that
appear in the assessment video. Nothing else in the pipeline noticed. The files
still parsed, the bundle still built, and every other gate above still passed.

The forbidden byte sequences are derived, not listed. The gate collects every
non-ASCII character the repository actually writes, pushes each one's UTF-8 bytes
through the Windows-1252 table, and searches for the result. A glyph introduced
tomorrow is protected the day it lands, and a character the project never uses
cannot produce a false positive. The count in the printed line is that derived
set, so it moves with the codebase rather than with the gate.

Two exclusions are worth stating because they look like loopholes and are not.
The six `docs/dissertation/*compile*.txt` files are pdflatex console captures,
transcribed byte for byte from a tool that prints Latin-1 font names into a UTF-8
terminal; they are legitimately not valid UTF-8, and rewriting them to satisfy a
gate would corrupt evidence of a compile. The U+FFFD check is restricted to code
because `docs/mcp.md` prints that character in a troubleshooting table so a
reader can recognise the symptom, which is the documentation doing its job.
