# Kodro / RoboLearn — Acceptance & Feature-Parity Matrix

Authoritative repo: `D:\project\robolearn` (origin `github.com/vaibhav4046/robolearn`).
Live: https://vaibhav4046.github.io/robolearn/
This matrix maps every acceptance criterion (docs/ACCEPTANCE.md), the CA1
proposal's promised objectives, README product claims, and the assignment brief
to their implementation and verifying evidence. Gate counts are the CURRENT
verified values (they have grown well beyond the v2.0.2 baseline in ACCEPTANCE.md).

Legend: DELIVERED = implemented + gated/verified; DISCLOSED = intentional,
documented limitation; N/R = not required by the brief.

## A. docs/ACCEPTANCE.md criteria (current state)

| # | Criterion | Reproduce | Current result | Status |
|---|-----------|-----------|----------------|--------|
| 1 | No confirmed HIGH (P0/P1) defects in audited scope | judge panel + gates | 12 adversarial rounds; 0 P0/P1 outstanding; all 54 JR findings FIXED | DELIVERED |
| 2 | Bundle freshness | `node scripts/build_web.cjs --check` | committed bundle == build output; CI freshness gate | DELIVERED |
| 3 | Interpreter conformance | `node scripts/qa_interpreter.mjs` | 180 passed, 0 failed (was 157) | DELIVERED |
| 4 | Lesson-grader parity | `node scripts/qa_grader.mjs` | 34 passed, 0 failed | DELIVERED |
| 5 | Simulation physics unit gate | `node scripts/qa_physics.mjs` | 20 passed, 0 failed | DELIVERED |
| 6 | AI facade unit gate | `node scripts/qa_ai_web.mjs` | 27 passed, 0 failed (was 19) | DELIVERED |
| 7 | Static web boot + privacy | `node scripts/qa_web.mjs` | 5/5 checks incl. privacy-zero-external + studio-mount | DELIVERED |
| 8 | World/site render sweep | `node scripts/qa_worlds.mjs` | 61 passed, 0 failed | DELIVERED |
| 9 | UI smoke + modal coverage | `node scripts/qa_ui.mjs` | 6/6 flows, 38/38 behaviour, 12/12 modals (was 24/24) | DELIVERED |
| 10 | Python suite + coverage gate | `python -m pytest` | CI-authoritative green (3 OSes); coverage above the 85% gate | DELIVERED |
| 11 | Lint, format, types | ruff check / ruff format --check / mypy | green on touched code | DELIVERED |
| 12 | Offline web guard alone | `pytest tests/unit/test_web_offline.py` | passes standalone | DELIVERED |
| 13 | Source app constructs | `python -c "from robolearn.web.app import build_app; ..."` | prints `Kodro` | DELIVERED |
| 14 | Live hosted web reachable + CI-gated deploy | curl live; gh run list | HTTP 200; CI-gated Deploy Pages; live bundle sha256 == committed | DELIVERED |
| 15 | Windows installer/release packaging | `python scripts/build_exe.py --clean` | dual-binary release workflow (RoboLearn.exe + robolearn-tk.exe) | DELIVERED (see HUMAN note) |

Extra gates added since the baseline (all CURRENT): qa_honesty 86, qa_contrast 51
(WCAG AA across 10 themes + true-viewport phone layout via CDP), qa_parts 40,
qa_memgraph 22, qa_pupilstore 23, qa_scenario_parity 4, qa_interp_fixes 13,
Python golden-trace + urdf 11.

## B. CA1 / README promised objectives — parity

| Objective (CA1 / README) | Implementation | Evidence | Status |
|--------------------------|----------------|----------|--------|
| Design-build-program-run-validate learning loop | RobotLab + Editor + interpreter + diagnostics + verify | qa_ui flows, qa_interpreter, qa_grader | DELIVERED |
| Honest fidelity disclosure (HONOURED/APPROXIMATED/NOT SIMULATED) | specschema.FIDELITY + per-stat badges + verify annex | qa_honesty (86 checks) | DELIVERED |
| Offline-first, no cloud required | vendored React/Three; local Ollama or free BYO key; privacy gate | qa_web privacy-zero-external | DELIVERED |
| Deterministic validator has final word over the AI | validator/self-test gate on generated code | qa_ai_web, interpreter | DELIVERED |
| 18 graded lessons, ages 5-16, teacher register | lessons.json + lesson-grader + pupil-store + TeacherModal | qa_grader, qa_pupilstore 23 | DELIVERED |
| Real parts catalogue within a budget | parts-db + budget planner (desktop) | qa_parts 40 | DELIVERED (planner desktop-only, disclosed) |
| Cinematic 2D/3D worlds, living city, no first-person | Viewport3D + worldfx + ambient; 61 world/site sweep | qa_worlds 61 | DELIVERED |
| Robot spec import (KRS) drives measured numbers | specschema.deriveFromPhysical + motion-model | golden-trace 4, qa_interpreter | DELIVERED |
| Gymnasium env + KodroBench (RL/eval) | envs/kodro_env.py + kodrobench.py | test_kodro_env, KodroBench record | DELIVERED |
| URDF interop | interop/urdf_io.py | test_urdf_import/export | DELIVERED |
| Accessibility (contrast, keyboard, readable-text, reduced-motion) | theme tokens + a11y-readable + reduced-motion gates | qa_contrast 51, qa_honesty a11y §§ | DELIVERED |
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
