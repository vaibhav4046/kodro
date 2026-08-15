# Dissertation

The **canonical, up-to-date dissertation is
[`Kodro_Dissertation.tex`](Kodro_Dissertation.tex)** (and the PDF built from
it). It reflects the candidate release state verified on 18 July 2026: a robot
**proving ground** where a skeptical builder imports a robot specification
(KRS) and tests it under a disclosed first-order model, with every reported figure carried at a stated level
of fidelity (HONOURED / APPROXIMATED / NOT SIMULATED), backed by one shared
motion model locked across the two engines. The same platform doubles as a
design studio for a non-expert who has only an idea. The final interface uses
Simple progressive disclosure by default, follows a Design, Prove, Build
journey, and keeps an opt-in Expert surface.
The complete declared Python matrix passes against an 85% branch-coverage gate.
The counts are deliberately not repeated here. This paragraph has carried a
stale figure twice now, at 1,087 and then at 1,488, because a restated number
goes stale the moment the suite grows and nothing forces it to be updated. The
run writes its own commit, working-tree status, counts and coverage into
[`../eval/test_suite.json`](../eval/test_suite.json). Read them there. Note that
the skip count in that file is not stable on the development host: it comes from
a fixture that turns an intermittent local Tk startup failure into a skip, the
cause has not been established, and three runs of the same suite gave one skip,
then two, then none.
Four deterministic contracts — straight transit, controlled corner, obstacle
clearance and battery reserve — pass five seeded runs each, twenty in total,
and reject an intentionally broken controller; the per-run record is in
[`../eval/prove_baseline.json`](../eval/prove_baseline.json). Synthetic-persona
and renderer results are reported as engineering evidence only, with their
human-study and hardware boundaries explicit.

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

The July evidence trail is recorded in
[`INTEGRITY_AUDIT_2026-07-17.md`](INTEGRITY_AUDIT_2026-07-17.md), and the
item-by-item bibliography check is recorded in
[`REFERENCE_AUDIT_2026-07-17.md`](REFERENCE_AUDIT_2026-07-17.md). **Both are
dated snapshots, not the current state.** Each now opens with a note listing
what has moved since; the integrity audit's figures in particular were measured
against a 49-page PDF and a smaller test matrix, and the bibliography has since
grown by two entries that have not been checked against a primary record.

The current-state assessment, including the outstanding items that only the
author can close, is
[`DIAGNOSTIC_2026-08-14.md`](DIAGNOSTIC_2026-08-14.md).
