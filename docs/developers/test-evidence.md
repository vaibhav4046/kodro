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
