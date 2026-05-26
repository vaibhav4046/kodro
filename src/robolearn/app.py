"""Top-level Tk application that wires every panel into the main window.

Calling :func:`launch` opens the full RoboLearn UI: the main-window
shell from :mod:`robolearn.ui.main_window` with the editor, simulation,
sensors, lessons and console panels installed, plus the welcome wizard
on first launch and the teacher dashboard behind ``Ctrl+Shift+T``.
"""

from __future__ import annotations

import tkinter as tk
from dataclasses import dataclass
from pathlib import Path

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, World
from robolearn.lessons.schema import Lesson, load_library
from robolearn.memory.store import Store
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider
from robolearn.ui.console_panel import ConsolePanel, HintCardArea
from robolearn.ui.editor_panel import EditorCallbacks, EditorPanel
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
    lessons = library if library is not None else load_library()
    starting_lesson = lessons[0] if lessons else _default_lesson()
    world = _world_from_lesson(starting_lesson)
    rover = Rover(world)
    tracer = Tracer()
    set_active(tracer)
    set_state_provider(lambda: _snapshot(rover))

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

    editor._callbacks = EditorCallbacks(
        on_run=lambda src: _run_clicked(app, sim, sensors, console, hint_card, src),
        on_reset=lambda: _reset_clicked(app, sim, sensors, console, hint_card),
    )
    lessons_panel._callbacks = LessonsCallbacks(
        on_select=lambda lsn: _lesson_selected(app, lsn, editor, sim, sensors, console, hint_card),
    )
    win.on_open_teacher_dashboard(lambda: TeacherDashboard(win.root, store))
    sim.set_world(world, rover)
    sensors.update_from_rover(rover)
    console.log("RoboLearn ready. Pick a lesson on the right, write code, press Run.")
    return app


def launch() -> None:
    """Build the app and enter the Tk main loop."""
    app = build_app()
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


def _run_clicked(
    app: App,
    sim: SimPanel,
    sensors: SensorsPanel,
    console: ConsolePanel,
    hint_card: HintCardArea,
    source: str,
) -> None:
    console.log("Running…", level="info")
    result = run_pupil_code(source, timeout_s=5.0)
    if result.success:
        console.log(f"Run finished in {result.duration_ms} ms", level="info")
    else:
        console.log(
            f"{result.error_kind}: {result.error_message} (line {result.error_line})",
            level="error",
        )
    sim.set_world(app.world, app.rover)
    sensors.update_from_rover(app.rover)


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
