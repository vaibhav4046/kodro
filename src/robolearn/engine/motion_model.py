"""Shared motion model - the Python twin of assets/web/motion-model.js (E-P1).

One constant table and one set of pure formulas exist in exactly two places:
this module and ``assets/web/motion-model.js``. Both emit the SAME canonical
JSON of their constant table; ``tests/unit/test_motion_model_conformance.py``
(E-C4) hashes the two strings and fails the build on any drift, and
``tests/unit/test_golden_traces.py`` (E-P2) runs a corpus of programs through
both engines and fails on behavioural drift.

Before this module, the Python :class:`~robolearn.engine.rover.Rover` drained
0.1 percent per metre while the JS tick drained 1.1 (11x apart), and 0.05 per
degree against 0.004 (12.5x the other way). The JS constants are the
calibrated, user-visible ones (the plan's 3.125 m/s anchor and every measured
showcase number were taken against them), so Python adopts them here.
"""

from __future__ import annotations

import json
import math

#: Constant table. MUST mirror MODEL in assets/web/motion-model.js key for
#: key and value for value; keep it flat so the canonical JSON is trivial.
MODEL: dict[str, object] = {
    "modelId": "kodro-motion-v1",
    # arena + body
    "arenaHalfExtentCm": 1500,
    "roverRadiusCm": 30,
    # calibration anchor: 3.125 m/s at set_speed(100), factors 1, traction 1.
    "baseSpeedCmPerS": 312.5,
    "msPerCm": 0.32,
    "minSpeedUnits": 8,
    # catalogue battery model (constant-power ledger, APPROXIMATED)
    "drainPctPerCm": 0.011,
    "drainPctPerDeg": 0.004,
    "drainPctPerCollision": 1,
    # catalogue turn timing
    "turnMsPer180Deg": 650,
    "turnMassBase": 0.78,
    "turnMassSlope": 0.5,
    "turnMassCap": 1.5,
    # catalogue derivation bounds (RobotLab.derive)
    "massBaselineG": 900,
    "catMassFactorLo": 0.6,
    "catMassFactorHi": 1.8,
    "catSpeedFactorLo": 0.7,
    "catSpeedFactorHi": 1.45,
    # mobility bands (shared by catalogue and physical modes)
    "mobilityStallBand": 0.45,
    "mobilityWarnBand": 0.75,
    "mobilityStallMul": 0.35,
    "mobilityWarnMul": 0.7,
    "mobilityNoDriveMul": 0.22,
    # environment
    "gravityEarthMps2": 9.81,
    "sensorRangeCm": 600,
    "obstacleAheadCm": 50,
    # physical (KRS) model constants: E-A1/E-A2 closed forms.
    # rollingResistance is the EFFECTIVE rolling + gearbox drag coefficient
    # for small geared wheels, calibrated with the JS twin.
    "rollingResistance": 0.12,
    "drivetrainEfficiency": 0.55,
    "idleDrawW": 1.5,
    "brakeMu": 0.7,
    "physMassFactorLo": 0.4,
    "physMassFactorHi": 2.5,
    "physSpeedFactorLo": 0.3,
    "physSpeedFactorHi": 2,
}

#: Battery cost per METRE travelled, derived from the shared per-cm constant.
BATTERY_PCT_PER_METRE: float = float(MODEL["drainPctPerCm"]) * 100.0  # type: ignore[arg-type]

#: Battery cost per degree turned (shared constant).
BATTERY_PCT_PER_DEGREE: float = float(MODEL["drainPctPerDeg"])  # type: ignore[arg-type]

#: Extra battery cost per registered collision (shared constant).
BATTERY_PCT_PER_COLLISION: float = float(MODEL["drainPctPerCollision"])  # type: ignore[arg-type]

#: Rover body radius in metres (matches the JS collision circle of 30 cm).
ROVER_RADIUS_M: float = float(MODEL["roverRadiusCm"]) / 100.0  # type: ignore[arg-type]


