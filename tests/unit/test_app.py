"""Headless integration tests for the top-level app wiring.

The full app (MainWindow + sv-ttk theme + every panel) is expensive to
build, so these tests share a single ``build_app`` instance per module
and keep event-loop pumping short.
"""

from __future__ import annotations

import time
import tkinter as tk
from collections.abc import Iterator

import pytest

from robolearn.app import (
    App,
    _default_lesson,
    _snapshot,
    _world_from_lesson,
    build_app,
)
from robolearn.engine.rover import Rover
from robolearn.ui.main_window import MainWindow


@pytest.fixture(scope="module")
def app_ctx(tmp_path_factory: pytest.TempPathFactory) -> Iterator[App]:
    """Build the full app once for the whole module."""
    tmp = tmp_path_factory.mktemp("app") / "p.db"
    try:
        win = MainWindow()
        win.root.withdraw()
        app = build_app(main_window=win, db_path=tmp)
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        pytest.skip(f"Tk unavailable: {exc}")
    try:
        yield app
    finally:
        app.store.close()
        win.destroy()


def _pump(root: tk.Tk, seconds: float = 0.4) -> None:
    """Run the Tk event loop briefly to flush after() callbacks."""
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        root.update()


def test_build_app_wires_every_panel(app_ctx: App) -> None:
    win = app_ctx.main_window
    assert app_ctx.lessons  # bundled lessons loaded
    assert app_ctx.rover is not None
    for slot in ("editor", "sim", "sensors", "console"):
        assert win.get_slot(slot) is not None


def test_run_button_drives_and_animates(app_ctx: App) -> None:
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    editor._callbacks.on_run("move_forward(2)\nbeep(1)\n")  # type: ignore[attr-defined]
    _pump(app_ctx.main_window.root, 0.8)
    assert app_ctx.rover.state.x >= app_ctx.world.base[0]


def test_reset_button_restores_world(app_ctx: App) -> None:
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    app_ctx.rover.state.x = 99.0
    editor._callbacks.on_reset()  # type: ignore[attr-defined]
    _pump(app_ctx.main_window.root, 0.2)
    assert app_ctx.rover.state.x == app_ctx.world.base[0]


def test_run_with_invalid_code_does_not_crash(app_ctx: App) -> None:
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    editor._callbacks.on_run("import os")  # sandbox rejects  # type: ignore[attr-defined]
    _pump(app_ctx.main_window.root, 0.2)
    assert app_ctx.rover is not None


# --- pure helpers (no Tk) --------------------------------------------------


def test_helpers_world_and_snapshot() -> None:
    lesson = _default_lesson()
    world = _world_from_lesson(lesson)
    rover = Rover(world)
    snap = _snapshot(rover)
    assert snap.x == rover.state.x
    assert snap.battery_pct == rover.state.battery_pct


def test_default_lesson_is_valid() -> None:
    lesson = _default_lesson()
    assert lesson.id == "fallback"
    assert lesson.terrain.value == "earth"
