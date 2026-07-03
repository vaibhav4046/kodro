# Dissertation

The **canonical, up-to-date dissertation is
[`Kodro_Dissertation.tex`](Kodro_Dissertation.tex)** (and the PDF built from
it). It reflects the shipped v2.0 system: a robot **proving ground** where a
skeptical builder imports a real robot specification (KRS) and sees how that
machine would perform, with every reported figure carried at a stated level
of fidelity (HONOURED / APPROXIMATED / NOT SIMULATED), backed by one shared
motion model locked across the two engines. The same platform doubles as a
design studio for a non-expert who has only an idea.

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
| Conclusion & future work | [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex) (Ch. 8) |

## Integrity note

Everything technical in the `.tex` can be checked against the repository at
the tag you are writing about. Where a claim depends on external literature
or on the not-yet-run human study, the text says so explicitly rather than
asserting an unsupported result. No result from a study with real users is
reported anywhere, because that study has not been run.
