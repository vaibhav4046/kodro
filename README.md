# Kodro: An Offline AI-Assisted Robotics Design and Simulation Platform

[![CI](https://github.com/vaibhav4046/robolearn/actions/workflows/ci.yml/badge.svg)](https://github.com/vaibhav4046/robolearn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)

**Design a robot. Program it. Validate its behaviour in a realistic simulation. All offline, on one laptop.**

Kodro is a self contained desktop studio. You build a custom robot from
real parts, write its behaviour in code, blocks or plain language, and
validate it in a 3D world chosen to suit it. The system reflects on each
run and refines what it suggests next. It runs entirely on your own
computer with no account and no cloud.

Kodro is for a capable non expert adult who wants to design and test robot
behaviour without a lab, a kit, or a cloud subscription.

> This repository accompanies an MSc research project (COMP702, University
> of Liverpool). The specification and design proposal is in
> [`docs/ca1/`](docs/ca1/) and the dissertation in
> [`docs/dissertation/`](docs/dissertation/).

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
- **Not cloud-connected.** Zero paid services, zero API calls, zero
  accounts. The local AI assistant talks only to an Ollama model on
  `localhost`, and falls back to a deterministic rule engine when
  Ollama is absent.
- **Not a childrens coding toy.** It assumes a capable non expert adult.

## The loop

```
  design  ->  program  ->  validate  ->  refine
    |           |             |            |
  Robot Lab   code /        a 3D world   localStorage
  boards,     blocks /      picked for   reflections
  sensors,    with a        the robot:   and saved
  actuators   grounded      city, room,  skills feed
  and type    local AI      or terrain   the next run
```

1. **Design.** In the Robot Lab you assemble a robot from a board,
   sensors, actuators and a chassis type (rover, car, home or arm).
   Kodro derives its mass, top speed and runtime from the parts you
   choose.
2. **Program.** Write procedural Python against a small, readable API,
   stack Scratch style blocks that compile to that same Python, or
   describe the behaviour and let a local AI model draft it. A code
   reviewer and an ask panel sit alongside the editor.
3. **Validate.** Kodro recommends the world that fits the robot and
   drops it in: a self driving car gets the City with one way traffic,
   pedestrians and a crossing; a home or arm robot gets the Room with
   furniture; a rover gets planetary terrain. You orbit the scene 360
   degrees and watch it drive with weight transfer, banking and
   suspension rather than sliding.
4. **Refine.** Every run is recorded. The memory layer reflects on
   outcomes and keeps the skills you save, so the studio gets more
   useful from your own verified work. This is honest, system level
   self refinement in localStorage, not retraining of any model
   weights.

## Features

What actually ships in this repository, verified against the test suite:

- **Robot Lab.** Build a custom robot from real parts and let Kodro
  derive its physical envelope and recommend a world for it.
- **Three ways to program, all offline.** A Python subset interpreter,
  a blocks editor that emits the same Python, and an optional local AI
  assistant (Ollama on `localhost`, a small 3 to 4B open model) with a
  deterministic rule based fallback when Ollama is absent.
- **Realistic worlds.** A City with looping one way traffic and
  pedestrians that brake for your robot, a furnished Room, and
  planetary terrains. Built in code with Three.js (core only), an
  environment map, shadows and tone mapping.
- **Natural motion.** Per type motion feel so a car throws its weight
  around, a heavy rover stays measured, a humanoid stays upright, and
  a fixed arm does not pitch as it works.
- **Self refinement memory.** A localStorage memory of reflections and
  saved skills that informs later sessions. No cloud, no accounts, no
  model retraining.
- **Telemetry.** Live heading, battery, LIDAR distance and samples
  collected, plus a compass dial and arc gauges in the sensors rail.
- **Procedural sound effects.** Every cue (drive, turn, scan, LED,
  speech, pass, fail, crash) is synthesised at runtime with the Web
  Audio API or the standard library. No audio files, no network.
- **Curriculum lessons.** Eighteen bundled lessons mapped to the UK
  DfE / BCS computing programme of study, from KS1 through KS4
  stretch, each with success criteria and offline hints.
- **Strictly offline.** Zero paid services, zero API calls, zero
  accounts.

For what is partial, experimental or only on the roadmap, see
[`docs/implementation-status.md`](docs/implementation-status.md).

## Screenshots

The first run landing, with the brand mark and the positioning:

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

Download `RoboLearn.exe` from the
[latest release](https://github.com/vaibhav4046/robolearn/releases/latest)
and run it. It is a self contained windowed app (WebView2). Everything
works immediately except the optional AI assistant, which needs a local
model (next section).

### Option 2: From source (Windows, macOS, Linux)

Requires Python 3.12+ and Node.js (Node only if you want to rebuild the UI).

```bash
git clone https://github.com/vaibhav4046/robolearn.git
cd robolearn
pip install -e ".[dev]"
python -m robolearn.web   # modern web UI in a native window (pywebview)
```

### Optional: the local AI assistant (Ollama)

The Vibe, Review and Ask panels use a local model through
[Ollama](https://ollama.com/download). Without it the app still works
fully; those panels fall back to a deterministic rule engine. To enable
the assistant:

1. Install Ollama for your OS from <https://ollama.com/download> and
   start it (it serves on `localhost:11434`).
2. Pull a small code model (3 to 4B runs on a normal laptop):

   ```bash
   ollama pull qwen2.5-coder:3b     # good default
   # or: ollama pull gemma3:4b
   ```

3. Start Kodro. It auto detects whatever model Ollama has and shows it
   in the Vibe panel; you can switch models there. Nothing ever leaves
   your machine: the only network peer the app will talk to is
   `localhost:11434`.

The web UI is pre compiled to a single `bundle.js`, so the desktop app
loads plain JavaScript with no build server and no network. To rebuild
after editing any `.jsx` source:

```bash
node scripts/build_web.cjs
```

To build the standalone Windows executable:

```bash
python scripts/build_exe.py    # -> dist/RoboLearn.exe (windowed WebView2 app)
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
| Web UI | Vendored React and Three.js r137, pre compiled to `bundle.js` | `src/robolearn/assets/web/` |
| Interpreter | Python subset, compiles to a generator of motion and sensor events | `src/robolearn/assets/web/interpreter.js` |
| Worlds and motion | City, Room and terrains, type aware robots, natural motion tick | `Viewport3D.jsx`, `terrains.jsx`, `agents.jsx` |
| Robot Lab and memory | Parts catalogue, world recommendation, self refinement | `RobotLab.jsx`, `memory.jsx` |
| Python engine | Metres world, pymunk and pygame-ce physics, public rover API | `src/robolearn/engine/`, `rover_api.py` |

A fuller diagram and chapter by chapter design are in
[`docs/dissertation/`](docs/dissertation/).

## Quality

Measured, not asserted. Reproduce both locally:

```bash
node scripts/qa_interpreter.mjs   # interpreter and kinematics functional QA
python -m pytest                  # Python engine test suite
```

- **Interpreter QA: 156 of 156 passing.** Every shipped example program
  terminates, moves, stays inside the arena box, never hits a wall and
  never throws. Command semantics (metres versus centimetres, turn,
  speed clamp, guarded huge exponents, for and while, sensors), Python
  parity edge cases (chained comparison, division by zero, banker's
  rounding, range validation) and malformed input handling are all
  asserted.
- **UI regression net.** `node scripts/qa_ui.mjs` drives the real
  bundle in headless Chrome: six studio flows, five behaviour asserts
  (the rover measurably moves, blocks insert real code, errors surface,
  worlds are distinct) and a render check for every modal.
- **Python engine: 869 tests passing**, coverage gated at
  `--cov-fail-under=85` on every push.

The honest marker assessment of the project to date is a strong A. An A
star band depends on the empirical teacher and user study, which only a
real run can produce; see [`HUMAN_TODO.md`](HUMAN_TODO.md).

## Documentation

Full docs live in [`docs/`](docs/) and are served via MkDocs Material:

```bash
mkdocs serve -f docs/mkdocs.yml
```

For the boundaries of what Kodro does and does not do, read:

- [`docs/known-limitations.md`](docs/known-limitations.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/implementation-status.md`](docs/implementation-status.md)

## Acknowledgements

Submitted in partial fulfilment of COMP702 at the University of
Liverpool. Parts of the implementation and documentation were produced
with AI assistance, disclosed in the dissertation.

## Licence

Released under the [MIT Licence](LICENSE).
