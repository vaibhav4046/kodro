"""Physical-mode formula parity between the JS and Python engines (M1).

The constant-table hash (E-C4) locks the shared *numbers*; the catalogue
golden traces (E-P2) lock catalogue-mode *behaviour*. Neither covered the
physical (KRS import) closed forms: ``motion-model.js`` grew fourteen ``phys*``
functions plus ``sensorPose`` that ``motion_model.py`` did not have, so an
imported build's derived numbers (top speed, stall force, mobility, energy,
runtime, slope, turn timing, stopping distance, sensor pose) were JS-only.

This test ports that gap shut: it drives the JS twin over the shipped
Reference Rover inputs, then asserts the newly ported Python ``phys_*``
functions agree to within ``rel=1e-12`` or ``abs=1e-9``, whichever bound is
looser at that magnitude -- in practice the absolute one, since most trace
values are well under 1e3. That is far tighter than anything the UI shows but
it is a numeric tolerance, not bit equality. Perturbing either side now
fails the build, so the physical-mode FORMULAS are parity-locked, not just the
constant table.

Note the scope boundary this test deliberately does NOT cross: it proves the
DERIVED NUMBERS agree. Full measured-build SIMULATION -- sensor rays that
originate at the mounted sensor pose and honour the imported ``rangeCm`` --
still lives only in the JS studio (``engine/sensors.py`` rays from the rover
centre with fixed ranges). That limitation is disclosed in
``docs/known-limitations.md``; this file guards the formula parity, not the
sensor-ray wiring.
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from robolearn.engine import motion_model as mm

ROOT = Path(__file__).resolve().parents[2]
MODEL_JS = ROOT / "src" / "robolearn" / "assets" / "web" / "motion-model.js"
FIXTURE = ROOT / "tests" / "fixtures" / "dump_phys_trace.cjs"
_NODE = shutil.which("node")
_REQUIRE_NODE = os.environ.get("ROBOLEARN_REQUIRE_NODE") == "1"

# Shipped Reference Rover inputs (tests/fixtures/krs_reference_rover.json).
RPM, WHEEL_R, TORQUE, MOTORS, MASS_KG = 300.0, 3.25, 0.35, 2.0, 1.2
TRACK, STEER, MAH, VOLT, USABLE = 14.0, 30.0, 2200.0, 7.4, 0.8
G, TRACTION = 9.81, 1.0
SLOW_RPM, SLOW_WHEEL_R = 60.0, 3.0
# A build that cannot move itself: one weak motor under 8 kg (mobility 0.008
# against a 0.45 stall band). Must mirror dump_phys_trace.cjs exactly.
STALL_TORQUE, STALL_MOTORS, STALL_MASS_KG = 0.02, 1.0, 8.0


def _js_trace() -> dict:
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(MODEL_JS)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def _py_trace() -> dict:
    v_max = mm.phys_top_speed_cm_per_s(RPM, WHEEL_R)
    stall_f = mm.phys_stall_force_n(TORQUE, MOTORS, WHEEL_R)
    energy_wh = mm.phys_energy_wh(MAH, VOLT, USABLE)
    sv = mm.phys_stall_verdict(stall_f, MASS_KG, TRACTION, G, MOTORS, WHEEL_R)
    weak_f = mm.phys_stall_force_n(STALL_TORQUE, STALL_MOTORS, WHEEL_R)
    weak_sv = mm.phys_stall_verdict(weak_f, STALL_MASS_KG, TRACTION, G, STALL_MOTORS, WHEEL_R)
    pose = mm.sensor_pose(0.0, 0.0, 0.0, 10.0, 0.0, 0.0)
    slow_v = mm.phys_top_speed_cm_per_s(SLOW_RPM, SLOW_WHEEL_R)
    return {
        "vMaxCmPerS": v_max,
        "speedFactor": mm.phys_speed_factor(v_max),
        "massFactor": mm.phys_mass_factor(MASS_KG),
        "stallForceN": stall_f,
        "mobility": mm.phys_mobility(stall_f, MASS_KG, TRACTION, G),
        "accelCmPerS2": mm.phys_accel_cm_per_s2(stall_f, MASS_KG, G),
        "energyWh": energy_wh,
        "drainPctPerCm": mm.phys_drain_pct_per_cm(MASS_KG, energy_wh, v_max, G, TRACTION),
        "runtimeMin": mm.phys_runtime_min(MASS_KG, energy_wh, v_max, G, TRACTION),
        "turnMs90": mm.phys_turn_duration_ms(90.0, v_max, TRACK, 1.0),
        "turnRadiusCm": mm.phys_turn_radius_cm(TRACK, STEER),
        "stoppingCm": mm.phys_stopping_distance_cm(v_max, TRACTION, G),
        "maxSlopeDeg": mm.phys_max_slope_deg(stall_f, MASS_KG, G, TRACTION),
        "stallMobility": float(sv["mobility"]),  # type: ignore[arg-type]
        "stallNeededNm": float(sv["neededNm"]),  # type: ignore[arg-type]
        "stallHasNm": float(sv["hasNm"]),  # type: ignore[arg-type]
        # The verdict BOOLEAN, on a build that clears the band and one that does
        # not. Booleans are ints, so the approx comparison below degenerates to
        # exact equality for them: a disagreement is a difference of 1.
        "stalled": bool(sv["stalled"]),
        "weakStalled": bool(weak_sv["stalled"]),
        "weakStallMobility": float(weak_sv["mobility"]),  # type: ignore[arg-type]
        "sensorPoseX": pose["x"],
        "sensorPoseY": pose["y"],
        "sensorPoseHeading": pose["heading"],
        "slowVMaxCmPerS": slow_v,
        "slowSpeedFactor": mm.phys_speed_factor(slow_v),
    }


def test_python_phys_top_speed_matches_closed_form() -> None:
    """Reference-rover top speed = 300/60 * 2*pi * 3.25 = 102.1 cm/s."""
    expected = (RPM / 60.0) * 2.0 * math.pi * WHEEL_R
    assert mm.phys_top_speed_cm_per_s(RPM, WHEEL_R) == pytest.approx(expected)
    assert mm.phys_top_speed_cm_per_s(RPM, WHEEL_R) == pytest.approx(102.10, abs=0.01)


def test_python_reference_rover_does_not_stall() -> None:
    """The shipped Reference Rover clears the stall band on nominal ground."""
    stall_f = mm.phys_stall_force_n(TORQUE, MOTORS, WHEEL_R)
    sv = mm.phys_stall_verdict(stall_f, MASS_KG, TRACTION, G, MOTORS, WHEEL_R)
    assert sv["stalled"] is False
    assert float(sv["mobility"]) > float(mm.MODEL["mobilityStallBand"])  # type: ignore[arg-type]


def test_python_slow_build_floors_speed_factor() -> None:
    """A 60-rpm / 3-cm build is below the floor, so its speed factor clamps
    UP to physSpeedFactorLo (the H1 defect: simulated faster than real)."""
    slow_v = mm.phys_top_speed_cm_per_s(SLOW_RPM, SLOW_WHEEL_R)
    # Real: ~18.85 cm/s -> factor ~0.06, clamped up to the 0.3 floor.
    assert slow_v == pytest.approx(18.85, abs=0.05)
    assert mm.phys_speed_factor(slow_v) == pytest.approx(
        float(mm.MODEL["physSpeedFactorLo"])  # type: ignore[arg-type]
    )


@pytest.mark.skipif(_NODE is None and not _REQUIRE_NODE, reason="Node.js not available")
def test_phys_formulas_match_js_engine() -> None:
    """Every ported phys_* value is identical to the JS twin's output."""
    if _NODE is None:
        pytest.fail("ROBOLEARN_REQUIRE_NODE=1 but Node.js is not on PATH")
    js = _js_trace()
    py = _py_trace()
    assert js.keys() == py.keys(), "trace keys drifted between engines"
    # Both stall booleans must be exercised in both directions, or agreeing on
    # them proves nothing. If a constant change makes the weak build mobile,
    # fail here rather than quietly comparing false against false for ever.
    assert py["stalled"] is False and py["weakStalled"] is True, (
        "the stall fixtures no longer straddle the band; pick new inputs"
    )
    for key in js:
        assert py[key] == pytest.approx(js[key], rel=1e-12, abs=1e-9), (
            f"{key}: python {py[key]} vs js {js[key]}"
        )
