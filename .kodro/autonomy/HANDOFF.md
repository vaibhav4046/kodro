# Kodro 2.1 completion handoff

Read `STATE.md`, `EVIDENCE.json`, `docs/ACCEPTANCE.md` and `git status` before
continuing. Never quote a historical count without rerunning its gate.

## Candidate

- Version: 2.1.0.
- Baseline parent: `f01767ee908f74c50436aa2e6086de7358eefab0`.
- Learning library: 24 lessons: 3 KS1, 4 KS2, 9 KS3, 8 KS4.
- Product path: Design, Prove, Build, plus learning, teacher and authoring paths.
- Browser UI: vendored modules compiled by `scripts/build_web.cjs`; commit
  `bundle.js` whenever a source module changes.
- Desktop: Python bridge and PyInstaller builds; the release workflow produces
  the platform artifacts.

## Verified locally on 13 August 2026

- Python: 1,239 passed, 140 skipped on Python 3.13. The skips are Tcl/Tk GUI
  tests unavailable in this interpreter; the release coverage authority is the
  Linux Python 3.12 Xvfb CI job.
- Node gates: interpreter 180, grader 55, physics 25, scenario parity 8,
  assistant 51, pupil store 23, honesty 121, contrast 61, parts 40, memory 22,
  GPU 46, project storage 16, construct liveness 30, Lesson Studio 79, pupil
  errors 42, Parsons 13, markbook 16, annotations 28 and fuzz 9, all green.
- Browser boot/privacy: 5/5 green. The separate paint harness could not spawn
  Chrome on the saturated Windows/SwiftShader host; no assertions ran, so it is
  neither a pass nor a product failure.
- Windows packaging: `Kodro.exe` and `robolearn-tk.exe` both built successfully;
  exact candidate hashes are recorded in `EVIDENCE.json`.
- Teacher materials cover all 24 lessons and copy every machine-verified answer
  exactly.

## Non-negotiable boundaries

1. Do not invent a participant study, ethics approval, physical validation,
   Turnitin percentage, signed executable or performance result.
2. Keep the dissertation's required authorship/tool disclosure consistent with
   the assessment rules; do not remove it to conceal assistance.
3. Treat kinematic simulation as learning and early-design evidence, not
   certification.
4. Publish only from a reviewed candidate commit with green CI, then tag that
   exact merged commit and verify every release asset.

## Remaining external sequence

1. Obtain explicit permission to push the candidate branch.
2. Run the GitHub Python 3.12 and browser matrix and fix any real regression.
3. Merge, tag `v2.1.0`, verify platform artifacts and Pages hashes.
4. Revise the dissertation against that immutable release evidence, run the
   mandatory final-integrity gate, compile LaTeX and inspect every rendered page.
5. The student confirms administrative details, reads the final PDF and submits
   it through the official university portal.
