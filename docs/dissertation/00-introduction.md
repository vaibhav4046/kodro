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

- **Hard constraint:** 100% offline — no cloud services, no accounts, no
  paid APIs, no third-party data processing. (An optional AI tutor uses a
  *local* Ollama server on `localhost` only; it degrades gracefully when
  absent.) *Explain why this matters for schools: cost, safeguarding, GDPR.*
- Single-machine, single-pupil-per-install data model.

## 1.5 Contributions

> List what the project delivers. Grounded options:
> - a working, tested, cross-platform application (12 curriculum lessons);
> - an auto-grader + 24-rule offline hint engine driven by a per-call trace;
> - an adaptive per-concept strength model and teacher reporting;
> - a documented engineering process (decision log, test evidence,
>   evaluation) suitable for critical reflection.

## 1.6 Report structure

> One short paragraph signposting the remaining chapters (Background,
> Design, Implementation, Evaluation, Conclusion).
