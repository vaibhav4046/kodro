"""Top-level Tk application that wires every panel into the main window.

Calling :func:`launch` opens the full RoboLearn UI: the main-window
shell from :mod:`robolearn.ui.main_window` with the editor, simulation,
sensors, lessons and console panels installed, plus the welcome wizard
on first launch and the teacher dashboard behind ``Ctrl+Shift+T``.
"""

from __future__ import annotations

import contextlib
import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, World
from robolearn.lessons.grader import grade
from robolearn.lessons.schema import Lesson, load_library
from robolearn.memory.achievements import (
    PupilContext,
    check_and_unlock,
    daily_streak,
    show_toast,
)
from robolearn.memory.hint_engine import HintContext, find_first_hint
from robolearn.memory.pupil_model import attempted_lesson_ids, update_on_submission
from robolearn.memory.store import Store
from robolearn.runtime.binding import set_active_rover, set_active_world
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider
from robolearn.ui import a11y, sounds
from robolearn.ui.console_panel import ConsolePanel, HintCardArea
from robolearn.ui.editor_panel import EditorCallbacks, EditorPanel
from robolearn.ui.lesson_editor import LessonEditor, load_custom_lessons
from robolearn.ui.lessons_panel import LessonsCallbacks, LessonsPanel
from robolearn.ui.main_window import MainWindow
from robolearn.ui.sensors_panel import SensorsPanel
from robolearn.ui.sim_panel import SimPanel
from robolearn.ui.teacher_dashboard import TeacherDashboard

#: Path the desktop app uses for the SQLite store. Tests override this.
DEFAULT_DB_PATH: Path = Path.home() / ".robolearn" / "pupil.db"


@dataclass(slots=True)
class App:
    """Container for the long-lived application objects."""

    main_window: MainWindow
    store: Store
    tracer: Tracer
    world: World
    rover: Rover
    lessons: list[Lesson]
    current_lesson: Lesson | None = None
    pupil_id: str = ""
    last_source: str = ""
    last_duration_ms: int = 0
    stop_requested: bool = False
    hint_card: HintCardArea | None = None
    lessons_panel: LessonsPanel | None = None
    progress_label: tk.Widget | None = None
    editor: EditorPanel | None = None
    console: ConsolePanel | None = None
    sim: SimPanel | None = None
    a11y_settings: a11y.A11ySettings | None = None
    step_events: list[object] | None = None
    step_index: int = 0


