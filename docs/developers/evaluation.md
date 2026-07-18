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
| Renderer evidence | Cadence and render-submission work against the 240 Hz budget | `scripts/qa_performance.mjs` | **Done, environment-specific** |
| User and refinement study | Real efficacy and the refinement loop | non-experts + builders | **Planned, future work** |

The first methods ran throughout the build and drove the design. The planned
pilot remains ethics-pending and is the only method here designed to measure
human diagnosis performance; the instrumentation in Section 5 exists to feed it.

## 2. Automated verification

Every task closed only when the full gate passed: `pytest` (with branch
coverage), `ruff`, `ruff format --check`, and `mypy --strict`. The suite
grew with the codebase and is the primary evidence of correctness.

- **Python suite:** the complete declared matrix, including optional RL and
  URDF surfaces, is gated at a minimum of **85%** line+branch coverage.
  Measured on the candidate release state on Windows:
  **1,087 passed, zero skipped, 88.21% coverage**.
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
  `node scripts/qa_interpreter.mjs`: **180 passed, 0 failed**.

A running, per-capability log lives in [`test-evidence.md`](test-evidence.md);
design decisions and their rationale are in [`decision-log.md`](decision-log.md).

### 2.1 Deterministic Prove contracts

Four declarative contracts cover straight transit, a controlled corner,
obstacle clearance and battery reserve. Each runs over five seeds while
obstacle offset, sensor noise, start delay and initial battery vary within
declared ranges. The canonical manifest records the code hash, contract,
seed, engine identity, conditions, metrics and verdict. It contains no clock
timestamp, so the same source, contract and seed reproduce byte for byte.

The candidate baseline passes 20 of 20 runs. A second replay is byte-identical,
baseline comparison passes, and `tests/fixtures/broken_controller.py` fails all
four contracts with a non-zero process status. The Companion may explain this
evidence but cannot change the deterministic verdict. The report states that a
pass is kinematic simulation evidence only, not physical or safety validation.

### 2.2 The one shared motion model and its conformance gates

The simulation is driven by a single set of closed-form equations and
constants, mirrored in `assets/web/motion-model.js` and
`engine/motion_model.py`. Three tests gate the pair on every push:

- **Constants hash (E-C4):** `test_motion_model_conformance.py` serialises
  both constant tables to a canonical form and compares their SHA-256
  hashes, so a constant edited in one engine and not the other fails.
- **Golden traces (E-P2):** `test_golden_traces.py` runs a corpus through
  both engines and asserts displacement, distance, heading and battery
  agree, so catalogue-mode motion cannot drift.
- **Formula parity (M1):** `test_physical_golden_trace.py` runs the studio
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

### 2.3 World and interface nets (smoke)

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

The heuristic review above is subjective. A second evaluation asks a
narrower reproducible question: whether the offline assistant turns a plain
request into code that compiles, runs, stays inside the arena and completes
an executable task predicate. Eight simulated personas each attempt five
tasks with persona-specific phrasing. The local `qwen2.5-coder:3b` model runs
at temperature zero with base seed 4046. The shipped interpreter and
self-test, not a model judge, decide every outcome over up to three turns.
The committed JSON retains prompts, raw replies, extracted code, execution
evidence, seeds, the model digest and evaluator hashes.

Measured funnel over 40 cells, recorded in
`docs/eval/persona_eval_results.json`:

| Outcome | Cells |
| --- | :--: |
| Compiled (valid program produced) | 40/40 (100%) |
| Ran clean through the interpreter | 40/40 (100%) |
| Stayed inside the arena (no wall hit) | 40/40 (100%) |
| Completed the task | 40/40 (100%) |

Mean turns to success: 1.0.

| Persona group | Done | | Task | Done |
| --- | :--: | :-- | --- | :--: |
| Beginner and younger learner | 10/10 | | Forward | 8/8 |
| Teacher and maker | 10/10 | | Turn + move | 8/8 |
| Low-vision and EAL | 10/10 | | Square | 8/8 |
| Engineer and skeptic | 10/10 | | Obstacle stop | 8/8 |
| | | | Counted loop | 8/8 |

This establishes a narrow fact about one model, prompt contract and five
short tasks. It supersedes a historical 7/20 run with `kodro-coder`, but the
change is not a controlled comparison because the model, personas and
harness all changed. It does not establish open-ended generation, learning,
usability or real-robot safety.

Three role prompts inspected the summary as an advisory panel. Usability
and robotics returned PASS; methodology returned FAIL because synthetic
personas are not human participants. These are prompts to the same model,
not independent experts, and they cannot override execution. The
methodology failure is retained and points to the planned human study.

### 4.1 Renderer evidence

`scripts/qa_performance.mjs` measures a rolling 120-frame sample from the
shipped 3D loop and hash-locks the harness and bundle. Windows headless
Chrome with SwiftShader measured 18.7 FPS Low and 18.4 FPS High; P95
render-submission work was 51.4 ms and 37.0 ms respectively, so both missed
the 4.17 ms budget required for 240 Hz. This is an environment-specific
negative result, not a hardware-GPU benchmark or a universal FPS claim.

## 5. Instrumentation for the planned study

The application records every run (code, trace, score, battery, collisions,
timestamp), maintains the self-refinement memory (reflections, skills, run
reports), and can export a self-contained `.kodro` project and a progress
report entirely on-device. This is consistent with the project's hard
constraint of no cloud, no accounts and no third-party data processing,
which also simplifies the ethics/GDPR position for a study.

## 6. Planned human evaluation

One bounded, ethics-pending pilot asks whether the deterministic evidence view
helps a user diagnose a failed robot program more accurately than the raw
console alone. A target of 12 participants, with 10 to 15 accepted for the
pilot, completes both conditions in a counterbalanced within-participant
design. Three missions expose a goal shortfall, unsafe clearance and
insufficient battery reserve. Correct diagnosis is primary; time, confidence,
workload and evidence use are secondary.

The protocol, participant information sheet, consent form, task script,
measures, data templates and analysis script are versioned in `docs/study`.
They contain no participant data. Recruitment, consent and data collection
must not begin before ethics approval and supervisor agreement. No human
result is reported because the study has not been run.

## 7. Honest position

The product has been **verified** (it does what it claims, provably, via the
Python suite, the interpreter QA and the conformance gates) and
**heuristically reviewed** (it should work for a range of makers and
builders). An **objective, execution-scored** evaluation puts a reproducible
figure on the offline assistant and confirms the safety net's value. What
has **not** happened is **validation with real users**. Closing that gap is
the recommended next step, and the instrumentation for it is in place.
