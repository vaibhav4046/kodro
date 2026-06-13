# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Budget Robot Builder (local AI)** — a "🤖" nav-bar tool: type a budget
  (and an optional goal) and a **local** Ollama model returns a real-hardware
  rover guide — a tiered parts list with costs, numbered build steps, and a
  mapping from each RoboLearn command to the hardware action it drives. Every
  plan ships with a procedural SVG schematic (board, wheels, sensor, driver,
  battery). A deterministic floor guarantees a usable plan even at tiny
  budgets ($5 → cardboard micro-rover; $30+ → ESP32 rover). Offline, no cloud.
- **Nine visual themes** — a Theme picker in Settings, driven by `[data-theme]`
  CSS variable swaps so the whole shell repaints from one attribute: Mission
  (dark default), Daylight (light), Matrix, Pixel, Arcade, Brick, Clean,
  Abstract and Wiki / Network. The choice persists across sessions.
- **Real-world Earth landscape** — the base Earth terrain now reads like a map
  you could fly over: a farmland patchwork of crop fields (with crop-row
  striping and hedgerows), forest clusters, country roads with dashed
  centrelines, and a meandering river. Decorative only; it never collides.
- **Vibe coding (local AI)** — a "✨ Vibe" panel: describe what the rover
  should do and a **local** Ollama model (Qwen 2.5 Coder / Gemma preference)
  writes the Python, which is typed live into the editor (typewriter
  animation) for the pupil to read and Run. Localhost-only, no cloud, no
  account; graceful 3-step guide when Ollama is absent. The generated code
  runs through the same sandbox as hand-typed code.
- **Blocks mode (Scratch-style)** — a "🧩 Blocks" panel with a click-to-stack
  palette (move/turn/beep/say/LED/scan/collect, repeat-N and if-obstacle
  containers with nesting), editable amounts, and "Insert code" that turns
  the stack into real Python typed live into the editor.
- **Rover voice** — `say()` lines are spoken aloud with the OS's built-in
  offline TTS (Windows SAPI; zero new dependencies); respects the sound mute.
- **Security hardening** — the Ollama client now *enforces* localhost-only
  URLs; pip-audit clean (pip itself patched); sandbox `exec` documented;
  AI prompt/speech length caps.
- **Standalone desktop app** — the web UI now packages into a single
  double-clickable `RoboLearn.exe` (PyInstaller spec `robolearn-web.spec`)
  that bundles pywebview, the engine and the vendored design; no Python
  install required. Verified launching + rendering the full UI.
- **Offline sound design** — `sound.js` synthesises every cue with the Web
  Audio API (no audio files): drive/turn/scan/LED/speech, a pass arpeggio,
  a fail cadence and a crash burst, with a persisted "🔊 Sound" toggle.
- **Celebration confetti** on a lesson pass (honours `prefers-reduced-motion`).
- **KS1/KS2 onboarding lessons + reading scaffolding** — three new
  age-appropriate lessons (`00_first_drive` KS1 age 6, `00b_repeat_square`
  KS2 age 9, `00c_look_first` KS2 age 10) in plain language, extending the
  curriculum below the KS3/KS4 core. The lesson schema gains optional
  `reading_age` and a plain-English `glossary` ({term: definition}); the web
  lesson card shows an "Age N+" chip and an inline glossary so jargon
  (loop, sensor, obstacle) is always explained. `KeyStage` now allows
  KS1/KS2. Library is 18 lessons; both engines run all of them (conformance).
- **Multi-pupil accounts** — see above; bridge list/create/select/rename +
  a "Pupil" picker so shared machines keep each pupil's progress separate.
- **Autopilot demo** — a flagship "self-driving rover" example (now the
  default program in the web UI): it reads its lidar, probes left/right when
  a boulder looms, steers toward the clearer side, and finishes with a survey
  spiral — pure sense-think-act, no waypoints. Verified to drive ~36 legs and
  dodge ~25 obstacles in the interpreter.