def build_app(
    *,
    db_path: Path | None = None,
    library: list[Lesson] | None = None,
    main_window: MainWindow | None = None,
) -> App:
    """Build (but do not enter the main loop of) the full application."""
    win = main_window or MainWindow()
    store = Store(db_path or DEFAULT_DB_PATH)
    # Ensure a single local pupil exists (the spec's UUID-per-machine model).
    existing = store.list_pupils()
    pupil = existing[0] if existing else store.create_pupil("Pupil")
    if library is not None:
        lessons = list(library)
    else:
        lessons = list(load_library()) + list(load_custom_lessons())
    starting_lesson = lessons[0] if lessons else _default_lesson()
    world = _world_from_lesson(starting_lesson)
    rover = Rover(world)
    tracer = Tracer()
    set_active(tracer)
    set_active_rover(rover)
    set_active_world(world)

    editor = EditorPanel(
        win.frames.editor,
        initial_source=starting_lesson.starter_code if lessons else "move_forward(5)",
    )
    sim = SimPanel(win.frames.sim)

    # The right-hand slot stacks SensorsPanel on top of LessonsPanel inside
    # a single wrapper frame; the bottom slot stacks HintCardArea above
    # ConsolePanel. Wrapping avoids mixing pack/grid via `in_=` arguments
    # (which painted blank on some Tk builds).
    right_wrap = tk.Frame(win.frames.sensors)
    sensors = SensorsPanel(right_wrap)
    lessons_panel = LessonsPanel(right_wrap, lessons=lessons)
    sensors.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
    lessons_panel.pack(side=tk.BOTTOM, fill=tk.BOTH, expand=True)

    bottom_wrap = tk.Frame(win.frames.console)
    hint_card = HintCardArea(bottom_wrap)
    console = ConsolePanel(bottom_wrap)
    hint_card.pack(side=tk.TOP, fill=tk.X)
    console.pack(side=tk.BOTTOM, fill=tk.BOTH, expand=True)

    win.set_slot("editor", editor)
    win.set_slot("sim", sim)
    win.set_slot("sensors", right_wrap)
    win.set_slot("console", bottom_wrap)

    app = App(
        main_window=win,
        store=store,
        tracer=tracer,
        world=world,
        rover=rover,
        lessons=lessons,
        current_lesson=starting_lesson if lessons else None,
        pupil_id=pupil.id,
        hint_card=hint_card,
        lessons_panel=lessons_panel,
        editor=editor,
        console=console,
        sim=sim,
        a11y_settings=a11y.load(A11Y_PATH),
    )
    # Snapshot provider reads through `app.rover` so reset replacements stick.
    set_state_provider(lambda: _snapshot(app.rover))

    editor._callbacks = EditorCallbacks(
        on_run=lambda src: _run_clicked(app, sim, sensors, console, hint_card, src),
        on_step=lambda src: _step_clicked(app, sim, sensors, console, hint_card, src),
        on_stop=lambda: _stop_clicked(app, console),
        on_reset=lambda: _reset_clicked(app, sim, sensors, console, hint_card),
    )
    lessons_panel._callbacks = LessonsCallbacks(
        on_select=lambda lsn: _lesson_selected(app, lsn, editor, sim, sensors, console, hint_card),
    )
    win.on_open_teacher_dashboard(lambda: TeacherDashboard(win.root, store))

    from tkinter import ttk

    def _open_lesson_editor() -> None:
        def _on_saved(_lesson: Lesson) -> None:
            app.lessons = list(load_library()) + list(load_custom_lessons())
            lessons_panel.set_lessons(app.lessons)
            console.log(f"Reloaded {len(app.lessons)} lessons.", level="info")

        LessonEditor(win.root, on_saved=_on_saved)

    def _open_ai_studio() -> None:
        from robolearn.ui.ai_studio import AIStudio

        def _on_saved(_lesson: Lesson) -> None:
            app.lessons = list(load_library()) + list(load_custom_lessons())
            lessons_panel.set_lessons(app.lessons)
            console.log(
                f"AI wrote lesson '{_lesson.id}'. Reloaded {len(app.lessons)} lessons.",
                level="hint",
            )

        AIStudio(win.root, on_saved=_on_saved)

    def _explain_code() -> None:
        from robolearn.ai import OllamaError, explain_code, is_available

        if not is_available():
            console.log(
                "AI tutor needs a local Ollama server. See AI Studio for setup.",
                level="warn",
            )
            return
        source = editor.get_source()
        console.log("Asking the local AI tutor…", level="info")

        def _worker() -> None:
            try:
                title = app.current_lesson.title if app.current_lesson else ""
                explanation = explain_code(source, lesson_title=title)
            except OllamaError as exc:
                err = str(exc)
                win.root.after(0, lambda: console.log(f"AI tutor error: {err}", level="error"))
                return
            win.root.after(0, lambda: console.log(f"AI tutor: {explanation}", level="hint"))

        import threading

        threading.Thread(target=_worker, name="ai-explain", daemon=True).start()

    ttk.Button(win.frames.topbar, text="✨ AI Studio", command=_open_ai_studio).pack(
        side=tk.RIGHT, padx=4, pady=6
    )
    ttk.Button(win.frames.topbar, text="Explain my code", command=_explain_code).pack(
        side=tk.RIGHT, padx=4, pady=6
    )
    ttk.Button(win.frames.topbar, text="New lesson…", command=_open_lesson_editor).pack(
        side=tk.RIGHT, padx=4, pady=6
    )

    # At-a-glance progress: streak / lessons passed / last score. Updated
    # after every Run so the reward for finishing is always on screen.
    progress = ttk.Label(win.frames.topbar, text="", anchor=tk.W)
    progress.pack(side=tk.LEFT, padx=10, pady=6)
    app.progress_label = progress
    _refresh_progress(app)

    # Accessibility controls: text scaling + high-contrast toggle.
    ttk.Button(
        win.frames.topbar, text="A-", width=3, command=lambda: _change_text_scale(app, larger=False)
    ).pack(side=tk.LEFT, padx=(8, 0), pady=6)
    ttk.Button(
        win.frames.topbar, text="A+", width=3, command=lambda: _change_text_scale(app, larger=True)
    ).pack(side=tk.LEFT, padx=(0, 0), pady=6)
    ttk.Button(
        win.frames.topbar, text="◑ Contrast", command=lambda: _toggle_high_contrast(app)
    ).pack(side=tk.LEFT, padx=(4, 0), pady=6)
    _apply_a11y(app)

    sim.set_world(world, rover)
    sensors.update_from_rover(rover)
    console.log("RoboLearn ready. Pick a lesson on the right, write code, press Run.")
    if app.current_lesson is not None:
        _log_lesson_brief(console, app.current_lesson)

    # Keyboard shortcuts (accessibility / power users): Ctrl+Enter and F5
    # run, Esc stops, Ctrl+R resets. bind_all so they work from any focus.
    def _run_shortcut(_e: object) -> str:
        _run_clicked(app, sim, sensors, console, hint_card, editor.get_source())
        return "break"

    win.root.bind_all("<Control-Return>", _run_shortcut)
    win.root.bind_all("<F5>", _run_shortcut)
    win.root.bind_all("<Escape>", lambda _e: _stop_clicked(app, console))
    win.root.bind_all(
        "<Control-r>", lambda _e: _reset_clicked(app, sim, sensors, console, hint_card)
    )
    win.root.bind_all(
        "<Control-R>", lambda _e: _reset_clicked(app, sim, sensors, console, hint_card)
    )
    return app


