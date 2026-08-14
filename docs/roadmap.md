# Roadmap

This is the forward plan for Kodro, ordered roughly by the order we
expect to take the work on. Nothing here has a date attached, because
this is a research project and the timeline depends on what the
evaluation and the next milestone turn up. Each item links back to the
limitation it addresses in [`known-limitations.md`](known-limitations.md)
where one exists.

Reconciled against the code on 14 August 2026. Three items had drifted:
two were substantially built while still listed as forward work, and one
described a blocker that turned out not to be the real one. Those are
marked in their headings and kept rather than deleted, with the part that
genuinely remains stated, because an item that quietly vanishes leaves no
record of what was decided. What ships today is in
[`implementation-status.md`](implementation-status.md); if the two files
disagree, the code decides and both are wrong until fixed.

## URDF import for real robot models

Today every robot is built from procedural geometry in the Robot Lab.
The first step toward real hardware fidelity is an URDF importer that
reads a robot description, builds the joint tree, and surfaces it in
the viewport and the rover API. This unblocks using published robot
models (Turtlebot, fetch, etc.) directly in Kodro.

## Webots, Gazebo and Isaac research bridge

Kodro is not a replacement for the established simulators and never
will be. The useful relationship is a bridge: export a Kodro robot
spec and a program, then hand them off to Webots, Gazebo or Isaac Sim
for high fidelity validation, and pull the results back. This keeps
Kodro offline and lightweight while opening a path to rigid body
physics and photoreal rendering when a user needs them.

## Blender asset workflow for glTF models

A companion to URDF import. A documented pipeline for authoring robot
parts, terrain props and obstacles in Blender, exporting glTF, and
loading them into the viewport. This addresses the no GLTF loading
limitation and lets contributors ship real assets without writing
procedural geometry.

## Rigid body physics, wiring Pymunk into the runtime

The pymunk wrapper already exists in the Python engine and is tested.
The work is to make it the source of truth for motion in the shipped
runtime, so the viewport reflects real contact forces, friction and
collision response instead of the kinematic tick. This is the largest
single change on the roadmap because it touches the interpreter, the
viewport and the grader at once.

## Full sensor gating

The gating machinery is built and the item's original framing was wrong
about what remains. `COMMAND_PART` in `RobotLab.jsx` maps three parts to
commands: ultrasonic gates `distance()`, `read_distance()` and `scan()`,
the IMU gates `heading()`, `read_heading()` and `tilt()`, and the line
sensor gates `on_line()`. A build without the part gets a readable refusal
across text, blocks and the assistant.

Camera, GPS and bumper are fitted in the Robot Lab and carry mass, so they
change the derived speed and runtime, but none of them appears in
`COMMAND_PART`, because none of them exposes a command in the interpreter
to gate. The work left is therefore not gating. It is deciding what a
camera, a GPS fix and a bumper contact should mean in a teaching subset
that is deliberately small, then implementing those commands in both
engines and gating them the way the existing three already are.

## ROS2 bridge

A ROS2 bridge so a Kodro program can publish to real ROS topics and
subscribe to real sensor streams. This is explicitly not in the code
today and is a long way out, because it pulls in a heavy dependency
stack that fights the offline guarantee. The likely shape is an
optional, separate package that talks to a running ROS2 daemon over a
local socket.

## Richer domain randomization (largely delivered)

This landed while the roadmap still listed it as forward work.
`scenario.jsx` runs a program over seeded repeats, varying friction, robot
mass, sensor noise and obstacle placement per run from a
`randomizationConfig`, and reports the spread rather than a single verdict.
Results persist to localStorage and to SQLite through
`Store.save_scenario_run`.

Two things named in the original item are still absent. Lighting is not
randomised, because nothing in the grading path reads it. And the
randomisation runs in the scenario validator, not in ordinary lesson
marking, so a pupil's graded attempt is still a single deterministic run
against a fixed world. Making randomised validation part of marking is a
pedagogical decision before it is an engineering one: a lesson that
sometimes fails for reasons the pupil cannot see is worse than a lesson
that is easy to game.

## Model selection UI (mostly delivered)

The listing and the memory both shipped. `ai-web.jsx` queries Ollama's
`/api/tags` for what is actually installed, and `setModel` writes the
choice to `kodro_web_model` in localStorage and forwards it to the desktop
bridge, so the pick survives a reload. The hardcoded preference order is
now only the fallback for when the user has not chosen, and the rule
engine still catches the case where Ollama is absent.

What is left is the smaller half of the original item: picking the drafter
and the critic independently. Today both roles run on the one selected
model. The reviewer's propose-then-critique loop would be more honest with
two different models, since a model critiquing its own draft agrees with
itself more than it should.

## Advanced scene generation

A procedural scene generator that takes a target difficulty and a
robot type and builds a world to match: obstacle density, pedestrian
count, terrain roughness, sample placement. This turns the three
handcrafted worlds (City, Room, terrain) into a continuous space the
refinement loop can draw from.
