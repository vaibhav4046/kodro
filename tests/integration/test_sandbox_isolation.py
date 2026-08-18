"""Hostile-input test suite for the pupil-code sandbox + executor (Task 7).

Every snippet in :data:`HOSTILE_SNIPPETS` must be rejected before execution.
Every snippet in :data:`LEGITIMATE_SNIPPETS` must pass the sandbox check and
run to completion in less than the timeout.
"""

from __future__ import annotations

import pytest

from kodro import rover_api
from kodro.runtime import (
    Tracer,
    execute,
    find_violations,
    is_safe,
    restricted_globals,
    set_active,
)

# ---------------------------------------------------------------------------
# Snippet tables
# ---------------------------------------------------------------------------

HOSTILE_SNIPPETS: tuple[str, ...] = (
    "import os",
    "import sys",
    "import subprocess",
    "from os import system",
    "from sys import exit",
    "open('file.txt')",
    "open('/etc/passwd', 'r').read()",
    "eval('1+1')",
    "exec('print(1)')",
    "compile('1', '<x>', 'exec')",
    "__import__('os')",
    "__import__('os').system('echo hi')",
    "getattr(object, '__class__')",
    "setattr(object(), 'x', 1)",
    "delattr(object(), 'x')",
    "globals()",
    "locals()",
    "vars()",
    "exit()",
    "quit()",
    "input('?')",
    "breakpoint()",
    "().__class__",
    "(1).__class__.__bases__",
    "''.__class__.__mro__",
    "object.__subclasses__()",
    "{}.__class__",
    "type(1).__bases__",
    "[].__getattribute__('__class__')",
    "x = __builtins__",
    "lambda: __import__('os')",
    "def evil():\n    return __import__('os')\nevil()",
    "for x in [].__class__.__mro__:\n    pass",
)


LEGITIMATE_SNIPPETS: tuple[str, ...] = (
    "move_forward(10)",
    "turn_left(90)",
    "move_forward(5)\nturn_right(45)\nmove_forward(5)",
    "for i in range(5):\n    move_forward(1)",
    "for _ in range(5):\n    if obstacle_ahead():\n        break\n    move_forward(1)\n",
    "if read_distance() < 1.0:\n    turn_left(90)\nelse:\n    move_forward(2)",
    ("def patrol():\n    move_forward(5)\n    turn_left(90)\n    move_forward(5)\npatrol()\n"),
    "for i in range(3):\n    print(i)\n",
    "x = [1, 2, 3]\nprint(len(x))",
    "x = {'a': 1, 'b': 2}\nprint(x['a'])",
    "log('hello rover')",
    "beep(2)",
    "collect_sample()",
)


# ---------------------------------------------------------------------------
# Sandbox AST checks
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("snippet", HOSTILE_SNIPPETS)
def test_sandbox_rejects_hostile(snippet: str) -> None:
    violations = find_violations(snippet) if _parses(snippet) else None
    assert not is_safe(snippet), f"sandbox failed to flag: {snippet!r} (got {violations})"


def _parses(source: str) -> bool:
    try:
        find_violations(source)
        return True
    except SyntaxError:
        return False


@pytest.mark.parametrize("snippet", LEGITIMATE_SNIPPETS)
def test_sandbox_accepts_legitimate(snippet: str) -> None:
    assert is_safe(snippet), f"sandbox falsely rejected: {snippet!r}"


def test_find_violations_reports_line_numbers() -> None:
    source = "move_forward(1)\nimport os"
    violations = find_violations(source)
    assert violations
    assert violations[0].lineno == 2
    assert violations[0].kind == "import"


def test_find_violations_lists_every_problem_in_one_snippet() -> None:
    source = "import os\n__import__('sys')\nopen('x')"
    violations = find_violations(source)
    kinds = {v.kind for v in violations}
    assert "import" in kinds
    assert "forbidden-name" in kinds
    assert any(v.name == "open" for v in violations)


def test_find_violations_syntax_error_propagates() -> None:
    with pytest.raises(SyntaxError):
        find_violations("def(")


def test_is_safe_returns_false_for_syntax_error() -> None:
    assert is_safe("def(") is False


def test_restricted_globals_contains_rover_api_and_safe_builtins() -> None:
    g = restricted_globals()
    assert "move_forward" in g
    assert "read_distance" in g
    assert "log" in g
    assert g["__builtins__"]["range"] is range
    assert g["__builtins__"]["len"] is len
    # 'print' is rewired to rover_api.log.
    from kodro import rover_api

    assert g["__builtins__"]["print"] is rover_api.log


def test_restricted_globals_exposes_browser_sensor_aliases_with_matching_units() -> None:
    g = restricted_globals()

    assert g["distance"]() == rover_api.read_distance() * 100.0
    assert g["heading"]() == rover_api.read_heading()
    assert g["battery"]() == rover_api.read_battery()


def test_restricted_globals_does_not_leak_os_or_sys() -> None:
    g = restricted_globals()
    assert "os" not in g
    assert "sys" not in g
    assert "open" not in g["__builtins__"]
    assert "eval" not in g["__builtins__"]
    assert "exec" not in g["__builtins__"]


# ---------------------------------------------------------------------------
# Executor end-to-end
# ---------------------------------------------------------------------------


def test_execute_legitimate_snippet_succeeds() -> None:
    result = execute("move_forward(5)\nturn_left(90)\n")
    assert result.success is True
    assert result.error_kind is None
    assert result.error_message is None


