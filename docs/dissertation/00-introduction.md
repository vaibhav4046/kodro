# 1. Introduction

> **Superseded draft.** The canonical Introduction is Chapter 1 of
> [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex). This file is an earlier
> scaffold, kept for reference only; where it differs, the `.tex` is
> authoritative.

## Current framing (v2.0)

Kodro is an offline desktop **proving ground**. A skeptical builder imports a
real robot specification (KRS) of measured numbers, its motor, battery, body
and sensors, and watches how that machine would behave in a realistic
simulated world, with every reported figure carried at an honestly stated
level of fidelity rather than dressed up as a certified result. The imported
specification drives the simulation, so a heavier build accelerates more
slowly and drains its battery faster and a stronger motor raises the
closed-form top speed. The same platform doubles as a design studio in which
a non-expert assembles a build from a parts catalogue and programs it in
Python or in blocks, so the tool serves both the builder validating a real
machine and the learner exploring an idea.

The offline constraint is a hard one: no cloud service, no account, no paid
API, no data leaving the machine. The one concession, the AI assistant,
connects only to a *local* Ollama server and degrades silently to a
deterministic rule engine when that server is absent, so the offline
guarantee is never broken and a deterministic validator, not the model, has
the final word on safety.

See Chapter 1 of the `.tex` for the full context, problem statement, aims and
objectives, contributions, and report structure.
