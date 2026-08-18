"""Headless integration tests for the top-level app wiring.

The full app (MainWindow + sv-ttk theme + every panel) is expensive to
build, so these tests share a single ``build_app`` instance per module
and keep event-loop pumping short.
"""

from __future__ import annotations

import contextlib
import sys
import time
import tkinter as tk
from collections.abc import Iterator

import pytest

from kodro.app import (
    App,
    _default_lesson,
    _snapshot,
    _world_from_lesson,
    build_app,
)
from kodro.engine.rover import Rover
from kodro.ui.main_window import MainWindow

#: The headless GitHub macOS runner intermittently deadlocks inside
#: ``root.update()`` (a long-standing Aqua-in-CI Tk quirk), so every test that
#: pumps the Tk event loop is skipped on Darwin. The same code paths run on
#: Linux (xvfb) and Windows, and the synchronous Step/Stop/grade/welcome
#: tests below still run on macOS, so the grade-on-Run wiring stays covered
#: on all three platforms.
_skip_darwin_anim = pytest.mark.skipif(
    sys.platform == "darwin",
    reason="headless macOS Tk intermittently hangs in root.update()",
)


@pytest.fixture(scope="module")
def app_ctx(tmp_path_factory: pytest.TempPathFactory) -> Iterator[App]:
    """Build the full app once for the whole module."""
    import kodro.app as app_mod

    # Achievement toasts spawn a secondary tk.Toplevel. On a headless
    # macOS (Aqua) runner mapping that window blocks root.update() forever,
    # so neutralise toasts for every app test -- the unlock logic itself is
    # covered elsewhere; here we only care about the Run/Step/grade wiring.
    _orig_toast = app_mod.show_toast
    app_mod.show_toast = lambda *a, **k: None  # type: ignore[assignment]
    tmp = tmp_path_factory.mktemp("app") / "p.db"
    try:
        win = MainWindow()
        win.root.withdraw()
        app = build_app(main_window=win, db_path=tmp)
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        app_mod.show_toast = _orig_toast
        pytest.skip(f"Tk unavailable: {exc}")
    # H3: prove the Tk event loop on THIS machine can actually run scheduled
    # ``after`` callbacks before any timing-sensitive test relies on it. If it
    # cannot (a wedged headless interpreter), the whole GUI group skips cleanly
    # instead of flaking red halfway through a graded run.
    try:
        _require_scheduling(win.root)
    except _TkSchedulingUnavailable as exc:  # pragma: no cover
        app_mod.show_toast = _orig_toast
        app.store.close()
        win.destroy()
        _teardown_tk()
        pytest.skip(f"Tk cannot schedule callbacks: {exc}")
    try:
        yield app
    finally:
        app_mod.show_toast = _orig_toast
        app.store.close()
        win.destroy()
        # H3: drop the Tk default-root so the NEXT GUI test module starts from
        # a clean interpreter rather than inheriting this module's torn-down one.
        _teardown_tk()


class _TkSchedulingUnavailable(RuntimeError):
    """Raised when the Tk event loop cannot run ``after`` callbacks at all."""


#: Hard ceiling for any single graded run to reach its terminal callback. The
#: real work is a handful of 16-90 ms tweened frames, so a few seconds is
#: generous headroom; we poll to COMPLETION and stop early, so a fast machine
#: never waits the full budget and a loaded one never gives up too soon.
_RUN_TIMEOUT_S: float = 8.0


def _teardown_tk() -> None:
    """Destroy any lingering Tk default root so modules don't cross-wire."""
    with contextlib.suppress(Exception):
        root = tk._get_default_root() if hasattr(tk, "_get_default_root") else tk._default_root  # type: ignore[attr-defined]
        if root is not None:
            root.destroy()
    with contextlib.suppress(Exception):
        tk._default_root = None  # type: ignore[attr-defined]