#: Path the accessibility settings persist to (offline, per-machine).
A11Y_PATH: Path = Path.home() / ".robolearn" / "a11y.toml"


def _apply_a11y(app: App) -> None:
    """Apply the current accessibility settings to every text widget."""
    settings = app.a11y_settings or a11y.A11ySettings()
    with contextlib.suppress(Exception):
        if app.editor is not None:
            app.editor.set_font_size(settings.code_size())
        if app.console is not None:
            app.console.set_font_size(settings.text_size())
            app.console.set_high_contrast(settings.high_contrast)
        if app.hint_card is not None:
            app.hint_card.set_font_size(settings.text_size())


def _change_text_scale(app: App, *, larger: bool) -> None:
    """Nudge the text scale one step, re-apply, and persist."""
    settings = app.a11y_settings or a11y.A11ySettings()
    settings.text_scale = a11y.stepped_scale(settings.text_scale, larger=larger)
    app.a11y_settings = settings
    _apply_a11y(app)
    with contextlib.suppress(Exception):
        a11y.save(A11Y_PATH, settings)


def _toggle_high_contrast(app: App) -> None:
    """Flip high-contrast mode, re-apply, and persist."""
    settings = app.a11y_settings or a11y.A11ySettings()
    settings.high_contrast = not settings.high_contrast
    app.a11y_settings = settings
    _apply_a11y(app)
    with contextlib.suppress(Exception):
        a11y.save(A11Y_PATH, settings)


def _log_lesson_brief(console: ConsolePanel, lesson: Lesson) -> None:
    """Print the lesson title, key stage and intro to the console."""
    console.log(f"Lesson {lesson.id} — {lesson.title}  [{lesson.key_stage}]", level="hint")
    for line in lesson.intro.strip().splitlines():
        if line.strip():
            console.log(f"  {line.strip()}", level="info")
    goals = []
    for crit in lesson.success_criteria:
        if crit.samples_collected:
            goals.append(f"collect {crit.samples_collected} sample(s)")
        if crit.no_collisions:
            goals.append("no collisions")
        if crit.returns_to_base:
            goals.append("return to base")
        if crit.uses_construct:
            goals.append(f"use a {crit.uses_construct}")
    if goals:
        console.log("Goal: " + ", ".join(goals), level="warn")


def launch() -> None:
    """Build the app, show a splash, then enter the Tk main loop."""
    from robolearn.ui.splash import show_splash

    app = build_app()
    show_splash(app.main_window.root)
    _maybe_show_welcome(app)
    app.main_window.root.mainloop()


