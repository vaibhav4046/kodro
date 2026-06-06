# Evaluation

This chapter records how RoboLearn was evaluated during development. It is
written as honest evidence for the COMP702 dissertation: it separates what
was **actually measured** (automated verification and an analyst-run
heuristic review) from what is **planned but not yet done** (a study with
human teachers and pupils). Nothing here reports data from human subjects —
that study is deliberately left to a human (see `HUMAN_TODO.md` in the
repository root).

## 1. Evaluation strategy

Three complementary methods were used, in increasing cost and decreasing
frequency (the planned study is detailed in `HUMAN_TODO.md`):

| Method | What it checks | Who/what runs it | Status |
| --- | --- | --- | --- |
| Automated test suite | Correctness of every subsystem, regression safety | CI on Linux/Windows (macOS informational) | **Done, continuous** |
| Heuristic persona review | Whole-product usability across learner types | Author, simulating 100 personas | **Done (formative)** |
| Teacher evaluation study | Real classroom efficacy and acceptability | 5–8 teachers + pupils | **Planned (future work)** |

The first two ran throughout the build and drove the design. The third is
the summative study a human will run before a `v1.0.0` release; the
[progress-report export](#5-instrumentation-for-the-planned-study)
was built specifically to feed it.

## 2. Automated verification

Every task closed only when the full gate passed: `pytest` (with branch
coverage), `ruff`, `ruff format --check`, and `mypy --strict`. The suite
grew with the codebase and is the primary evidence of correctness.

- **Scale:** 630+ unit, property-based (Hypothesis) and headless
  integration tests.
- **Coverage:** **92.5 %** line+branch on Linux, gated at a minimum of 85 %.
- **Cross-platform:** Linux (under `xvfb`) and Windows are hard gates on
  every push. macOS is an *informational* leg — its headless runner has no
  Aqua window server, so Tk intermittently segfaults under the GUI-heavy
  suite. This is a test-environment limitation, not a product defect: the
  same tests pass under Linux/`xvfb` and Windows, and the application runs
  normally on a real macOS desktop.
- **What the tests pin down:** the procedural rover API never raises and
  clamps bad input; the physics, sensors and grader are deterministic; the
  sandbox rejects unsafe code and enforces a hard timeout; and the
  end-to-end "press Run → grade → hint → persist → reward" loop is exercised
  on the fully wired application.

A running, per-capability log lives in
[`test-evidence.md`](test-evidence.md); design decisions and their
rationale are in [`decision-log.md`](decision-log.md).

## 3. Heuristic persona review (formative)

To evaluate the *whole product* rather than individual units, the author
conducted a structured heuristic review: 100 personas spanning fourteen
bands, from an impatient first-time clicker to a world-class HCI/pedagogy
reviewer. Each band was scored 0–10 on its likely experience, and the
scores were aggregated.

This is an **analyst-simulated** technique (in the tradition of heuristic
evaluation and cognitive walkthrough). Its purpose is to surface design
problems cheaply and early — **not** to stand in for evidence from real
users. Its findings are hypotheses to be confirmed by the planned study.

### 3.1 Headline finding

The first review scored the build **4.5 / 10**. The dominant, cross-band
complaint was blunt: the pupil could write and run code, but **the
application never responded to the attempt** — no pass/fail, no hint, no
reward. The learning loop was open.

### 3.2 What changed

The single most important fix was closing that loop: pressing **Run** now
grades the attempt the moment the animation ends, then shows a pass/fail
banner and score, surfaces an actionable hint on failure, persists the
submission, updates the per-concept strength model, plays a sound cue, and
unlocks any earned achievement. A second review after this and the
follow-on polish (progress strip, accessibility, sound, two extra KS4
lessons, confetti, an adaptive next-lesson recommendation) scored the build
**~8.3 / 10**.

| Persona band | Before | After |
| --- | :--: | :--: |
| Impatient / distracted | 3–4 | 8.5 |
| Beginner (KS3) | 5 | 8.5 |
| Stronger pupil (KS4) | 5 | 8.5 |
| Struggling / SEN | 3.5 | 8 |
| Accessibility (SENDCo) | 3 | 7.5 |
| Teacher (non-technical) | 4.5 | 8 |
| Teacher (CS specialist) | 5 | 8.5 |
| Examiner / curriculum auditor | 5 | 8.5 |
| World-class reviewer | 4 | 7.5 |
| **Weighted aggregate** | **4.5** | **~8.3** |

### 3.3 Threats to validity

- **Single rater.** One analyst simulated every persona, so the scores
  carry that analyst's bias. Inter-rater reliability is unknown.
- **Simulation, not observation.** Personas are informed guesses about real
  learners; they cannot capture genuine confusion, motivation or classroom
  dynamics.
- **Anchoring.** Re-scoring the same product the analyst built risks
  optimism. The "after" figure should be read as a direction of travel, not
  a measured outcome.

These threats are exactly what the planned human study is designed to
address.

## 4. Curriculum alignment

The twelve bundled lessons map to the UK Computing programme of study and
GCSE subject content, covering sequence, selection, iteration, functions,
sensors/abstraction, decomposition and recursion across KS3 and KS4. Each
lesson YAML carries explicit DfE/BCS curriculum references, and the
auto-grader's success criteria operationalise each lesson's learning
objective. The mapping is documented in
[`curriculum-mapping.md`](../teachers/curriculum-mapping.md).

## 5. Instrumentation for the planned study

The application records every submission (code, trace, score, battery,
collisions, timestamp) and maintains a rolling per-concept strength model
and achievement state. Two outputs make this usable as study evidence
without any cloud service:

- the **teacher dashboard** (class heatmap, per-pupil drill-down, CSV
  export); and
- the **progress report** (`robolearn.memory.report`) — a self-contained,
  offline HTML file summarising a pupil's submissions, concept strengths and
  achievements, written locally on demand.

Both run entirely on-device, consistent with the project's hard constraint
of no cloud, no accounts and no third-party data processing — which also
simplifies the ethics/GDPR position for a school study.

## 6. Planned teacher evaluation (future work)

The summative study a human should run before `v1.0.0`:

- **Participants:** 5–8 secondary Computing teachers, optionally with a
  class of KS3/KS4 pupils.
- **Design:** short task-based sessions (complete two or three lessons),
  followed by a System Usability Scale (SUS) questionnaire and a brief
  semi-structured interview. Pupil progress is captured automatically via
  the exports above.
- **Measures:** SUS score; task completion and time; number of attempts and
  hints used per lesson (from the trace); teachers' judgement of curriculum
  fit and classroom viability.
- **Analysis:** descriptive statistics for SUS and task metrics; thematic
  analysis of interview notes.
- **Ethics:** informed consent, no personally identifying data leaves the
  machine, right to withdraw.

The honest limitation of this dissertation is that the product has been
*verified* (it does what it claims, provably) and *heuristically reviewed*
(it should work for a wide range of learners), but not yet *validated* with
real users. Closing that gap is the recommended next step.
