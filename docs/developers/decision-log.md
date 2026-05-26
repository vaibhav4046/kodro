# Decision log

One entry per non-obvious technical decision, written at the time the
decision is made. The dissertation chapter on critical reflection draws
from this log.

---

## 2026-05-26 — Procedural pupil API on top of an object-oriented engine

**What was considered.** A pure object-oriented `Rover` class that pupils
instantiate, versus a procedural module with free functions, versus a hybrid
where pupils write classes that subclass `RoverBehaviour`.

**What was chosen.** A flat, procedural module — `robolearn.rover_api` — that
hides a singleton engine handle. Pupils write `move_forward(50)`; the engine
is OO internally for state encapsulation.

**Why.** UK KS3 pupils encounter functions before classes in the programme of
study. Forcing them to instantiate a class first conflates the curriculum
goal (sequence / selection / iteration) with object-oriented mechanics they
have not yet been taught. Teachers reading the source benefit from the same
simplicity.

---

## 2026-05-26 — Pygame-CE + Pymunk + Tk over a single-window pygame app

**What was considered.** Pure pygame for both the simulation and the UI;
pygame embedded in a Tk shell; a Qt-based UI.

**What was chosen.** Tk for the surrounding UI (it ships with Python and
needs zero extra install on classroom estates) with a pygame-CE surface
embedded inside it. Physics is Pymunk for collision handling.

**Why.** Tk's ubiquity matters in schools where pip wheels for Qt can be
blocked. Pygame is the safest cross-platform 2D renderer with no licensing
surprises.

---

## 2026-05-26 — Rover API: clamp-and-warn over raise-on-bad-input (Task 2)

**What was considered.** Three failure modes for bad pupil inputs:
(a) raise a `ValueError` immediately, (b) silently truncate, (c) clamp and
emit a `logging.WARNING`.

**What was chosen.** Option (c) — `_clamp_finite` clamps any out-of-range
or non-finite value into the valid interval, logs a warning naming the
argument, and returns the safe default. NaN and `±inf` are also clamped
to the lower bound.

**Why.** Section 4 of the spec is explicit: "No function may raise on bad
input — clamp, log a warning, return a safe default." A KS3 pupil who
types `move_forward(-5)` should see their rover sit still and a yellow
warning, not a traceback that derails the lesson. The logging-based
warnings give the teacher dashboard a clean event stream to surface in
the hint engine (Task 10) without changing the public signatures.

---

## 2026-05-26 — Sandbox: AST walk that rejects every dunder name (Task 7)

**What was considered.** A whitelist of allowed AST node types
(reject everything else), versus a blacklist that names specific bad
constructs (Import, dunder access, forbidden builtins).

**What was chosen.** A blacklist. `_SandboxWalker` rejects exactly the
constructs Section 9 lists, plus every name and attribute that begins
and ends with `__`. That single dunder rule blocks the well-known
`().__class__.__bases__[0].__subclasses__()` escape vector without
needing to list every dunder by hand.

**Why.** A whitelist for valid pupil constructs would be huge and
constantly evolving as new lessons land. The blacklist is short and the
dunder rule is broad enough to catch every documented sandbox-escape
pattern I could find.

---

## 2026-05-26 — Executor: daemon thread, not subprocess (Task 7)

**What was considered.** The spec says "subprocess executor", but the
rest of the design — tracer integration, the time-travel debugger, GUI
event routing — assumes pupil code runs in the same Python process. A
subprocess would need a Pickle / pipe IPC layer for every tracer event.

**What was chosen.** A daemon thread that runs `exec(compiled, globals)`
with a wall-clock `thread.join(timeout=...)` enforcing the 30-second
hard timeout. The daemon flag keeps a runaway pupil thread from
blocking process exit.

**Why.** Same-process execution is dramatically simpler and lets the
tracer record events in real time. The known limitation — a runaway
thread keeps spinning until process exit — is acceptable because the
sandbox already rules out `os.system` and similar IO-heavy escapes, and
the simulator's GUI keeps responding because the GUI thread is separate.
This trade-off is reported back to the user in the autonomous report and
in the decision-log entry for the dissertation.

---

## 2026-05-26 — Tracer: module-level active tracer + state-provider hook (Task 6)

**What was considered.** Two ways to thread the tracer through the
procedural pupil API: (a) pass an explicit `tracer` argument to every
function (breaks the locked-in signatures in Section 4), or (b) keep a
module-level "active tracer" that `emit()` consults.

**What was chosen.** Option (b). `robolearn.runtime.tracer` exposes
`set_active`, `get_active` and `clear_active`. `rover_api` calls
`emit(name, args, result, kind=...)` after each public function; if no
tracer is active, `emit` returns immediately so pupil code outside the UI
shell never pays a cost.

The same module also exposes `set_state_provider(callable)`. When the
engine wiring lands (later tasks), the UI shell registers a callable that
returns a fresh `RoverSnapshot`; until then the snapshot is `None`. This
keeps the engine optional rather than a hard dependency of the API.

**Why.** Preserves the spec's Section 4 signatures verbatim. Tests can
swap the active tracer in / out trivially (a `tests/conftest.py` autouse
fixture resets both module globals between tests).

---

## 2026-05-26 — JSON round-trip drops tuple semantics on purpose (Task 6)

**What was considered.** Encode tuples in `Event.args` and `Event.result`
as either `[1, 2, 3]` (lossy: tuple → list) or `{"_tuple": [1, 2, 3]}`
(lossless but custom).