#: Sentinel written once the welcome wizard has been completed.
WELCOME_SENTINEL: Path = Path.home() / ".robolearn" / "config.toml"


def _maybe_show_welcome(app: App) -> None:
    """Show the first-run welcome wizard unless we've onboarded before."""
    if WELCOME_SENTINEL.exists():
        return
    from robolearn.ui.welcome_wizard import WelcomeWizard, WizardResult

    def _done(result: WizardResult) -> None:
        try:
            WELCOME_SENTINEL.parent.mkdir(parents=True, exist_ok=True)
            WELCOME_SENTINEL.write_text(
                "# RoboLearn local profile (no cloud, no account).\n"
                f'display_name = "{result.display_name}"\n'
                f'age_band = "{result.age_band}"\n'
                f'key_stage = "{result.key_stage}"\n'
                f'terrain = "{result.terrain.value}"\n',
                encoding="utf-8",
            )
            app.store.set_display_name(app.pupil_id, result.display_name)
        except Exception:  # pragma: no cover - onboarding is best-effort
            pass

    # Never block startup on the wizard.
    with contextlib.suppress(Exception):
        WelcomeWizard(app.main_window.root, on_complete=_done)


# --- helpers ---------------------------------------------------------------


def _default_lesson() -> Lesson:
    """Fallback lesson used when the bundled library is unavailable."""
    from robolearn.lessons.schema import WorldDef as _WD

    return Lesson(
        id="fallback",
        title="Free play",
        key_stage="KS3",
        ct_concepts=["sequence"],
        curriculum_refs=[],
        prereqs=[],
        terrain=Terrain.EARTH,
        intro="Drive freely on a blank arena.",
        starter_code="move_forward(2)",
        allowed_constructs=["function_call"],
        max_lines=20,
        world=_WD(base=(1.0, 1.0)),
    )


def _world_from_lesson(lesson: Lesson) -> World:
    from robolearn.engine.world import Obstacle, Sample

    world_def = lesson.world
    return World(
        terrain=Terrain(lesson.terrain),
        base=tuple(world_def.base),  # type: ignore[arg-type]
        samples=[Sample(s[0], s[1]) for s in world_def.samples],
        obstacles=[Obstacle(o.x, o.y, o.r) for o in world_def.obstacles],
        bounds=ArenaBounds(width=world_def.width, height=world_def.height),
    )


def _snapshot(rover: Rover) -> RoverSnapshot:
    state = rover.state
    return RoverSnapshot(
        x=state.x,
        y=state.y,
        heading_deg=state.heading_deg,
        battery_pct=state.battery_pct,
        samples_held=state.samples_held,
        samples_collected=state.samples_collected,
        collisions=state.collisions,
    )


#: Wall-clock gap between animation frames during Run playback (ms).
ANIMATION_TICK_MS: int = 90


def _run_clicked(
    app: App,
    sim: SimPanel,
    sensors: SensorsPanel,
    console: ConsolePanel,
    hint_card: HintCardArea,
    source: str,
) -> None:
    """Auto-reset, execute pupil code, then animate the tracer events."""
    # 1) Wipe console + world so every Run starts identically.
    app.last_source = source
    app.stop_requested = False
    app.step_events = None
    app.step_index = 0
    _reset_clicked(app, sim, sensors, console, hint_card)
    console.log("Running…", level="info")
    # 2) Execute pupil code -- the engine is wired so sensors return real
    #    values. The tracer captures every call.
    result = run_pupil_code(source, timeout_s=5.0)
    if not result.success:
        console.log(
            f"{result.error_kind}: {result.error_message} (line {result.error_line})",
            level="error",
        )
        return
    app.last_duration_ms = result.duration_ms
    events = app.tracer.events()
    # 3) Reset the engine state again so the animation starts from frame 0.
    app.world = _world_from_lesson(app.current_lesson or _default_lesson())
    app.rover = Rover(app.world)
    set_active_rover(None)  # animation drives the rover manually
    set_active_world(app.world)
    sensors.clear_charts()
    sim.set_world(app.world, app.rover)
    sensors.update_from_rover(app.rover)
    # 4) Walk the events at ANIMATION_TICK_MS intervals so the pupil
    #    actually sees the rover move, the charts climb / drain, and the
    #    samples disappear one at a time.
    _animate_playback(app, sim, sensors, console, events, 0, result.duration_ms)


