# Kodro

Kodro is an offline robot coding and kinematic simulation app for pupils
aged 5 to 16, teachers, and beginners. Write or adapt a program, then
watch a robot try it in a visual test world.

**[Open Kodro in your browser](https://vaibhav4046.github.io/kodro/)**

![Kodro front door with four routes into learning, design, free play and lesson authoring](docs/design/kodro-home.png)

## Choose your route

| I want to... | Start with |
| --- | --- |
| learn Python step by step | **Learn to code**, then open **Drive to the Flag** |
| choose motors, batteries and sensors | **Design a robot** |
| experiment without a score | **Free play** |
| draw an arena and set a class task | **Make a lesson** |

### Try the first lesson

1. Open the live app and choose **Learn to code**.
2. Open **Drive to the Flag**.
3. Predict where `move_forward(1)` will stop.
4. Change the distance, press **Run**, then read the goal feedback.

No account is required. Core design, coding, simulation and lesson paths run
without AI.

From a cloned repository, one command starts the local browser version:
`python scripts/demo.py`.

## What you can make

Three examples:

- a wheeled rover that follows a route and avoids obstacles
- a self-driving car design tested in Riverside City
- an indoor personal robot tested around furniture in the Living Room

Kodro supports learning and early design comparison. It does not certify
a physical robot, electrical safety, mechanical fit, or safe deployment.

## At a glance

- **For pupils:** guided lessons, visible goals, offline hints and a worked
  answer after the hints run out.
- **For teachers:** a scheme of work, printable worksheets, a first-lesson
  card, an answer key and a lesson authoring studio.
- **For makers:** a robot parts catalogue, Python editor, visual worlds and
  provisional build evidence.
- **For privacy:** no account and no mandatory network call for the core paths.

[Teacher first-lesson card](docs/teachers/first-lesson-card.md) |
[Scheme of work](docs/teachers/scheme-of-work.md) |
[Pupil API cheatsheet](docs/pupils/api-cheatsheet.md)

## Project status

The hosted app runs in the browser and can work offline after its first
load. `Kodro-windows.exe` puts that same interface in a native window over
the local Python engine. The `Kodro-windows-tk.exe` fallback shares the
engine but not the interface: it is a Tk application with its own layout,
and its feature set differs in places, most visibly the teacher dashboard.
Core design, coding, simulation, and lesson paths need no account or AI.

> This repository accompanies an MSc research project (COMP702, University
> of Liverpool). The specification and design proposal is in
> [`docs/ca1/`](docs/ca1/) and the dissertation in
> [`docs/dissertation/`](docs/dissertation/).

[![CI](https://github.com/vaibhav4046/kodro/actions/workflows/ci.yml/badge.svg)](https://github.com/vaibhav4046/kodro/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/vaibhav4046/kodro/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/vaibhav4046/kodro/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)

## What Kodro is NOT

Kodro is a research and teaching studio, not an industrial simulator. To
set honest expectations up front:

- **Not a production robotics simulator.** It is a desktop research and
  learning tool, not a deploy-time validation pipeline.
- **Not a replacement for Isaac Sim, Gazebo, Webots or MuJoCo.** Those are
  heavyweight physics simulators with rigid body dynamics, contact
  solvers and ecosystem support. Kodro does kinematic motion with a
  hand written tick. See [`docs/known-limitations.md`](docs/known-limitations.md).
- **Not ROS2.** There is no ROS2 bridge, topic publisher or message
  types. A bridge is on the roadmap, not in the code.
- **Not cloud-connected by default.** No account is ever required and
  nothing leaves your machine on the default path: the local AI
  assistant talks only to an Ollama model on `localhost`, and falls
  back to a deterministic rule engine when Ollama is absent. You may
  optionally connect a free-tier key (Groq, or OpenRouter's free
  models) for a stronger model; that key stays in your browser, is sent
  only to the provider you pick, and is never required.

## The three-stage loop

```text
Design  ->  Prove  ->  Build
 parts      program    provisional brief
 spec       contracts  assumptions and limits
 commands   manifests  competent-person checks
```

1. **Design.** Assemble a catalogue robot or import measured values.
   Kodro derives its mass, motion envelope, battery estimate, fitted
   command set and per-value fidelity disclosure.
2. **Prove.** Write or generate a program, choose a world and replay a
   declarative contract over controlled seeds. Kodro emits metrics, a
   deterministic verdict and a downloadable evidence manifest.
3. **Build.** Export a provisional brief that carries requirements,
   assumptions and simulation limits forward. Original datasheets,
   electrical protection and mechanical fit still require competent
   review before purchase or power-up.

Lessons, teacher progress, blocks, replay, history and simulation limits
remain available through **More Tools** without competing with the primary
journey. Expert mode exposes the full editor, console and evidence rail.

## Five-minute evidence demo

1. Open [the live build](https://vaibhav4046.github.io/kodro/) and choose **Design**.
2. Change a part and inspect the resulting capability and fidelity changes.
3. Choose **Prove**, run the program, then run the five-seed proof.
4. Inspect the contract metrics and download the evidence manifest.
5. Open **Simulation limits** from **More Tools** and state the kinematic boundary.
6. Choose **Build** and inspect the provisional build brief.

The demo does not establish real-world equivalence, electrical safety,
classroom efficacy or a guaranteed frame rate.

## Features

What currently ships in this repository:

- **Robot Lab.** Build a custom robot from example hobby parts and let Kodro
  derive its physical envelope and recommend a world for it.
- **Three ways to program, all offline.** A Python subset interpreter,
  a blocks editor that emits the same Python, and an optional local AI
  assistant (Ollama on `localhost`, a small 3 to 4B open model) with a
  deterministic rule based fallback when Ollama is absent.
- **Visual test worlds.** A City with looping one way traffic and
  pedestrians that brake for your robot, a furnished Room, and
  planetary terrains. Built in code with Three.js (core only), an
  environment map, shadows and tone mapping.
- **Type-specific visual motion.** Per type motion feel so a car throws its weight
  around, a heavy rover stays measured, a humanoid stays upright, and
  a fixed arm does not pitch as it works.
- **Local experience memory.** Reflections and saved skills can inform
  later suggestions. Storage and retrieval are implemented; a causal
  reduction in design iterations has not been demonstrated.
- **Telemetry.** Live heading, battery, LIDAR distance and traction, plus a
  compass dial and arc gauges in the sensors rail.
- **Procedural sound effects.** Every cue (drive, turn, scan, LED,
  speech, pass, fail, crash) is synthesised at runtime with the Web
  Audio API or the standard library. No audio files, no network.
- **Curriculum lessons.** Twenty-four bundled lessons mapped to the UK
  DfE / BCS computing programme of study, spanning KS1 through KS4
  and weighted to KS3 and KS4: 3 lessons are tagged KS1, 4 are KS2, 9 are
  KS3 and 8 are KS4 stretch. Each has stated goals and offline hints. Each lesson is graded on
  the run you watch, in the lesson's own world. The independent audit that
  found the earlier visible-world and grading mismatches is kept as a dated
  record in [`AUDIT_CODEX.md`](AUDIT_CODEX.md).
- **Every lesson is provably finishable.** Each ships one worked answer,
  shown to a pupil only after the hints run out. Those answers are not
  editorial: an automated gate runs all twenty four through *both* marking
  engines on every change and requires 100 out of 100, inside the constructs
  that lesson has taught and inside its own line budget
  (`tests/unit/test_lesson_solutions.py`, plus the solvability block in
  `scripts/qa_grader.mjs`). A lesson whose own answer fails does not ship.
- **Lesson Studio: write your own.** Draw an arena by clicking, choose what
  counts as finished, write the starter and one answer, and set it for a
  class. Authored lessons are graded by the *identical* criterion dispatch
  as the bundled ones, appear in the library marked "Made here", and export
  to a single `.kodrolesson` file you can send to anyone. You cannot save a
  lesson until your own answer passes it, which is the same bar the built-in
  twenty four are held to.
- **Offline by default.** No account, paid service or mandatory network
  call is required for Design, Test, lessons or deterministic checking.
  Local Ollama is optional, and cloud models are an explicit
  bring-your-own-key connected mode.

For what is partial, experimental or only on the roadmap, see
[`docs/implementation-status.md`](docs/implementation-status.md).

## Product loop

This loop is captured from the real application and shows the primary
Design, Prove and Build stages.

![Kodro Design, Prove and Build loop](docs/launch/kodro-loop.gif)

## More screenshots

The earlier first-run landing:

![Kodro onboarding landing](docs/img/onboarding_landing.png)

The studio: code editor on the left, the City world with looping
traffic, a crossing and the robot in the middle, and live telemetry on
the right.

![Kodro studio in the City world](docs/img/studio.png)

These are rendered from the real app (the WebGL viewport included) via
the offline capture script `scripts/build_screenshot_harness.cjs` plus
headless Chrome; see [`HUMAN_TODO.md`](HUMAN_TODO.md) for how to
regenerate them.

## Download and install

### Option 1: Windows executable (no Python needed)

Download the Kodro app (`Kodro-windows.exe`) from the
[latest release](https://github.com/vaibhav4046/kodro/releases/latest)
and run it. It is a self contained windowed app (WebView2). If WebView2
is unavailable, use the `Kodro-windows-tk.exe` fallback asset from
the same release; it runs the same Python engine behind a Tk interface
rather than this one, and
[`docs/teachers/classroom-setup.md`](docs/teachers/classroom-setup.md)
sets out where the two differ. Core design, coding, kinematic simulation,
and lessons do not require AI. Companion needs a local model or an explicitly selected
cloud provider.

### Option 2: From source (Windows, macOS, Linux)

Requires Python 3.12+ and Node.js (Node only if you want to rebuild the UI).

```bash
git clone https://github.com/vaibhav4046/kodro.git
cd kodro
pip install -e ".[dev]"
python -m kodro.web   # modern web UI in a native window (pywebview)
```

### Optional: the local AI assistant (Ollama)

The Companion and Review program tools can use a local model through
[Ollama](https://ollama.com/download). Without it the app still works
for core design, coding, simulation, and lessons; those tools fall back
to a deterministic rule engine. To enable the assistant:

1. Install Ollama for your OS from <https://ollama.com/download> and
   start it (it serves on `localhost:11434`).
2. Pull a small code model (3 to 4B runs on a normal laptop):

   ```bash
   ollama pull qwen2.5-coder:3b     # good default
   # or: ollama pull gemma3:4b
   ```

3. Start Kodro. It detects available Ollama models and shows them in
   Companion. Requests to local Ollama stay on `localhost:11434`. If you
   deliberately choose Groq or OpenRouter, the prompt is sent to that
   provider instead.

**Using the hosted web build with Ollama.** The desktop app needs none of
this. The browser build at
[vaibhav4046.github.io/kodro](https://vaibhav4046.github.io/kodro/)
is served from a different origin than `localhost`, so Ollama must be told
to accept requests from it. Start Ollama with that origin allowed:

- Windows: run `setx OLLAMA_ORIGINS "https://vaibhav4046.github.io"`, then
  restart Ollama.
- macOS or Linux: run `OLLAMA_ORIGINS=https://vaibhav4046.github.io ollama serve`.

Without this the browser build cannot reach your local model and falls back
to the deterministic rule engine.

The web UI is pre compiled to a single `bundle.js`, so the desktop app
loads plain JavaScript with no build server and no network. To rebuild
after editing any `.jsx` source:

```bash
node scripts/build_web.cjs
```

To build the standalone Windows executable:

```bash
python scripts/build_exe.py    # -> dist/Kodro.exe (windowed WebView2 app)
```

A one command demo is also available:

```bash
python scripts/demo.py        # serves on http://localhost:8080
```

## A first program

```python
# A rover that drives a square and leaves a trail.
rover.set_speed(60)
rover.pen_down()
for side in range(4):
    rover.forward(200)
    rover.turn_right(90)
```

Two call styles are both valid: bare `move_forward(2)` moves 2 metres,
while `rover.forward(200)` moves 200 cm in engine units. Press **Run**
and watch it drive; press **Step** to advance one event at a time.

## Architecture

| Layer | What | Where |
| --- | --- | --- |
| Web UI | Vendored React and Three.js r137, pre compiled to `bundle.js` | `src/kodro/assets/web/` |
| Interpreter | Python subset, compiles to a generator of motion and sensor events | `src/kodro/assets/web/interpreter.js` |
| Worlds and motion | City, Room and terrains, type aware robots, type-specific visual motion tick | `Viewport3D.jsx`, `terrains.jsx`, `agents.jsx` |
| Robot Lab and memory | Parts catalogue, world recommendation, self refinement | `RobotLab.jsx`, `memory.jsx` |
| Python engine | Metres world, pymunk and pygame-ce physics, public rover API | `src/kodro/engine/`, `rover_api.py` |

A fuller diagram and chapter by chapter design are in
[`docs/dissertation/`](docs/dissertation/).

## Quality

Measured, not asserted. Reproduce both locally:

```bash
node scripts/qa_interpreter.mjs   # interpreter and kinematics functional QA
python -m pytest                  # Python engine test suite
```

- **Interpreter QA: all checks pass** (180 at the candidate release state; reproduce
  with `node scripts/qa_interpreter.mjs`). Every shipped example program
  terminates, moves, stays inside the arena box, never hits a wall and
  never throws. Command semantics (metres versus centimetres, turn,
  speed clamp, guarded huge exponents, for and while, sensors), Python
  parity edge cases (chained comparison, division by zero, banker's
  rounding, range validation) and malformed input handling are all
  asserted.
- **UI regression net.** `node scripts/qa_ui.mjs` drives the real
  bundle in headless Chrome: six rendered flows, 41 behaviour assertions,
  six responsive layouts and 13 modal surfaces, written to
  [`docs/eval/ui_eval.json`](docs/eval/ui_eval.json) with the SHA-256 of the
  bundle they ran against. Run it with nothing else competing for the
  machine: the flows are driven against a single-threaded dev server on
  wall-clock timers, so concurrent load can time out an assert that passes
  on its own. `qa_worlds.mjs` adds 61 world, robot, quality, site and
  weather identity checks.
- **Python matrix.** Gated at 85 percent branch-aware coverage. The counts
  are not restated here, because a restated count goes stale the moment the
  suite grows: this bullet has carried a figure that the suite had already
  outgrown. They come out of the run's own coverage and JUnit output into
  [`docs/eval/test_suite.json`](docs/eval/test_suite.json), which records the
  commit and working-tree state they belong to. Read them there. The
  percentage is a floor: the harness drops the coverage contribution of
  node-subprocess tests on Windows outside CI while still running them, so
  CI measures the same suite at or above that figure. The skip count in that
  file is not stable on the development machine, and the file explains what
  is and is not established about it rather than offering a cause.
- **Deterministic Prove.** Four contracts pass 20 of 20 seeded runs,
  reproduce byte-identically and reject the deliberately broken controller.
- **Coverage gate.** `--cov-fail-under=85` on every push.

## KodroBench: measuring grounded code

A grounded local model must not invent commands outside the robot's fitted
set. KodroBench measures exactly that. It asks a model to write rover
programs for seeded tasks, then scores whether the program stays inside the
build's real command set (invention_rate, lower is better) and whether it
completes the task (success@N, higher is better). Full results and the
methodology are in
[`results/kodrobench-leaderboard.md`](results/kodrobench-leaderboard.md).

How to read the numbers: success@N is the mean seeded-task success over N
seeds (v0.1 runs 5 tasks over 10 seeds). The dev/heldout split is the same
task set divided by whether a task was visible while iterating, so heldout
success is the honest generalisation figure; invention_rate is the fraction
of runs that call a command the fitted robot does not have.

| Model | success@N | invention_rate |
| --- | --- | --- |
| gemma3:4b | 0.24 | 0.00 |
| deterministic | 0.22 | 0.00 |
| gemma3:1b | 0.02 | 0.00 |
| llama3.2:3b | 0.00 | 0.00 |
| kodro-fast:latest | 0.00 | 0.60 |
| kodro-coder:latest | 0.00 | 1.00 |

The honest story of these numbers is that the project's own fine-tunes are
the worst behaved. `kodro-fast` and `kodro-coder` invent `rover.*` commands
at 0.60 and 1.00 while never completing a task (0.00 success@N), whereas the
general models hold invention_rate at 0.00. The deterministic floor, a rule
engine with no model at all, scores 0.22 success@N: it beats every fine-tune
and comes within 0.02 of the best general model (gemma3:4b at 0.24). A
grounded rule engine is a strong baseline, and naive fine-tuning of tiny
models made grounding worse, not better, which is why the deterministic
fallback ships as the honest default.

Reproduce the benchmark yourself:

```bash
kodrobench --help                        # console script
python -m kodro.kodrobench --help    # module entry point
```

## MCP server: an assistant that marks the same way Kodro does

`kodro-mcp` is a Model Context Protocol server that exposes the lesson library,
the sandboxed interpreter and the grader to any MCP client. An assistant helping
a pupil can therefore run their program in the real world model and mark it with
the real grader instead of guessing, and a guess that contradicts the grader is
worse than no help at all.

```bash
kodro-mcp --list-tools     # the eight tools, printed to stderr
kodro-mcp                  # start the server (JSON-RPC 2.0 over stdio)
```

Register it with a client:

```json
{"mcpServers": {"kodro": {"command": "kodro-mcp"}}}
```

Eight tools: `list_lessons`, `get_lesson`, `run_program`, `grade_program`,
`check_api`, `validate_robot_spec`, `prove_contracts`, `pupil_progress`. Plus
resources for the API reference and every lesson brief.

It runs offline like everything else here. The transport is hand-rolled on the
standard library, because an MCP server that needed `pip install mcp` to start
would put a hole in the no-network claim. There is a test that monkeypatches
`socket` to raise and then calls every tool.

Details in [`docs/developers/mcp-server.md`](docs/developers/mcp-server.md).

## Documentation

Full docs live in [`docs/`](docs/) and are served via MkDocs Material:

```bash
mkdocs serve -f docs/mkdocs.yml
```

For the boundaries of what Kodro does and does not do, read:

- [`docs/known-limitations.md`](docs/known-limitations.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/implementation-status.md`](docs/implementation-status.md)

Teacher and pupil material:

- [First lesson card](docs/teachers/first-lesson-card.md)
- [Scheme of work](docs/teachers/scheme-of-work.md)
- [Printable worksheets](docs/teachers/worksheet-block-a-first-programs.md)
- [Teacher answer key](docs/teachers/answer-key.md)
- [Pupil API cheatsheet](docs/pupils/api-cheatsheet.md)

## Acknowledgements

Submitted in partial fulfilment of COMP702 at the University of
Liverpool. Parts of the implementation and documentation were produced
with AI assistance, disclosed in the dissertation.

## Licence

Released under the [MIT Licence](LICENSE).