def _require_scheduling(root: tk.Tk) -> None:
    """Confirm ``root.after`` callbacks fire, or raise so the caller can skip."""
    fired = {"ok": False}

    def _mark() -> None:
        fired["ok"] = True

    root.after(0, _mark)
    deadline = time.monotonic() + 2.0
    while not fired["ok"] and time.monotonic() < deadline:
        try:
            root.update()
        except tk.TclError as exc:  # pragma: no cover
            raise _TkSchedulingUnavailable(str(exc)) from exc
    if not fired["ok"]:  # pragma: no cover
        raise _TkSchedulingUnavailable("after(0) callback never fired within 2s")


def _pump_until(
    root: tk.Tk,
    done: object,
    *,
    timeout: float = _RUN_TIMEOUT_S,
    settle: float = 0.05,
) -> bool:
    """Pump the Tk loop until ``done()`` is truthy, then briefly settle.

    Deterministic replacement for the old fixed-wall-clock ``_pump``: it drives
    the SAME ``after``-chained animation the app schedules, but stops the instant
    the run reaches its terminal state (``done()`` true) rather than racing a
    guessed budget. Returns whether the terminal state was observed. A short
    post-settle lets the trailing ``_finish_run`` callbacks (grade + persist)
    flush after the condition first flips.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        root.update()
        if done():  # type: ignore[operator]
            break
    else:
        return False
    settle_end = time.monotonic() + settle
    while time.monotonic() < settle_end:
        root.update()
    return True


def _pump(root: tk.Tk, seconds: float = 0.2) -> None:
    """Flush pending ``after`` callbacks for surfaces with no terminal signal.

    Used only by paths that schedule at most one short callback and expose no
    natural completion predicate (reset, sandbox-rejected run). The graded-run
    tests use :func:`_pump_until` and poll their real terminal state instead.
    """
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        root.update()


def _drain_after(root: tk.Tk, timeout: float = _RUN_TIMEOUT_S) -> None:
    """Run the Tk loop until no ``after`` callbacks remain queued.

    A run's animation is a chain of self-scheduling ``after`` callbacks; if a
    test asserts before the chain finishes, a leftover frame fires DURING the
    next test and corrupts its state (the exact cross-test bleed behind the old
    flakiness). Draining to an empty ``after`` queue between tests makes each
    test start from a quiescent event loop, so order can never matter.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            pending = root.tk.call("after", "info")
        except tk.TclError:  # pragma: no cover
            return
        if not pending:
            return
        root.update()


@pytest.fixture(autouse=True)
def _isolate_run_loop(request: pytest.FixtureRequest) -> Iterator[None]:
    """Quiesce the Tk event loop after every GUI test so none bleed into the next.

    Only engages for tests that took the module ``app_ctx`` fixture (the GUI
    group); pure-helper tests have no root and are left untouched. It requests
    a stop and drains the ``after`` queue, guaranteeing the next test sees no
    in-flight animation regardless of run order.
    """
    yield
    if "app_ctx" not in request.fixturenames:
        return
    app = request.getfixturevalue("app_ctx")
    app.stop_requested = True
    with contextlib.suppress(tk.TclError):
        _drain_after(app.main_window.root)
    app.stop_requested = False


def test_build_app_wires_every_panel(app_ctx: App) -> None:
    win = app_ctx.main_window
    assert app_ctx.lessons  # bundled lessons loaded
    assert app_ctx.rover is not None
    for slot in ("editor", "sim", "sensors", "console"):
        assert win.get_slot(slot) is not None


@_skip_darwin_anim
def test_run_button_drives_and_animates(app_ctx: App) -> None:
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    base_x = app_ctx.world.base[0]
    before = len(app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id))
    editor._callbacks.on_run("move_forward(2)\nbeep(1)\n")  # type: ignore[attr-defined]
    # Poll to the run's TERMINAL callback (the whole tweened animation is drained
    # and _finish_run has persisted the submission) rather than to the first
    # moved frame: draining every chained after() callback here is what stops a
    # trailing frame from firing into -- and corrupting -- the next test.
    finished = _pump_until(
        app_ctx.main_window.root,
        lambda: len(app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id)) > before,
    )
    assert finished, "run never finished (Tk animation did not drain to _finish_run)"
    assert app_ctx.rover.state.x >= base_x


