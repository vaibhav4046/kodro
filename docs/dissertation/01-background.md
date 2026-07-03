# 2. Background and related work

> **Superseded draft.** The canonical Background chapter is Chapter 2 of
> [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex), which carries the real
> citations. This file is an earlier scaffold, kept for reference only; where
> it differs, the `.tex` is authoritative.

## Current framing (v2.0)

The `.tex` situates Kodro against four lines of work, each read for what it
implies for an offline proving ground:

1. **Learning by building** (constructionism): people learn by building
   something they can watch behave and debug. The blocks palette compiles to
   the same Python the editor runs, so the medium does not get in the way of
   the idea.
2. **The simulation-to-reality gap and domain randomisation:** the value of a
   simulator is the honesty of the spread it reports, not its prettiness.
   Kodro validates across randomised seeds and reports the spread.
3. **Hallucination, grounding and honest refinement:** hallucination is
   intrinsic to language models, so generation is grounded in the build the
   user assembled or imported, a deterministic gate has the final word, and
   refinement is system-level (reflection + skill library), not weight-level.
4. **Small local models:** small open-weight models with retrieval make the
   offline choice practical; the honest limit is grounding and format, not
   frontier capability.

The niche the surveyed work leaves open is a single offline desktop tool that
lets a builder import a real robot specification, or a non-expert design one,
validate its behaviour among moving agents across a randomised spread, with
every figure carried at an honestly stated level of fidelity, a grounded
local model, and a deterministic gate. See Chapter 2 of the `.tex` for the
full review and references.
