# 6. Conclusion and future work

> **Superseded draft.** The canonical Conclusion & Future Work chapter is
> Chapter 8 of [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex). This file
> is an earlier draft written for the older teaching-tool framing; where it
> differs, the `.tex` is authoritative.

## Current framing (v2.0)

Kodro is an offline desktop proving ground on which a builder imports a real
robot specification, or a non-expert designs one, programs it two ways
against one meaning, and validates its behaviour in a realistic,
agent-populated simulation before building any hardware, with every reported
figure carried at an honestly stated level of fidelity and a local model
that helps without ever having the last word on safety.

Against the core objectives the artefact delivers: a specification (imported
or designed) that drives the simulation; a three-tier fidelity disclosure
with a verification report; one shared motion model locked across the two
engines; a sandboxed execution and scoring path; a validation layer of 17
named mission sites with moving agents; a grounded assistant with a
deterministic fallback; and a self-refinement memory. Measured evidence:
interpreter QA **156/156**, Python suite **~870 passing** above the 85%
coverage gate, world and interface smoke nets, and an objective
execution-scored persona-task evaluation.

The main future work is to wire the imported specification through the Python
engine (sensor mount pose/range and the public API), implement the remaining
part commands, put rigid-body physics on the hot path, and run the specified
human studies under consent. No result from a study with real users is
reported, because that study has not been run.

See Chapter 8 of the `.tex` for the full summary, reflection and roadmap.
