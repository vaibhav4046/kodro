"""Top-level Tk application that wires every panel into the main window.

Calling :func:`launch` opens the full RoboLearn UI: the main-window
shell from :mod:`robolearn.ui.main_window` with the editor, simulation,
sensors, lessons and console panels installed, plus the welcome wizard
on first launch and the teacher dashboard behind ``Ctrl+Shift+T``.
"""

from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, World
from robolearn.lessons.schema import Lesson, load_library
from robolearn.memory.store import Store
from robolearn.runtime.binding import set_active_rover, set_active_world
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider
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


def build_app(
    *,
    db_path: Path | None = None,
    library: list[Lesson] | None = None,
    main_window: MainWindow | None = None,
) -> App:
    """Build (but do not enter the main loop of) the full application."""
    win = main_window or MainWindow()
    store = Store(db_path or DEFAULT_DB_PATH)
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
    )
    # Snapshot provider reads through `app.rover` so reset replacements stick.
    set_state_provider(lambda: _snapshot(app.rover))

    editor._callbacks = EditorCallbacks(
        on_run=lambda src: _run_clicked(app, sim, sensors, console, hint_card, src),
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

    sim.set_world(world, rover)
    sensors.update_from_rover(rover)
    console.log("RoboLearn ready. Pick a lesson on the right, write code, press Run.")
    return app


def launch() -> None:
    """Build the app, show a splash, then enter the Tk main loop."""
    from robolearn.ui.splash import show_splash

    app = build_app()
    show_splash(app.main_window.root)
    app.main_window.root.mainloop()


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
    if index >= len(events):
        console.log(
            f"Run finished in {total_ms} ms ({len(events)} events animated)",
            level="info",
        )
        set_active_rover(app.rover)
        return

    def _next() -> None:
        _animate_playback(app, sim, sensors, console, events, index + 1, total_ms)

    event = events[index]
    name = event.name
    args = event.args
    rover = app.rover
    state = rover.state

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
        rover.try_collect()
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
    _reset_clicked(app, sim, sensors, console, hint_card)
    console.log(f"Loaded lesson: {lesson.id}  {lesson.title}", level="info")


# Provide a callable named main() so the existing `python -m robolearn`
# entry point in __main__.py can transition from its placeholder to the
# full UI without touching any other file.
def main() -> int:
    """Console-script entry: launch the app."""
    launch()
    return 0
