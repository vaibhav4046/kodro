# 3. Design and architecture

This chapter describes the system's design. Every claim corresponds to code
in the repository; the rationale for the non-obvious choices is recorded
contemporaneously in the [decision log](../developers/decision-log.md).

## 3.1 Design goals

The architecture was shaped by four goals, in priority order:

1. **Legibility for non-specialist teachers.** A secondary Computing teacher
   should be able to read the pupil-facing code and understand it.
2. **Determinism and testability.** The simulation, grading and hinting must
   be reproducible so they can be unit-tested without a display.
3. **Strict offline operation.** No network dependency anywhere on the
   critical path.
4. **Separation of pupil code from engine internals**, so the pupil works
   against a tiny, safe surface.

## 3.2 Layered architecture

The system is organised in layers with a one-directional dependency flow:

```
Pupil code
  → rover_api            (procedural surface: ~16 free functions)
  → runtime.binding      (module-level handle to the live engine)
  → runtime.tracer       (records every call as an Event)
  → engine.*             (world, rover, sensors, physics, terrain)
  → engine.renderer      (pygame surface) / ui.sim_panel (tk.Canvas)
  → ui.*                 (Tk shell, panels, dialogs)
  → memory.*             (store, pupil_model, hint_engine, achievements, report)
```

`app.py` is the *composition root*: it constructs every object once and wires
the panels' callbacks to the runtime. It is deliberately a flat procedure,
not a class hierarchy.

## 3.3 The procedural pupil API

The pupil surface (`rover_api`) is a flat module of free functions —
`move_forward`, `turn_left`, `read_distance`, `collect_sample`, `log`, etc.
This was chosen over an object-oriented `Rover` class because KS3 pupils meet
functions before classes; forcing object instantiation would conflate the
curriculum goal with object-oriented mechanics they have not been taught
(decision log, 2026-05-26). Every function clamps bad input (NaN, infinity,
out-of-range) to a safe default and never raises, so a beginner's mistake
produces a warning, not a crash.

A subtlety is that a procedural surface must reach a stateful engine. This is
solved with a **module-level binding** (`runtime.binding`): `app.py` installs
the active rover/world, and `rover_api` consults the binding at call time.
The same indirection lets the headless test suite and the grader drive the
engine without a UI.

## 3.4 Deterministic simulation

`engine.terrain` defines four terrains (Earth, Mars, underwater, space), each
with its own gravity, friction and drag constants. `engine.physics` wraps
Pymunk to build a walled arena and detect collisions; `engine.rover` performs
dead-reckoning motion and models battery drain (per metre, per degree turned,
and a penalty per collision). Because the same inputs always produce the same
trace, the grader and the test suite can assert exact outcomes.

## 3.5 Tracing, grading and hinting

A single abstraction underpins feedback, grading and replay: the
**tracer** (`runtime.tracer`). Every API call appends an `Event` (name,
arguments, result, a rover-state snapshot, and a collision/kind tag). From
one trace, three features are derived:

- **Grading** (`lessons.grader`) compares aggregates of the trace (samples
  collected, collisions, battery used, distance, final position) and an AST
  analysis of the source against the lesson's declared `success_criteria`,
  yielding a pass/fail verdict, a 0–100 score and a per-criterion reason
  list. The grader is *pure* — lesson + tracer + source in, result out — so
  it is trivially testable with synthetic "golden" traces.
- **Hinting** (`memory.hint_engine`) runs 24 rule predicates over a
  `HintContext` (lesson, source, events, grade result) and surfaces the
  first match. Rules are entirely offline and deterministic.
- **Replay** reconstructs a tracer from its JSON (`Tracer.from_json`) and
  scrubs through it in the replay dialog.

## 3.6 Lessons as data

Lessons are declarative YAML validated by a Pydantic schema
(`lessons.schema`): identity, key stage, CT concepts, curriculum references,
starter code, allowed constructs, the world definition and the success
criteria. Twelve lessons ship in the bundled library; teachers (or the
optional local AI) can author more without touching Python. Keeping lessons
as data is what makes the grader and hint engine generic.

## 3.7 Pupil-progress memory

`memory.store` is a single SQLite file under `~/.robolearn/` — backup is a
file copy, and nothing leaves the machine. It records pupils, submissions and
a per-concept exponential-moving-average strength score. `memory.pupil_model`
reads that to recommend the next lesson and to drive the teacher dashboard's
class heatmap. `memory.achievements` adds sixteen achievements and a daily
streak. `memory.report` renders a self-contained offline HTML progress
report for evaluation evidence.

## 3.8 Safety: sandbox and executor

Pupil code is untrusted. `runtime.sandbox` walks the AST and rejects unsafe
imports and builtins before execution; `runtime.executor` then runs the
snippet in a daemon thread with a hard wall-clock timeout, folding every
failure mode (syntax, runtime, sandbox violation, timeout) into a structured
result rather than propagating an exception. A CPython async-exception is
used to break a runaway thread out of its bytecode loop so the test suite and
the app shut down cleanly.

## 3.9 The decisive design choice: feedback coupled to Run

The most consequential design decision (decision log, 2026-05-30) is that
**grading happens automatically at the end of every Run**, not behind a
separate Submit button. The pupil presses one button, watches the rover
move, and is immediately told whether the mission was met, why not, what to
try next, and what they earned. This is the formative-assessment loop made
unmissable; the [evaluation](../developers/evaluation.md) explains why a
heuristic review identified the *absence* of this loop as the single biggest
weakness of an earlier build.

The sequence below shows the full path of one Run, from the button press to
every feedback channel firing:

```mermaid
sequenceDiagram
    actor Pupil
    participant Editor
    participant Sandbox as Sandbox + Executor
    participant Tracer
    participant Sim as Sim animation
    participant Grader
    participant Feedback as Console / hint / sound / store

    Pupil->>Editor: press Run
    Editor->>Sandbox: execute(source)
    Sandbox->>Tracer: record each rover-API call as an Event
    Sandbox-->>Editor: ExecutionResult (ok / error)
    Editor->>Sim: animate the recorded events (tween)
    Sim->>Grader: on finish, grade(lesson, tracer, source)
    Grader-->>Feedback: GradeResult (passed, score, reasons)
    Feedback->>Pupil: verdict banner + score; hint on fail; sound; confetti
    Feedback->>Feedback: persist submission, update strengths, unlock achievements
    Feedback->>Pupil: recommend the next lesson
```

## 3.10 User interface

The UI is Tkinter with the Sun-Valley theme. The main window hosts an editor
(syntax-highlighted `tk.Text`), a simulation canvas (native `tk.Canvas`
drawing, chosen after an earlier `PhotoImage` approach painted blank on some
Tk builds), sensor read-outs, a lessons list, and a console with a hint/verdict
banner. Accessibility (`ui.a11y`) adds text scaling, a high-contrast toggle
and keyboard shortcuts, persisted offline.
