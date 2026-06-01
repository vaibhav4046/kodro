"""Tests for the splash screen and the __main__ entry point."""

from __future__ import annotations

import tkinter as tk
from pathlib import Path

import pytest

import robolearn.__main__ as main_mod
from robolearn.ui.splash import SPLASH_DURATION_MS, show_splash


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


def test_show_splash_returns_toplevel(root: tk.Tk) -> None:
    top = show_splash(root)
    assert isinstance(top, tk.Toplevel)
    # Let the self-destruct timer fire.
    root.update()
    root.after(SPLASH_DURATION_MS + 50, root.quit)
    root.update_idletasks()


def test_main_delegates_to_app(monkeypatch: pytest.MonkeyPatch) -> None:
    called: list[int] = []

    def _fake_app_main() -> int:
        called.append(1)
        return 0

    import robolearn.app as app_mod

    monkeypatch.setattr(app_mod, "main", _fake_app_main)
    rc = main_mod.main([])
    assert rc == 0
    assert called == [1]


def test_main_writes_startup_log(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import robolearn.app as app_mod

    monkeypatch.setattr(app_mod, "main", lambda: 0)
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    rc = main_mod.main([])
    assert rc == 0
    assert (tmp_path / ".robolearn" / "startup.log").exists()


def test_main_handles_app_exception(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import robolearn.app as app_mod

    def _boom() -> int:
        raise RuntimeError("kaboom")

    monkeypatch.setattr(app_mod, "main", _boom)
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    # The fatal-error handler pops a modal messagebox for the .exe user;
    # stub it so the headless test (and CI under xvfb) never blocks on a
    # dialog that no one can dismiss.
    monkeypatch.setattr("tkinter.messagebox.showerror", lambda *a, **k: None)
    # Guarded top-level: returns 1, never raises.
    rc = main_mod.main([])
    assert rc == 1
