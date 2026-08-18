"""Divergence regression gate for the shared motion model (PERFECTION_PLAN E-C4).

The physics constants exist in exactly two places: ``assets/web/motion-model.js``
and ``kodro/engine/motion_model.py``. Both emit a canonical JSON string of
their constant table (keys sorted, no whitespace); this test hashes the two
strings and FAILS the build if they ever differ, so a constant can never again
change on one side only (the old 11x battery divergence was exactly that).
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from kodro.engine import motion_model

ROOT = Path(__file__).resolve().parents[2]
MODEL_JS = ROOT / "src" / "kodro" / "assets" / "web" / "motion-model.js"
FIXTURE = ROOT / "tests" / "fixtures" / "dump_motion_model.cjs"
_NODE = shutil.which("node")
_REQUIRE_NODE = os.environ.get("ROBOLEARN_REQUIRE_NODE") == "1"


def _js_canonical() -> str:
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(MODEL_JS)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    return proc.stdout.strip()


def test_python_model_exposes_shared_battery_constants() -> None:
    """The Python engine's battery constants come from the shared table."""
    assert pytest.approx(1.1) == motion_model.BATTERY_PCT_PER_METRE
    assert pytest.approx(0.004) == motion_model.BATTERY_PCT_PER_DEGREE
    assert pytest.approx(1.0) == motion_model.BATTERY_PCT_PER_COLLISION
    assert pytest.approx(0.3) == motion_model.ROVER_RADIUS_M


@pytest.mark.skipif(_NODE is None and not _REQUIRE_NODE, reason="Node.js not available")
def test_constant_tables_are_identical() -> None:
    """motion-model.js and motion_model.py serialise the SAME constant table."""
    if _NODE is None:
        pytest.fail("ROBOLEARN_REQUIRE_NODE=1 but Node.js is not on PATH")
    js = _js_canonical()
    py = motion_model.canonical_json()
    assert js == py, f"constant tables diverged:\nJS: {js}\nPY: {py}"


@pytest.mark.skipif(_NODE is None and not _REQUIRE_NODE, reason="Node.js not available")
def test_constant_table_hashes_match() -> None:
    """The sha256 gate the plan asks for: a seeded mismatch fails here."""
    if _NODE is None:
        pytest.fail("ROBOLEARN_REQUIRE_NODE=1 but Node.js is not on PATH")
    js_hash = hashlib.sha256(_js_canonical().encode("utf-8")).hexdigest()
    py_hash = hashlib.sha256(motion_model.canonical_json().encode("utf-8")).hexdigest()
    assert js_hash == py_hash


def test_segment_circle_hit_geometry() -> None:
    """The shared swept-collision helper finds the first contact point."""
    # Segment along +x from origin; circle of radius 1 centred at (5, 0):
    # first contact at x = 4 -> t = 0.4 on a 10-long segment.
    t = motion_model.segment_circle_hit(0.0, 0.0, 10.0, 0.0, 5.0, 0.0, 1.0)
    assert t == pytest.approx(0.4)
    # A segment that misses the circle entirely reports no contact.
    assert motion_model.segment_circle_hit(0.0, 0.0, 10.0, 0.0, 5.0, 3.0, 1.0) is None
    # A segment pointing away never touches it.
    assert motion_model.segment_circle_hit(0.0, 0.0, -5.0, 0.0, 5.0, 0.0, 1.0) is None
