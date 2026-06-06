# 1. Introduction (scaffold)

> **This is a scaffold, not finished prose.** Bullet prompts mark what to
> write. Add your own framing and citations; do not submit verbatim.

## 1.1 Context and motivation

- The UK Computing curriculum requires pupils to learn programming
  constructs (sequence, selection, iteration, functions, decomposition,
  abstraction). *Cite the National Curriculum programme of study and the
  GCSE subject content you are targeting.*
- Physical robotics kits teach these ideas well but are expensive, fragile
  and unevenly distributed across schools. *Cite evidence on cost/access
  barriers if you have it; otherwise state it as a motivating assumption.*
- A free, offline desktop simulator can deliver the pedagogical benefit of a
  rover without the hardware barrier, and without the privacy/cost issues of
  cloud platforms.

## 1.2 Problem statement

> Write 1–2 sentences: *how* can a single, offline, free application let UK
> secondary pupils learn curriculum programming constructs by driving a
> simulated rover, with adaptive feedback a non-specialist teacher can use?

## 1.3 Aims and objectives

State your aim, then enumerable objectives. A defensible set, given what was
built:

1. Design a procedural, curriculum-aligned programming API suitable for KS3
   beginners.
2. Build a deterministic rover simulation (physics, sensors, terrains).
3. Implement automated grading and rule-based, offline hinting against
   explicit per-lesson success criteria.
4. Provide a pupil-progress memory model and a teacher-facing dashboard.
5. Package the system as a one-download, fully offline desktop application.
6. Verify the system with an automated test suite and evaluate it
   heuristically; specify a human study.

## 1.4 Scope and constraints

The defining constraint is that RoboLearn runs **fully offline**: it makes no
use of cloud services, user accounts, paid APIs or third-party data
processing of any kind. This is a deliberate design position rather than a
limitation. UK schools operate on tight budgets and locked-down networks,
and any tool that handles minors' data must satisfy safeguarding and data
protection obligations; an application that keeps every byte on the local
machine sidesteps the recurring cost and the data-governance burden in one
move. *Support this paragraph with the relevant cost and data-protection
references in the background chapter.* The one concession — an optional AI
tutor — connects only to a *local* Ollama server on `localhost` and degrades
silently to a no-op when that server is absent, so the offline guarantee is
never broken. The data model is single-machine and single-pupil-per-install,
which is adequate for the target deployment and keeps the storage layer (a
single SQLite file a teacher can copy) trivial to reason about.

## 1.5 Contributions

This project contributes a complete, working artefact and the engineering
record behind it. Concretely, it delivers: a tested, cross-platform desktop
application with fifteen curriculum-mapped lessons; an automated grader and a
twenty-four-rule offline hint engine, both driven by a single per-call
execution trace and validated against explicit, declarative success
criteria; an adaptive per-concept strength model that recommends the next
lesson, together with achievement and streak tracking and a teacher-facing
dashboard and progress report; and a disciplined development process —
recorded in a decision log, a running test-evidence log and an evaluation —
that makes the work reproducible and provides the basis for critical
reflection.

## 1.6 Report structure

The remainder of this report is organised as follows. The **Background**
chapter situates RoboLearn against computational-thinking pedagogy, existing
programming-education tools and the literature on formative feedback. The
**Design** chapter sets out the layered architecture and the key design
decisions, chief among them the choice to couple feedback to every Run. The
**Implementation** chapter describes how the design was realised, the notable
techniques, and the engineering challenges that arose. The **Evaluation**
chapter reports the automated verification and the heuristic persona review,
and specifies the human study that remains as future work. The
**Conclusion** reflects on the outcome, states the limitations, and sets out
the next steps.
