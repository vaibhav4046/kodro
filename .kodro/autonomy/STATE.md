# Kodro autonomy state

Last refreshed: 13 August 2026

Repository: `C:\Users\lalwa\OneDrive\Desktop\codex fix\robolearn`

Origin: `https://github.com/vaibhav4046/robolearn.git`

## Objective

Prepare one internally consistent Kodro 2.1 product, evidence set, teacher pack,
release and dissertation without fabricating participant, physical-validation,
similarity-check or signing evidence.

## Current stage

The local product candidate is verified and is awaiting the mandatory academic
pipeline checkpoint plus explicit authority for external GitHub publication.
It is based on parent commit `f01767ee908f74c50436aa2e6086de7358eefab0`.

## Product candidate

- Version: `2.1.0`.
- Lessons: 24 total: 3 KS1, 4 KS2, 9 KS3 and 8 KS4.
- Product copy, README, getting-started guide, scheme of work, curriculum map
  and answer key use the same lesson baseline.
- All 24 worked answers are required to pass both marking engines, and the
  teacher answer key is mechanically checked against those exact answers.
- The generated web bundle is fresh.

## Verification snapshot

- Python 3.13 local run: 1,239 passed, 140 skipped in 154.20 seconds. Skips are
  Tcl/Tk GUI cases unavailable on this interpreter. This 66% local coverage
  figure is not used as release coverage because skipped GUI modules remain
  unexecuted.
- Release coverage authority: Linux Python 3.12 with Xvfb and the 85% branch
  threshold in GitHub Actions.
- All 19 deterministic Node gates pass. Exact counts are in `EVIDENCE.json`.
- Browser boot/privacy: 5/5 pass, including a mounted studio, clean console and
  zero app-originated external requests.
- Windows packaging: both `Kodro.exe` and `robolearn-tk.exe` built successfully
  from the candidate; exact sizes and SHA-256 hashes are in `EVIDENCE.json`.
- Full paint capture did not execute because Chrome process creation timed out
  on the saturated Windows/SwiftShader host. Do not call that a product failure
  or a pass; rely on candidate CI for the browser matrix.

## Convergence

The historical judge process did not record two consecutive zero-finding
rounds. That historical counter is not rewritten. Current completion uses
material release gates instead: no known P0/P1 defect, deterministic gates
green, candidate CI green, release artifacts built from one immutable commit,
and dissertation claims verified against that commit. The latter external and
academic gates remain pending.

## Required next decisions

1. Academic pipeline checkpoint: confirm progression from the synchronized
   product/evidence stage into dissertation revision and final integrity review.
2. Publication authority: confirm creation and push of a candidate branch and
   draft pull request. No external repository mutation is assumed from a local
   editing request.

## Human-only boundaries

See `HUMAN_TODO.md`. No human study, physical calibration, disabled-user study,
Turnitin result, signing credential or university submission receipt exists in
the repository, so none is claimed.
