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
- Published product commit: `0559257b17ee2b3899bdffa0455c49c984050640`.
- Draft PR: `https://github.com/vaibhav4046/robolearn/pull/3`.

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
- Candidate GitHub Actions: Ubuntu, Windows and macOS Python 3.12 jobs green;
  Prove contract summary green.
- Dissertation: 50 pages, approximately 20,005 body words, 26/26 cited
  bibliography keys, clean multi-pass build and all-page visual inspection.

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

1. Push the dissertation/audit commit and require the updated PR CI to pass.
2. The student confirms the mandatory academic finalization checkpoint, checks
   title-page details, reads the PDF and submits through the official portal.
3. If the repository owner chooses, merge pull request 3, tag `v2.1.0`, then
   verify release assets and Pages hashes from that exact immutable commit.
