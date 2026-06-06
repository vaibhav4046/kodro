# 6. Conclusion and future work

## 6.1 Summary

RoboLearn is a free, fully offline desktop application that lets UK secondary
pupils learn curriculum programming constructs by writing procedural Python to
drive a simulated rover across four terrains. Against the objectives set out
in the introduction, the project delivered:

- a procedural, curriculum-aligned pupil API that never crashes on bad input;
- a deterministic simulation with per-terrain physics, four sensor types and
  battery modelling;
- an automated grader and a 24-rule offline hint engine, both driven by a
  single per-call trace and validated against explicit per-lesson criteria;
- a pupil-progress memory model (per-concept strength, recommendations,
  achievements, streaks) and a teacher dashboard plus offline HTML reporting;
- thirteen curriculum-mapped lessons spanning KS3 and KS4; and
- a one-download desktop binary, built and released through a disciplined,
  fully green CI process.

The central design insight — coupling formative feedback to every Run — was
validated by a heuristic review that moved from 4.5/10 to roughly 8.3/10 once
the loop was closed and polished.

## 6.2 Reflection

- **What worked.** Building grading, hinting and replay on one trace
  abstraction, and keeping the decision-making cores pure and Tk-free, paid
  off repeatedly in testability and in the ease of adding the report and
  recommendation features late in the project.
- **What was harder than expected.** Headless GUI testing across three
  operating systems was a persistent source of friction; the honest outcome
  was to gate on the two stable platforms and treat the third as
  informational, rather than weaken the tests.
- **What I would do differently.** Wire the feedback loop first, not last —
  the most important feature was implemented after much of the surrounding
  UI, and discovering its absence through a structured review (rather than
  by design) cost rework.

## 6.3 Limitations

- The system is **verified and heuristically reviewed, but not yet validated
  with human users.** The persona review is analyst-simulated and carries
  single-rater bias.
- The data model is single-pupil-per-install; multi-pupil shared machines
  are handled only coarsely.
- macOS is not covered by a hard CI gate (a test-environment limitation).

## 6.4 Future work

1. **Run the teacher evaluation study** specified in the
   [evaluation chapter](../developers/evaluation.md) and
   `HUMAN_TODO.md`: 5–8 teachers, task-based sessions, a SUS questionnaire
   and interviews, using the built-in dashboard and HTML report as evidence.
2. **Broaden content** beyond the current lessons, and add worked-example and
   Parsons-problem lesson types.
3. **Deepen accessibility** (screen-reader labelling, a bundled
   OpenDyslexic-style font) toward a formal WCAG-style assessment.
4. **Multi-pupil support** for shared classroom machines, with per-pupil
   selection and isolated stores.
5. **Strengthen the optional local AI** tutor's reliability across small
   models, keeping the strict no-cloud guarantee.

## 6.5 Closing statement

The project demonstrates that a single, free, offline download can provide a
curriculum-aligned, feedback-rich programming environment for schools without
the cost, fragility or privacy concerns of hardware kits or cloud platforms.
The remaining step to a `v1.0.0` release is empirical validation with real
teachers and pupils — for which the instrumentation is already in place.