def canonical_json() -> str:
    """Serialise the constant table exactly like motion-model.js does.

    Keys sorted, no whitespace, JSON number formatting. ``json.dumps`` and
    ``JSON.stringify`` agree on every value used above (integers stay bare,
    floats keep their shortest repr), which E-C4 asserts.
    """
    return json.dumps(MODEL, sort_keys=True, separators=(",", ":"))


def gravity_factor(gravity_mps2: float | None) -> float:
    """Mirror of KodroMotion.gravityFactor."""
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    return 0.5 + 0.5 * (g / float(MODEL["gravityEarthMps2"]))  # type: ignore[arg-type]


def mobility_score(speed_factor: float, mass_factor: float, traction: float) -> float:
    """Mirror of KodroMotion.mobilityScore."""
    return (speed_factor * traction) / mass_factor


def move_drain_pct(
    distance_cm: float, gravity_mps2: float | None, mass_factor: float, traction: float
) -> float:
    """Mirror of KodroMotion.moveDrainPct (percent for a distance in cm)."""
    return (
        distance_cm
        * float(MODEL["drainPctPerCm"])  # type: ignore[arg-type]
        * gravity_factor(gravity_mps2)
        * mass_factor
        / traction
    )


def cat_range_cm(mass_factor: float, gravity_mps2: float | None, traction: float) -> float:
    """Mirror of KodroMotion.catRangeCm: sim-enforced range on one charge (cm)."""
    return 100.0 / move_drain_pct(1.0, gravity_mps2, mass_factor, traction)


def cat_endurance_min(
    mass_factor: float, speed_factor: float, gravity_mps2: float | None, traction: float
) -> float:
    """Mirror of KodroMotion.catEnduranceMin: that range at full cruise speed."""
    return (
        cat_range_cm(mass_factor, gravity_mps2, traction)
        / (float(MODEL["baseSpeedCmPerS"]) * speed_factor)  # type: ignore[arg-type]
        / 60.0
    )


def turn_drain_pct(deg: float) -> float:
    """Mirror of KodroMotion.turnDrainPct."""
    return abs(deg) * float(MODEL["drainPctPerDeg"])  # type: ignore[arg-type]


def _clamp(value: float, low: float, high: float) -> float:
    """Mirror of the JS clamp helper in motion-model.js."""
    return min(high, max(low, value))


# --- physical-mode closed forms (E-A1/E-A2/E-A4) ----------------------------
# Ported verbatim from the phys* functions in assets/web/motion-model.js so the
# derived numbers a KRS import produces (top speed, stall force, mobility,
# acceleration, energy, runtime, slope, turns, stopping distance, sensor pose)
# are provably identical across the two engines. tests/unit/test_physical_
# golden_trace.py runs the JS twin over the shipped reference-rover spec and
# fails the build on any drift, so these formulas are parity-locked, not just
# the constant table (E-C4). Full measured-build SIMULATION (sensor rays that
# honour mount geometry and imported range) remains the JS studio only; see
# docs/known-limitations.md.


def phys_top_speed_cm_per_s(no_load_rpm: float, wheel_radius_cm: float) -> float:
    """Free top speed from motor and wheel: v = rpm/60 * 2*pi*r (E-A1)."""
    return (no_load_rpm / 60.0) * 2.0 * math.pi * wheel_radius_cm


def phys_speed_factor(v_cm_per_s: float) -> float:
    """Clamp the derived speed into the simulable band [Lo, Hi]."""
    return _clamp(
        v_cm_per_s / float(MODEL["baseSpeedCmPerS"]),  # type: ignore[arg-type]
        float(MODEL["physSpeedFactorLo"]),  # type: ignore[arg-type]
        float(MODEL["physSpeedFactorHi"]),  # type: ignore[arg-type]
    )


def phys_mass_factor(mass_kg: float) -> float:
    """Clamp mass into the physical mass-factor band."""
    return _clamp(
        (mass_kg * 1000.0) / float(MODEL["massBaselineG"]),  # type: ignore[arg-type]
        float(MODEL["physMassFactorLo"]),  # type: ignore[arg-type]
        float(MODEL["physMassFactorHi"]),  # type: ignore[arg-type]
    )


