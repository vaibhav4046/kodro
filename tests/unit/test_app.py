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


def test_run_pass_records_submission_and_clears_hint(app_ctx: App) -> None:
    """A passing run is graded, persisted, and clears the hint card."""
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    # A criteria-free lesson grades as a guaranteed pass.
    app_ctx.current_lesson = _default_lesson()
    before = len(app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id))
    editor._callbacks.on_run("move_forward(1)")  # type: ignore[attr-defined]
    _pump(app_ctx.main_window.root, 0.9)
    subs = app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id)
    assert len(subs) == before + 1
    assert subs[-1].passed is True
    assert subs[-1].score == 100
    assert app_ctx.hint_card is not None
    assert app_ctx.hint_card.current_rule is None
    # The rover really executed the move (battery only drains on motion),
    # proving the trace was captured and animated -- not a vacuous pass.
    assert app_ctx.rover.state.battery_pct < 100.0


def test_run_fail_records_and_surfaces_hint(app_ctx: App) -> None:
    """A failing run records a failing submission and shows a hint."""
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    sample_lessons = [
        lesson
        for lesson in app_ctx.lessons
        if any(c.samples_collected for c in lesson.success_criteria)
    ]
    assert sample_lessons, "expected at least one sample-collecting lesson"
    app_ctx.current_lesson = sample_lessons[0]
    before = len(app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id))
    editor._callbacks.on_run("move_forward(1)")  # type: ignore[attr-defined]
    _pump(app_ctx.main_window.root, 0.9)
    subs = app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id)
    assert len(subs) == before + 1
    assert subs[-1].passed is False
    assert app_ctx.hint_card is not None
    assert app_ctx.hint_card.current_rule is not None


def test_step_advances_then_finishes(app_ctx: App) -> None:
    """Step starts a session, advances one event per click, then grades."""
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    app_ctx.current_lesson = _default_lesson()
    # Exercise every instant-apply branch: turn, move, collect, drop, log, beep.
    src = "turn_left(45)\nmove_forward(1)\ncollect_sample()\ndrop_sample()\nlog('x')\nbeep(1)\n"
    editor._callbacks.on_step(src)  # type: ignore[attr-defined]
    assert app_ctx.step_index >= 1
    for _ in range(12):
        if not app_ctx.step_events:
            break
        editor._callbacks.on_step(src)  # type: ignore[attr-defined]
    assert app_ctx.step_events is None


def test_stop_sets_flag_and_clears_step(app_ctx: App) -> None:
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    app_ctx.stop_requested = False
    editor._callbacks.on_stop()  # type: ignore[attr-defined]
    assert app_ctx.stop_requested is True
    assert app_ctx.step_events is None


def test_welcome_writes_sentinel_and_renames(
    app_ctx: App, tmp_path: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    """First-run wizard persists the profile sentinel and renames the pupil."""
    import robolearn.app as app_mod
    from robolearn.engine.terrain import Terrain
    from robolearn.ui.welcome_wizard import WizardResult

    sentinel = tmp_path / "config.toml"  # type: ignore[operator]
    monkeypatch.setattr(app_mod, "WELCOME_SENTINEL", sentinel)

    class _FakeWizard:
        def __init__(self, _parent: object, *, on_complete=None) -> None:  # type: ignore[no-untyped-def]
            if on_complete is not None:
                on_complete(WizardResult("Ada", "13-14", "KS3", Terrain.MARS))

    monkeypatch.setattr("robolearn.ui.welcome_wizard.WelcomeWizard", _FakeWizard)
    app_mod._maybe_show_welcome(app_ctx)
    assert sentinel.exists()  # type: ignore[attr-defined]
    assert 'display_name = "Ada"' in sentinel.read_text(encoding="utf-8")  # type: ignore[attr-defined]
    pupil = app_ctx.store.get_pupil(app_ctx.pupil_id)
    assert pupil is not None and pupil.display_name == "Ada"


def test_welcome_skips_when_sentinel_exists(
    app_ctx: App, tmp_path: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    import robolearn.app as app_mod

    sentinel = tmp_path / "config.toml"  # type: ignore[operator]
    sentinel.write_text("seen", encoding="utf-8")  # type: ignore[attr-defined]
    monkeypatch.setattr(app_mod, "WELCOME_SENTINEL", sentinel)
    calls: list[int] = []

    class _FakeWizard:
        def __init__(self, *_a: object, **_k: object) -> None:
            calls.append(1)

    monkeypatch.setattr("robolearn.ui.welcome_wizard.WelcomeWizard", _FakeWizard)
    app_mod._maybe_show_welcome(app_ctx)
    assert calls == []  # short-circuited before constructing the wizard


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
