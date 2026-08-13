# Dissertation

The **canonical, up-to-date dissertation is
[`Kodro_Dissertation.tex`](Kodro_Dissertation.tex)** (and the PDF built from
it). It reflects the Kodro 2.1 candidate product commit
`0559257b17ee2b3899bdffa0455c49c984050640`, verified on 13 August 2026: a robot
**proving ground** where a skeptical builder imports a robot specification
(KRS) and tests it under a disclosed first-order model, with every reported figure carried at a stated level
of fidelity (HONOURED / APPROXIMATED / NOT SIMULATED), backed by one shared
motion model locked across the two engines. The same platform doubles as a
design studio for a non-expert who has only an idea. The final interface uses
Simple progressive disclosure by default, follows a Design, Prove, Build
journey, and keeps an opt-in Expert surface.
The workspace-local Python 3.13 run passes 1,239 tests and skips 140 Tcl/Tk
cases because that host has no working Tk runtime; the dissertation does not
mislabel its resulting 66% coverage as release coverage. Release coverage is
owned by the Python 3.12 Linux/Xvfb CI gate at 85%. Nineteen deterministic
JavaScript gates pass locally, including 180 interpreter checks, 55 lesson
grader checks and 121 honesty assertions. All 24 worked lesson answers pass
both graders. The static-browser boot/privacy gate passes 5/5, and both Windows
executables build and hash successfully. Synthetic-persona and renderer results
remain engineering evidence only, with their human-study and hardware
boundaries explicit.

The previously tracked HTML dissertation was an obsolete early draft and has
been removed. It contradicted the canonical LaTeX on ethics, evaluation and
feature status. Generate or submit the PDF from the canonical `.tex` only.

## Chapter markdown files

The `0X-*.md` files in this folder are **earlier draft chapters** kept for
reference. They predate the v2.0 proving-ground reframing and the canonical
`.tex`, so where they differ, **the `.tex` is authoritative**. The
[Evaluation](../developers/evaluation.md) markdown is kept current and
matches the `.tex` evaluation chapter.

| Chapter | Source of truth |
| --- | --- |
| Introduction | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 1) |
| Background / literature | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 2) |
| Requirements & analysis | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 3) |
| Design & architecture | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 4) |
| Implementation | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 5) |
| Evaluation | [`../developers/evaluation.md`](../developers/evaluation.md) |
| Discussion & limitations | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 7) + [`../known-limitations.md`](../known-limitations.md) |
| Professional issues and ethics | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 8) |
| Conclusion & future work | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 9) |

## Integrity note

Technical claims revised in the `.tex` were checked against the candidate
release state and verification date. Where a claim depends on external literature
or on the not-yet-run human study, the text says so explicitly rather than
asserting an unsupported result. No result from a study with real users is
reported anywhere, because that study has not been run.

The current evidence trail is recorded in
[`INTEGRITY_AUDIT_2026-08-13.md`](INTEGRITY_AUDIT_2026-08-13.md), and the
bibliography check is recorded in
[`REFERENCE_AUDIT_2026-08-13.md`](REFERENCE_AUDIT_2026-08-13.md). Earlier dated
audits are retained as historical records, not current release evidence.
