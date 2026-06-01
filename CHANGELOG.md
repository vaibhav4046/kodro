# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Closed the learning loop (P0).** Pressing **Run** now grades the
  attempt the moment the animation ends: the console prints a pass/fail
  verdict with a 0–100 score and one line per unmet criterion, the hint
  card surfaces the first matching rule from the offline hint engine on
  failure (and clears on success), the submission is persisted to the
  SQLite store (code, trace, score, battery, collisions), the rolling
  per-concept strength model is updated, and any freshly-earned
  achievement fires a toast. Previously the pupil ran code and the app
  said nothing — the single biggest gap surfaced by the 100-persona QA.
- **Run now always records its trace.** `_reset_clicked` re-asserts the
  active `Tracer`, state provider and engine bindings before every
  execution, so a detached module-global tracer can no longer silently
  swallow a run's events (some headless integration tests were passing
  vacuously because of this).

### Added
- **Two new KS4 stretch lessons** (12 bundled in total): `11_decomposition`
  (break a patrol into named helper subroutines) and `12_abstraction`
  (use `obstacle_ahead()` as a sensor abstraction to avoid a crash),
  each with DfE/BCS curriculum references and failure hints.
- **Accessibility pass.** Text-size controls (`A-` / `A+`) rescale the
  editor, console and hint fonts; a high-contrast toggle switches the
  console to pure black-on-white; both preferences persist offline to
  `~/.robolearn/a11y.toml` and reapply on launch. New keyboard shortcuts:
  `F5` (also `Ctrl+Enter`) run, `Esc` stop, `Ctrl+R` reset. The settings
  logic is Tk-free and unit-tested (`robolearn.ui.a11y`).
- **Pass/fail verdict banner** in the hint card: a green "✅ Mission
  complete! Score N/100" on success, the matching hint (amber) or an
  orange "Not passed yet" nudge on failure. The success case used to just
  blank the card, so finishing felt like nothing happened.
- **At-a-glance progress strip** in the top bar — daily streak, lessons
  passed and last score — refreshed after every Run so the reward for
  finishing is always visible (`_refresh_progress`).
- **Step** advances the rover one trace event per click and grades when
  the trace is exhausted; **Stop** halts an in-flight animation or step
  session. Both are wired through `EditorCallbacks`.
- **First-run welcome wizard** is shown on first launch (guarded by a
  `~/.robolearn/config.toml` sentinel) and persists the pupil's chosen
  display name via the new `Store.set_display_name`.
- **P1 polish:** Sun-Valley (`sv-ttk`) theme applied globally so ttk
  widgets pick up a modern look on Windows / macOS / Linux. Splash
  screen displayed for ~250 ms at launch
  (`robolearn.ui.splash.show_splash`). Per-terrain particle effects
  (`engine.particles`): grass for Earth, dust for Mars, bubbles for
  Underwater, stars for Space. Particles render under the rover sprite
  in the SimPanel canvas.

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
- Top-level app wiring (`robolearn.app`):
  - `build_app()` wires the `MainWindow` shell to the editor, sim,
    sensors, lessons, console and hint-card panels; registers the
    active `Tracer` + `RoverSnapshot` provider; and binds the
    teacher-dashboard shortcut.
  - `launch()` calls `build_app()` and enters Tk's main loop.
  - `python -m robolearn` now opens the full UI instead of a placeholder.
- `HUMAN_TODO.md` enumerates the three deliverables the autonomous
  build deliberately leaves to a human: recording the README demo GIF,
  conducting the 5-8 teacher evaluation study, and tagging `v1.0.0`
  once both are complete.
- `docs/teachers/curriculum-mapping.md` finalised as the full lesson
  table with DfE / BCS programme-of-study references.
- Lesson library content polish (`lessons/library/*.yaml`):
  - Every lesson now cites the exact attainment-target text from
    DfE-00191-2013 (KS3) or DfE-00094-2015 (KS4) plus the BCS
    Csizmadia et al. (2015) computational-thinking guide.
  - `docs/teachers/curriculum-mapping.md` rewritten as a full
    lesson-by-lesson table plus a CT-concept × lesson coverage
    matrix and a recommended teaching order.
- First-run welcome wizard (`ui.welcome_wizard`):
  - Four-step modal `Toplevel` asking display name, age band, key
    stage, and starting terrain.
  - `WizardResult` dataclass surfaces the answers to the parent UI
    via the optional `on_complete` callback.
  - Coverage gate raised from 75% to 85% per the autonomous-mode
    override after Task 18.
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
