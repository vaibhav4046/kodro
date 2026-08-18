# Kodro / RoboLearn — Acceptance & Feature-Parity Matrix

Authoritative repo: `D:\project\robolearn` (origin `github.com/vaibhav4046/robolearn`).
Live: https://vaibhav4046.github.io/robolearn/
This matrix maps every acceptance criterion (docs/ACCEPTANCE.md), the CA1
proposal's promised objectives, README product claims, and the assignment brief
to their implementation and verifying evidence.

Gate counts below were reconciled on 15 August 2026 against
`docs/eval/qa_gate_runs_2026-08-14.md`, which is a hand-recorded transcript of
real runs with the exact summary line each gate printed. Before that
reconciliation this header claimed the counts were current when seven of them
were not: grader, physics, ai_web, honesty, contrast, scenario_parity and the
qa_ui behaviour and modal totals had all grown, and the lesson count still read
18. They have grown well beyond the v2.0.2 baseline in ACCEPTANCE.md, which is
itself now stamped as a dated snapshot rather than a live figure.

Rows 8 and 9 gained their flags on 15 August 2026. Both gates need a fixture:
headless Chrome, `cap.html` built by `node scripts/build_screenshot_harness.cjs`,
and `src/kodro/assets/web` served on `:8099` by `python -m http.server 8099`.
Without it each one prints SKIP and exits 0, which is the documented default so a
GPU-less box never breaks a pipeline. That default is wrong for this table: a row
here pairs a command with an exact expected total, so an agent running the bare
command with no fixture gets a success exit, no total, and nothing telling it the
sweep never ran. `qa_worlds.mjs` says so in its own header and ships `--strict`
(or `KODRO_QA_WORLDS_REQUIRED=1`) for the case where the total is quoted as
evidence; `qa_ui.mjs` uses `KODRO_QA_UI_REQUIRED=1` and has no flag form. The
Reproduce column now carries the opt-in on both. `docs/ACCEPTANCE.md` row 8
already named the fixture and was the model for this fix. Nothing about either
gate or its counts changed.

Legend: DELIVERED = implemented + gated/verified; DISCLOSED = intentional,
documented limitation; N/R = not required by the brief.

## A. docs/ACCEPTANCE.md criteria (current state)

| # | Criterion | Reproduce | Current result | Status |
|---|-----------|-----------|----------------|--------|
| 1 | No confirmed HIGH (P0/P1) defects in audited scope | judge panel + gates | 12 adversarial rounds; 0 P0/P1 outstanding; all 54 JR findings FIXED | DELIVERED |
| 2 | Bundle freshness | `node scripts/build_web.cjs --check` | committed bundle == build output; CI freshness gate | DELIVERED |
| 3 | Interpreter conformance | `node scripts/qa_interpreter.mjs` | 180 passed, 0 failed (was 157) | DELIVERED |
| 4 | Lesson-grader parity | `node scripts/qa_grader.mjs` | 55 passed, 0 failed (was 34) | DELIVERED |
| 5 | Simulation physics unit gate | `node scripts/qa_physics.mjs` | 25 passed, 0 failed (was 20) | DELIVERED |
| 6 | AI facade unit gate | `node scripts/qa_ai_web.mjs` | 51 passed, 0 failed (was 27) | DELIVERED |
| 7 | Static web boot + privacy | `node scripts/qa_web.mjs` | 5/5 checks incl. privacy-zero-external + studio-mount | DELIVERED |
| 8 | World/site render sweep | `node scripts/qa_worlds.mjs --strict` (needs the fixture below) | 61 passed, 0 failed | DELIVERED |
| 9 | UI smoke + modal coverage | `KODRO_QA_UI_REQUIRED=1 node scripts/qa_ui.mjs` (needs the fixture below) | 6/6 flows, 47/47 behaviour or layout, 13/13 modals (was 38/38 and 12/12) | DELIVERED |
| 10 | Python suite + coverage gate | `python -m pytest` | 1641 passed, 0 skipped, coverage 90.85% against the 85% gate, recorded in `docs/eval/test_suite.json` at commit `e70b98b` (was 1638/1/90.9 at `aa174cf`) | DELIVERED |
| 11 | Lint, format, types | ruff check / ruff format --check / mypy | green on touched code | DELIVERED |
| 12 | Offline web guard alone | `pytest tests/unit/test_web_offline.py` | passes standalone | DELIVERED |
| 13 | Source app constructs | `python -c "from kodro.web.app import build_app; ..."` | prints `Kodro` | DELIVERED |
| 14 | Live hosted web reachable + CI-gated deploy | curl live; gh run list | HTTP 200; CI-gated Deploy Pages; live bundle sha256 == committed | DELIVERED |
| 15 | Windows installer/release packaging | `python scripts/build_exe.py --clean` | dual-binary release workflow (RoboLearn.exe + kodro-tk.exe) | DELIVERED (see HUMAN note) |
| 16 | Recorded MCP values still match the live server | `python scripts/qa_mcp_finale.py` | 30 of 30 documented values matched across the 11 calls of the CA2 finale, 17 August 2026 | DELIVERED |