#: Number of eased sub-frames a single move / turn animates across.
TWEEN_FRAMES: int = 14

#: Milliseconds between tween sub-frames (~60 fps).
TWEEN_FRAME_MS: int = 16


def _animate_playback(
    app: App,
    sim: SimPanel,
    sensors: SensorsPanel,
    console: ConsolePanel,
    events: list,  # type: ignore[type-arg]
    index: int,
    total_ms: int,
) -> None:
    """Apply events[index], tweening motion smoothly, then chain the next."""
    if app.stop_requested:
        console.log("Stopped.", level="warn")
        set_active_rover(app.rover)
        return
    if index >= len(events):
        console.log(
            f"Run finished in {total_ms} ms ({len(events)} events animated)",
            level="info",
        )
        set_active_rover(app.rover)
        _finish_run(app, console)
        return

    def _next() -> None:
        _animate_playback(app, sim, sensors, console, events, index + 1, total_ms)

    event = events[index]
    name = event.name
    args = event.args
    rover = app.rover
    state = rover.state

    if getattr(event, "kind", None) == "collision":
        sounds.play_collision()

    if name in ("move_forward", "move_backward") and args:
        start = (state.x, state.y)
        signed = float(args[0]) * (1.0 if name == "move_forward" else -1.0)
        rover.move(signed)  # engine applies clamp + battery drain
        end = (state.x, state.y)
        _tween(app, sim, sensors, start, end, (state.heading_deg, state.heading_deg), _next)
        return
    if name in ("turn_left", "turn_right") and args:
        start_h = state.heading_deg
        signed = float(args[0]) * (1.0 if name == "turn_left" else -1.0)
        rover.turn(signed)
        end_h = state.heading_deg
        pos = (state.x, state.y)
        _tween(app, sim, sensors, pos, pos, (start_h, end_h), _next)
        return
    if name == "collect_sample":
        if rover.try_collect():
            sounds.play_collect()
    elif name == "drop_sample":
        rover.try_drop()
    elif name == "log" and args:
        console.log(f"log: {args[0]}", level="hint")
    elif name == "beep":
        console.log("beep!", level="info")
    sim.refresh()
    sensors.update_from_rover(rover)
    sim.after(ANIMATION_TICK_MS, _next)


def _tween(
    app: App,
    sim: SimPanel,
    sensors: SensorsPanel,
    start_xy: tuple[float, float],
    end_xy: tuple[float, float],
    heading: tuple[float, float],
    done: Callable[[], None],
    frame: int = 0,
) -> None:
    """Quintic-ease the rover from start to end over :data:`TWEEN_FRAMES`."""
    from robolearn.ui.premium import ease_in_out_quintic

    state = app.rover.state
    if frame > TWEEN_FRAMES:
        state.x, state.y = end_xy
        state.heading_deg = heading[1]
        sim.refresh()
        sensors.update_from_rover(app.rover)
        done()
        return
    t = ease_in_out_quintic(frame / TWEEN_FRAMES)
    state.x = start_xy[0] + (end_xy[0] - start_xy[0]) * t
    state.y = start_xy[1] + (end_xy[1] - start_xy[1]) * t
    state.heading_deg = heading[0] + (heading[1] - heading[0]) * t
    sim.refresh()
    sensors.update_from_rover(app.rover)
    sim.after(
        TWEEN_FRAME_MS,
        lambda: _tween(app, sim, sensors, start_xy, end_xy, heading, done, frame + 1),
    )


def _reset_clicked(
    app: App,
    sim: SimPanel,
    sensors: SensorsPanel,
    console: ConsolePanel,
    hint_card: HintCardArea,
) -> None:
    app.world = _world_from_lesson(app.current_lesson or _default_lesson())
    app.rover = Rover(app.world)
    app.tracer.clear()
    # Re-assert every runtime binding so a Run always records. (Tests and
    # long-lived sessions can detach the module-level tracer; rebinding
    # here guarantees the executor traces into *this* app's tracer.)
    set_active(app.tracer)
    set_state_provider(lambda: _snapshot(app.rover))
    set_active_rover(app.rover)
    set_active_world(app.world)
    sim.set_world(app.world, app.rover)
    sensors.update_from_rover(app.rover)
    hint_card.clear()
    console.clear()
    console.log("World reset.", level="info")


