# Evaluation

This chapter records how Kodro was evaluated during development. It is
written as honest evidence for the COMP702 dissertation: it separates what
was **actually measured** (automated verification and an analyst-run
review) from what is **planned but not yet done** (a study with real
users). Nothing here reports data from human subjects. That study is
deliberately left as future work and is specified, not run.

Kodro is a robot proving ground: a skeptical builder imports a real robot
specification (KRS) and sees how that machine would perform, with every
reported figure carried at a stated level of fidelity. The same platform
doubles as a design studio for a non-expert who has only an idea. The
evaluation below asks whether the automated evidence supports those claims.

## 1. Evaluation strategy

Complementary methods were used, in increasing cost and decreasing
frequency. The human study (Section 6) is specified but not run.

| Method | What it checks | Who/what runs it | Status |
| --- | --- | --- | --- |
| Python test suite | Correctness of every subsystem, regression safety | CI (Linux/Windows hard gates; macOS informational) | **Done, continuous** |
| Interpreter QA harness | Interpreter, kinematics, product-coherence checks | `node scripts/qa_interpreter.mjs` | **Done, continuous** |
| World and interface nets | Site identity across worlds; interface flows and modals | `qa_worlds.mjs`, `qa_ui.mjs` (headless browser) | **Done, smoke** |
| Heuristic persona review | Whole-product usability across user types | Author, simulating personas | **Done, formative** |
| Objective persona-task eval | Assistant code generation and the self-test safety net | `scripts/qa_personas.mjs`, scored by execution | **Done, deterministic** |
| User and refinement study | Real efficacy and the refinement loop | non-experts + builders | **Planned, future work** |

The first methods ran throughout the build and drove the design. The last
is the summative study a human will run before any release claim of
usefulness; the instrumentation (Section 5) exists to feed it.

## 2. Automated verification

Every task closed only when the full gate passed: `pytest` (with branch
coverage), `ruff`, `ruff format --check`, and `mypy --strict`. The suite
grew with the codebase and is the primary evidence of correctness.

- **Python suite:** about **870 tests** (unit, property-based with
  Hypothesis, and headless integration), gated at a minimum of **85 %**
  line+branch coverage that every push must clear. Measured with
  `python -m pytest -q --no-cov`: **870 passed**.
- **Cross-platform:** Linux (under `xvfb`) and Windows are hard gates on
  every push. macOS is an *informational* leg: its headless runner has no
  Aqua window server, so Tk intermittently segfaults under the GUI-heavy
  suite. This is a test-environment limitation, not a product defect.
- **What the Python tests pin down:** the procedural rover API never raises
  and clamps bad input; the physics, sensors and grader are deterministic;
  the sandbox rejects unsafe code and enforces a hard timeout; the shared
  motion model is locked against the studio twin (Section 2.1); and the
  end-to-end "Run -> grade -> hint -> persist -> reward" loop is exercised
  on the fully wired application.
- **Interpreter QA harness:** drives the *shipped* JavaScript interpreter
  with the real kinematics and the wall ray, asserting command semantics,
  every bundled example (including the three showcases), the interpreter
  diagnostics, the honesty of the design-check command list, and the
  absence of emoji glyphs from the interface chrome. Measured with
  `node scripts/qa_interpreter.mjs`: **156 passed, 0 failed**.

A running, per-capability log lives in [`test-evidence.md`](test-evidence.md);
design decisions and their rationale are in [`decision-log.md`](decision-log.md).

### 2.1 The one shared motion model and its conformance gates

The simulation is driven by a single set of closed-form equations and
constants, mirrored in `assets/web/motion-model.js` and
`engine/motion_model.py`. Three tests gate the pair on every push:

- **Constants hash (E-C4)** — `test_motion_model_conformance.py` serialises
  both constant tables to a canonical form and compares their SHA-256
  hashes, so a constant edited in one engine and not the other fails.
- **Golden traces (E-P2)** — `test_golden_traces.py` runs a corpus through
  both engines and asserts displacement, distance, heading and battery
  agree, so catalogue-mode motion cannot drift.
- **Formula parity (M1)** — `test_physical_golden_trace.py` runs the studio
  closed forms over a reference robot through a Node fixture and asserts the
  Python twin returns identical values (relative tolerance 1e-12), so an
  imported build's derived numbers (top speed, stall force, mobility,
  acceleration, energy, runtime, slope, turn timing, stopping distance,
  sensor pose) are provably identical across the two engines.

