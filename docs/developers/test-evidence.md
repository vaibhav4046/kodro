# Test evidence

One line per demonstrable capability, appended as each task lands. Used by
the dissertation chapter on verification.

- **2026-06-06** — Packaged-binary smoke check: the PyInstaller one-file
  build (`dist/robolearn.exe`, v0.59) was launched on Windows 11 and
  confirmed to start cleanly — a process with main-window title
  "RoboLearn" came up using ~73 MB, and `~/.robolearn/startup.log` recorded
  "robolearn package imported OK" with no fatal error. This verifies the
  shipped download imports its bundled package and opens its main UI window
  on a real desktop (the automated suite otherwise runs the UI headlessly).
- **2026-06-01** — Post-QA feature program (driven by the 100-persona
  review) shipped and verified across Linux/macOS/Windows CI:
  (a) **accessibility** — `robolearn.ui.a11y` text-scaling and
  high-contrast settings persist to `~/.robolearn/a11y.toml` and reapply
  on launch; `A-`/`A+` and the contrast toggle are covered by Tk-free unit
  tests plus a synchronous app test (`test_a11y.py`, `test_app.py`);
  keyboard shortcuts F5/Esc/Ctrl+R are bound. (b) **content** — the
  bundled library grows from 10 to 12 with two KS4 stretch lessons
  (decomposition, abstraction), schema-validated (`test_lesson_schema.py`).
  (c) **feedback** — a green pass / orange fail verdict banner and a
  top-bar progress strip (streak / passed / last score) are unit-tested
  (`test_console_panel.py`, `test_app.py`). (d) **audio** —
  `robolearn.ui.sounds` synthesises pass/fail/collect/collision tones from
  the standard library with a hard-guarded mixer that no-ops on
  audio-less machines, tested under SDL's headless `dummy` driver
  (`test_sounds.py`). A per-test `--timeout=120` was added to CI so a hung
  GUI test fails fast with a traceback instead of burning to the 6 h cap.
- **2026-05-30** — The learning loop is closed end-to-end: pressing **Run**
  now grades the attempt, logs a pass/fail verdict + 0–100 score, surfaces
  an offline hint on failure (clears on pass), persists the submission to
  SQLite, updates the per-concept strength model, and unlocks
  achievements. Nine new headless integration tests prove it on the real
  wired app: a criteria-free lesson records a passing submission, clears
  the hint card, and drains battery (proving the rover actually moved — no
  longer a vacuous pass); a sample lesson with non-collecting code records
  a failing submission and shows a hint; **Step** advances one trace event
  per click across turn/move/collect/drop/log/beep then grades; **Stop**
  flags + clears the session; the first-run wizard writes its sentinel and
  renames the pupil via `Store.set_display_name`. A latent bug was fixed in
  passing: `_reset_clicked` now re-asserts the active `Tracer` so a Run
  always records its events. Full suite: **621 passed, 1 skipped, 92.53 %
  coverage** (`tests/unit/test_app.py`, `tests/unit/test_store.py`).
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
- **2026-05-26** — `ui.teacher_dashboard` exposes a class heatmap,
  per-pupil drill-down, and CSV export. 8 unit tests cover empty
  store, populated store, pupil selection, CSV header + concept
  columns, the "no chooser path" silent branch and refresh
  idempotency.
- **2026-05-26** — `ui.replay_dialog` scrubs through a `Tracer`'s
  recorded events via a `ttk.Scale` slider; rendering each event's
  name, args, timestamp and captured `RoverSnapshot`. 8 unit tests
  cover empty-tracer fallback, clamp-to-bounds, snapshot rendering,
  `on_scrub` callback firing and `set_tracer` swap behaviour.
- **2026-05-26** — `ui.console_panel` exposes a colour-coded read-only
  log (`info` / `warn` / `error` / `hint`) and a hint-card balloon.
  9 unit tests cover line emission, level styling, the read-only
  Text state, and the hint card show/clear/current_rule lifecycle.
- **2026-05-26** — `ui.sensors_panel` displays a live rover read-out
  (heading, battery, LIDAR distance, under-rover colour, samples
  collected) backed by `tk.StringVar`s; the parent UI calls
  `update_from_rover(rover)` after each step. `ui.lessons_panel`
  exposes a lesson `Listbox` plus a pupil-progress drawer rendered
  from `PupilStrength` rows. 10 headless tests cover both panels.
- **2026-05-26** — The simulation viewport (`ui.sim_panel`) renders the
  engine state to a pygame surface, then converts the surface to PPM
  bytes and loads it into a `tk.PhotoImage`. 7 headless tests prove
  surface creation, world binding, optional `on_frame` callback,
  `clear` blanking, idempotent `render_once` with no bound world, and
  the PPM→PhotoImage conversion.
- **2026-05-26** — The code editor (`ui.editor_panel`) wraps a
  `tk.Text` widget, exposes `get_source` / `set_source` / `clear`, and
  a regex-driven syntax highlighter applies five tag categories
  (keyword / rover-API builtin / string / comment / number). Run / Step
  / Stop / Reset buttons fire registered `EditorCallbacks`. 15 unit
  tests (`tests/unit/test_editor_panel.py`) exercise round-trip
  source, palette switching and each button's callback wiring.
- **2026-05-26** — The Tk main-window shell installs a five-slot
  layout (`topbar` / `editor` / `sim` / `sensors` / `console`), applies
  a dark / light / high-contrast palette via `ttk.Style`, and binds
  `Ctrl+Shift+T` to a teacher-dashboard callback. The companion
  `theme.py` module exposes three palettes and a `ThemeSettings`
  dataclass with a dyslexia-font toggle. 19 unit tests in
  `tests/unit/test_ui_main_window.py` cover theme lookup, slot
  installation / replacement / rejection, palette switching, and the
  teacher-dashboard shortcut wiring. CI now installs `xvfb-run` on the
  Linux runner so the Tk tests pass headlessly across all three OSes.
- **2026-05-26** — The pupil-progress memory layer is fully wired:
  - `memory.store`: SQLite schema with `pupils`, `submissions`,
    `concept_strength` (12 unit tests cover round-trip CRUD, the EMA
    update, and the context-manager close behaviour).
  - `memory.pupil_model`: EMA-driven concept strengths, `passing_streak`,
    `weakest_concepts`, `suggest_next_lesson` (with stretch-lesson
    promotion after `STREAK_BEFORE_STRETCH=5` consecutive passes) and
    a class-wide `class_heatmap` (14 unit tests).
  - `memory.hint_engine`: 24 rules and 77 hint-engine tests (three per
    rule plus five sanity checks). Coverage gate raised from 60 to 75 per
    the autonomous-mode override after Task 10. Total suite: 434 tests,
    93.8 % coverage. The count read 78 with "six sanity checks" until
    2026-08-15; `tests/unit/test_hint_engine.py` has held exactly 77 `def
    test_` functions since it was first committed at `eec5837`, checked at
    every commit that has touched it, so the 78 was arithmetic rather than
    a removed test.
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