@_skip_darwin_anim
def test_reset_button_restores_world(app_ctx: App) -> None:
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    base_x = app_ctx.world.base[0]
    app_ctx.rover.state.x = 99.0
    editor._callbacks.on_reset()  # type: ignore[attr-defined]
    restored = _pump_until(
        app_ctx.main_window.root, lambda: app_ctx.rover.state.x == base_x, timeout=2.0
    )
    assert restored
    assert app_ctx.rover.state.x == base_x


@_skip_darwin_anim
def test_run_with_invalid_code_does_not_crash(app_ctx: App) -> None:
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    editor._callbacks.on_run("import os")  # sandbox rejects  # type: ignore[attr-defined]
    _pump(app_ctx.main_window.root, 0.2)
    assert app_ctx.rover is not None


@_skip_darwin_anim
def test_run_pass_records_submission_and_clears_hint(app_ctx: App) -> None:
    """A passing run is graded, persisted, and clears the hint card."""
    editor = app_ctx.main_window.get_slot("editor")
    assert editor is not None
    # A criteria-free lesson grades as a guaranteed pass.
    app_ctx.current_lesson = _default_lesson()
    before = len(app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id))
    editor._callbacks.on_run("move_forward(1)")  # type: ignore[attr-defined]
    # Poll to the run's terminal callback (_finish_run persists the submission)
    # rather than guessing a wall-clock budget -- deterministic under load.
    graded = _pump_until(
        app_ctx.main_window.root,
        lambda: len(app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id)) > before,
    )
    assert graded, "graded run never recorded a submission (Tk run did not finish)"
    subs = app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id)
    assert len(subs) == before + 1
    assert subs[-1].passed is True
    assert subs[-1].score == 100
    assert app_ctx.hint_card is not None
    assert app_ctx.hint_card.current_rule is None
    # The rover really executed the move (battery only drains on motion),
    # proving the trace was captured and animated -- not a vacuous pass.
    assert app_ctx.rover.state.battery_pct < 100.0


@_skip_darwin_anim
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
    graded = _pump_until(
        app_ctx.main_window.root,
        lambda: len(app_ctx.store.list_submissions(pupil_id=app_ctx.pupil_id)) > before,
    )
    assert graded, "graded run never recorded a submission (Tk run did not finish)"
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
    # The criteria-free default lesson passes -> green success banner.
    assert app_ctx.hint_card is not None
    assert "Mission complete" in app_ctx.hint_card.text()
    # The adaptive recommender surfaces a next lesson in the console.
    assert app_ctx.console is not None
    assert "Recommended next" in app_ctx.console.text()


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
    import kodro.app as app_mod
    from kodro.engine.terrain import Terrain
    from kodro.ui.welcome_wizard import WizardResult

    sentinel = tmp_path / "config.toml"  # type: ignore[operator]
    monkeypatch.setattr(app_mod, "WELCOME_SENTINEL", sentinel)

    class _FakeWizard:
        def __init__(self, _parent: object, *, on_complete=None) -> None:  # type: ignore[no-untyped-def]
            if on_complete is not None:
                on_complete(WizardResult("Ada", "13-14", "KS3", Terrain.MARS))

    monkeypatch.setattr("kodro.ui.welcome_wizard.WelcomeWizard", _FakeWizard)
    app_mod._maybe_show_welcome(app_ctx)
    assert sentinel.exists()  # type: ignore[attr-defined]
    assert 'display_name = "Ada"' in sentinel.read_text(encoding="utf-8")  # type: ignore[attr-defined]
    pupil = app_ctx.store.get_pupil(app_ctx.pupil_id)
    assert pupil is not None and pupil.display_name == "Ada"


