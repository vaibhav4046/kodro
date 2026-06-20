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

The procedural surfaces are now shaded with generated relief, not just
flat colour. Each open terrain ground builds a tileable normal map
(Sobel derived from a height field) and a roughness map in canvas at
scene build time, so the sun and fill light graze real micro relief:
sand catches a sheen, regolith reads as pits, the seabed ripples. This
is still procedural geometry, but it closes a lot of the gap that made
the ground read as a flat plane.

A glTF or GLB loader stays on the roadmap rather than shipped because
it cannot be done under the hard offline rule today. Three.js ships
GLTFLoader only in its examples tree, which is not vendored here, and
the zero network constraint means it cannot be fetched and vendored in
this environment; and good interchange models would themselves need an
asset pipeline the offline build does not have. So the honest position
is: the renderer is procedural by design, now with real surface
shading, and an asset loader is future work, not a missing feature we
quietly skipped. See the roadmap for the Blender to glTF and URDF path.

## Post-processing (Cinematic tier only)

The Low, Medium and High tiers render with core Three.js: an
environment map, shadow maps and tone mapping, with no post pass beyond
what the browser provides. The Cinematic tier adds a small, hand
written, fully offline post chain: a bloom pass (bright pass plus a
separable Gaussian blur) and a vignette, composited on top of the
normal render. It is written directly against the core renderer with no
EffectComposer and no examples code, because those are not vendored and
cannot be fetched offline.

It is gated deliberately. It runs only at Cinematic, is disabled under
prefers-reduced-motion, and turns itself off if the slow hardware auto
downgrade fires or if the GPU cannot allocate the render targets, in
which case the view falls back to the plain render. So the offline and
low hardware guarantees hold: a basic laptop on Low or High is never
asked to pay for it. There is still no screen space ambient occlusion,
depth of field or motion blur; those remain future work.

## Robot spec gating: enforced for the implemented commands

The Robot Lab derives a robot specification from the parts you choose,
and a single command registry (`KodroCommands` in `RobotLab.jsx`) is the
source of truth for which commands the build supports. The commands that
are actually implemented in the interpreter, the ultrasonic range read
`distance()` and the IMU read `heading()` (with its `tilt` reading), are
gated end to end: the text editor, the blocks palette, the voice route
and the grounded assistant all refuse the call with a readable message
when the part is not fitted, rather than faking a reading, and the
assistant is handed the same registry so it refuses too.

The other catalogue parts, the camera, GPS, bumper, line follower and
gripper, are real fitted hardware: they add mass and change how the build
accelerates, brakes and drains its battery, so choosing them still
changes the behaviour. What they do not yet have is a runnable command
binding (`see()`, `locate()`, `bumped()`, `on_line()`, `grab()`). The
catalogue used to advertise those commands, which then failed with a
confusing "name is not defined" instead of a clean refusal, so they have
been removed from the advertised set and from the assistant's grounding:
nothing is promised that the runtime cannot honour. Implementing those
bindings, and gating a ground-colour read behind the line follower, is a
near-term roadmap item. Until then the honest position is that gating is
enforced for the commands that exist, and the remaining parts are
hardware that shapes the build without a dedicated command.

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