def _lesson_selected(
    app: App,
    lesson: Lesson,
    editor: EditorPanel,
    sim: SimPanel,
    sensors: SensorsPanel,
    console: ConsolePanel,
    hint_card: HintCardArea,
) -> None:
    app.current_lesson = lesson
    editor.set_source(lesson.starter_code)
    app.step_events = None
    app.step_index = 0
    _reset_clicked(app, sim, sensors, console, hint_card)
    _log_lesson_brief(console, lesson)


def _progress_text(app: App) -> str:
    """Build the topbar progress string from the store."""
    streak = daily_streak(app.store, app.pupil_id)
    passed = len(attempted_lesson_ids(app.store, app.pupil_id))
    subs = app.store.list_submissions(pupil_id=app.pupil_id)
    last = f"{subs[-1].score}" if subs else "—"
    fire = "🔥" if streak > 0 else "·"
    return f"{fire} Streak {streak}    ✓ {passed} passed    ★ Last {last}"


def _refresh_progress(app: App) -> None:
    """Recompute and render the at-a-glance progress strip (best-effort)."""
    label = app.progress_label
    if label is None:
        return
    with contextlib.suppress(Exception):
        label.configure(text=_progress_text(app))  # type: ignore[call-arg]


def _run_aggregates(events: list) -> tuple[int, float]:  # type: ignore[type-arg]
    """Return ``(collisions, battery_used_pct)`` derived from trace events."""
    collisions = sum(1 for e in events if getattr(e, "kind", None) == "collision")
    battery_used = 0.0
    for event in events:
        snap = getattr(event, "rover_state", None)
        if snap is not None:
            battery_used = max(battery_used, 100.0 - snap.battery_pct)
    return collisions, battery_used


def _finish_run(app: App, console: ConsolePanel) -> None:
    """Grade the just-finished run, surface a hint, persist + reward.

    This is the step that closes the learning loop: the pupil presses Run,
    sees the rover move, and *then* gets told whether they met the mission,
    why not, what to try next, and any achievement they earned.
    """
    lesson = app.current_lesson
    if lesson is None:
        return
    events = app.tracer.events()
    result = grade(lesson, app.tracer, app.last_source)
    collisions, battery_used = _run_aggregates(events)

    # 1) Verdict + score (with a matching sound cue).
    if result.passed:
        console.log(f"✅ Passed!  Score {result.score}/100", level="hint")
        sounds.play_pass()
        if app.sim is not None:
            with contextlib.suppress(Exception):
                app.sim.celebrate()
    else:
        console.log(f"❌ Not passed yet — score {result.score}/100", level="warn")
        for reason in result.reasons:
            console.log(f"   • {reason}", level="warn")
        sounds.play_fail()

    # 2) Banner: green pass, or an actionable hint / orange nudge on fail.
    hint_card = app.hint_card
    if not result.passed:
        ctx = HintContext(
            lesson=lesson,
            source=app.last_source,
            events=tuple(events),
            grade_result=result,
        )
        hint = find_first_hint(ctx)
        if hint is not None:
            if hint_card is not None:
                hint_card.show(hint)
            console.log(f"💡 {hint.message}", level="hint")
        elif hint_card is not None:
            hint_card.show_failure(
                f"Not passed yet — score {result.score}/100. Tweak your code and run again."
            )
    elif hint_card is not None:
        hint_card.show_success(f"Mission complete!  Score {result.score}/100")

    # 3) Persist the submission (history is everything *before* this one).
    history = tuple(app.store.list_submissions(pupil_id=app.pupil_id))
    submission = app.store.record_submission(
        pupil_id=app.pupil_id,
        lesson_id=lesson.id,
        code=app.last_source,
        passed=result.passed,
        score=result.score,
        reasons=result.reasons,
        trace_json=app.tracer.to_json(),
        duration_ms=app.last_duration_ms,
        battery_used=battery_used,
        collisions=collisions,
    )

    # 4) Update the rolling concept model so the recommender stays current.
    update_on_submission(app.store, pupil_id=app.pupil_id, lesson=lesson, passed=result.passed)

    # 5) Unlock + celebrate any freshly-earned achievements.
    pctx = PupilContext(
        pupil_id=app.pupil_id,
        lesson=lesson,
        submission=submission,
        history=history,
    )
    for ach in check_and_unlock(app.store, pctx):
        console.log(f"{ach.icon} Achievement unlocked: {ach.title}", level="hint")
        # Toast is best-effort UI sugar; never let it break the run loop.
        with contextlib.suppress(Exception):
            show_toast(app.main_window.root, ach)

    # 6) Refresh the lessons panel so the recommended-next badge updates.
    if app.lessons_panel is not None and hasattr(app.lessons_panel, "set_lessons"):
        app.lessons_panel.set_lessons(app.lessons)

    # 7) Refresh the at-a-glance progress strip (streak / passed / score).
    _refresh_progress(app)