def phys_stall_force_n(stall_torque_nm: float, motor_count: float, wheel_radius_cm: float) -> float:
    """Tractive force at stall: F = n * tau / r (gear ratio 1 in v1)."""
    return (motor_count * stall_torque_nm) / (wheel_radius_cm / 100.0)


def phys_mobility(
    stall_force_n: float, mass_kg: float, traction: float, gravity_mps2: float | None
) -> float:
    """Force-ratio mobility fed into the shared three bands.

    Drive force times grip over weight.
    """
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    return (stall_force_n * traction) / (mass_kg * g)


def phys_accel_cm_per_s2(stall_force_n: float, mass_kg: float, gravity_mps2: float | None) -> float:
    """First-order acceleration a = (F_stall - Crr*m*g)/m, floored at 1 cm/s^2."""
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    a = (stall_force_n - float(MODEL["rollingResistance"]) * mass_kg * g) / mass_kg  # type: ignore[arg-type]
    return max(1.0, a * 100.0)


def phys_energy_wh(m_ah: float, voltage: float, usable_fraction: float) -> float:
    """Usable pack energy in watt-hours."""
    return (m_ah / 1000.0) * voltage * usable_fraction


def phys_drain_pct_per_cm(
    mass_kg: float, energy_wh: float, v_cm_per_s: float, gravity_mps2: float | None, traction: float
) -> float:
    """Energy-true battery drain per cm (E-A2): P = F_drive*v/eta + P_idle."""
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    v_mps = max(0.01, v_cm_per_s / 100.0)
    f_drive = float(MODEL["rollingResistance"]) * mass_kg * g / (traction or 1.0)  # type: ignore[arg-type]
    watts = (f_drive * v_mps) / float(MODEL["drivetrainEfficiency"]) + float(MODEL["idleDrawW"])  # type: ignore[arg-type]
    joules_per_cm = watts * (0.01 / v_mps)
    return 100.0 * joules_per_cm / (3600.0 * energy_wh)


def phys_runtime_min(
    mass_kg: float, energy_wh: float, v_cm_per_s: float, gravity_mps2: float | None, traction: float
) -> float:
    """Minutes until the usable energy is gone at cruise speed v."""
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    v_mps = max(0.01, v_cm_per_s / 100.0)
    f_drive = float(MODEL["rollingResistance"]) * mass_kg * g / (traction or 1.0)  # type: ignore[arg-type]
    watts = (f_drive * v_mps) / float(MODEL["drivetrainEfficiency"]) + float(MODEL["idleDrawW"])  # type: ignore[arg-type]
    return (energy_wh * 3600.0) / watts / 60.0


def phys_turn_duration_ms(
    deg: float, v_cm_per_s: float, track_cm: float, speed_mul: float | None = None
) -> float:
    """Geometric differential-drive turn (E-A4): omega = 2*v_wheel/track."""
    omega = (2.0 * v_cm_per_s) / max(1.0, track_cm)
    return (abs(deg) * math.pi / 180.0) / max(0.01, omega) * 1000.0 / (speed_mul or 1.0)


def phys_turn_radius_cm(wheelbase_cm: float, max_steer_deg: float) -> float:
    """Ackermann minimum turn radius (report-only in v1): R = wheelbase/tan(steer)."""
    t = math.tan(max_steer_deg * math.pi / 180.0)
    return wheelbase_cm / t if t > 1e-6 else math.inf


def phys_stopping_distance_cm(
    v_cm_per_s: float, traction: float, gravity_mps2: float | None
) -> float:
    """Braking distance from speed v: d = v^2 / (2*mu*g)."""
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    v_mps = v_cm_per_s / 100.0
    mu = float(MODEL["brakeMu"]) * (traction or 1.0)  # type: ignore[arg-type]
    return (v_mps * v_mps) / (2.0 * mu * g) * 100.0


