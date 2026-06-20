# The Realism System

This document describes how Kodro makes its simulation honest: how the robot a
user builds drives behaviour, how commands are gated by fitted parts, how a
program is validated across a randomised spread, and what is shown on the
realism dashboard. Each part is labelled with its honest status.

The guiding principle is that the robot is not cosmetic. Its specification is a
single source of truth the rest of the system reads, so changing the build
changes the behaviour.

## 1. RobotSpec and the command registry (Status: working)

The Robot Lab assembles a robot from a board, sensors and actuators and derives
its mass, top speed, battery life and the set of commands it can run
(`RobotLab.jsx`, `derive()`).

The single command registry lives in `window.KodroCommands` (defined in
`RobotLab.jsx`). It maps every part-gated command to the part that must be
fitted:

| Command | Requires part |
| --- | --- |
| `read_distance()` / `sensor()` | ultrasonic |
| `read_heading()` / `tilt()` | imu |
| `see()` | camera |
| `locate()` | gps |
| `on_line()` | line follower |
| `bumped()` | bumper |
| `grab()` | gripper |

`KodroCommands.check(robot, name)` returns either `{ok: true}` or
`{ok: false, reason}` with a readable explanation. `KodroCommands.availability`
returns the full list for the UI. Every surface reads this one registry:

- The interpreter host (`app.jsx`, `host.sensor`) throws the readable refusal
  when a program calls a command whose part is not fitted, so text and blocks
  are gated identically.
- The assistant is given `KodroCommands.groundingText(robot)` in its prompt, so
  the model is told which commands to use and which to refuse; the runtime gate
  and the self-test are the deterministic backstop for any code source.

The effect: remove a sensor in the Robot Lab and its command genuinely
disappears from every way of programming the robot, rather than returning a
faked reading.

## 2. Movement dynamics (Status: working, kinematic)

Movement is a believable kinematic model, not a rigid-body solver (see
[`known-limitations.md`](known-limitations.md)). Within `app.jsx`,
`animateMove` integrates a mass-scaled trapezoidal velocity profile:

- The robot ramps up to a cruise speed, holds it, then brakes. A heavier build
  (higher `massFactor`) has a longer acceleration and a longer braking phase,
  so it visibly lags a light one.
- Momentum carries between consecutive straight moves (`s.vel`): a straight run
  flows, while a turn or a wait bleeds the momentum so the next move
  re-accelerates from rest.
- Turns are mass-scaled and eased rather than snapping.

The profile is normalised so the endpoint of every move is exact
(`coverFrac(1) === 1`), which means distances and collision detection are
unchanged and the headless interpreter QA (which uses its own kinematics) is
unaffected. Battery drain scales with mass, gravity and terrain traction; a
collision halts the robot and records a reflection.

## 3. Scenario validation and domain randomisation (Status: working)

`scenario.jsx` (`window.KodroScenario`) runs one program through the same
interpreter, headless and with no animation, many times. Each run draws
friction, robot mass, sensor noise and obstacle placement from a seeded
deterministic random source, so a seed reproduces a run exactly and a behaviour
that survives the spread is the one to trust. This follows domain randomisation
(Tobin et al., 2017).

A scenario is data: `scenarioId`, `environmentPreset`, `startPose`, `goalPose`,
`obstacles`, `terrainMaterial`, `seed`, `successCriteria`,
`randomizationConfig`. Each run reports `reachedGoal`, `collisions`,
`timeToGoal`, `batteryUsed`, `minObstacleDistance`, `commandErrors`,
`sensorFailures` and a `finalScore`, and the aggregate reports success rate,
mean collisions, mean time, mean battery and mean score.

Reports persist offline two ways:

- **localStorage** via `KodroMemory.saveScenarioReport` (web).
- **SQLite** via `Store.save_scenario_run` and the bridge method
  `save_scenario_run` (desktop). See `tests/unit/test_store.py` for the
  round-trip tests.

The "Validate" button in the studio runs the current program across five
seeds, prints the spread to the console, and opens the dashboard.

## 4. The realism dashboard (Status: working)

`realism.jsx` (`window.KodroRealism`, the "Realism" button) is a read-only
panel with five cards, each reading a single source of truth so a viewer sees
the spec actually matters:

- **Robot physics**: mass, top speed, acceleration, terrain friction, battery.
- **Sensors**: the fitted sensors and whether noise is randomised.
- **Scenario score**: the last validation aggregate (success, collisions,
  time, battery, seed).
- **Environment**: preset, lighting, gravity, friction, moving-agent count.
- **Command registry**: available commands and disabled ones with the reason.

## 5. The grounded assistant and the guaranteed fallback (Status: working)

The assistant suggests code only from the registry and is asked to refuse a
command whose part is not fitted. A user can point Kodro at any local model
they have installed (DeepSeek, Nemotron, Qwen, a custom fine-tune) through the
model picker in the Vibe panel; the choice persists to
`~/.robolearn/ai_models.json` and is honoured by both the drafter and the
quality model. When no model is present, a deterministic rule engine takes over
within a fixed time budget, so the platform stays fully usable offline.

## 6. The onboarding agent (Status: working)

The first-run flow lets a user describe a robot in words or by voice. The
description is mapped onto the validated parts catalogue
(`RobotLab.fromText` / `buildFromText`, `window.KodroRobotFromText`), so the
agent can only ever produce a buildable robot. It never emits executable code;
the output is data, validated field by field, with anything unknown dropped.

## 7. What is not real (Status: roadmap)

To keep the claims honest:

- Motion is kinematic, not rigid body. The tested Pymunk wrapper is not yet on
  the visible hot path.
- The viewport uses procedural geometry with core lighting; there is no glTF or
  URDF import and no post-processing chain.
- "Real-world" data is shipped as offline, real-world-derived content (curated
  scenarios and component values), not live API calls. The offline constraint
  is a hard requirement, so there is no network dependency anywhere on the
  critical path.

See [`roadmap.md`](roadmap.md) for the planned work and
[`ca2-demo-script.md`](ca2-demo-script.md) for the guided demo that exercises
the whole loop.