def test_execute_records_events_through_active_tracer() -> None:
    tracer = Tracer()
    set_active(tracer)
    execute("move_forward(5)\nturn_left(90)\n")
    names = [e.name for e in tracer.events()]
    assert names == ["move_forward", "turn_left"]


def test_execute_print_rewires_to_log_emitting_log_events() -> None:
    tracer = Tracer()
    set_active(tracer)
    execute("print('hello')\n")
    # log() emits a "call" event with name='log' and args containing the message.
    events = tracer.events()
    assert any(e.name == "log" and "hello" in str(e.args[0]) for e in events)


def test_execute_rejects_sandbox_violation_before_running() -> None:
    tracer = Tracer()
    set_active(tracer)
    result = execute("import os\nmove_forward(5)\n")
    assert result.success is False
    assert result.error_kind == "sandbox"
    assert result.error_line == 1
    # The move_forward line must NOT have been executed.
    assert tracer.events() == []


def test_execute_reports_syntax_error_with_line() -> None:
    result = execute("def broken(\n")
    assert result.success is False
    assert result.error_kind == "syntax"
    assert result.error_line == 1


def test_execute_reports_runtime_error_with_pupil_line() -> None:
    source = "move_forward(5)\nraise RuntimeError('boom')\nturn_left(90)\n"
    result = execute(source)
    assert result.success is False
    assert result.error_kind == "runtime"
    assert "RuntimeError" in (result.error_message or "")
    assert result.error_line == 2


def test_execute_hard_timeout_returns_timeout_result() -> None:
    result = execute("while True:\n    pass\n", timeout_s=0.2)
    assert result.success is False
    assert result.error_kind == "timeout"
    assert "hard timeout" in (result.error_message or "")


def test_execute_records_duration() -> None:
    result = execute("move_forward(1)\n")
    assert result.duration_ms >= 0


@pytest.mark.parametrize("snippet", LEGITIMATE_SNIPPETS)
def test_execute_all_legitimate_snippets_succeed(snippet: str) -> None:
    result = execute(snippet, timeout_s=2.0)
    assert result.success, f"snippet failed: {snippet!r}; error={result.error_message}"


@pytest.mark.parametrize("snippet", HOSTILE_SNIPPETS)
def test_execute_all_hostile_snippets_blocked(snippet: str) -> None:
    result = execute(snippet, timeout_s=2.0)
    assert not result.success
    assert result.error_kind in {"sandbox", "syntax"}


# ---------------------------------------------------------------------------
# Unreadable input must not escape the executor's contract.
# ---------------------------------------------------------------------------

#: Sources CPython cannot parse, or cannot parse without exhausting its stack.
#: ``ast.parse``, the sandbox walker and ``compile`` each recurse once per
#: nesting level, so deep nesting raises ``RecursionError``. That is not a
#: ``SyntaxError``, so it escaped both parse guards and propagated out of
#: :func:`execute`, whose docstring promises it never raises.
UNREADABLE_SNIPPETS: dict[str, str] = {
    "broken_def": "def (:",
    "null_byte": "x = 'a\x00b'",
    "bom_prefix": "﻿move_forward(1)",
    "indent_x100": "\n".join("    " * i + "if True:" for i in range(100))
    + "\n"
    + "    " * 100
    + "move_forward(1)",
    "expr_x20000": "x = " + "1+" * 20000 + "1",
    "parens_x5000": "x = " + "(" * 5000 + "1" + ")" * 5000,
    "lists_x5000": "x = " + "[" * 5000 + "]" * 5000,
    "calls_x3000": "x = " + "len(" * 3000 + "[]" + ")" * 3000,
}

#: Parametrised by name: pytest builds a test id from the parameter, and these
#: sources run to tens of thousands of characters.
_UNREADABLE = list(UNREADABLE_SNIPPETS.items())
_UNREADABLE_IDS = [name for name, _ in _UNREADABLE]


@pytest.mark.parametrize(("name", "snippet"), _UNREADABLE, ids=_UNREADABLE_IDS)
def test_execute_never_raises_on_unreadable_source(name: str, snippet: str) -> None:
    """The contract is a returned result, not an exception the caller must catch."""
    result = execute(snippet, timeout_s=2.0)
    assert not result.success
    assert result.error_kind == "syntax"
    assert result.error_message


@pytest.mark.parametrize(("name", "snippet"), _UNREADABLE, ids=_UNREADABLE_IDS)
def test_is_safe_is_false_rather_than_raising(name: str, snippet: str) -> None:
    """A source that cannot be read is not a source that is safe to run."""
    assert is_safe(snippet) is False


def test_the_deep_snippets_really_do_exhaust_the_parser() -> None:
    """Guard the guard.

    If CPython ever raises its recursion limit, these inputs stop being
    pathological and the two tests above would pass for the wrong reason.
    """
    import ast

    deep = [s for s in UNREADABLE_SNIPPETS.values() if "1+" in s or s.count("(") > 100]
    assert deep, "no deep-nesting snippet left in the corpus"
    exhausted = 0
    for snippet in deep:
        try:
            ast.parse(snippet)
        except RecursionError:
            exhausted += 1
        except SyntaxError:
            pass
    assert exhausted, (
        "no snippet still exhausts the parser, so the RecursionError path is "
        "no longer covered by this corpus"
    )