def phys_max_slope_deg(
    stall_force_n: float, mass_kg: float, gravity_mps2: float | None, traction: float = 1.0
) -> float:
    """Max climbable slope: lesser of the force limit and the wheel-grip limit."""
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    s = (stall_force_n - float(MODEL["rollingResistance"]) * mass_kg * g) / (mass_kg * g)  # type: ignore[arg-type]
    force_deg = math.asin(_clamp(s, 0.0, 1.0)) * 180.0 / math.pi
    grip_deg = math.atan(float(MODEL["brakeMu"]) * (traction or 1.0)) * 180.0 / math.pi  # type: ignore[arg-type]
    return min(force_deg, grip_deg)


def phys_stall_verdict(
    stall_force_n: float,
    mass_kg: float,
    traction: float,
    gravity_mps2: float | None,
    motor_count: float,
    wheel_radius_cm: float,
) -> dict[str, object]:
    """Stall verdict inputs (E-A5): needed vs available torque per motor."""
    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])  # type: ignore[arg-type]
    mob = phys_mobility(stall_force_n, mass_kg, traction, g)
    needed_force_n = (float(MODEL["mobilityStallBand"]) * mass_kg * g) / (traction or 1.0)  # type: ignore[arg-type]
    needed_nm = needed_force_n * (wheel_radius_cm / 100.0) / max(1.0, motor_count)
    has_nm = stall_force_n * (wheel_radius_cm / 100.0) / max(1.0, motor_count)
    return {
        "stalled": mob < float(MODEL["mobilityStallBand"]),  # type: ignore[arg-type]
        "mobility": mob,
        "neededNm": needed_nm,
        "hasNm": has_nm,
    }


def sensor_pose(
    x: float,
    y: float,
    heading_deg: float,
    fwd_cm: float,
    left_cm: float,
    yaw_deg: float,
) -> dict[str, float]:
    """Sensor mount pose (SI2).

    Ray origin offset by the sensor's forward/left position and yaw, in the
    sim's compass frame (heading 0 is up/-y, clockwise positive). z is ignored
    and disclosed. Mirrors sensorPose in motion-model.js.
    """
    a = heading_deg * math.pi / 180.0
    fx, fy = math.sin(a), -math.cos(a)  # forward
    lx, ly = -math.cos(a), -math.sin(a)  # left
    return {
        "x": x + fwd_cm * fx + left_cm * lx,
        "y": y + fwd_cm * fy + left_cm * ly,
        "heading": heading_deg + (yaw_deg or 0.0),
    }


def segment_circle_hit(
    ax: float,
    ay: float,
    bx: float,
    by: float,
    cx: float,
    cy: float,
    radius: float,
) -> float | None:
    """First contact parameter t in [0, 1] where segment a->b meets a circle.

    The circle is the obstacle grown by the rover radius (a swept-circle
    test, the same shape the JS tick and scenario validator use). Returns
    ``None`` when the segment never touches the circle. Used by
    :meth:`robolearn.engine.rover.Rover.move` to stop AT the contact point
    and register a real collision (E-A7) instead of gliding through.
    """
    dx, dy = bx - ax, by - ay
    fx, fy = ax - cx, ay - cy
    a = dx * dx + dy * dy
    c = fx * fx + fy * fy - radius * radius
    if a <= 1e-12:
        # Degenerate (zero-length) move: report contact only if already inside.
        return 0.0 if c <= 0.0 else None
    b = 2.0 * (fx * dx + fy * dy)
    if c <= 0.0:
        # The segment STARTS inside (or exactly on) the grown circle, which is
        # precisely where a previous swept stop leaves the rover. Blocking
        # unconditionally here (the old ``max(0.0, t1)`` collapsed this case
        # to t=0) trapped a touching rover forever: every later move,
        # including one pointed straight AWAY from the obstacle, reported an
        # immediate hit. Physically the rover may back off: moving away or
        # tangentially is free; only moving deeper in is an immediate contact.
        return 0.0 if b < 0.0 else None
    disc = b * b - 4.0 * a * c
    if disc < 0.0:
        return None
    sqrt_disc = math.sqrt(disc)
    t1 = (-b - sqrt_disc) / (2.0 * a)
    t2 = (-b + sqrt_disc) / (2.0 * a)
    if t2 < 0.0 or t1 > 1.0:
        return None
    return max(0.0, t1)
