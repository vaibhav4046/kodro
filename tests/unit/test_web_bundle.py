"""Guards for the pre-compiled web bundle (bundle.js).

The app loads ``bundle.js`` (generated from the .jsx sources by
``scripts/build_web.cjs``) instead of transpiling JSX with Babel at runtime,
so it starts fast. Two risks need guarding:

1. **Staleness** -- a .jsx edited without rebuilding leaves bundle.js out of
   date, so the app would run old code. ``--check`` recompiles and compares.
2. **Validity** -- the concatenated bundle must execute and register every
   component + render the app.

Both skip cleanly where Node is unavailable.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "src" / "robolearn" / "assets" / "web"
BUILD = ROOT / "scripts" / "build_web.cjs"
RENDER = ROOT / "tests" / "fixtures" / "render_bundle.cjs"
_NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(_NODE is None, reason="Node.js not available")


def test_bundle_is_fresh() -> None:
    """bundle.js matches a fresh compile of the .jsx sources (not stale)."""
    proc = subprocess.run(
        [str(_NODE), str(BUILD), "--check"],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout


def test_bundle_executes_and_registers_components() -> None:
    """The shipped bundle runs, registers components, and renders the app."""
    proc = subprocess.run(
        [str(_NODE), str(RENDER), str(WEB)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout.strip().splitlines()[-1])
    assert result["error"] is None, f"bundle threw: {result['error']}"
    assert result["rendered"] is True
    assert result["componentsRegistered"] is True


def test_index_html_loads_bundle_not_babel() -> None:
    """index.html ships the pre-compiled bundle and no runtime Babel."""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    assert "bundle.js" in html
    assert "babel.min.js" not in html
    assert 'type="text/babel"' not in html
