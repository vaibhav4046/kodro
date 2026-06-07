"""JS interpreter <-> Python engine conformance over the real lesson library.

The re-score panel flagged that the in-browser JS interpreter and the Python
grading engine are two independent implementations of the same Python subset,
so a verb one knows and the other doesn't silently desyncs "what the pupil
sees animate" from "what is graded". This test runs every bundled lesson's
starter code through BOTH engines and asserts neither raises a name/parse
error -- i.e. every API verb a real lesson uses exists on both sides.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from robolearn.lessons.schema import load_library
from robolearn.runtime.executor import execute

ROOT = Path(__file__).resolve().parents[2]
INTERP = ROOT / "src" / "robolearn" / "assets" / "web" / "interpreter.js"
FIXTURE = ROOT / "tests" / "fixtures" / "run_interp.cjs"
_NODE = shutil.which("node")
# CI sets ROBOLEARN_REQUIRE_NODE=1 so a missing Node is a hard failure, not a
# silent skip: the JS half of the conformance suite must run wherever the build
# is gated, or a JS-vs-Python verb desync could land unnoticed. Local dev
# without Node still skips cleanly.
_REQUIRE_NODE = os.environ.get("ROBOLEARN_REQUIRE_NODE") == "1"

_LESSONS = list(load_library())


def test_library_is_non_empty() -> None:
    assert len(_LESSONS) >= 10


@pytest.mark.parametrize("lesson", _LESSONS, ids=[lesson.id for lesson in _LESSONS])
def test_starter_has_no_name_error_in_python(lesson) -> None:  # type: ignore[no-untyped-def]
    """No lesson verb is undefined in the Python sandbox.

    We assert name resolution, not termination: sensor-driven starters (e.g.
    ``while read_distance() > 1``) only halt once a world is bound, so a bare
    ``execute`` may legitimately time out -- that still proves every verb
    resolved. We fail only on a NameError or a syntax error.
    """
    result = execute(lesson.starter_code, timeout_s=3.0)
    msg = result.error_message or ""
    is_name_error = result.error_kind == "runtime" and "not defined" in msg
    is_syntax = result.error_kind == "syntax"
    assert not (is_name_error or is_syntax), (
        f"{lesson.id} python: {result.error_kind}: {msg} (line {result.error_line})"
    )


_JS_NAME_OR_PARSE = ("not defined", "Expected", "Unexpected", "has no method", "not callable")


@pytest.mark.skipif(_NODE is None and not _REQUIRE_NODE, reason="Node.js not available")
@pytest.mark.parametrize("lesson", _LESSONS, ids=[lesson.id for lesson in _LESSONS])
def test_starter_has_no_name_error_in_js(lesson) -> None:  # type: ignore[no-untyped-def]
    """No lesson verb is undefined / mis-parsed in the in-browser JS interpreter.

    As with Python, sensor loops may hit the step cap without a world; that is
    fine. We fail only on a name/parse error (a verb the JS engine lacks).
    """
    if _NODE is None:
        # Only reachable when ROBOLEARN_REQUIRE_NODE=1 (CI): the skipif above
        # no longer fired, so a missing Node must fail loudly rather than skip.
        pytest.fail("ROBOLEARN_REQUIRE_NODE=1 but Node.js is not on PATH: the JS parity half cannot run")
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(INTERP)],
        input=lesson.starter_code,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    err = json.loads(proc.stdout)["error"] or ""
    name_or_parse = any(marker in err for marker in _JS_NAME_OR_PARSE)
    assert not name_or_parse, f"{lesson.id} js interpreter: {err}"
