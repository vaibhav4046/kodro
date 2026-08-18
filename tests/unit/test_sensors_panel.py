"""SensorsPanel and LessonsPanel unit tests (Task 14)."""

from __future__ import annotations

import os
import tkinter as tk

import pytest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")

from kodro.engine.rover import Rover
from kodro.engine.terrain import Terrain
from kodro.engine.world import ArenaBounds, Sample, World
from kodro.lessons.schema import Lesson, WorldDef
from kodro.memory.pupil_model import PupilStrength
from kodro.ui.lessons_panel import LessonsCallbacks, LessonsPanel
from kodro.ui.sensors_panel import SensorsPanel


@pytest.fixture
def root():  # type: ignore[no-untyped-def]
    try:
        r = tk.Tk()
        r.withdraw()
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        pytest.skip(f"Tk unavailable: {exc}")
    try:
        yield r
    finally:
        r.destroy()


def _world() -> World:
    return World(
        terrain=Terrain.MARS,
        base=(1.0, 1.0),
        samples=[Sample(2.0, 2.0)],
        bounds=ArenaBounds(6.0, 6.0),
    )


def _lesson(lesson_id: str = "X") -> Lesson:
    return Lesson(
        id=lesson_id,
        title=f"Lesson {lesson_id}",
        key_stage="KS3",  # type: ignore[arg-type]
        ct_concepts=["sequence"],  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",  # type: ignore[arg-type]
        intro="hi",
        starter_code="move_forward(1)",
        allowed_constructs=["function_call"],  # type: ignore[arg-type]
        max_lines=10,
        world=WorldDef(base=(1.0, 1.0)),
    )


# --- SensorsPanel ----------------------------------------------------------


def test_sensors_panel_initialises_with_placeholders(root: tk.Tk) -> None:
    panel = SensorsPanel(root)
    panel.clear()  # ensure clear() does not raise


def test_sensors_panel_update_displays_battery(root: tk.Tk) -> None:
    panel = SensorsPanel(root)
    rover = Rover(_world())
    rover.state.battery_pct = 73.5
    panel.update_from_rover(rover)
    # battery row text contains the value (read via the underlying StringVar)
    assert "73.5" in panel._rows.battery.get()  # type: ignore[attr-defined]


def test_sensors_panel_distance_displays_infinity_in_empty_arena(root: tk.Tk) -> None:
    panel = SensorsPanel(root)
    world = World(terrain=Terrain.SPACE, base=(5.0, 5.0), bounds=ArenaBounds(1000.0, 1000.0))
    rover = Rover(world)
    panel.update_from_rover(rover)
    assert "∞" in panel._rows.distance.get()  # type: ignore[attr-defined]


def test_sensors_panel_colour_is_hex_string(root: tk.Tk) -> None:
    panel = SensorsPanel(root)
    rover = Rover(_world())
    panel.update_from_rover(rover)
    text = panel._rows.colour.get()  # type: ignore[attr-defined]
    assert text.startswith("#")
    assert len(text) == 7


# --- LessonsPanel ----------------------------------------------------------


def test_lessons_panel_populates_listbox_on_init(root: tk.Tk) -> None:
    lessons = [_lesson("01"), _lesson("02")]
    panel = LessonsPanel(root, lessons=lessons)
    assert panel._listbox.size() == 2  # type: ignore[attr-defined]


def test_lessons_panel_set_lessons_replaces_list(root: tk.Tk) -> None:
    panel = LessonsPanel(root, lessons=[_lesson("a")])
    panel.set_lessons([_lesson("b"), _lesson("c"), _lesson("d")])
    assert panel._listbox.size() == 3  # type: ignore[attr-defined]
    assert tuple(lsn.id for lsn in panel.lessons) == ("b", "c", "d")


def test_lessons_panel_marks_completed_with_tick(root: tk.Tk) -> None:
    panel = LessonsPanel(root, lessons=[_lesson("a"), _lesson("b")])
    panel.set_completed({"a"})
    first = panel._listbox.get(0)  # type: ignore[attr-defined]
    second = panel._listbox.get(1)  # type: ignore[attr-defined]
    assert first.startswith("✓") and "a" in first
    assert second.startswith("•") and "b" in second
    # Replacing the list keeps the completed marks.
    panel.set_lessons([_lesson("a"), _lesson("b")])
    assert panel._listbox.get(0).startswith("✓")  # type: ignore[attr-defined]


def test_lessons_panel_selected_lesson_returns_none_when_no_selection(root: tk.Tk) -> None:
    panel = LessonsPanel(root, lessons=[_lesson("a")])
    assert panel.selected_lesson() is None


def test_lessons_panel_select_fires_on_select(root: tk.Tk) -> None:
    received: list[str] = []
    cb = LessonsCallbacks(on_select=lambda lsn: received.append(lsn.id))
    panel = LessonsPanel(root, lessons=[_lesson("a"), _lesson("b")], callbacks=cb)
    panel.select(1)
    assert received == ["b"]


def test_lessons_panel_select_out_of_range_raises(root: tk.Tk) -> None:
    panel = LessonsPanel(root, lessons=[_lesson("a")])
    with pytest.raises(IndexError):
        panel.select(99)


def test_lessons_panel_update_pupil_memory_renders_lines(root: tk.Tk) -> None:
    panel = LessonsPanel(root, lessons=[_lesson("a")])
    strengths = [
        PupilStrength(concept="sequence", score=0.8, successes=4, failures=1, last_seen=0),
        PupilStrength(concept="iteration", score=0.5, successes=1, failures=1, last_seen=0),
    ]
    panel.update_pupil_memory(strengths)
    rendered = panel._memory_text.get("1.0", tk.END)  # type: ignore[attr-defined]
    assert "sequence" in rendered
    assert "iteration" in rendered
