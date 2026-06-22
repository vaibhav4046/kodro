"""CI gate for the vendored rover interpreter QA (qa_interpreter.mjs).

``scripts/qa_interpreter.mjs`` loads the real shipped ``interpreter.js`` into a
sandbox, runs every built-in example program through it, and asserts each stays
inside the arena and produces the expected motion. It exits non-zero on any
failure. That harness only protected the interpreter if a human remembered to
run it; this test wires it into the gated pytest run so a regression in the
interpreter (or in an example program) fails CI on Linux and Windows.

Mirrors the subprocess+node pattern in ``test_web_bundle.py``; skips cleanly
where Node is unavailable.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
QA_INTERPRETER = ROOT / "scripts" / "qa_interpreter.mjs"
_NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(_NODE is None, reason="Node.js not available")


def test_interpreter_qa_passes() -> None:
    """Every example program runs clean through the shipped interpreter."""
    proc = subprocess.run(
        [str(_NODE), str(QA_INTERPRETER)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