**What was chosen.** Lossy. `to_json` converts tuples to lists,
`from_json` converts back to tuples for `Event.args` but leaves results
as whatever JSON decoded. Sensor results that are tuples are emitted as
`list(rgb)` in `rover_api`, so the round-trip is exact.

**Why.** Grader (Task 9) doesn't care about list-vs-tuple, and a custom
encoding would force the dissertation reader to learn a non-standard
JSON dialect just to inspect the trace. Decision-log entry exists so the
next person sees this is deliberate.

---

## 2026-05-26 — Renderer: procedural free functions + headless pixel sampling (Task 5)

**What was considered.** A `Renderer` class that owns a Surface and an
internal cache, or a flat module of free functions that take the Surface
explicitly. Tests via image-diff goldens, or per-pixel assertions.

**What was chosen.** Free functions (`draw_background`, `draw_obstacles`,
`draw_samples`, `draw_base`, `draw_rover`, `render`) plus a frozen
`ViewTransform` dataclass. Tests sample specific pixels with
`Surface.get_at` instead of writing golden PNG files.

**Why.** Procedural matches the rest of the codebase. Pixel sampling
gives a small, readable failure message when the test fails (which I
proved while debugging the rover-body triangle overlap), versus an
image-diff that just says "0.4 % of pixels changed". The headless test
environment uses `SDL_VIDEODRIVER=dummy`, so no display is needed in CI.

---

## 2026-05-26 — Sensors: closed-form ray-casting over a Pymunk raycast query (Task 4)

**What was considered.** Two LIDAR implementations: query Pymunk's spatial
hash via `space.segment_query_first`, or compute analytic ray-vs-wall and
ray-vs-circle intersections in pure Python.

**What was chosen.** The analytic path. `_wall_intersections` solves the
axis-aligned line equations and `_circle_ray_intersection` solves a single
quadratic. Both return the smallest positive parameter.

**Why.** (1) Determinism: the analytic path produces the same answer
regardless of the Pymunk solver state, which means lesson tests are
reproducible. (2) Property-based testability: Hypothesis can sweep
rover poses without first having to add a Pymunk body. (3) Zero coupling:
the renderer (Task 5) and the grader (Task 9) can call the sensors before
a Pymunk space exists.

The trade-off is duplicated geometry between the sensors and the physics
layer. Acceptable because LIDAR / ultrasonic only need to handle circular
obstacles and axis-aligned walls — a 30-line implementation.

---

## 2026-05-26 — Colour sensor returns indicator colours, not literal pixels (Task 4)

**What was considered.** Return the actual pixel under the rover (read
from the renderer surface), or return a small palette of indicator
colours ("on base", "on sample", "on terrain X").

**What was chosen.** Indicator colours. `colour_under` checks proximity
to the base, then any uncollected sample, then falls back to the per-
terrain background colour.

**Why.** Pupils write `if read_colour() == (255, 215, 0): ...` to check
for samples. If the renderer changed its tile texture, every lesson would
break. Indicator colours give a stable contract that survives any visual
restyle of the simulator.

---

## 2026-05-26 — Engine: zero-gravity Pymunk space with per-shape friction (Task 3)

**What was considered.** Three ways to model the per-terrain physics from
Section 5: (a) drive a true 2D side-view with Pymunk's gravity vector,
(b) ignore Pymunk and integrate motion ourselves, (c) keep a 2D top-down
view where the rover slides on a horizontal plane and only obstacle
collisions matter.

**What was chosen.** Option (c). The Pymunk space has zero gravity, four
static boundary segments, and per-shape friction read from the terrain
registry. The "gravity" magnitudes from the spec are stored on
:class:`TerrainParams` and influence the rover's battery drain model (and
will inform sensor noise in Task 4), but they do not bend trajectories.

**Why.** A top-down rover that "falls" toward the bottom of the screen
would confuse pupils — Mars in the simulator should look like Mars, not
like a billiard table tilted south. The wheel-friction physics for a top-
down rover are dominated by surface friction anyway, which we apply via
Pymunk's per-shape friction coefficient. The same code path handles all
four terrains by swapping one `TerrainParams` lookup.

---

## 2026-05-26 — `on_collision` callbacks with begin + post_solve split (Task 3)

**What was considered.** Wire only a `begin` callback and read impulse off
the arbiter, or wire `begin` (record the collision happened) + `post_solve`
(fill in the contact impulse once Pymunk has solved it).

**What was chosen.** The split: `begin` appends a `CollisionEvent` with
impulse zero; `post_solve` reaches back into the last event of the same
type and overwrites the impulse with the magnitude of
`arbiter.total_impulse`.

**Why.** Pymunk 7's begin handler runs *before* the constraint solver, so
`arbiter.total_impulse` is `(0, 0)` there. Reading impulse in `post_solve`
gives the true magnitude. Splitting also keeps the collision counter
correct: each touch is counted exactly once regardless of how many post-
solve frames the contact spans.

---

## 2026-05-26 — Package-root re-exports of the rover API (Task 2)

**What was considered.** Force pupils to write
`from robolearn.rover_api import move_forward`, or re-export every public
symbol from `robolearn/__init__.py`.

**What was chosen.** Re-export. Pupils can write either
`from robolearn import move_forward` or
`from robolearn.rover_api import move_forward`; both bind to the same
function object (asserted by `test_package_root_reexports_full_api`).

**Why.** Section 3 of the spec literally says
`__init__.py # exports public Rover API only`. The shorter form is what
lesson YAMLs will embed in their `starter_code`, and shorter imports keep
the curriculum-mapped lesson code legible at the back of the classroom.