def _apply_event_instant(
    app: App,
    sim: SimPanel,
    sensors: SensorsPanel,
    console: ConsolePanel,
    event: object,
) -> None:
    """Apply a single trace event to the rover with no tween (Step mode)."""
    rover = app.rover
    name = getattr(event, "name", "")
    args = getattr(event, "args", ()) or ()
    if getattr(event, "kind", None) == "collision":
        sounds.play_collision()
    if name in ("move_forward", "move_backward") and args:
        rover.move(float(args[0]) * (1.0 if name == "move_forward" else -1.0))
    elif name in ("turn_left", "turn_right") and args:
        rover.turn(float(args[0]) * (1.0 if name == "turn_left" else -1.0))
    elif name == "collect_sample":
        if rover.try_collect():
            sounds.play_collect()
    elif name == "drop_sample":
        rover.try_drop()
    elif name == "log" and args:
        console.log(f"log: {args[0]}", level="hint")
    elif name == "beep":
        console.log("beep!", level="info")
    sim.refresh()
    sensors.update_from_rover(rover)


def _step_clicked(
    app: App,
    sim: SimPanel,
    sensors: SensorsPanel,
    console: ConsolePanel,
    hint_card: HintCardArea,
    source: str,
) -> None:
    """Advance the rover one trace event per click; grade when exhausted."""
    if not app.step_events:
        # Start a fresh step session: run headless, capture the trace.
        app.last_source = source
        app.stop_requested = False
        _reset_clicked(app, sim, sensors, console, hint_card)
        result = run_pupil_code(source, timeout_s=5.0)
        if not result.success:
            console.log(
                f"{result.error_kind}: {result.error_message} (line {result.error_line})",
                level="error",
            )
            return
        app.last_duration_ms = result.duration_ms
        app.step_events = list(app.tracer.events())
        app.step_index = 0
        app.world = _world_from_lesson(app.current_lesson or _default_lesson())
        app.rover = Rover(app.world)
        set_active_rover(None)
        set_active_world(app.world)
        sensors.clear_charts()
        sim.set_world(app.world, app.rover)
        sensors.update_from_rover(app.rover)
        console.log(
            f"Step mode: {len(app.step_events)} event(s). Press Step to advance.",
            level="info",
        )
        if not app.step_events:
            set_active_rover(app.rover)
            _finish_run(app, console)
            return

    events = app.step_events
    if not events:
        return
    event = events[app.step_index]
    _apply_event_instant(app, sim, sensors, console, event)
    app.step_index += 1
    console.log(
        f"Step {app.step_index}/{len(events)}: {getattr(event, 'name', '?')}",
        level="info",
    )
    if app.step_index >= len(events):
        set_active_rover(app.rover)
        _finish_run(app, console)
        app.step_events = None
        app.step_index = 0


def _stop_clicked(app: App, console: ConsolePanel) -> None:
    """Request the running animation stop and clear any step session."""
    app.stop_requested = True
    app.step_events = None
    app.step_index = 0
    console.log("Stop requested.", level="warn")


# Provide a callable named main() so the existing `python -m robolearn`
# entry point in __main__.py can transition from its placeholder to the
# full UI without touching any other file.
def main() -> int:
    """Console-script entry: launch the app."""
    launch()
    return 0
