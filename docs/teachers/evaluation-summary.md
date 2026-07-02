# Speculative Teacher-Persona Walkthrough (Summary)

> **Read this first.** This document is an analyst-written speculative walkthrough of how
> eight UK secondary-school teacher archetypes *might* respond to Kodro. It was written to
> surface design requirements ahead of any classroom contact. It is a design review, not a
> study: it involved **no participants, no measurements, and no model-generated scores**.
> Nothing below is a finding. The measured evidence for the assistant is the objective
> persona-task evaluation (`docs/developers/evaluation.md`, section 3.5: 40% task
> completion, scored by the shipped interpreter and self-test). The real classroom
> questions are answered only by the planned human study (`HUMAN_TODO.md`).

**Status:** Design-review artefact. No study has been conducted with teachers, simulated or otherwise, and this document approves nothing.
**Method:** One analyst wrote eight teacher archetypes (non-specialist KS3 cover through experienced GCSE CS leads and a SENDCo) and walked the end-to-end workflow (welcome wizard, lessons, teacher dashboard, editor, replay debugger) through each archetype's likely priorities and objections.

## Why write this at all

A speculative walkthrough is cheap and forces the design to answer questions it had not
asked itself: what does a summative assessment lesson need, what does a SENDCo look for,
what does a school network actually block. Its output is a set of hypotheses to test in
the human study, plus concrete roadmap items. It carries all the limits of the persona
review in the dissertation, and one more: nothing here was run, so it is speculation
end to end.

## Design hypotheses raised (to test in the human study)

### 1. Onboarding must fit a lesson block
- Hypothesis: a teacher needs a class to reach a first working program comfortably inside
  a standard 45-minute lesson, including login-free startup and handout time.
- No time measurement exists. Time-to-first-success is a metric the human study will
  collect; it is not a number this document can supply.

### 2. Hint engine: determinism is the selling point, control is the ask
- Hypothesis: a SENDCo would care that hints are deterministic, not hallucinated.
  Consistent, repeatable guidance matters for neurodivergent pupils, so the deterministic
  rule-based fallback is a designed-in advantage worth verifying with SEND specialists.
- Hypothesis: a GCSE teacher would want hints toggleable off for summative assessment.
  A hint engine that cannot be disabled undermines controlled-assessment conditions.
  **Roadmap item: hint toggle for assessment mode.**
- Hypothesis: hint wording may pitch above Year 7 reading level in places; worth checking
  with KS3 teachers.

### 3. Achievement system: motivation likely varies by key stage
- Hypothesis: badges (for example the battery-efficiency achievements) are more likely to
  motivate KS3 than exam-focused Year 11, who care about grades. The design intent, that
  achievements reward efficient code rather than merely working code, is a claim about
  learning the study should probe rather than assume.

### 4. Offline deployment is probably a logistical advantage
- Hypothesis: a single offline executable sidesteps school web filtering, GDPR and
  student-account consent overhead, and bandwidth limits, which would make deployment
  materially easier than cloud IDEs. This is a deployment argument, not a measured
  outcome; it should be checked with school IT leads and MAT-level decision makers.

### 5. Curriculum mapping needs to speak exam-board language
- Hypothesis: GCSE teachers will ask for explicit mapping from lessons to exam-board
  terminology (OCR/AQA specification points), beyond the current programme-of-study
  mapping in `curriculum-mapping.md`. **Roadmap item: exam-board criteria mapping.**

### 6. Pedagogical surfaces worth studying
- Hypothesis: the replay debugger (stepping backwards through state) is the strongest
  teaching feature for explaining program state, and the 3D world's visible failure
  (crashing into a wall) is more legible to beginners than a stack trace. Both are
  plausible and unproven; the human study should test them directly.
- Hypothesis: the teacher dashboard's class heatmap and its CSV/PDF exports serve real
  reporting workflows (line management, parents' evenings). Whether they fit actual
  reporting practice is a study question.

## What this walkthrough cannot tell us

- No time-on-task, satisfaction, usability, or attainment figures exist. Any such number
  before the human study would be invented.
- It cannot rank features, find blockers, or clear the product for release. Release
  decisions rest on the measured evidence (test suite, QA harness, objective persona-task
  evaluation) and, for classroom claims, on the human study.

## Relationship to the evidence

| Question | Where it is actually answered |
|---|---|
| Does the assistant produce working programs? | Objective persona-task evaluation, `docs/developers/evaluation.md` section 3.5 (40% task completion, measured) |
| Is unsafe generated code caught? | Same evaluation: the deterministic self-test caught every unsafe program (measured) |
| Does Kodro work for teachers and pupils in a classroom? | Planned human study (`HUMAN_TODO.md`); not yet run, no results exist |
| What should the classroom study look for? | The hypotheses above |