### Fixed
- **Nested `if/else` was broken in the interpreter** (real correctness bug):
  an `if` node carries `.branches`, not `.body`, so the conditional-linking
  pass skipped recursion into `if` bodies — a nested `else` survived to
  execution as `Unknown statement`. Any program with a conditional inside an
  `if` (e.g. the autopilot's steering logic) failed. Now linked correctly;
  regression-tested (`test_nested_if_else*`).
- **JS↔Python API parity** (re-score round, 2.87→6.7): the in-browser
  interpreter and the Python grader were two engines that didn't agree on
  the lesson vocabulary. Now reconciled — `interpreter.js` also accepts the
  Python sensor names (`read_distance`/`read_heading`/`read_battery`/
  `read_colour`/`sample_detected`/`at_base`/`drop_sample`), and Python
  `rover_api` gains the missing action verbs (`say`/`led`/`scan`/
  `set_speed`/`pen_down`/`pen_up`). A new **conformance test**
  (`test_web_lesson_parity`) runs every bundled lesson's starter through
  *both* engines and fails on any unresolved verb.
- **JS recursion was broken**: `return` only ended the current statement,
  not the function, so a base case never stopped — `09_recursion` recursed
  until the JS stack overflowed. `return` now unwinds to the enclosing call.
- **Scientific-notation + `1_000` numeric literals** now tokenize in the
  interpreter (`move_forward(1e3)` no longer throws `Expected ")"`).
- **Stale lesson verdict** cleared on terrain switch (it was graded against
  the lesson's own world).
- **Web lessons were dead-on-arrival** (100-persona QA, #1 finding, avg 2.87/10):
  every lesson's starter code uses the bare verbs `move_forward()`,
  `turn_left()`, `obstacle_ahead()`, `collect_sample()`, `beep()`, `log()`,
  but the design's `interpreter.js` only knew `rover.forward()`, so loading
  any lesson and pressing Run threw `Name "..." is not defined` on line 1.
  `interpreter.js` now speaks the full RoboLearn lesson API (bare verbs +
  sensors), scaling `move_forward`/`move_backward` metres→cm so on-screen
  motion matches what the Python grader scores. The design's `rover.*` API
  still works. Contract-tested through Node (`test_web_interpreter`).
- **Adversarial: huge motion magnitudes froze the rover** (QA adv1):
  `move_forward(99999999)` overflowed the animation; magnitudes are now
  clamped (distance ≤ 40 m, turn ≤ 3600°, speed 0–100, wait 0–10 s).

### Added
- **JSX compile-check in CI** — `test_web_jsx_valid` transforms every vendored
  `.jsx` with the bundled Babel (via Node) so a syntax error that would
  white-screen the app is caught as a failing test, not at runtime.
- **Web accessibility round 2** (100-persona QA): the console is a
  `role="log"` `aria-live="polite"` region (errors `role="alert"`) so
  verdicts/crashes are announced; the editor exposes an `aria-label` and
  **Escape releases focus** (fixes the Tab keyboard-trap, WCAG 2.1.2); the
  layout now **reflows to a single column below ~1100px / at 200% zoom**
  (WCAG 1.4.10) instead of crushing the viewport off-screen on Chromebooks;
  the API hint bar now lists the real lesson verbs (`move_forward`,
  `obstacle_ahead`, `collect_sample`).
- **NEW web UI** (`python -m robolearn.web`) — the actual Claude Design
  rover-simulator React/CSS prototype is now vendored under
  `src/robolearn/assets/web/` (with React 18, Babel standalone, and 14 TTF
  font files vendored locally — fully offline, no CDN) and rendered in a
  desktop window via **pywebview** (Edge WebView2 on Windows). A new
  `robolearn.web.app.BridgeAPI` exposes the existing lesson library +
  pupil store to the React shell via `window.pywebview.api.*`, bridged by
  `assets/web/bridge.js`. The Tk app at `python -m robolearn` is unchanged
  and stays as a fallback. This is the *modern, sleek* UI medium the design
  was built in — closes the "looks like a Macintosh game" gap.

### Changed
- **Full dark ttk theme** — every ttk widget (buttons, slider, scrollbars,
  entries, separators, notebook) is now repainted from the active palette
  via clam `style.configure`/`map`, so the controls match the dark Orbital
  Rover chrome instead of clam's light-grey default. The editor's **Run**
  button is now a cyan `Accent.TButton`; Step/Stop/Reset are ghost buttons.
  This closes the biggest UI gap against the design (light buttons on dark).
- **Lessons list + progress drawer reskinned** — navy panels with
  warm-paper text and a phosphor-cyan selection highlight, matching the rest
  of the Orbital Rover chrome.
- **Telemetry rail reskinned** — the LIDAR/battery mini-charts and the
  rover-trail mini-map now use the design's tokens: navy panels, a cyan
  trail and series lines, warm-paper labels, brass/success/danger accents.
- **Console + hint card reskinned** to the Orbital Rover chrome — navy
  panels, warm-paper text, cyan hints, brass warnings, danger-red errors
  (the green/orange pass-fail banners stay semantic).
- **Viewport chrome** reskinned to void background + navy HUD chip.
- **Dark theme retuned to the Orbital Rover palette** — the shared dark
  `Palette` now uses the design's void/navy chrome, phosphor-cyan accent and
  warm-paper text, so the code editor (which reads the palette) matches the
  mission bar's identity. Semantic panel colours (pass/fail banners) are
  unchanged.

### Added
- **3-D diorama viewport** — the hero viewport now renders the world on a
  tilted, receding ground plane (perspective grid converging to a horizon,
  a sky band, and depth-squeezed rover/trail/obstacles), evoking the
  design's 3-D scene. A `_PerspectiveView` wraps the flat transform so every
  element tilts together; `set_perspective(False)` falls back to flat
  top-down. Defaults to 3-D.
- **Telemetry gauges** — the sensors rail now leads with the design's
  instrument cluster: a **compass dial** (cardinal ticks + cyan heading
  needle) and circular **arc gauges** for battery and LIDAR, above the
  existing history charts. New `Compass` + `ArcGauge` canvas widgets.
- **Rover pen trail** — the viewport now traces the rover's path as a
  phosphor-cyan trail while it drives (the design's signature "pen trail"),
  cleared on Reset or lesson change. Capped at 400 points.
- **"Orbital Rover" mission bar** — implements the signature chrome from the
  Claude Design handoff (`Rover Simulator.html`): a wordmark + `ROVER
  SIMULATOR` mono subtitle, a run-status dot (idle / running / complete /
  error, in the design's phosphor-cyan palette) wired to the run lifecycle,
  and a **sim-speed slider** that scales playback (0.25×–4×) via
  `orbital.scaled_delay`. Tk-free tokens/helpers in `robolearn.ui.orbital`.
- **Passed-lesson ticks** — the lessons list now shows a ✓ next to lessons
  the pupil has passed (• otherwise), updated after every Run, so progress
  through the curriculum is visible at a glance (`LessonsPanel.set_completed`).
- **Resume your last attempt** — selecting a lesson you've worked on before
  reloads your most recent code instead of the starter, so progress survives
  closing the app (`_source_for_lesson`). "↺ Starter code" still starts fresh.
- **Restore starter code** — a top-bar "↺ Starter code" button puts the
  current lesson's starter back in the editor, so a pupil who tangles their
  code can start over in one click (the Reset button only resets the world).
- **Sound on/off toggle** — a top-bar 🔊/🔇 button mutes all sound effects
  for SEN pupils and quiet classrooms. The choice persists with the other
  accessibility settings in `~/.robolearn/a11y.toml` and re-applies on
  launch (`A11ySettings.sound_enabled`, `sounds.set_enabled`).

## [0.64.0] - 2026-06-06

> This release line (git tags `v0.34.0`–`v0.64.0`, all cut on 2026-06-06)
> consolidates the milestone that closed the formative-feedback learning
> loop and then built out accessibility, audio and game-juice, an adaptive
> next-lesson recommender, replay, a trophy case, an offline teacher
> report, content depth (15 curriculum lessons) and the draft dissertation
> chapters — fixing several real correctness bugs along the way. The
> entries below are grouped Added/Fixed; the per-feature history is in the
> tags and commit log.

### Fixed
- **First-run profile is written as valid TOML.** The welcome wizard wrote
  `~/.robolearn/config.toml` by raw string interpolation, so a display name
  containing a quote or newline produced a malformed file. The values are
  now JSON-escaped (valid TOML basic strings); found by an adversarial code
  review of this milestone's changes.
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
- **`15_parameters` lesson** (KS4 stretch) — functions with parameters: the
  samples sit at different gaps, so a fixed-distance hop can't reach them
  all until you parameterise it (15 lessons).
- **`14_counting` lesson** (KS4 stretch) — the accumulator pattern: keep a
  running tally in a variable to count samples inside a loop (14 lessons).
- **`13_nested_loops` lesson** (KS4 stretch) — sweep a 2-D field of samples
  by nesting one loop inside another; brings the bundled library to 13.
- **Teacher progress report** — a top-bar "📄 Report" button writes a
  self-contained, offline HTML report (`robolearn.memory.report`) to
  `~/.robolearn/progress-report.html`: summary, every submission, per-concept
  strengths and achievements. Tk-free + deterministic, so it is fully
  unit-tested; intended as evidence for the teacher evaluation study.
- **Trophy case** — a top-bar "🏆 Trophies" button opens a window listing
  all 16 achievements with locked/unlocked state and an unlocked count.
  The achievements existed but were only ever glimpsed as a fleeting
  unlock toast; `achievement_status()` exposes the full set.
- **Replay last run** — a top-bar button opens the existing time-travel
  replay dialog on the most recent run's trace (`Tracer.from_json` /
  `ReplayDialog` were already built but unreachable from the UI). Warns
  when there is nothing to replay yet.
- **Adaptive next-lesson recommendation** surfaced after every Run — the
  per-concept strength model (`suggest_next_lesson`) already existed but
  was invisible; the console now logs "👉 Recommended next: …" so the
  adaptivity is actually used.
- **Confetti celebration overlay** on a passing Run — a static "🎉 Mission
  complete 🎉" + confetti burst painted on the sim canvas, cleared by the
  next Run/Reset (no timer, so it can't stall the event loop on any
  platform).
- **Procedural sound effects** (`robolearn.ui.sounds`): a bright chime on
  pass, a low buzz on fail, a blip on sample-collect and a thud on
  collision. Tones are synthesised at runtime from the standard library
  (no asset files, no network) and the mixer is hard-guarded — on any
  machine without audio (CI, locked-down classrooms) every cue is a silent
  no-op that never raises or blocks. Tests use SDL's headless `dummy`
  driver.
- **Two new KS4 stretch lessons** (12 bundled in total): `11_decomposition`
  (break a patrol into named helper subroutines) and `12_abstraction`
  (use `obstacle_ahead()` as a sensor abstraction to avoid a crash),
  each with DfE/BCS curriculum references and failure hints.
- **Accessibility pass.** Text-size controls (`A-` / `A+`) rescale the
  editor, console and hint fonts; a high-contrast toggle switches the
  editor and console to pure black-on-white; both preferences persist offline to
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