Row 16 is not an ACCEPTANCE.md criterion and is listed here because it guards a
claim nothing else can reach. `docs/ca2/MCP_DEMO_PROMPT.md` writes down the score,
the battery reading and three grader reasons word for word, and those sentences
get spoken over a screen recording. The document is prose and the server is code,
so the two can drift apart indefinitely without any existing gate noticing. The
script drives a real server subprocess through the same eleven calls and exits
non-zero naming the row that moved. It hardcodes its counts on purpose, which is
the opposite of what `scripts/smoke_mcp.py` argues for and right for a different
reason: the numbers are already written down in a document, so the only useful
question is whether the document is still true.

Extra gates added since the baseline, reconciled 15 August 2026: qa_honesty 121
(was 86), qa_contrast 74 (was 61 on 15 August and 51 before that; WCAG AA across
10 themes + true-viewport phone layout via CDP, plus a section added 17 August
that locks the `--hud-*` family as theme-invariant so a later pass cannot
"correct" the HUD by overriding it per theme), qa_parts 40, qa_memgraph 22,
qa_pupilstore 23,
qa_scenario_parity 8 (was 4), qa_interp_fixes 13, Python golden-trace + urdf 11.
Gates that postdate this matrix entirely and are not counted above: qa_voice 108,
qa_secrets 42, qa_learning_annotations 28, qa_encoding 10, qa_lesson_studio 79,
qa_construct_liveness 30, qa_markbook 16, qa_pupil_errors 42, qa_parsons 13,
qa_fuzz 9, qa_project_storage 16, qa_gpucaps 46, and 66 MCP server unit tests.

## B. CA1 / README promised objectives — parity

| Objective (CA1 / README) | Implementation | Evidence | Status |
|--------------------------|----------------|----------|--------|
| Design-build-program-run-validate learning loop | RobotLab + Editor + interpreter + diagnostics + verify | qa_ui flows, qa_interpreter, qa_grader | DELIVERED |
| Honest fidelity disclosure (HONOURED/APPROXIMATED/NOT SIMULATED) | specschema.FIDELITY + per-stat badges + verify annex | qa_honesty (121 checks) | DELIVERED |
| Offline-first, no cloud required | vendored React/Three; local Ollama or free BYO key; privacy gate | qa_web privacy-zero-external | DELIVERED |
| Deterministic validator has final word over the AI | validator/self-test gate on generated code | qa_ai_web, interpreter | DELIVERED |
| 24 graded lessons, ages 5-16, teacher register (CA1 promised 18; the library grew) | lessons.json + lesson-grader + pupil-store + TeacherModal | qa_grader 55, qa_pupilstore 23 | DELIVERED |
| Real parts catalogue within a budget | parts-db + budget planner (desktop) | qa_parts 40 | DELIVERED (planner desktop-only, disclosed) |
| Cinematic 2D/3D worlds, living city, no first-person | Viewport3D + worldfx + ambient; 61 world/site sweep | qa_worlds 61 | DELIVERED |
| Robot spec import (KRS) drives measured numbers | specschema.deriveFromPhysical + motion-model | golden-trace 4, qa_interpreter | DELIVERED |
| Gymnasium env + KodroBench (RL/eval) | envs/kodro_env.py + kodrobench.py | test_kodro_env, KodroBench record | DELIVERED |
| URDF interop | interop/urdf_io.py | test_urdf_import/export | DELIVERED |
| Accessibility (contrast, keyboard, readable-text, reduced-motion) | theme tokens + a11y-readable + reduced-motion gates | qa_contrast 74, qa_honesty a11y §§ | DELIVERED |
| Responsive phone layout (true 320/375/420) | minmax(0,1fr) grid + wrap rules + CDP-verified gate | qa_ui CDP layout gates | DELIVERED |
| Sound OFF by default (usability) | muted-by-default + Settings toggle | qa_honesty §25 | DELIVERED (this batch) |

## C. Human-only / disclosed items (NOT counted as completed)

| Item | Classification | Effect |
|------|----------------|--------|
| 5-8 teacher usability study | Requires real human participants | Reported as a LIMITATION / future evaluation in the dissertation; automated persona panel is described only as automated scenario-based evaluation, never as human data |
| Desktop pywebview boot traceback (K-001) | DISCLOSED, harmless (console hidden) | Documented in known-limitations; no user-facing impact |
| Turnitin similarity | External system, not run here | Dissertation states "not measured"; a local originality/citation audit is performed instead |
| Windows .exe signing / notarization | Requires credentials | Out of scope for the assessment; unsigned build documented |

See DISSERTATION_TRACEABILITY.md for CA1-feedback and BCS mapping.
