"""Shared pytest fixtures."""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

# Force SDL to a headless dummy audio device before pygame is imported
# anywhere, so the procedural sound effects can initialise the mixer in CI
# (and any machine without a sound card) without touching real hardware,
# raising, or blocking.
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

from robolearn.runtime import tracer as _tracer


@pytest.fixture(autouse=True)
def _no_blocking_dialogs(monkeypatch: pytest.MonkeyPatch) -> None:
    """Neutralise Tk modal dialogs so a headless test run never blocks.

    Several UI modules pop ``tkinter.messagebox`` dialogs on error paths
    (teacher_dashboard, lesson_editor, __main__). Under xvfb/CI these are modal
    and wait for a click that never comes, hanging the whole suite (this is what
    made the Linux CI job time out). Replace them with non-blocking stubs; a test
    that specifically checks a dialog can still re-patch them itself.
    """
    import tkinter.messagebox as mb

    monkeypatch.setattr(mb, "showerror", lambda *a, **k: None, raising=False)
    monkeypatch.setattr(mb, "showinfo", lambda *a, **k: None, raising=False)
    monkeypatch.setattr(mb, "showwarning", lambda *a, **k: None, raising=False)
    monkeypatch.setattr(mb, "askyesno", lambda *a, **k: True, raising=False)
    monkeypatch.setattr(mb, "askokcancel", lambda *a, **k: True, raising=False)


@pytest.fixture(autouse=True)
def _reset_tracer_module_state() -> Iterator[None]:
    """Detach any active tracer / state provider before and after each test.

    The tracer module exposes module-level globals (``_active_tracer`` and
    ``_state_provider``); without this reset, a test that forgets to
    clean up could leak state into the next test.
    """
    _tracer.set_active(None)
    _tracer.set_state_provider(None)
    yield
    _tracer.set_active(None)
    _tracer.set_state_provider(None)
