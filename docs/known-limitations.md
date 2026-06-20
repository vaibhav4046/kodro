# Known Limitations

This page lists what Kodro does not do yet, written honestly so users
and contributors can plan around the gaps. Each item is framed as
something we are working toward, not something broken with no path
forward. The companion [`roadmap.md`](roadmap.md) tracks the planned
work, and [`implementation-status.md`](implementation-status.md) gives
the per component status table.

## Movement is kinematic, not rigid body

The rover and all moving agents in the 3D viewport advance via a hand
written kinematic tick. There is no rigid body solver, no contact
forces, no friction model in the runtime. A car banks and a rover
throws its weight around because the per type motion code fakes the
feel, not because a physics engine resolves forces. Collisions are
detected as overlap events and recorded, not resolved with impulses.
The motion does now model mass-scaled acceleration, a cruise phase,
braking and momentum carry-over between straight moves, so a heavier
build visibly accelerates and stops more slowly, but this is still a
kinematic profile rather than a force solver.

We are working toward wiring a real rigid body engine into the
production runtime; see the Pymunk item below and the roadmap.

## Pymunk engine exists but is not wired into the production runtime

The Python package ships a `PhysicsSpace` wrapper around `pymunk.Space`
in `src/robolearn/engine/physics.py` that builds boundary walls, places
the rover and obstacles, and records collisions via begin and
post-solve handlers. It is exercised by the Python test suite and used
by the Python grader. It is not, however, what the web UI runs. The
shipped desktop app renders and steps the world through the vendored
JavaScript interpreter, which is kinematic. So the pymunk code path is
real but not on the hot path a user sees when they press Run in the
studio.

We are working toward a runtime where the pymunk space drives the
visible motion, so the Python engine and the viewport agree on physics.

## No GLTF model loading, procedural geometry only

Robots, obstacles, terrain features and agents are all built from
procedural geometry generated in code: boxes, cylinders, spheres,
extruded shapes and canvas textures. There is no asset loader for
GLTF, GLB, OBJ or any interchange format. You cannot drop a real robot
URDF or a Blender export into the scene and have it appear. This keeps
the app fully offline and zero dependency on asset pipelines, but it
caps visual fidelity and blocks importing real hardware models.

We are working toward a Blender to glTF asset workflow and URDF import
for real robot models; see the roadmap.

## No post-processing

The viewport renders with core Three.js: an environment map, shadow
maps and tone mapping. There is no bloom, no screen space ambient
occlusion, no depth of field, no motion blur, no anti aliasing pass
beyond what the browser provides. The look is clean and readable but
not cinematic.

We are working toward a measured, optional post-processing chain that
does not compromise the offline or low hardware guarantees.

## Robot spec gating (now complete)

The Robot Lab derives a robot specification from the parts you choose,
and a single command registry (`KodroCommands` in `RobotLab.jsx`) is the
source of truth for which commands the build supports. Gating is now
enforced for every part-gated command, the ultrasonic and distance
sensor plus the IMU, camera, GPS, bumper, line follower and gripper,
across the text editor, the blocks palette, the voice route and the
grounded assistant. A program that calls a command whose part is not
fitted gets a readable refusal rather than a faked reading, and the
assistant is told the same registry so it refuses too. The remaining
gap is that some part-gated commands (camera, GPS, bumper, line) are
recognised and refused by the registry but are not yet fully simulated
in the runtime, so they are validation-gated rather than fully playable.

## Arena size mismatch between the JS and Python engines

The in-browser JavaScript interpreter runs the rover in a 30 metre
arena, while the Python engine and grader work in a 10 metre world.
Both engines run every bundled lesson and the conformance test passes,
because the lesson criteria are scale tolerant, but the mismatch means
a program tuned visually in the web UI may score differently under the
Python grader. The metres to centimetres scaling in the interpreter
mitigates this for motion but not for arena boundary behaviour.

We are working toward a single shared arena definition so the two
engines agree on the world size.

## Voice is Windows-only without faster-whisper

The voice button has two paths. With `faster-whisper` installed it
transcribes speech on any OS using a local model, fully offline.
Without `faster-whisper` the path falls back to the Windows SAPI speech
recognizer, which is Windows only and depends on the OS language pack.
On macOS or Linux without `faster-whisper`, voice input is not
available. The deterministic phrase parser that turns a transcript into
a rover line works everywhere once it has text.

We are working toward making `faster-whisper` the default path on all
platforms and documenting the install.
