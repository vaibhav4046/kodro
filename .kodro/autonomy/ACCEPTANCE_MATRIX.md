# Kodro 2.1 acceptance and feature-parity matrix

Repository: `C:\Users\lalwa\OneDrive\Desktop\codex fix\robolearn`

Baseline parent: `f01767ee908f74c50436aa2e6086de7358eefab0`

This matrix links product promises to implemented surfaces and reproducible
evidence. `DELIVERED` means implemented and verified. `RELEASE PENDING` means
the candidate is published in draft pull request 3 but is not merged/tagged.
`DISCLOSED` means the boundary is intentionally not claimed as complete.

## Engineering acceptance

| Criterion | Evidence | Candidate result | Status |
| --- | --- | --- | --- |
| Bundle matches source | `build_web.cjs --check` | Fresh | DELIVERED |
| Python behaviour | workspace-local `pytest` plus candidate CI | 1,239 passed and 140 host-unavailable Tcl/Tk skips locally; Python 3.12 CI green on Ubuntu, Windows and macOS | DELIVERED |
| Interpreter | `qa_interpreter` | 180/180 | DELIVERED |
| Lesson grading and solvability | `qa_grader` plus Python solution tests | 55/55; all 24 solutions pass both engines | DELIVERED |
| Web physics and scenario parity | `qa_physics`, `qa_scenario_parity` | 25/25 and 8/8 | DELIVERED |
| Privacy and browser boot | `qa_web` | 5/5, including zero app-originated external requests | DELIVERED |
| Accessibility tokens | `qa_contrast` | 61/61 across 10 themes | DELIVERED |
| Product honesty | `qa_honesty` | 121/121 | DELIVERED |
| Assistant surface | `qa_ai_web` | 51/51 | DELIVERED |
| Storage, markbook and learning evidence | storage, pupil-store, markbook and annotation gates | 23/23, 16/16, 16/16 and 28/28 | DELIVERED |
| Authored lessons | `qa_lesson_studio` | 79/79 | DELIVERED |
| Fuzz and construct parity | `qa_fuzz`, `qa_construct_liveness` | 9/9 suites and 30/30 | DELIVERED |
| Public lesson claims | documentation parity tests | Product copy and teacher materials agree on 24 lessons | DELIVERED |
| Platform CI and coverage | GitHub Actions at product commit `0559257` | Python 3.12 matrix and Prove summary green | DELIVERED for candidate |
| Platform binaries | `v2.1.0` tag workflow | Awaiting merge/tag | RELEASE PENDING |
| Pages hash equality | live bundle and stylesheet versus tagged commit | Awaiting deployment | RELEASE PENDING |

## CA1, README and BCS parity

| Promised outcome | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Design, program, test and review loop | Robot Lab, editor/interpreter, world, deterministic result and evidence surfaces | interpreter, browser, physics and Prove gates | DELIVERED |
| Disclosed fidelity | HONOURED, APPROXIMATED and NOT SIMULATED values plus exported boundaries | honesty gates and known limitations | DELIVERED |
| Offline-first, no account | vendored application, local storage, optional local or explicit BYOK model | browser privacy gate | DELIVERED |
| Deterministic validation outranks generated output | sandbox, fitted-command checking and run-based grading | sandbox, interpreter, assistant and grader gates | DELIVERED |
| Curriculum and teacher path | 24 lessons, scheme, mapping, verified answer key, markbook and Lesson Studio | curriculum/document/solution gates | DELIVERED |
| KRS measured specification path | schema, derived motion/energy values and fidelity report | golden and physical trace tests | DELIVERED within stated scope |
| URDF and Gymnasium interoperability | import/export and optional environment modules | unit tests | DELIVERED |
| Accessibility engineering | contrast, keyboard, reduced-motion and responsive checks | deterministic and browser gates | DELIVERED as automated evidence |
| Critical self-evaluation | failures, limitations and absent validation reported explicitly | dissertation and `known-limitations.md` | DELIVERED |

## Boundaries not converted into claims

| Boundary | Status |
| --- | --- |
| Classroom efficacy or teacher usability | DISCLOSED: no human study reported |
| Physical predictive validity and safety | DISCLOSED: no physical-robot validation or certification |
| Accessibility for every disabled user | DISCLOSED: automated checks only |
| Memory reducing design iterations | DISCLOSED: mechanism exists, causal effect untested |
| Turnitin or a guaranteed similarity percentage | DISCLOSED: external system not measured |
| Signed/notarised binaries | DISCLOSED: credentials required |

See `docs/ACCEPTANCE.md`, `.kodro/autonomy/EVIDENCE.json` and
`.kodro/autonomy/DISSERTATION_TRACEABILITY.md` for the detailed records.
