# Kodro autonomy state

Last refreshed: 13 August 2026

Repository: `C:\Users\lalwa\OneDrive\Desktop\codex fix\robolearn`

Origin: `https://github.com/vaibhav4046/robolearn.git`

## Objective

Prepare one internally consistent Kodro 2.1 product, evidence set, teacher pack,
release and dissertation without fabricating participant, physical-validation,
similarity-check or signing evidence.

## Current stage

The Kodro 2.1 product candidate is published on branch
`agent/kodro-2-1-completion` at commit
`0559257b17ee2b3899bdffa0455c49c984050640`. Draft pull request 3 is open. Its
Ubuntu, Windows and macOS Python 3.12 jobs and Prove summary are green. The
dissertation has completed revision, reference checking, the final-integrity
gate and all-page PDF review; it awaits the student's mandatory finalization
checkpoint. Merge, tag and release are not implied by candidate publication.

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
  on the saturated Windows/SwiftShader host. No local assertion ran; the Linux
  candidate CI browser matrix is the release authority and passed.

## Dissertation snapshot

- Canonical LaTeX and PDF: 50 pages; approximately 20,005 body words.
- 26 in-text citation keys and 26 bibliography entries match bidirectionally.
- No blank rendered page, unresolved citation/reference, duplicate destination,
  overfull box or Unicode en/em dash remains.
- Current product claims are locked to commit `0559257`; historical model,
  persona and renderer evidence is labelled as historical/formative evidence.
- No human-study, physical-validation, universal-accessibility, Turnitin,
  signing or safety-certification claim is made.

## Convergence

The historical judge process did not record two consecutive zero-finding
rounds. That historical counter is not rewritten. Current completion uses
material release gates instead: no known P0/P1 defect, deterministic gates
green, candidate CI green, release artifacts built from one immutable commit,
and dissertation claims verified against that commit. The latter external and
academic gates remain pending.

## Required next decision

The student must read the candidate PDF and explicitly confirm the mandatory
academic-pipeline finalization checkpoint. After that, administrative submission
is performed through the university service. Merging pull request 3 and creating
the `v2.1.0` tag/release are separate repository-owner decisions.

## Human-only boundaries

See `HUMAN_TODO.md`. No human study, physical calibration, disabled-user study,
Turnitin result, signing credential or university submission receipt exists in
the repository, so none is claimed.
