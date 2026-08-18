"""The teardown hook that keeps Tcl interpreter finalisation on the main thread.

The abort this guards against is not reproducible here. Windows has no usable
``tk.tcl``, so every Tk fixture skips and no interpreter is ever created; three
probes of the obvious orphan shapes (bare root, root with child widgets, root
holding a bound-method cycle through ``protocol`` and ``bind``) all showed the
root freed by refcounting before any collection ran. Only CI can prove the fix.

What is testable is the wiring, which is the part that actually regresses: the
hook has to exist, it has to collect, and it has to run after the fixture
finalisers rather than before them.
"""

from __future__ import annotations

import gc

import pytest

import conftest


def test_teardown_hook_is_registered_trylast() -> None:
    """Ordering is the whole fix, so it gets its own assertion.

    ``_pytest/runner.py`` runs the fixture finalisers from its own
    ``pytest_runtest_teardown``, and pluggy calls ``trylast`` implementations
    after the normal ones. Drop ``trylast`` and the collect happens while the
    fixture still holds a strong reference to the Tk root, which makes it a
    no-op and leaves the orphan for whichever thread collects next.
    """
    assert conftest.pytest_runtest_teardown.pytest_impl["trylast"] is True


def test_teardown_hook_collects(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[None] = []
    monkeypatch.setattr(gc, "collect", lambda *args: calls.append(None) or 0)

    conftest.pytest_runtest_teardown()

    assert len(calls) == 1
