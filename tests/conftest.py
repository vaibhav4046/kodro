"""Shared pytest fixtures."""

from __future__ import annotations

import os
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest

# Force SDL to a headless dummy audio device before pygame is imported
# anywhere, so the procedural sound effects can initialise the mixer in CI
# (and any machine without a sound card) without touching real hardware,
# raising, or blocking.
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

from robolearn.runtime import tracer as _tracer

_NODE_SUBPROCESS_TESTS = {
    "test_golden_traces.py",
    "test_motion_model_conformance.py",
    "test_physical_golden_trace.py",
    "test_qa_interpreter.py",
    "test_web_bundle.py",
    "test_web_interpreter.py",
    "test_web_jsx_valid.py",
    "test_web_lesson_parity.py",
    "test_web_render.py",
}


def _needs_local_node_no_cover_marker() -> bool:
    return (
        os.name == "nt"
        and sys.version_info >= (3, 13)
        and os.environ.get("CI", "").lower() != "true"
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Keep the isolated web-offline gate from failing on whole-repo coverage.

    ``python -m pytest`` remains the coverage gate. The documented offline
    command exercises four static web-asset tests, so applying the same 85%
    whole-package threshold there makes a passing offline check exit 1.
    """
    collected: set[str] = set()
    mark_node_subprocesses_no_cover = _needs_local_node_no_cover_marker()
    for item in items:
        filename = Path(str(item.fspath)).name
        collected.add(filename)
        if mark_node_subprocesses_no_cover and filename in _NODE_SUBPROCESS_TESTS:
            item.add_marker(pytest.mark.no_cover)

    if collected == {"test_web_offline.py"}:
        config.option.cov_fail_under = 0
        cov_plugin = config.pluginmanager.getplugin("_cov")
        cov_options = getattr(cov_plugin, "options", None)
        if cov_options is not None:
            cov_options.cov_fail_under = 0


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