**Honest scope.** The two engines share the *formulas*. The full
end-to-end *simulation* of an imported build is the JS studio only:
`engine/sensors.py` rays originate at the rover centre with fixed module
ranges and do not yet consume an imported sensor's mount pose or range, and
`rover_api.py` does not import a KRS spec's mass/rpm/battery. So a measured
build is simulated end to end in the studio; the Python engine reproduces
the derived numbers and grades catalogue-mode motion. This is why the
"HONOURED" sensor-pose/range line in the fidelity table is scoped to the
studio sim. See [`../known-limitations.md`](../known-limitations.md).

### 2.2 World and interface nets (smoke)

Two headless-browser nets cover the interactive surface the deterministic
suites do not reach. `qa_worlds.mjs` loads every base world and all
**17 named mission sites** and asserts each stamps its own site treatment
in the rendered scene. `qa_ui.mjs` exercises the studio: **6** end-to-end
flows, a set of behaviour assertions (command gating, run feedback, the
studio/classroom modes, the KRS spec import, the fidelity card, the
showcase run), and the opening of every toolbar modal. Both render the real
WebGL scene through a software rasteriser, so they need no GPU and no
network.

These nets are deliberately reported as a **smoke signal, not a hard
gate**: they depend on a headless browser spawning reliably, and on a
loaded machine a browser launch can time out (`chrome.exe ETIMEDOUT`),
failing an assertion for reasons unrelated to the product. The harness
therefore never breaks CI on a spawn hiccup. In a clean run the interface
flows and world sites pass; the value is in catching a real regression when
the browser does run. Historically these nets caught defects the unit tests
could not, because they live in the wiring: a real-world site that resolved
through the wrong table and crashed the view; a 3D robot mesh facing 90
degrees off its travel direction while the physics stayed correct; a parts
catalogue advertising commands the interpreter does not implement; and
controls below the accessible-contrast and touch-target thresholds. Each
confirmed finding was fixed and re-verified.

## 3. Heuristic persona review (formative)

To evaluate the *whole product* rather than individual units, the author
conducted a structured heuristic review across simulated personas spanning
the range of makers and builders who might use the tool. Each persona drove
a session and returned a mark out of ten with the concrete defects it
found; after each round the named defects were fixed and the build was
re-rated.

This is an **analyst-simulated** technique (in the tradition of heuristic
evaluation and cognitive walkthrough). Its purpose is to surface design
problems cheaply and early, **not** to stand in for evidence from real
users. Its findings are hypotheses to be confirmed by the planned study.

| Round | Personas | Focus | Mean (/10) |
| --- | :--: | --- | :--: |
| 1 | 50 | First contact with the build | 5.86 |
| 2 | 12 | After the first round of fixes | 6.50 |
| 3 | 50 | After wiring the model and tools into the app | 7.10 |
| 4 | 50 | After grounded answers were added | 7.36 |
| 5 | 8 | Focused review of the new 3D world | 6.40 |

The single most important fix the review drove was closing the learning
loop: pressing **Run** now grades the attempt the moment the animation
ends, shows a pass/fail banner and score, surfaces a hint on failure,
persists the submission and updates the memory. The round-5 dip (scoring
the new 3D world lower) is left in deliberately, because the honest record
includes the rounds that went down as well as up.

### 3.1 Threats to validity

- **Single rater.** One analyst simulated every persona, so the scores
  carry that analyst's bias. Inter-rater reliability is unknown.
- **Simulation, not observation.** Personas are informed guesses about real
  users; they cannot capture genuine confusion, motivation or real use.
- **Anchoring.** Re-scoring a build the analyst made risks optimism. A
  rising mean should be read as a direction of travel, not a measured
  outcome.

These threats are exactly what the planned human study is designed to
address.

## 4. Objective persona-task evaluation

The heuristic review above is subjective. A second, **deterministic**
persona evaluation removes the analyst from the scoring entirely: four
simulated personas (a beginner with no code, a teacher preparing a class
demo, a precise hobbyist maker, and an accessibility-focused low-vision
user) each attempt five tasks (drive forward; turn and move; drive a
square; stop before an obstacle using the distance sensor; a counted loop),
phrased in that persona's own words. The local assistant model answers;
success is judged **only by the shipped interpreter and self-test**
(`scripts/qa_personas.mjs`), over up to three correction turns in which the
self-test summary is fed back as a user would report it. No model and no
human scores the outcome; execution does. Fully offline; the local model is
the only peer.

Measured funnel over the 20 persona-task cells (model `kodro-coder`), as
recorded in `docs/eval/persona_eval_results.json`:

| Outcome | Cells |
| --- | :--: |
| Compiled (valid program produced) | 17/20 (85%) |
| Ran clean through the interpreter | 15/20 (75%) |
| Stayed inside the arena (no wall hit) | 7/20 (35%) |
| Completed the task | 7/20 (35%) |

