# Speculative Teacher-Persona Walkthrough (Archetype Notes)

> **Read this first.** This document is an analyst-written speculative walkthrough of how
> eight UK secondary-school teacher archetypes *might* respond to Kodro, written to
> surface design requirements. It is a design review, not a study: it involved **no
> participants, no measurements, and no model-generated scores**. There are no timings,
> no quotes, and no feedback below, only hypotheses the analyst wrote in each archetype's
> voice of concern. The measured evidence for the assistant is the objective persona-task
> evaluation (`docs/developers/evaluation.md`, section 4: 40/40 narrow executable cells in one seeded synthetic run). The real
> classroom questions are answered only by the planned human study (`HUMAN_TODO.md`).

**Status:** Design-review artefact; approves nothing.
**Method:** One analyst walked the end-to-end workflow (welcome wizard, lessons, teacher dashboard, editor, replay debugger) through eight archetypes' likely priorities and objections. Each note below is a hypothesis to test in the human study, not an observation.

## Archetype 1: Head of Computing, mixed comprehensive

- Likely priorities: departmental rollout, curriculum fit, reliability under school IT.
- Hint engine: would probably approve of hints that point at the missing construct (for
  example a `while` loop) rather than giving the answer, since that matches common
  scaffolding practice. To verify in the study.
- Achievements: plausibly motivating for KS3, plausibly ignored by older students.
- Deployment: school filtering regularly breaks cloud IDEs, so an offline tool is likely
  attractive; would still ask who maintains installs across a department.
- Ask to expect: explicit mapping to OCR GCSE criteria. **Roadmap item.**

## Archetype 2: Early-career (NQT/ECT) Computing teacher

- Likely priorities: not being the only debugger in the room.
- Hint engine: automatic detection of syntax and indentation errors would reduce
  teacher-as-debugger load. Whether hints actually reduce hands-up rate is a study metric.
- Visual failure: a rover visibly crashing is plausibly less discouraging than a
  traceback for beginners. Worth testing against real pupils' reactions.

## Archetype 3: Primary specialist transitioning to KS3

- Likely priorities: bridging block-based to text-based programming.
- Hypothesis: the dual block/text view supports that transition, which is a recognised
  pain point at KS2 to KS3.
- Risk to check: hint vocabulary may pitch above Year 7 reading level in places.
- Achievements: likely to land well with younger pupils.

## Archetype 4: Experienced KS4/GCSE CS teacher

- Likely priorities: assessment integrity and exam preparation.
- Ask to expect: the ability to turn the hint engine off for summative assessment.
  **Roadmap item: assessment mode.**
- Hypothesis: the replay debugger (stepping backwards through a trace) is the standout
  pedagogical feature for teaching state change.
- Achievements: probably neutral for grade-focused Year 11.

## Archetype 5: SENDCo specialist

- Likely priorities: consistency, predictability, accessibility.
- Hypothesis: deterministic hints matter here most. Guidance that never varies for the
  same error, and cannot hallucinate, supports neurodivergent pupils who are confused by
  inconsistent feedback. This is a designed property of the fallback engine; whether it
  delivers the expected benefit needs SEND-informed evaluation.
- To check: UI contrast, reading level, and the voice-first accessibility path against
  real access needs, not against the analyst's guess at them.

## Archetype 6: After-school robotics club lead

- Likely priorities: engagement and tinkering freedom over curriculum coverage.
- Hypothesis: speccing robot parts and seeing behaviour change (mass, speed, battery) is
  the hook for club use; efficiency achievements plausibly drive friendly competition.
- Would probably use hints sparingly and prefer pupils to struggle productively.

## Archetype 7: Non-specialist covering KS3 Computing

- Likely priorities: not being exposed by the subject; needing the tool to teach them too.
- Hypothesis: the welcome wizard and hint engine double as teacher upskilling. Whether a
  non-specialist can run a full lesson unaided is one of the sharpest study questions.
- Hypothesis: the dashboard's class heatmap supports the reporting a non-specialist is
  least equipped to improvise.

## Archetype 8: Multi-academy trust (MAT) Computing lead

- Likely priorities: deployability at scale, data protection, evidence for line management.
- Hypothesis: a single executable with no accounts, no domains to whitelist, and no
  student personal data leaving the machine removes most MAT-level procurement friction.
  To be checked with an actual MAT IT/DPO review, not assumed.
- Hypothesis: CSV/PDF export from the teacher dashboard fits line-management reporting.

## What is deliberately absent

- **No time-to-first-success figures.** None were measured; the human study will measure
  them.
- **No quoted feedback.** No teacher, real or simulated, said anything; earlier drafts of
  this document invented quotes and they have been removed.
- **No approval or release recommendation.** Release rests on the measured evidence and,
  for classroom claims, the human study.