def test_welcome_config_is_valid_toml_for_tricky_name(
    app_ctx: App, tmp_path: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A display name with a quote/newline must still write parseable TOML."""
    import tomllib

    import kodro.app as app_mod
    from kodro.engine.terrain import Terrain
    from kodro.ui.welcome_wizard import WizardResult

    sentinel = tmp_path / "config.toml"  # type: ignore[operator]
    monkeypatch.setattr(app_mod, "WELCOME_SENTINEL", sentinel)
    tricky = 'Ada "the\nGreat"'

    class _FakeWizard:
        def __init__(self, _parent: object, *, on_complete=None) -> None:  # type: ignore[no-untyped-def]
            if on_complete is not None:
                on_complete(WizardResult(tricky, "13-14", "KS3", Terrain.MARS))

    monkeypatch.setattr("kodro.ui.welcome_wizard.WelcomeWizard", _FakeWizard)
    app_mod._maybe_show_welcome(app_ctx)
    data = tomllib.loads(sentinel.read_text(encoding="utf-8"))  # type: ignore[attr-defined]
    assert data["display_name"] == tricky
    assert data["terrain"] == "mars"


def test_welcome_skips_when_sentinel_exists(
    app_ctx: App, tmp_path: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    import kodro.app as app_mod

    sentinel = tmp_path / "config.toml"  # type: ignore[operator]
    sentinel.write_text("seen", encoding="utf-8")  # type: ignore[attr-defined]
    monkeypatch.setattr(app_mod, "WELCOME_SENTINEL", sentinel)
    calls: list[int] = []

    class _FakeWizard:
        def __init__(self, *_a: object, **_k: object) -> None:
            calls.append(1)

    monkeypatch.setattr("kodro.ui.welcome_wizard.WelcomeWizard", _FakeWizard)
    app_mod._maybe_show_welcome(app_ctx)
    assert calls == []  # short-circuited before constructing the wizard


def test_a11y_controls_change_and_persist(
    app_ctx: App, tmp_path: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A-/A+ and the contrast toggle mutate, apply and persist settings."""
    import kodro.app as app_mod
    from kodro.ui.a11y import A11ySettings

    monkeypatch.setattr(app_mod, "A11Y_PATH", tmp_path / "a11y.toml")  # type: ignore[operator]
    app_ctx.a11y_settings = A11ySettings()
    app_mod._change_text_scale(app_ctx, larger=True)
    assert app_ctx.a11y_settings is not None
    assert app_ctx.a11y_settings.text_scale > 1.0
    before = app_ctx.a11y_settings.high_contrast
    app_mod._toggle_high_contrast(app_ctx)
    assert app_ctx.a11y_settings.high_contrast is not before
    assert (tmp_path / "a11y.toml").exists()  # type: ignore[attr-defined]


@_skip_darwin_anim  # opening a Toplevel segfaults the headless macOS runner
def test_trophies_dialog_opens_and_lists_all(app_ctx: App) -> None:
    """The trophy case opens and lists every catalogue entry."""
    from kodro.app import _show_trophies
    from kodro.memory.achievements import CATALOGUE

    dialog = _show_trophies(app_ctx)
    try:
        assert dialog is not None
        labels = list(dialog.winfo_children()[0].winfo_children())
        # header + one row per achievement
        assert len(labels) >= len(CATALOGUE)
    finally:
        dialog.destroy()


def test_export_report_writes_and_logs(
    app_ctx: App, tmp_path: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Report button writes an HTML file and logs its path (no dialog)."""
    import kodro.app as app_mod

    out = tmp_path / "r.html"  # type: ignore[operator]
    monkeypatch.setattr(app_mod, "REPORT_PATH", out)
    assert app_ctx.console is not None
    app_mod._export_report(app_ctx, app_ctx.console)
    assert out.exists()  # type: ignore[attr-defined]
    assert "progress report" in app_ctx.console.text()


def test_replay_last_warns_when_no_run(app_ctx: App) -> None:
    """Replay with an empty tracer warns and opens no dialog (macOS-safe)."""
    from kodro.app import _replay_last

    app_ctx.tracer.clear()
    assert app_ctx.console is not None
    result = _replay_last(app_ctx, app_ctx.console)
    assert result is None
    assert "Nothing to replay" in app_ctx.console.text()


def test_sound_toggle_flips_persists_and_applies(
    app_ctx: App, tmp_path: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The sound toggle mutes effects, persists the choice, and re-applies."""
    import kodro.app as app_mod
    from kodro.ui import sounds
    from kodro.ui.a11y import A11ySettings

    monkeypatch.setattr(app_mod, "A11Y_PATH", tmp_path / "a11y.toml")  # type: ignore[operator]
    app_ctx.a11y_settings = A11ySettings(sound_enabled=True)
    app_mod._toggle_sound(app_ctx)
    assert app_ctx.a11y_settings.sound_enabled is False
    assert sounds.is_enabled() is False
    assert (tmp_path / "a11y.toml").exists()  # type: ignore[attr-defined]
    app_mod._toggle_sound(app_ctx)  # restore for other tests
    assert sounds.is_enabled() is True


# --- the .kodro bridge to the website --------------------------------------
#
# Save and Open are the desktop half of the two-implementation file format, and
# the failure they exist to prevent is silent: a pupil's work crossing to the
# website and arriving empty. Both take an injectable chooser precisely so the
# path a pupil actually walks can be exercised with no file dialog -- these
# tests drive that path rather than the ``# pragma: no cover -- GUI`` default.


def _console_tail(app: App, mark: int) -> str:
    """Console text logged since ``mark``.

    The app fixture is module-scoped, so the console accumulates every earlier
    test's output; asserting on the whole buffer would let an unrelated line
    satisfy the assertion.
    """
    assert app.console is not None
    return app.console.text()[mark:]


def _console_mark(app: App) -> int:
    assert app.console is not None
    return len(app.console.text())


def _editor(app: App):
    editor = app.main_window.get_slot("editor")
    assert editor is not None
    return editor


def test_cancelling_the_save_dialog_writes_nothing(app_ctx: App, tmp_path: object) -> None:
    """A pupil who backs out of the file dialog gets no file and no log noise."""
    from kodro.app import _save_project

    assert app_ctx.console is not None
    mark = _console_mark(app_ctx)
    result = _save_project(app_ctx, app_ctx.console, _editor(app_ctx), chooser=lambda _s: None)
    assert result is None
    assert list(tmp_path.iterdir()) == []  # type: ignore[attr-defined]
    assert _console_tail(app_ctx, mark) == ""


def test_cancelling_the_open_dialog_leaves_the_editor_alone(app_ctx: App) -> None:
    from kodro.app import _open_project

    assert app_ctx.console is not None
    editor = _editor(app_ctx)
    editor.set_source("move_forward(1)")
    mark = _console_mark(app_ctx)
    assert _open_project(app_ctx, app_ctx.console, editor, chooser=lambda: None) is False
    assert editor.get_source().strip() == "move_forward(1)"
    assert _console_tail(app_ctx, mark) == ""


def test_a_saved_project_opens_back_into_the_editor(app_ctx: App, tmp_path: object) -> None:
    """The round trip that matters: what was written is what comes back."""
    from kodro.app import _open_project, _save_project

    assert app_ctx.console is not None
    editor = _editor(app_ctx)
    program = "move_forward(2)\nturn_left(90)\nbeep(1)"
    editor.set_source(program)
    target = tmp_path / "trip.kodro"  # type: ignore[operator]

    written = _save_project(app_ctx, app_ctx.console, editor, chooser=lambda _s: target)
    assert written == target
    assert target.exists()

    editor.set_source("# cleared")
    mark = _console_mark(app_ctx)
    assert _open_project(app_ctx, app_ctx.console, editor, chooser=lambda: target) is True
    assert editor.get_source().strip() == program
    assert "Loaded" in _console_tail(app_ctx, mark)


def test_the_suggested_file_name_reaches_the_chooser(app_ctx: App, tmp_path: object) -> None:
    """The dialog is pre-filled, so a pupil is not asked to invent a name."""
    from kodro.app import _save_project

    assert app_ctx.console is not None
    seen: list[str] = []

    def chooser(suggested: str):
        seen.append(suggested)
        return tmp_path / suggested  # type: ignore[operator]

    _save_project(app_ctx, app_ctx.console, _editor(app_ctx), chooser=chooser)
    # No KRS spec exists on the desktop side, so the generic name is correct
    # here -- what is being asserted is that a name arrives at all.
    assert seen == ["kodro-project.kodro"]


def test_an_unwritable_target_is_reported_not_raised(app_ctx: App, tmp_path: object) -> None:
    """A save that cannot land says so; it does not take the app down."""
    from kodro.app import _save_project

    assert app_ctx.console is not None
    # A real filesystem refusal rather than a patched one: writing over a
    # directory raises IsADirectoryError on POSIX and PermissionError on
    # Windows, both OSError, which is the branch under test.
    blocked = tmp_path / "a-directory.kodro"  # type: ignore[operator]
    blocked.mkdir()
    mark = _console_mark(app_ctx)
    result = _save_project(app_ctx, app_ctx.console, _editor(app_ctx), chooser=lambda _s: blocked)
    assert result is None
    assert "Could not save the project" in _console_tail(app_ctx, mark)


def test_a_corrupt_file_is_refused_with_the_shared_wording(app_ctx: App, tmp_path: object) -> None:
    from kodro.app import _open_project

    assert app_ctx.console is not None
    editor = _editor(app_ctx)
    editor.set_source("keep me")
    bad = tmp_path / "bad.kodro"  # type: ignore[operator]
    bad.write_text("{not json", encoding="utf-8")
    mark = _console_mark(app_ctx)
    assert _open_project(app_ctx, app_ctx.console, editor, chooser=lambda: bad) is False
    tail = _console_tail(app_ctx, mark)
    assert "Could not open that project" in tail
    assert "Not valid JSON" in tail
    assert editor.get_source().strip() == "keep me"


def test_a_project_with_no_program_leaves_the_editor_unchanged(
    app_ctx: App, tmp_path: object
) -> None:
    """An empty project must not blank the editor a pupil is working in."""
    import json

    from kodro.app import _open_project

    assert app_ctx.console is not None
    editor = _editor(app_ctx)
    editor.set_source("work in progress")
    empty = tmp_path / "empty.kodro"  # type: ignore[operator]
    empty.write_text(json.dumps({"kodroProject": 1}), encoding="utf-8")
    mark = _console_mark(app_ctx)
    assert _open_project(app_ctx, app_ctx.console, editor, chooser=lambda: empty) is False
    assert editor.get_source().strip() == "work in progress"
    assert "no program saved in it" in _console_tail(app_ctx, mark)


def test_a_web_only_world_is_named_as_web_only(app_ctx: App, tmp_path: object) -> None:
    """``city`` has no desktop terrain, and the pupil is told rather than moved."""
    import json

    from kodro.app import _open_project

    assert app_ctx.console is not None
    editor = _editor(app_ctx)
    here = app_ctx.world.terrain.value
    doc = {"kodroProject": 1, "tab": "drive", "programs": {"drive": "wait(1)"}, "world": "city"}
    from_web = tmp_path / "city.kodro"  # type: ignore[operator]
    from_web.write_text(json.dumps(doc), encoding="utf-8")
    mark = _console_mark(app_ctx)
    assert _open_project(app_ctx, app_ctx.console, editor, chooser=lambda: from_web) is True
    tail = _console_tail(app_ctx, mark)
    assert "city (web only)" in tail
    # The lesson's world is what the grader marks, so it must not have moved.
    assert app_ctx.world.terrain.value == here
    assert f"stays in {here}" in tail


def test_a_shared_world_is_named_without_the_web_only_caveat(
    app_ctx: App, tmp_path: object
) -> None:
    """A world both halves have is reported plainly -- no misleading caveat."""
    import json

    from kodro.app import SHARED_WORLDS, _open_project

    assert app_ctx.console is not None
    editor = _editor(app_ctx)
    here = app_ctx.world.terrain.value
    other = next(w for w in sorted(SHARED_WORLDS) if w != here)
    doc = {"kodroProject": 1, "tab": "drive", "programs": {"drive": "wait(1)"}, "world": other}
    path = tmp_path / "shared.kodro"  # type: ignore[operator]
    path.write_text(json.dumps(doc), encoding="utf-8")
    mark = _console_mark(app_ctx)
    assert _open_project(app_ctx, app_ctx.console, editor, chooser=lambda: path) is True
    tail = _console_tail(app_ctx, mark)
    assert f"saved in {other}" in tail
    assert "web only" not in tail


def test_source_for_lesson_resume_vs_starter(app_ctx: App) -> None:
    """A lesson with no history yields its starter; with history, the last code."""
    import dataclasses

    from kodro.app import _source_for_lesson

    pupil = app_ctx.store.create_pupil("resume-test")
    probe = dataclasses.replace(app_ctx, pupil_id=pupil.id)
    lesson = app_ctx.lessons[0]

    src, resumed = _source_for_lesson(probe, lesson)
    assert resumed is False
    assert src.strip() == lesson.starter_code.strip()

    app_ctx.store.record_submission(
        pupil_id=pupil.id,
        lesson_id=lesson.id,
        code="move_forward(7)",
        passed=False,
        score=0,
        reasons=[],
    )
    src2, resumed2 = _source_for_lesson(probe, lesson)
    assert resumed2 is True
    assert src2 == "move_forward(7)"


def test_restore_starter_resets_editor_code(app_ctx: App) -> None:
    """Restoring puts the current lesson's starter code back in the editor."""
    from kodro.app import _restore_starter

    lesson = app_ctx.lessons[0]
    app_ctx.current_lesson = lesson
    assert app_ctx.editor is not None and app_ctx.console is not None
    app_ctx.editor.set_source("# scribbled over\nmove_forward(99)\n")
    _restore_starter(app_ctx, app_ctx.console)
    assert app_ctx.editor.get_source().strip() == lesson.starter_code.strip()


def test_mission_bar_status_and_speed(app_ctx: App) -> None:
    """The mission-bar status dot recolours and the speed slider sets the factor."""
    from kodro.app import _set_speed, _set_status
    from kodro.ui import orbital

    assert app_ctx.status_dot is not None
    _set_status(app_ctx, "run")
    assert str(app_ctx.status_dot.cget("foreground")) == orbital.CYAN  # type: ignore[attr-defined]
    _set_status(app_ctx, "error")
    assert str(app_ctx.status_dot.cget("foreground")) == orbital.DANGER  # type: ignore[attr-defined]

    _set_speed(app_ctx, 2.0)
    assert app_ctx.speed_factor == 2.0
    _set_speed(app_ctx, "not-a-number")
    assert app_ctx.speed_factor == 1.0
    _set_status(app_ctx, "idle")  # leave clean


def test_progress_strip_reflects_store(app_ctx: App) -> None:
    """The topbar progress strip renders streak / passed / last score."""
    from kodro.app import _progress_text, _refresh_progress

    app_ctx.store.record_submission(
        pupil_id=app_ctx.pupil_id,
        lesson_id="01_hello_rover",
        code="move_forward(1)",
        passed=True,
        score=77,
        reasons=[],
    )
    text = _progress_text(app_ctx)
    assert "Streak" in text
    assert "passed" in text
    assert "Last 77" in text
    _refresh_progress(app_ctx)
    assert app_ctx.progress_label is not None
    assert app_ctx.progress_label.cget("text") == text  # type: ignore[attr-defined]


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
