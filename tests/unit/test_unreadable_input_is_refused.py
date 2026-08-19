"""Nothing that parses untrusted input may raise RecursionError at its caller.

``ast.parse`` and ``json.loads`` recurse once per nesting level, so deeply
nested input exhausts the interpreter stack and raises ``RecursionError``. That
is not a ``SyntaxError`` and not a ``JSONDecodeError``, so every guard written
as ``except SyntaxError`` or ``except json.JSONDecodeError`` lets it through.

The same defect was found five times in five different files: the pupil-code
executor, ``is_safe``, the project importer, the lesson grader and the hint
engine, plus the MCP server where one bad line killed the whole session instead
of failing one request. Hence two layers here: the behavioural tests below pin
the entry points, and the structural test pins the pattern so the sixth
instance fails in CI rather than in front of a pupil.
"""

from __future__ import annotations

import ast
import io
import json
import re
from pathlib import Path

import pytest

from kodro.interop import kodro_project
from kodro.lessons import grader
from kodro.mcp.server import serve_stdio
from kodro.memory import hint_engine
from kodro.runtime.executor import execute
from kodro.runtime.sandbox import is_safe

SRC = Path(__file__).resolve().parents[2] / "src" / "kodro"

#: Nested past the depth CPython's parser can walk, but well under any size cap.
DEEP_PY = "x = " + "1+" * 20000 + "1"
DEEP_JSON = "[" * 60000 + "]" * 60000


def test_the_fixtures_really_are_pathological() -> None:
    """Guard the guard: if CPython raises its limit, every test here goes vacuous."""
    with pytest.raises(RecursionError):
        ast.parse(DEEP_PY)
    with pytest.raises(RecursionError):
        json.loads(DEEP_JSON)
    assert len(DEEP_JSON) < 2 * 1024 * 1024, "must stay under the importer's 2 MB cap"


def test_executor_returns_a_result() -> None:
    result = execute(DEEP_PY, timeout_s=2.0)
    assert not result.success
    assert result.error_kind == "syntax"


def test_is_safe_answers_false() -> None:
    assert is_safe(DEEP_PY) is False


def test_project_importer_refuses() -> None:
    result = kodro_project.read_text(DEEP_JSON)
    assert result.ok is False
    assert result.errors[0].startswith("Not valid JSON:")


def test_grader_scores_rather_than_raises() -> None:
    """A pupil's score must never depend on the parser's stack depth."""
    assert grader._calls_in_order(DEEP_PY, ["move_forward"]) is False
    assert grader._source_uses(DEEP_PY, "loop") is False


def test_hint_engine_returns_none() -> None:
    assert hint_engine._parse(DEEP_PY) is None


def test_mcp_server_fails_one_request_not_the_session() -> None:
    """One malformed line must not take the server down with it."""
    good = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
    sink = io.StringIO()
    serve_stdio(iter([good, DEEP_JSON, good]), sink)
    replies = [line for line in sink.getvalue().splitlines() if line.strip()]
    assert len(replies) == 3, "the server stopped reading after the bad line"
    middle = json.loads(replies[1])
    assert middle["error"]["code"] == -32700, "expected a JSON-RPC parse error"


# ---------------------------------------------------------------------------
# Structural guard: catch the sixth instance at review time.
# ---------------------------------------------------------------------------

#: Modules that parse input arriving from outside the program: a pupil's code, a
#: file the user opened, a request on stdin. A narrow guard here is the defect
#: this module exists to prevent.
UNTRUSTED_INPUT_MODULES = (
    "runtime/executor.py",
    "runtime/sandbox.py",
    "interop/kodro_project.py",
    "lessons/grader.py",
    "memory/hint_engine.py",
    "mcp/server.py",
    "web/app.py",
)

_PARSE_CALL = re.compile(r"\b(ast\.parse|json\.loads)\s*\(")


def _unguarded_parses(text: str) -> list[tuple[int, str]]:
    """Return (line number, line) for parse calls whose except clause is narrow."""
    lines = text.splitlines()
    problems: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        if not _PARSE_CALL.search(line):
            continue
        # Only calls inside a try block are claiming to handle failure at all.
        preceding = lines[max(0, i - 4) : i + 1]
        if not any(s.strip() == "try:" for s in preceding):
            continue
        following = "\n".join(lines[i : i + 8])
        if "except" in following and "RecursionError" not in following:
            problems.append((i + 1, line.strip()))
    return problems


@pytest.mark.parametrize("relative", UNTRUSTED_INPUT_MODULES)
def test_untrusted_parses_also_catch_recursion_error(relative: str) -> None:
    problems = _unguarded_parses((SRC / relative).read_text(encoding="utf-8"))
    assert not problems, (
        f"{relative} parses untrusted input inside a try whose except clause omits "
        f"RecursionError, so deep nesting escapes to the caller: {problems}. "
        "Widen the guard, or move the call out of the try if it cannot receive "
        "untrusted input."
    )


def test_the_structural_scan_can_actually_fail() -> None:
    """Guard the guard: a scanner that never fires would pass every module."""
    narrow = "try:\n    tree = ast.parse(source)\nexcept SyntaxError:\n    return None\n"
    assert _unguarded_parses(narrow), "the scanner missed a deliberately narrow guard"
    wide = (
        "try:\n    tree = ast.parse(source)\n"
        "except (SyntaxError, RecursionError):\n    return None\n"
    )
    assert not _unguarded_parses(wide), "the scanner flagged a correctly widened guard"
