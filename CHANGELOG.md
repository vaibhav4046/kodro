# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial repository scaffold: directory tree, `pyproject.toml`, CI workflows,
  governance files, empty module stubs with docstrings.
- Public, procedural pupil-facing API
  (`robolearn.rover_api`) with all 16 locked-in signatures from Section 4
  of the build spec — driving, sensing, acting, plus a console `log()`.
  Inputs are clamped (NaN / ±inf / out-of-range → safe default, warning
  logged); no function ever raises. Package root re-exports every public
  symbol so `from robolearn import move_forward` works alongside the
  explicit `from robolearn.rover_api import move_forward`.
- Tracer subsystem (`runtime.tracer`):
  - `Event` and `RoverSnapshot` frozen dataclasses; the five `EventKind`
    literals from Section 10 of the spec (`call`, `sensor_read`,
    `collision`, `sample`, `battery`).
  - `Tracer` class with append-only event log, frame counter, monotonic
    `now_ms()` clock, and a `to_json` / `from_json` round-trip.
  - Module-level `set_active` / `get_active` / `clear_active` plus a
    `set_state_provider` hook so the engine can lazily attach
    `RoverSnapshot`s to each event.
  - `robolearn.rover_api` now emits an event after every public function:
    driving / waiting / beep / log are `call`, sensor functions are
    `sensor_read`, collect / drop are `sample`. Tuple sensor results are
    serialised as lists so the trace round-trips through JSON.
- Renderer subsystem (`engine.renderer`):
  - Procedural `draw_background` / `draw_obstacles` / `draw_samples` /
    `draw_base` / `draw_rover` / `render` free functions plus a frozen
    `ViewTransform` for world-to-screen mapping.
  - Four-terrain palette (earth / mars / underwater / space) reused from
    `engine.sensors` so rendered colours match `read_colour()` indicators.
  - Rover sprite is a grey body circle with a red heading triangle on top
    so even from a distance pupils can see which way the rover faces.
  - Optional grid overlay for the manual visual check.
  - CLI: `python -m robolearn.engine.renderer --terrain {earth,mars,underwater,space}`
    opens a demo window. Headless tests use `SDL_VIDEODRIVER=dummy` and
    `Surface.get_at` pixel sampling.
- Sensor subsystem (`engine.sensors`):
  - `lidar_distance`: configurable-angle LIDAR with closed-form ray casting
    against arena walls and circular obstacles.
  - `ultrasonic_distance`: forward-facing ultrasonic capped at 5 m.
  - `colour_under`: returns base / sample indicator colours or the
    per-terrain background colour for the four supported terrains.
  - `imu_reading`: returns a frozen `IMUReading` dataclass with heading and
    body-frame acceleration.
  - 23 unit tests (5 Hypothesis-based) cover sensor behaviour at boundary
    conditions; coverage gate raised from 0 to 60 per the autonomous-mode
    override.
- Engine subsystem with four modules:
  - `engine.terrain`: `Terrain` StrEnum (earth / mars / underwater / space)
    plus a `TerrainParams` lookup keyed by either enum or string name. The
    gravity / friction / drag constants from Section 5 of the spec live
    here in one place.
  - `engine.world`: `World`, `Sample`, `Obstacle`, `ArenaBounds`
    dataclasses, with convenience accessors for uncollected samples,
    completion check and base-distance.
  - `engine.rover`: `Rover` entity with `move`, `turn`, `try_collect`,
    `try_drop`, `register_collision`, `at_base` and the
    `RoverState` snapshot dataclass. Battery model implements the
    0.1 %/m, 0.05 %/°, +1 %/collision spec.
  - `engine.physics`: `PhysicsSpace` wrapper around `pymunk.Space` that
    creates the four boundary walls, places the rover and any obstacles,
    and records every collision via begin + post-solve handlers. Damping
    is set to `1 - drag` to model underwater resistance.
