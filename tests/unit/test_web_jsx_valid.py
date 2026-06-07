"""Static validity check for the vendored React/JSX UI.

A JSX syntax error white-screens the whole pywebview app at runtime with no
Python-side error. To catch that in CI, the ``tests/fixtures/jsx_validate.js``
harness transforms every ``.jsx`` file with the vendored Babel-standalone (the
same compiler the app uses in-browser) and reports any that fail to parse.
Skips where Node is unavailable.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "src" / "robolearn" / "assets" / "web"
FIXTURE = ROOT / "tests" / "fixtures" / "jsx_validate.cjs"
_NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(_NODE is None, reason="Node.js not available")


def test_all_jsx_files_compile() -> None:
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(WEB)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout.strip().splitlines()[-1])
    assert result.get("fatal") != "no-babel", "vendored Babel failed to load"
    assert result.get("fatal") != "no-dir", "web dir not passed"
    assert result["fails"] == [], "JSX failed to compile:\n" + "\n".join(result["fails"])
