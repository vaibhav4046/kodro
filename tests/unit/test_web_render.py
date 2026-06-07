"""Runtime render smoke test for the web App.

Babel-compiling the JSX (test_web_jsx_valid) does NOT catch render-time
runtime errors -- a temporal-dead-zone ReferenceError (reading a useState
value before its declaration) compiles fine but white-screens the app at
runtime. This executes App()'s render body once under Node with mocked React
hooks + browser globals and fails if it throws. Skips where Node is absent.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "src" / "robolearn" / "assets" / "web"
FIXTURE = ROOT / "tests" / "fixtures" / "render_app.cjs"
_NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(_NODE is None, reason="Node.js not available")


def test_app_renders_without_runtime_error() -> None:
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(WEB)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout.strip().splitlines()[-1])
    assert result["error"] is None, f"App render threw: {result['error']}"
    assert result.get("rendered") is True, "ReactDOM.render was never reached"
