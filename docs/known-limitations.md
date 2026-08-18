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
in `src/kodro/engine/physics.py` that builds boundary walls, places
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
`distance()`, the IMU read `heading()` (with its `tilt` reading) and the
line follower read `on_line()`, are gated end to end: the text editor,
the blocks palette and the grounded assistant all refuse the call with a
readable message when the part is not fitted, rather than faking a
reading, and the assistant is handed the same registry so it refuses
too. All three are real bound builtins. They sit in the interpreter's
`SENSOR_METHODS` and `LESSON_SENSOR` tables
(`assets/web/interpreter.js`), the host answers them from world state
(`on_line` reads 1 on the synthesized practice line and 0 off it), and
each of the three parts carries a `cmd` entry in the catalogue so the
gate has something to check.

The other catalogue parts, the camera, GPS, bumper and gripper, are real
fitted hardware: they add mass and change how the build
accelerates, brakes and drains its battery, so choosing them still
changes the behaviour. What they do not yet have is a runnable command
binding (`see()`, `locate()`, `bumped()`, `grab()`), and no part entry
for them carries a `cmd`. The
catalogue used to advertise those commands, which then failed with a
confusing "name is not defined" instead of a clean refusal, so they have
been removed from the advertised set and from the assistant's grounding:
nothing is promised that the runtime cannot honour. Implementing those
four bindings is a
near-term roadmap item. Until then the honest position is that gating is
enforced for the commands that exist, and the remaining parts are
hardware that shapes the build without a dedicated command.

## Arena bounds: one free-play box, per-world bounds everywhere else

There is no single arena size, because the two engines answer two
different questions. Free play runs in a fixed square defined by
`arenaHalfExtentCm: 1500` in the shared motion model
(`assets/web/motion-model.js`, and the same entry in its Python twin
`engine/motion_model.py`). That is a half extent of 1500 cm: 15 metres
in each direction from the start point, 30 metres across. A graded
world instead carries its own rectangle as data. On the Python side it
comes from the lesson YAML through `WorldDef.width`/`height`
(`lessons/schema.py`) into `ArenaBounds` (`engine/world.py`), and
`Rover.move` clamps to it and counts the clamp as a wall collision. The
bundled lessons range from 6 x 6 to 10 x 10 metres; the 10 metre figure
is only the schema default, not a size every lesson uses. The bench
world (8 x 8) and the proof contracts set their own bounds again.

The two engines do agree where it matters. Once a lesson is loaded the
studio sim stops using the free-play box: `app.jsx` builds a `bounds`
rectangle from the lesson's own width, height and base offset, and
`sim-physics.js` falls back to the symmetric half extent only when no
`bounds` is present, so the walls the pupil hits are the walls the
grader marks. The browser lesson grader clamps with the same
`min(max(t, 0), width)` form as the Python `Rover.move`
(`assets/web/lesson-grader.jsx`). So the 30 metre box is a free-play
property, not a scoring divergence.

What remains is that free play and a graded run are genuinely different
worlds. A program tuned in the open studio box can meet a wall much
earlier inside a 6 x 6 metre lesson arena, and nothing in the UI warns
about that before the run.

## The shared motion model and what the KRS import honours (M2)

Milestone 2 replaced the four hand-rolled kinematic replicas (the JS tick,
the Python engine, the scenario validator and the self-test) with ONE
shared motion model: `assets/web/motion-model.js` and its Python twin
`engine/motion_model.py`. The two constant tables are hash-gated in CI
(`test_motion_model_conformance.py`) and the engines are behaviour-gated by
a golden-trace corpus (`test_golden_traces.py`), which closed the old 11x
per-metre / 12.5x per-degree battery divergence. The Python engine now also
registers real collisions (obstacle sweeps and wall contact), so the
`no_collisions` lesson criterion grades what actually happened.

An imported KRS spec (Robot Lab, Import spec) drives the simulation through
three disclosed tiers, surfaced as badges in the Lab, the Realism dashboard
and the verification report:

- HONOURED: commanded distances and angles; motor-derived top speed
  (v = rpm/60 x 2 pi r) WHEN it lands inside the simulable band (a build
  outside the band drops to APPROXIMATED and the sim speed is disclosed, see
  below); sensor mount pose and range (z ignored) IN THE STUDIO SIM only, the
  Python engine rays from the rover centre with a fixed range; the collision
  circle from the body footprint; command availability; and the battery as a
  hard budget.
- APPROXIMATED: first-order acceleration/braking (a trapezoid, not F=ma
  integration), turn timing from track geometry, three traction bands, and
  the constant-power battery model (no voltage sag, no thermal derating).
- NOT SIMULATED: slopes (the max-slope figure is reported, never driven),
  wheel-level slip and torque curves, suspension/3D contact, per-motor
  current transients, IMU acceleration content, and the
  camera/GPS/bumper/gripper command semantics above.

The Ackermann minimum turn radius (wheelbase/tan(steer)) is REPORT-ONLY in
v1: the sim still turns in place (or on its fixed display arc for the car
type). A build whose real top speed falls outside the simulable band is
simulated at the band edge, NOT at its true speed, so its top-speed badge is
APPROXIMATED (never HONOURED) and the warning states the real direction: a
slow build below 0.94 m/s is simulated FASTER at the 0.94 m/s floor, and a
fast build above 6.25 m/s is simulated SLOWER at the 6.25 m/s ceiling. The
studio's readable speed range is calibrated around the 3.125 m/s anchor.

### Formula parity vs simulation parity (M1)

The two engines are locked at two levels. The constant table is hash-gated
(`test_motion_model_conformance.py`, E-C4) and the catalogue behaviour is
golden-trace gated (`test_golden_traces.py`, E-P2). As of this pass the
physical-mode CLOSED FORMS are gated too: the fourteen `phys*` functions plus
`sensorPose` were ported from `motion-model.js` into `engine/motion_model.py`
and `test_physical_golden_trace.py` runs the JS twin over the shipped
Reference Rover and fails on any drift, so an imported build's DERIVED NUMBERS
(top speed, stall force, mobility, acceleration, energy, runtime, slope, turn
timing, stopping distance, sensor pose) are provably identical across the two
engines.

What is still JS-only is the full measured-build SIMULATION, not the formulas.
The Python `engine/sensors.py` rays originate at the rover centre and use fixed
module ranges (`LIDAR_MAX_RANGE_M`, `ULTRASONIC_MAX_RANGE_M`); they do not yet
consume the imported `rangeCm` or the sensor mount offset, and `rover_api.py`
does not import a KRS spec's mass/rpm/battery. So a measured build is simulated
end to end only in the JS studio; the Python engine reproduces the derived
numbers and grades catalogue-mode motion. The HONOURED sensor-pose/range line
above is therefore scoped to the studio sim.
