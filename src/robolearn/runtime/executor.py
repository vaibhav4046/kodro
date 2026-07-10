"""Pupil-code executor with a wall-clock timeout.

Section 9 of the spec asks for a "subprocess executor" but the rest of the
specification — tracer integration, GUI eventing, replay — assumes the
pupil code runs in the same Python process. We therefore execute inside a
**daemon thread** with a wall-clock timeout. The thread cannot be hard-
killed (Python has no public API for that), but flagging it as daemon
guarantees it does not block process exit, and the executor returns to its
caller as soon as the timeout fires FOR NORMAL PYTHON CODE.

Honest limit: the timeout is NOT hard against a single bytecode op that holds
the GIL for longer than the budget (e.g. a giant-integer ``**`` or ``*``). The
join cannot wake and ``SetAsyncExc`` cannot fire until that op completes, so an
over-budget bignum op would otherwise run to completion and be graded as a
clean pass. The AST sandbox therefore rejects the constant-foldable forms of
these bombs BEFORE execution (see :data:`robolearn.runtime.sandbox.MAX_POW_EXP`
and :data:`MAX_LITERAL_REPEAT`). A size computed at runtime from a variable
remains a documented residual that only a true out-of-process executor could
hard-cap; the design deliberately declined that in favour of same-process
tracing.

The executor itself is thin: it asks the sandbox to walk the AST, then
compiles and runs the snippet in a restricted globals mapping, capturing
any exception and converting it to a structured :class:`ExecutionResult`.
"""

from __future__ import annotations

import sys
import threading
import time
import traceback
from dataclasses import dataclass

from .sandbox import find_violations, restricted_globals

#: Default hard timeout for a single execution.
DEFAULT_TIMEOUT_S: float = 30.0


@dataclass(frozen=True, slots=True)
class ExecutionResult:
    """Outcome of one :func:`execute` call.

    Attributes:
        success: ``True`` if the snippet finished without raising and
            without violating the sandbox.
        error_kind: ``"sandbox"`` / ``"syntax"`` / ``"runtime"`` /
            ``"timeout"`` / ``None``.
        error_message: Human-readable description of the failure, or
            ``None`` on success.
        error_line: Line number associated with the failure, or ``None``
            when the failure is not line-specific (e.g. a hard timeout).
        duration_ms: Wall-clock duration of the call in milliseconds.
    """

    success: bool
    error_kind: str | None
    error_message: str | None
    error_line: int | None
    duration_ms: int


def execute(source: str, *, timeout_s: float = DEFAULT_TIMEOUT_S) -> ExecutionResult:
    """Sandbox-check, compile and run ``source`` with a hard ``timeout_s`` timeout.

    The function never raises: every failure mode is folded into the
    returned :class:`ExecutionResult`.
    """
    start_ns = time.monotonic_ns()

    # 1) Sandbox check — fail fast on the first violation reported.
    try:
        violations = find_violations(source)
    except SyntaxError as exc:
        return _result_syntax(exc, start_ns)
    if violations:
        first = violations[0]
        return ExecutionResult(
            success=False,
            error_kind="sandbox",
            error_message=first.message(),
            error_line=first.lineno,
            duration_ms=_elapsed_ms(start_ns),
        )

    # 2) Compile.
    try:
        compiled = compile(source, "<pupil>", "exec")
    except SyntaxError as exc:
        return _result_syntax(exc, start_ns)

    # 3) Execute in a daemon worker thread.
    globals_dict = restricted_globals()
    captured: list[BaseException] = []

    def _worker() -> None:
        # Detach this daemon thread from any active trace/profile hook (e.g.
        # coverage.py). Pupil code is dynamically exec'd and this thread can be
        # force-killed mid-line; if coverage were tracing it, the kill could
        # leave coverage's internal data lock held and deadlock the main thread
        # (this intermittently hung pytest under --cov). We never want a
        # profiler to descend into pupil code anyway.
        sys.settrace(None)
        try:
            # This exec IS the product: it runs the pupil's lesson code, and
            # the sandbox is the restricted globals built above (no builtins
            # beyond the allow-list, no import, no file/network access) plus
            # the AST validation in sandbox.py and the timeout below.
            exec(compiled, globals_dict)  # nosec B102 - sandboxed pupil code
        except BaseException as exc:
            captured.append(exc)

    thread = threading.Thread(target=_worker, name="robolearn-pupil-exec", daemon=True)
    thread.start()
    thread.join(timeout=timeout_s)
    if thread.is_alive():
        _force_kill_thread(thread)
        return ExecutionResult(
            success=False,
            error_kind="timeout",
            error_message=f"execution exceeded the {timeout_s:.1f}s hard timeout",
            error_line=None,
            duration_ms=_elapsed_ms(start_ns),
        )

    # 4) Surface any captured exception.
    if captured:
        captured_exc = captured[0]
        return ExecutionResult(
            success=False,
            error_kind="runtime",
            error_message=f"{type(captured_exc).__name__}: {captured_exc}",
            error_line=_pupil_line(captured_exc),
            duration_ms=_elapsed_ms(start_ns),
        )

    return ExecutionResult(
        success=True,
        error_kind=None,
        error_message=None,
        error_line=None,
        duration_ms=_elapsed_ms(start_ns),
    )


# --- helpers ---------------------------------------------------------------


def _elapsed_ms(start_ns: int) -> int:
    return (time.monotonic_ns() - start_ns) // 1_000_000


def _result_syntax(exc: SyntaxError, start_ns: int) -> ExecutionResult:
    return ExecutionResult(
        success=False,
        error_kind="syntax",
        error_message=f"SyntaxError: {exc.msg}",
        error_line=exc.lineno,
        duration_ms=_elapsed_ms(start_ns),
    )


def _pupil_line(exc: BaseException) -> int | None:
    """Walk the traceback and return the line number inside the ``<pupil>`` frame."""
    for frame in traceback.extract_tb(exc.__traceback__):
        if frame.filename == "<pupil>":
            return frame.lineno
    return None


def _force_kill_thread(thread: threading.Thread) -> None:
    """Raise SystemExit inside a still-running thread.

    Uses the CPython internal ``PyThreadState_SetAsyncExc`` to break a
    daemon thread out of its bytecode loop. The pupil thread sees a
    SystemExit at the next bytecode boundary and unwinds, which is
    essential for clean test teardown on Linux CI (coverage flush
    raced with live pupil threads, causing SIGABRT).
    """
    import ctypes

    ident = thread.ident
    if ident is None:
        return
    for _ in range(3):
        if not thread.is_alive():
            return
        res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
            ctypes.c_ulong(ident), ctypes.py_object(SystemExit)
        )
        if res == 0:
            return
        if res > 1:
            # More than one thread affected -- roll back and bail.
            ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_ulong(ident), None)
            return
        thread.join(timeout=0.5)
