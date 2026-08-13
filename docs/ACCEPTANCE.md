# Kodro 2.1 acceptance record

This record separates verified engineering results from external or human
activities. It was refreshed on 13 August 2026 from the synchronized repository
at the 2.1 candidate worktree. The candidate branch and draft pull request are
published; a release is not described as published until merge, tag and
platform artifacts exist on GitHub.

## Candidate baseline

- Product version: `2.1.0`.
- Product commit: `0559257b17ee2b3899bdffa0455c49c984050640`.
- Draft pull request: `https://github.com/vaibhav4046/robolearn/pull/3`.
- Learning library: 24 lessons: 3 KS1, 4 KS2, 9 KS3 and 8 KS4.
- Primary journey: Design, Prove, Build, with learning and authoring routes.
- Core operation: local-first, no account, and no mandatory model or network
  request after the static application has been obtained.

## Reproducible checks

| Area | Command or evidence | Candidate result |
| --- | --- | --- |
| Web source/bundle identity | `node scripts/build_web.cjs --check` | PASS |
| Python suite on this Windows host | workspace-local `PYTHONPATH=src`; `pytest --cov-fail-under=0` | PASS: 1,239 passed, 140 skipped; skips are Tcl/Tk GUI cases unavailable in this Python 3.13 installation |
| Coverage release policy | Linux Python 3.12 CI with Xvfb and `--cov-fail-under=85` | PASS on product commit `0559257`; Windows and macOS Python 3.12 jobs also passed |
| Interpreter | `node scripts/qa_interpreter.mjs` | PASS: 180 |
| Lesson grader and solvability | `node scripts/qa_grader.mjs` | PASS: 55; all 24 worked answers pass both graders at 100/100 |
| Physics | `node scripts/qa_physics.mjs` | PASS: 25 |
| Scenario collision parity | `node scripts/qa_scenario_parity.mjs` | PASS: 8 |
| Assistant facade | `node scripts/qa_ai_web.mjs` | PASS: 51 |
| Pupil store | `node scripts/qa_pupilstore.mjs` | PASS: 23 |
| Honesty assertions | `node scripts/qa_honesty.mjs` | PASS: 121 |
| Contrast and responsive tokens | `node scripts/qa_contrast.mjs` | PASS: 61 across 10 themes |
| Parts, memory and GPU gates | `qa_parts`, `qa_memgraph`, `qa_gpucaps` | PASS: 40, 22 and 46 |
| Storage and construct liveness | `qa_project_storage`, `qa_construct_liveness` | PASS: 16 and 30 |
| Lesson Studio | `node scripts/qa_lesson_studio.mjs` | PASS: 79 |
| Pupil error explanations | `node scripts/qa_pupil_errors.mjs` | PASS: 42 |
| Parsons and markbook | `qa_parsons`, `qa_markbook` | PASS: 13 and 16 |
| Learning annotations and preview | `node scripts/qa_learning_annotations.mjs` | PASS: 28 |
| Cross-engine fuzzing | `node scripts/qa_fuzz.mjs` | PASS: 9 suites: 120 parity cases, 120 junk inputs and 30 storage rounds |
| Browser boot and privacy | local static server; `node scripts/qa_web.mjs` | PASS: 5/5, including studio mount, clean console and zero app-originated external requests |
| Windows packaging | `python scripts/build_exe.py --clean` | PASS: `Kodro.exe` (302,106,757 bytes; SHA-256 `4620918A185A561371095097A1571B5C6504A5B96970A9F4D9D349E1902389E4`) and `robolearn-tk.exe` (301,822,391 bytes; SHA-256 `DEAC2DFD56474B6B1F55BE043761ED4216438187D79EF1363C530480DB3CC0A3`) |
| Full local paint harness | `node scripts/qa_ui.mjs --suite=paint` | HOST LIMITATION: Chrome process creation timed out for all six captures on this saturated Windows/SwiftShader host; no product assertion ran, so this is not recorded as a pass or product failure |
| Public lesson/document parity | `test_docs_match_reality.py` | PASS: counts agree and the scheme, mapping and answer key cover all 24 lessons; every documented answer matches its verified YAML solution |

## Acceptance boundaries

The software evidence above does not establish classroom efficacy, physical
predictive validity, electrical or mechanical safety, accessibility for every
disabled user, or a causal benefit from the memory mechanism. No human study is
reported. Those boundaries are maintained in `docs/known-limitations.md` and
the dissertation.

The following are release operations rather than claims that may be inferred
from a local worktree:

1. Merge the reviewed candidate to `main`.
2. Tag the exact merged commit as `v2.1.0` and let `release.yml` build its
   Windows, Linux and macOS assets.
3. Verify the GitHub Pages bundle and stylesheet against that commit and record
   the resulting hashes.

Until those three operations are complete, this document describes a published,
CI-verified candidate, not a published 2.1 release.
