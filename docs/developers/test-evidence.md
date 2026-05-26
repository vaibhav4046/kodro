# Test evidence

One line per demonstrable capability, appended as each task lands. Used by
the dissertation chapter on verification.

- **2026-05-26** — Repository scaffold installs cleanly and the smoke test
  asserts that `robolearn.__version__` exists, all subpackages import, and
  CI is green on Ubuntu, macOS and Windows
  (`tests/unit/test_smoke.py::test_package_exposes_version`).
- **2026-05-26** — All sixteen public rover-API functions return their
  documented safe defaults, never raise on bad input, and clamp
  out-of-range or non-finite values with a logged warning. 51 unit tests
  cover the full API surface and the package-root re-exports; coverage on
  `src/robolearn/rover_api.py` is 100 %
  (`tests/unit/test_rover_api.py`).
- **2026-05-26** — The auto-grader turns a recorded `Tracer` plus a
  `Lesson` plus the pupil source into a `GradeResult(passed, reasons,
  score)`. Aggregates pulled from the trace cover samples collected,
  collisions, battery use, distance travelled, step count and final
  position. AST walks detect every `AllowedConstruct` value, including
  recursion via self-name `Call` matching. 28 unit tests
  (`tests/unit/test_grader.py`) cover each criterion's pass / fail path
  plus the score arithmetic. Total suite: 330 tests, 93.3 % coverage.
- **2026-05-26** — The lesson YAML loader validates every required field
  via Pydantic and refuses unknown keys (`extra="forbid"`). All ten
  bundled lessons (`01_hello_rover` ... `10_optimisation`) parse with
  the expected `terrain`, `key_stage` and `ct_concepts`; loader returns
  them in file-name order so the curriculum sequence is stable. 29 unit
  tests in `tests/unit/test_lesson_schema.py` cover positive paths,
  negative paths (missing field, extra field, invalid enum value,
  negative obstacle radius) and the bundled library round-trip. Total
  suite: 302 tests, 92.5 % coverage.
- **2026-05-26** — The pupil-code sandbox rejects 33 hostile snippets
  covering every category the spec calls out (imports, `eval`/`exec`,
  `open`, `getattr`, `setattr`, `globals`, `locals`, dunder attribute
  walks, `__class__.__bases__[0].__subclasses__()` and friends) and
  accepts 13 legitimate snippets that cover sequence, selection,
  iteration, function definitions, simple data structures and the
  rewired `print` to `log`. The executor enforces a 30-s hard timeout in
  a daemon thread, surfaces sandbox / syntax / runtime / timeout failures
  with a structured `ExecutionResult`, and records every pupil call
  through the active tracer (sandbox violations short-circuit before any
  tracer event is emitted). 106 new tests
  (`tests/integration/test_sandbox_isolation.py`). Total suite: 273 tests,
  92 % coverage.
- **2026-05-26** — `runtime.tracer` records every pupil-API call as an
  `Event` with frame, monotonic millisecond timestamp, kind, name, args,
  result and an optional `RoverSnapshot`. Tracer logs round-trip cleanly
  through `to_json` / `from_json`. The pupil-facing `rover_api`
  functions now emit events into the active tracer; tests prove that
  clamped values are recorded (not the raw input), the event kind matches
  the operation category, sequence is preserved and the no-active
  fast-path skips the state provider. 22 new tests
  (`tests/unit/test_tracer.py`). Coverage: tracer at 100 %.
- **2026-05-26** — The renderer paints any combination of the four
  terrains, samples, obstacles and rover sprite onto a Pygame surface
  using procedural draw functions and a frozen `ViewTransform`. 17 unit
  tests pixel-sample the surface to prove: background colour per terrain,
  base indicator overrides terrain, sample indicator at sample pixel,
  obstacle pixel at obstacle centre, rover body grey at the rover
  position, render determinism (two renders produce byte-identical
  output) and the manual visual-check CLI is exposed via
  `python -m robolearn.engine.renderer --terrain mars`
  (`tests/unit/test_renderer.py`).
- **2026-05-26** — LIDAR, ultrasonic, colour and IMU sensors are
  implemented and property-tested. 23 unit tests (5 Hypothesis-based)
  prove: (a) LIDAR distance is monotonic w.r.t. obstacle presence,
  (b) ultrasonic distance is never greater than its 5-m ceiling,
  (c) colour-under always returns a valid RGB triple, (d) IMU heading
  always matches the rover heading, (e) obstacles behind the rover are
  ignored. Coverage gate raised from 0 to 60 per the autonomous-mode
  override after Task 4. Total suite: 128 tests, 92 % overall coverage
  (`tests/unit/test_sensors.py`).
- **2026-05-26** — The engine subsystem (terrain, world, rover, physics)
  is fully operational with 54 additional unit tests. The four terrains
  expose the spec's gravity / friction / drag constants verbatim; the
  Pymunk wrapper builds a four-walled arena, lets the rover collide with
  walls and obstacles, and records every contact via `begin` +
  `post_solve` handlers. Rover dead-reckoning, battery drain
  (0.1 %/m, 0.05 %/°, +1 %/collision) and sample collection all behave
  per Section 5 of the spec. Coverage: `terrain.py`, `world.py` 100 %,
  `rover.py` 99 %, `physics.py` 92 %.
