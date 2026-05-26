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
- Teacher dashboard (`ui.teacher_dashboard`):
  - `Ctrl+Shift+T` opens a `Toplevel` window with three areas: the
    class-wide concept-strength heatmap, a per-pupil drill-down
    listing submissions and EMA scores, and an "Export CSV" button.
  - CSV export writes `pupil_id,display_name,<concept-1>,<concept-2>,...`
    so a teacher can drop the file straight into Excel / Sheets.
  - PDF export is deferred (see `docs/developers/known-issues.md` and
    `HUMAN_TODO.md`).
- Time-travel debugger (`ui.replay_dialog`):
  - Modal `Toplevel` with a `ttk.Scale` slider that scrubs through a
    `Tracer`'s recorded events.
  - Each scrub renders the event's name, args, timestamp and (if
    available) the `RoverSnapshot` captured at that frame.
  - Optional `on_scrub` callback notifies the parent UI when the
    pupil moves the slider.
- Console + hint card panels (`ui.console_panel`):
  - `ConsolePanel`: read-only `tk.Text` with four colour-coded log
    levels (info / warn / error / hint), timestamps, and a line counter.
  - `HintCardArea`: balloon-style label rendered with a lightbulb prefix;
    shows the highest-priority hint returned by the hint engine.
- Right-hand panels (`ui.sensors_panel`, `ui.lessons_panel`):
  - `SensorsPanel`: heading, battery, LIDAR distance, under-rover colour
    and samples-collected rows backed by `tk.StringVar`s; updated by the
    parent UI via `update_from_rover(rover)`.
  - `LessonsPanel`: scrollable `tk.Listbox` of lessons plus a pupil-
    progress drawer; exposes `set_lessons`, `select(index)`,
    `selected_lesson()` and `update_pupil_memory(strengths)`.
- Simulation panel (`ui.sim_panel`):
  - Embeds an in-memory pygame surface in a `tk.Label` via base64-PPM
    bytes -- avoids the brittle `SDL_WINDOWID` trick and works under
    `SDL_VIDEODRIVER=dummy` for tests.
  - `set_world(world, rover)` binds engine state and renders one frame;
    `render_once` is idempotent without a bound world; `clear` paints
    a blank background.
  - Optional `SimCallbacks.on_frame` fires after every successful
    render so an outer loop can observe simulation progress.
- Code editor panel (`ui.editor_panel`):
  - `tk.Text` widget wired to a regex highlighter (keywords, rover-API
    builtins, strings, comments, numbers).
  - Run / Step / Stop / Reset toolbar buttons fire `EditorCallbacks`.
  - `apply_palette` re-themes the editor in lockstep with the rest of
    the UI.
- Tk main-window shell + theme system (`ui.main_window`, `ui.theme`):
  - `Palette` and `ThemeSettings` dataclasses; three built-in themes
    (`dark` / `light` / `high_contrast`) and a dyslexia-friendly font
    toggle (Atkinson Hyperlegible default).
  - `MainWindow` arranges five named slots (`topbar`, `editor`, `sim`,
    `sensors`, `console`) and exposes `set_slot` / `get_slot`,
    `apply_theme`, and an `on_open_teacher_dashboard` callback bound to
    `Ctrl+Shift+T`.
  - CI: Linux runner installs `xvfb` and wraps `pytest` with
    `xvfb-run -a`; Windows / macOS runs `pytest` directly.
- Pupil-progress memory layer (`memory.store`, `memory.pupil_model`,
  `memory.hint_engine`):
  - SQLite `Store` with `pupils`, `submissions` and `concept_strength`
    tables; EMA update embedded in `update_concept_strength(alpha=0.3)`.
  - `PupilStrength` model with `update_on_submission`,
    `passing_streak`, `weakest_concepts`, `suggest_next_lesson` (with
    stretch-lesson promotion after 5 consecutive passes) and a
    `class_heatmap` mapping for the teacher dashboard.
  - Hint engine ships 24 rules covering: empty submissions, starter-code
    unchanged, while-with-no-progress, `while True` without break,
    multiple / single collisions, battery drained, negative move
    arguments, excessive turns, missing iteration / selection / function
    / recursion constructs, missing `collect_sample`, drives-only,
    turns-only, very-few-steps, distance-zero, exceeded max_lines,
    disallowed construct, missing `at_base` check, defined-but-not-
    called functions, missing sensor reads for sensor lessons, and
    collision-prone last action.
  - Coverage gate raised to 75% per the autonomous-mode override.
- Lesson auto-grader (`lessons.grader`):
  - `grade(lesson, tracer, source)` returns a `GradeResult(passed,
    reasons, score)` -- pure function, no engine handle required.
  - Aggregates derived from the trace: samples collected, collisions,
    distance travelled, max battery used, step count, final position.
  - Per-criterion checks for every field of `SuccessCriterion`
    (samples_collected, no_collisions, max_battery_used, uses_construct,
    returns_to_base, max_steps, min_distance_travelled).
  - AST walk detects each `AllowedConstruct`; recursion detected via a
    function's `Call` nodes referencing its own name.
  - Score starts at 100, deducts 20 per failing criterion, never below 0.
- Lesson schema + YAML loader (`lessons.schema`):
  - Pydantic models for `Lesson`, `WorldDef`, `ObstacleDef`,
    `SuccessCriterion`, `HintRules`, all with `extra="forbid"` to catch
    YAML key typos.
  - `KeyStage`, `CTConcept` and `AllowedConstruct` literal types pinned
    to the values listed in Section 6 of the spec.
  - `load_lesson` / `load_library` helpers; the bundled library auto-
    detects via `DEFAULT_LIBRARY_DIR`.
  - 10 lesson YAML files rewritten from placeholders to schema-compliant
    content (sequence / selection / iteration / functions / sensors /
    pathfinding / recursion / optimisation) — full curriculum text
    polish lands in Task 19.
- Sandbox + executor subsystem (`runtime.sandbox`, `runtime.executor`):
  - AST walker that rejects `import` / `from ... import`, double-underscore
    attribute / name access, and a fixed list of forbidden builtins
    (`open`, `eval`, `exec`, `compile`, `getattr`, `setattr`, `globals`,
    `locals`, `__import__`, `exit`, `quit`, `input`, `vars`, `delattr`,
    `breakpoint`).
  - `SandboxViolation` dataclass reports the kind, name and line number of
    each rejected construct.
  - `restricted_globals` exposes every public `rover_api` symbol plus
    `range`, `len` and `print` (rewired to `rover_api.log`).
  - `execute` sandbox-checks, compiles and runs pupil code in a daemon
    thread with a 30-s hard timeout; failures (`sandbox`, `syntax`,
    `runtime`, `timeout`) are returned as a structured `ExecutionResult`.
  - 33 hostile snippets and 13 legitimate snippets are exercised
    end-to-end in `tests/integration/test_sandbox_isolation.py`.
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