Mean turns to success: 1.0 (every success in this run landed on the first
attempt).

| Persona | Done | | Task | Done |
| --- | :--: | :-- | --- | :--: |
| Beginner (no code) | 0/5 | | Forward | 2/4 |
| Teacher (class demo) | 1/5 | | Turn + move | 1/4 |
| Maker (precise) | 3/5 | | Square | 0/4 |
| Low-vision (accessibility) | 3/5 | | Obstacle stop | 1/4 |
| | | | Counted loop | 3/4 |

The reading cuts both ways. The assistant produces compiling (85%) and
running (75%) code, the floor a beginner needs to not be stranded on a
syntax error. Task-correct behaviour is limited but real (35% in the
reported run), strongly dependent on phrasing precision (the precise maker
and the accessibility-focused phrasing each at 60% against 0 to 20% for the
beginner and teacher voices) and task complexity (the counted loop
succeeded for three of four personas, the square nowhere, the obstacle stop
once). This is the honest ceiling of a 1-to-4-billion-parameter model on a
laptop with no cloud, reported as such rather than hidden.

These figures are themselves iterations the eval drove. The first run
scored 30% task-complete and only 10% in-arena (the model over-shot
distances, reading "a few metres" as a 30-metre move). Feeding that back as
a single grounding change (the arena is small, a normal move is 1 to 5
metres, plus loop and sensor patterns) lifted in-arena from 10% into the 35
to 40% band. A second pass fixed the code extraction in the harness and the
shipped assistant, lifting compilation from 65% to 85% without touching the
model. Sampling makes repeated runs vary by 5 to 10 points even at low
temperature; the tables report the latest run, not the best one. Re-running
`scripts/qa_personas.mjs` overwrites the results JSON, so the numbers here
must always be read against the current file rather than assumed stable.

The result that matters most for the design is the safety row read against
the run row. Of the 15 programs that ran, 8 would still have driven the
robot into the arena wall. **The deterministic self-test caught every one**
before it reached the user and returned an actionable correction. The
weakness of the model and the value of the safety net are one finding, not
two: it is *because* the small offline model is not fully trustworthy alone,
even when well grounded, that Kodro pairs it with a deterministic execution
check rather than surfacing raw generated code.

**Its own limits**, stated plainly: the personas are simulated phrasings,
not real users; the task predicates are coarse proxies for success; and it
exercises one model in one configuration on five short tasks. It points to
the same human study and is not a substitute for it.

## 5. Instrumentation for the planned study

The application records every run (code, trace, score, battery, collisions,
timestamp), maintains the self-refinement memory (reflections, skills, run
reports), and can export a self-contained `.kodro` project and a progress
report entirely on-device. This is consistent with the project's hard
constraint of no cloud, no accounts and no third-party data processing,
which also simplifies the ethics/GDPR position for a study.

## 6. Planned user and refinement study (future work)

Three studies are specified and left for a point at which they can be run
under consent. **No result from any of them is reported here, because none
has been run.**

- **Help study:** a within-subject design with about sixteen non-experts,
  each attempting two comparable held-out scenarios, one with Kodro's
  grounded help and reviewer and one without, order counterbalanced.
  Success is a design that completes the scenario in at least 16 of 20
  randomised runs; iterations and collisions are recorded alongside.
- **Refinement-ablation study:** the same participant tackles a sequence of
  related scenarios in two arms differing only in the memory (full vs
  reflection/skill retrieval turned off), with the full arm expected to
  reach a working design in at least a quarter fewer iterations.
- **Assistant study:** the assistant is measured directly on a fixed set of
  design questions (including adversarial and off-specification ones), where
  grounded answers must be correct at least 85% of the time and invent a
  missing part less than 5% of the time, with the 5% invention rate set as a
  release gate.

The analysis for each is fixed before any data is collected, and a positive
result is a signal to confirm at scale, not proof, because the samples are
small and convenient.

A separate **speculative teacher-persona walkthrough** (eight UK secondary
teacher archetypes) is kept with the teacher documentation and is labelled
as speculation: it involved no participants, no timings and no scores, and
it produced design hypotheses (toggleable hints for summative assessment,
exam-board terminology mapping, offline-deployment logistics), not
findings. It must not be confused with a study.

## 7. Honest position

The product has been **verified** (it does what it claims, provably, via the
Python suite, the interpreter QA and the conformance gates) and
**heuristically reviewed** (it should work for a range of makers and
builders). An **objective, execution-scored** evaluation puts a reproducible
figure on the offline assistant and confirms the safety net's value. What
has **not** happened is **validation with real users**. Closing that gap is
the recommended next step, and the instrumentation for it is in place.
