"""The timeout kill path must actually kill.

``execute()`` runs pupil code on a worker thread and gives it a wall clock. When
that clock runs out, ``_force_kill_thread`` uses the CPython internal
``PyThreadState_SetAsyncExc`` to raise ``SystemExit`` inside the still-running
thread. Its docstring records why this exists: without it, coverage flush raced
with live pupil threads on Linux CI and the process died with SIGABRT.

Mutation testing scored ``runtime/executor.py`` at 56.2%, and the survivors were
concentrated in exactly this function, because nothing asserted what it does
with the C API's return value. One of those mutants is a real defect rather than
a nicety:

    if res > 1:      ->    if res >= 1:

``res == 1`` is the success case. Under the mutant a successful kill is treated
as "more than one thread affected", immediately rolled back, and the function
returns. The runaway thread is never killed and the timeout silently does
nothing.

These tests drive ``_force_kill_thread`` directly with a stubbed C API, because
the three interesting return values (0, 1, and >1) cannot be produced on demand
from real pupil code. The thread object is stubbed too: this is a unit test of
the decision logic, and starting a real runaway thread to test the code that
kills runaway threads would be its own hazard.
"""

from __future__ import annotations

import ctypes
from typing import Any

import pytest

from kodro.runtime.executor import _force_kill_thread


class _FakeThread:
    """Minimal stand-in for the parts of Thread that _force_kill_thread reads."""

    def __init__(self, ident: int | None, alive: bool = True) -> None:
        self.ident = ident
        self._alive = alive
        self.joins: list[float | None] = []

    def is_alive(self) -> bool:
        return self._alive

    def join(self, timeout: float | None = None) -> None:
        self.joins.append(timeout)


class _RecordingApi:
    """Records every SetAsyncExc call and returns a scripted sequence."""

    def __init__(self, returns: list[int]) -> None:
        self._returns = list(returns)
        self.calls: list[tuple[int, Any]] = []

    def __call__(self, ident: ctypes.c_ulong, exc: Any) -> int:
        self.calls.append((int(ident.value), exc))
        # A rollback call passes None and is not part of the scripted sequence.
        if exc is None:
            return 0
        return self._returns.pop(0) if self._returns else 0

    @property
    def rollbacks(self) -> int:
        return sum(1 for _ident, exc in self.calls if exc is None)

    @property
    def kill_attempts(self) -> int:
        return sum(1 for _ident, exc in self.calls if exc is not None)


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    def _install(returns: list[int]) -> _RecordingApi:
        recorder = _RecordingApi(returns)
        monkeypatch.setattr(ctypes.pythonapi, "PyThreadState_SetAsyncExc", recorder, raising=True)
        return recorder

    return _install


def test_a_return_of_one_kills_and_does_not_roll_back(api, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Kills `res > 1` -> `>=`. Success must never trigger the rollback path."""
    recorder = api([1])
    thread = _FakeThread(ident=4242)
    # The thread dies after the first successful kill, as a real one would.
    original_join = thread.join

    def _join(timeout: float | None = None) -> None:
        original_join(timeout)
        thread._alive = False

    monkeypatch.setattr(thread, "join", _join)

    _force_kill_thread(thread)  # type: ignore[arg-type]

    assert recorder.kill_attempts == 1, "must attempt the kill exactly once"
    assert recorder.rollbacks == 0, "a successful kill must not be rolled back"
    assert thread.joins == [0.5], "must wait for the thread to unwind"


def test_more_than_one_thread_affected_is_rolled_back(api) -> None:  # type: ignore[no-untyped-def]
    """Kills `res > 1` -> `res > 2`.

    A return above 1 means the exception landed on more than the intended
    thread, which is not recoverable. The documented response is to clear it
    again and give up rather than leave several threads carrying a SystemExit.
    """
    recorder = api([2])
    thread = _FakeThread(ident=4242)

    _force_kill_thread(thread)  # type: ignore[arg-type]

    assert recorder.rollbacks == 1, "an over-broad hit must be rolled back"
    assert thread.joins == [], "and must bail out rather than wait"


def test_a_return_of_zero_stops_immediately(api) -> None:  # type: ignore[no-untyped-def]
    """Kills `res == 0` -> `!=` and the `0` -> `1` literal.

    Zero means the interpreter found no thread with that id, so it has already
    finished. There is nothing to kill and nothing to roll back.
    """
    recorder = api([0])
    thread = _FakeThread(ident=4242)

    _force_kill_thread(thread)  # type: ignore[arg-type]

    assert recorder.kill_attempts == 1
    assert recorder.rollbacks == 0, "nothing was set, so nothing to clear"
    assert thread.joins == [], "must not wait on a thread that no longer exists"


def test_a_stubborn_thread_is_retried_and_then_abandoned(api) -> None:  # type: ignore[no-untyped-def]
    """The retry budget is finite, so a wedged thread cannot hang the caller."""
    recorder = api([1, 1, 1])
    thread = _FakeThread(ident=4242)  # never dies

    _force_kill_thread(thread)  # type: ignore[arg-type]

    assert recorder.kill_attempts == 3, "three attempts, then give up"
    assert recorder.rollbacks == 0
    assert thread.joins == [0.5, 0.5, 0.5]


def test_a_thread_that_never_started_is_left_alone(api) -> None:  # type: ignore[no-untyped-def]
    """No ident means the thread was never scheduled; the C call must not run."""
    recorder = api([1])
    _force_kill_thread(_FakeThread(ident=None))  # type: ignore[arg-type]
    assert recorder.calls == []


def test_a_thread_that_already_finished_is_left_alone(api) -> None:  # type: ignore[no-untyped-def]
    """Guard the guard: the liveness check must be consulted before the C call."""
    recorder = api([1])
    _force_kill_thread(_FakeThread(ident=4242, alive=False))  # type: ignore[arg-type]
    assert recorder.calls == []
