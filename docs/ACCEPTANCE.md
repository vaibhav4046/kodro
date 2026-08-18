# Kodro Acceptance Standard

This is Kodro's objective definition of done. It is separate from the
adversarial judge-panel score: these gates ask whether the build is correct,
honest, reproducible and shippable; the judge panel scores subjective product
quality and should not be forced to 10/10.

Last measured locally on 2026-07-09 from the then-current release-readiness
checkout. The release vehicle for that pass was `v2.0.2`.

Every number in the table below is from that date and several are now low,
because the gates gained checks afterwards rather than because anything
regressed. The criteria still stand; the counts do not. For the current figure
on each gate, with the exact summary line it printed, see
[`docs/eval/qa_gate_runs_2026-08-14.md`](eval/qa_gate_runs_2026-08-14.md).

## Criteria

| # | Criterion | How reproduced | Result |
|---|-----------|----------------|--------|
| 1 | No confirmed HIGH defects remain in the audited scope | Requested audit plus gate failures | Pass after fixing the isolated offline gate, CI coverage-marker regression, Windows release packaging collision and README asset-name mismatch |
| 2 | Bundle freshness | `node scripts/build_web.cjs --check` | Pass: `bundle.js is up to date.` |
| 3 | Interpreter conformance | `node scripts/qa_interpreter.mjs` | Pass: 157 passed, 0 failed |
| 4 | Lesson-grader parity | `node scripts/qa_grader.mjs` | Pass: 34 passed, 0 failed |
| 5 | Simulation physics unit gate | `node scripts/qa_physics.mjs` | Pass: 20 passed, 0 failed |
| 6 | AI facade unit gate | `node scripts/qa_ai_web.mjs` | Pass: 19 passed, 0 failed |
| 7 | Static web boot + privacy | `node scripts/build_web.cjs --static`; `node scripts/qa_web.mjs` | Pass: 4/4 checks, including privacy-zero-external |
| 8 | World/site render sweep | Static server on `localhost:8099`; `node scripts/build_screenshot_harness.cjs`; `node scripts/qa_worlds.mjs` | Pass: 61 passed, 0 failed |
| 9 | UI smoke and modal coverage | Static server on `localhost:8099`; `node scripts/qa_ui.mjs` | Pass: 6/6 flows, 24/24 behaviour asserts, 12/12 modals |
| 10 | Python suite + coverage gate | `python -m pytest` | Pass: 1023 passed, 1 skipped; coverage total reported above the 85% gate |
| 11 | Lint, format, types | `ruff check .`; `ruff format --check .`; `mypy src` | Pass on all three local gates |
| 12 | Offline web guard can run alone | `python -m pytest tests/unit/test_web_offline.py` | Pass: 4 passed; isolated run no longer fails only because whole-repo coverage is below 85% |
| 13 | Source app constructs | `python -c "from kodro.web.app import build_app; app = build_app(); print(app.window.title)"` | Pass: prints `Kodro` |
| 14 | Live hosted web reachable and CI-gated deploy exists | `Invoke-WebRequest https://vaibhav4046.github.io/robolearn/`; `gh run list --branch main --workflow CI` | Pass: HTTP 200; main/release GitHub Actions remain part of the shipping gate |
| 15 | Windows installer/release packaging | `python scripts/build_exe.py --clean` | Pass: produced distinct `dist/RoboLearn.exe` and `dist/kodro-tk.exe`; release workflow now packages the distinct fallback binary |

## Release Artifacts

Local Windows build outputs from this pass:

| File | Size | SHA-256 |
|---|---:|---|
| `dist/RoboLearn.exe` | 75,781,082 bytes | `99B3372BC4EC77A4F9C1993968611E7D74BDC71AC14169CD38BAB130C7A8E3F6` |
| `dist/kodro-tk.exe` | 75,495,392 bytes | `9FE51DF7ED45A60295D0C99466FA14927B050E7621FA09F9D4E75FDABFD7EF95` |

The previous latest GitHub release before this audit was `v2.0.0`, tagged at
`9ed5f4680c6dab41fa709f529d2477d1de252e6b`, while current `main` had advanced
to `e78112c25f95ff30494c68764712e38e1c9c68ac`. That was treated as a HIGH
shipping defect. `v2.0.1` exposed a CI-only pytest-cov marker regression, so
`v2.0.2` is the required current-release vehicle.

## Verdict

Objective acceptance score: **15/15 measured passing locally**.

Subjective judge-panel score: **about 8.1/10**, not 10/10. Remaining limitations
are still disclosed in `docs/known-limitations.md`: Kodro is kinematic rather
than a rigid-body simulator, Pymunk is not the visible runtime, imported assets
are procedural rather than glTF/URDF, and several fitted hardware parts affect
robot properties before they have dedicated command bindings.
