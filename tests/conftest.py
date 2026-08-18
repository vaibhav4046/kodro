"""Shared pytest fixtures."""

from __future__ import annotations

import gc
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


@pytest.hookimpl(trylast=True)
def pytest_runtest_teardown() -> None:
    """Finalise any orphaned Tk interpreter on the main thread, after every test.

    The macOS CI job aborted part-way through the suite with::

        Tcl_AsyncDelete: async handler deleted by the wrong thread
        Fatal Python error: Aborted
        Current thread 0x000000016ed97000 (most recent call first):
          Garbage-collecting
          File ".../coverage/collector.py", line 295 in _installation_trace
          File ".../threading.py", line 1001 in run

    ``Tk.destroy()`` tears down the widget tree but not the Tcl interpreter, so
    the Python ``Tk`` object can outlive the fixture that made it, as garbage.
    Whatever thread happens to run the collection that frees it ends up calling
    ``Tcl_DeleteInterp``, and Tcl aborts the process when that is not the thread
    that created the interpreter. ``concurrency = ["thread"]`` in the coverage
    config puts a tracer on every thread the pupil-code executor spawns, so a
    worker thread hitting a collection point is routine here. Every interpreter
    in this suite is created on the main thread, so collecting here makes the
    main thread the one that frees them.

    ``trylast`` is load-bearing. ``_pytest/runner.py`` runs the fixture
    finalisers from its own ``pytest_runtest_teardown``, and pluggy calls
    ``trylast`` implementations after the normal ones, so this fires after
    ``root.destroy()`` rather than before it, and after module-scoped finalisers
    such as the ``app_ctx`` in ``tests/unit/test_app.py``.

    Unconditional on purpose. Thirteen test files build a Tk, through three
    different fixtures and once with no fixture at all
    (``test_main_handles_app_exception`` forces ``__main__.main`` into its error
    handler, which builds a root of its own). A predicate keyed on fixture names
    misses that fourth shape and would go on missing new ones silently. A full
    collect measures about 7 ms against this suite's heap, so roughly 12 s over
    1642 tests. That is the price of not having to guess.

    Windows CI never hit this abort because it has no usable ``tk.tcl`` and skips
    every Tk fixture, so it creates no interpreters to orphan.
    """
    gc.collect()


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
