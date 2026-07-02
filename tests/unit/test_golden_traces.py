"""Golden-trace conformance between the JS and Python engines (E-P2).

A corpus of programs (straight drive, turns, square, spiral, wall approach,
battery-death run) is executed on BOTH engines:

* JS: the shipped ``interpreter.js`` driven with the shared
  ``motion-model.js`` kinematics (``tests/fixtures/golden_trace.cjs``),
* Python: the real :mod:`robolearn.runtime.executor` bound to a
  :class:`~robolearn.engine.rover.Rover` in a 30 x 30 m world (the same
  +/-15 m span as the JS arena, base at the centre).

The frames differ by construction (JS: centred cm, compass heading; Python:
corner-origin metres, math heading), so the cross-engine asserts compare
frame-independent quantities: displacement magnitude, distance travelled,
degrees turned, battery remaining and collision count. On top of that, each
engine's final state is pinned to golden values, so deliberately perturbing
any shared constant fails this suite (the plan's acceptance test).
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from robolearn.engine.motion_model import (
    BATTERY_PCT_PER_COLLISION,
    BATTERY_PCT_PER_DEGREE,
    BATTERY_PCT_PER_METRE,
)
from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, World
from robolearn.runtime.binding import set_active_rover, set_active_world
from robolearn.runtime.executor import execute

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "src" / "robolearn" / "assets" / "web"
FIXTURE = ROOT / "tests" / "fixtures" / "golden_trace.cjs"
_NODE = shutil.which("node")
_REQUIRE_NODE = os.environ.get("ROBOLEARN_REQUIRE_NODE") == "1"

# Corpus. Each entry: (id, program, expects_collision, expects_flat)
CORPUS: list[tuple[str, str, bool, bool]] = [
    ("drive_2m", "set_speed(80)\nmove_forward(2)", False, False),
    ("turn_only", "turn_left(45)\nturn_right(135)", False, False),
    (
        "square_3m",
        "for i in range(4):\n    move_forward(3)\n    turn_right(90)",
        False,
        False,
    ),
    (
        "spiral",
        "step = 0.4\nfor i in range(8):\n    move_forward(step)\n    turn_right(90)\n    step = step + 0.2",
        False,
        False,
    ),
    ("wall_approach", "move_forward(20)", True, False),
    (
        "battery_death",
        "for i in range(60):\n    move_forward(2)\n    turn_right(180)",
        False,
        True,
    ),
]


def _run_js(program: str) -> dict:
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(WEB / "interpreter.js"), str(WEB / "motion-model.js")],
        input=program,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def _run_py(program: str) -> Rover:
    world = World(
        terrain=Terrain.EARTH,
        base=(15.0, 15.0),
        samples=[],
        obstacles=[],
        bounds=ArenaBounds(width=30.0, height=30.0),
    )
    rover = Rover(world)
    set_active_world(world)
    set_active_rover(rover)
    try:
        result = execute(program, timeout_s=20.0)
        assert result.error_kind is None, f"python run failed: {result.error_message}"
    finally:
        set_active_rover(None)
        set_active_world(None)
    return rover


@pytest.mark.skipif(_NODE is None and not _REQUIRE_NODE, reason="Node.js not available")
@pytest.mark.parametrize("case", CORPUS, ids=[c[0] for c in CORPUS])
def test_cross_engine_conformance(case) -> None:  # type: ignore[no-untyped-def]
    """Both engines agree on the frame-independent outcome of each program."""
    if _NODE is None:
        pytest.fail("ROBOLEARN_REQUIRE_NODE=1 but Node.js is not on PATH")
    name, program, expects_collision, expects_flat = case
    js = _run_js(program)
    assert js["error"] is None, f"JS run failed: {js['error']}"
    py = _run_py(program)

    py_disp_cm = math.hypot(py.state.x - 15.0, py.state.y - 15.0) * 100.0
    py_travel_cm = py.state.distance_travelled_m * 100.0

    if expects_collision:
        # The JS tick HALTS the program at a crash; Python registers the
        # collision and keeps executing. Compare up to the shared contact:
        # both must report at least one collision at the same wall (30 cm
        # body radius stops JS 30 cm short of the Python clamp line).
        assert js["collisions"] >= 1
        assert py.state.collisions >= 1
        assert abs(py_disp_cm - js["displacementCm"]) <= 50.0
        return
    if expects_flat:
        # Both packs must run flat; the JS tick halts at 0, Python floors at
        # 0 and keeps going, so distances past the crossing are not compared.
        assert js["batteryPct"] == 0
        assert py.state.battery_pct == 0.0
        return

    assert js["collisions"] == 0
    assert py.state.collisions == 0, f"{name}: python registered a phantom collision"
    assert abs(py_disp_cm - js["displacementCm"]) <= 1.0, (
        f"{name}: displacement diverged (py {py_disp_cm:.2f} cm vs js {js['displacementCm']:.2f} cm)"
    )
    assert abs(py_travel_cm - js["travelledCm"]) <= 1.0
    assert py.state.degrees_turned == pytest.approx(js["turnedDeg"], abs=1e-6)
    assert py.state.battery_pct == pytest.approx(js["batteryPct"], abs=0.01), (
        f"{name}: battery diverged (py {py.state.battery_pct:.4f} vs js {js['batteryPct']:.4f})"
    )


# ---------------------------------------------------------------------------
# Pinned goldens: perturbing any shared constant fails these exact values.
# ---------------------------------------------------------------------------


def test_python_golden_square() -> None:
    """Python engine golden: 4 x (3 m + 90 deg) ends at base with 85.36%."""
    py = _run_py(CORPUS[2][1])
    assert py.state.x == pytest.approx(15.0, abs=1e-9)
    assert py.state.y == pytest.approx(15.0, abs=1e-9)
    assert py.state.distance_travelled_m == pytest.approx(12.0)
    assert py.state.degrees_turned == pytest.approx(360.0)
    # 100 - 12 m * 1.1 %/m - 360 deg * 0.004 %/deg = 85.36
    assert py.state.battery_pct == pytest.approx(
        100.0 - 12.0 * BATTERY_PCT_PER_METRE - 360.0 * BATTERY_PCT_PER_DEGREE
    )
    assert py.state.battery_pct == pytest.approx(85.36)
    assert py.state.collisions == 0


def test_python_golden_wall_approach() -> None:
    """Python engine golden: a 20 m command from centre stops at the wall."""
    py = _run_py(CORPUS[4][1])
    assert py.state.x == pytest.approx(30.0)
    assert py.state.distance_travelled_m == pytest.approx(15.0)
    assert py.state.collisions == 1
    assert py.state.battery_pct == pytest.approx(
        100.0 - 15.0 * BATTERY_PCT_PER_METRE - BATTERY_PCT_PER_COLLISION
    )


@pytest.mark.skipif(_NODE is None and not _REQUIRE_NODE, reason="Node.js not available")
def test_js_golden_square() -> None:
    """JS engine golden: the same square pins the same battery number."""
    if _NODE is None:
        pytest.fail("ROBOLEARN_REQUIRE_NODE=1 but Node.js is not on PATH")
    js = _run_js(CORPUS[2][1])
    assert js["displacementCm"] == pytest.approx(0.0, abs=1e-6)
    assert js["travelledCm"] == pytest.approx(1200.0)
    assert js["turnedDeg"] == pytest.approx(360.0)
    assert js["batteryPct"] == pytest.approx(85.36)
    assert js["collisions"] == 0
