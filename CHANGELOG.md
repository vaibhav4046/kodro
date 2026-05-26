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
