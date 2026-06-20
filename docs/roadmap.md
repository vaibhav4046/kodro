# Roadmap

This is the forward plan for Kodro, ordered roughly by the order we
expect to take the work on. Nothing here has a date attached, because
this is a research project and the timeline depends on what the
evaluation and the next milestone turn up. Each item links back to the
limitation it addresses in [`known-limitations.md`](known-limitations.md)
where one exists.

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

Extend the robot spec gating from the current ultrasonic and distance
sensors to the full set: IMU, GPS, camera and bumper. The AI assistant,
the blocks palette and the code reviewer should all refuse to propose
or accept a sensor call that the chosen robot does not carry.

## ROS2 bridge

A ROS2 bridge so a Kodro program can publish to real ROS topics and
subscribe to real sensor streams. This is explicitly not in the code
today and is a long way out, because it pulls in a heavy dependency
stack that fights the offline guarantee. The likely shape is an
optional, separate package that talks to a running ROS2 daemon over a
local socket.

## Richer domain randomization

The grader already runs lessons against the bundled worlds. Richer
domain randomization would vary obstacle placement, lighting, friction
coefficients and sensor noise across runs so a passing program is one
that generalizes, not one that memorized one layout. This is the
validation side of the self refinement loop.

## Model selection UI

Today the local AI assistant prefers Qwen 2.5 Coder and Gemma in a
hardcoded order and falls back to the rule engine when Ollama is
absent. A model selection UI would list the models Ollama reports as
installed, let the user pick the drafter and the critic independently,
and remember the choice. This makes the offline AI layer legible
rather than implicit.

## Advanced scene generation

A procedural scene generator that takes a target difficulty and a
robot type and builds a world to match: obstacle density, pedestrian
count, terrain roughness, sample placement. This turns the three
handcrafted worlds (City, Room, terrain) into a continuous space the
refinement loop can draw from.
