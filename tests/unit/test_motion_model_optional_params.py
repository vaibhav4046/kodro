"""Every optional parameter of the motion model must actually be used.

Mutation testing of ``engine/motion_model.py`` scored 11.1%: 24 of 27 mutants
survived, and a sample of them survived the whole 1,819-test suite, not just the
motion-model tests. Seventeen of the twenty-four were the same single mutation
applied in seventeen places, ``x or default`` flipped to ``x and default``:

    g = gravity_mps2 or float(MODEL["gravityEarthMps2"])   ->   ... and ...

Under that flip, a caller who passes a real gravity gets Earth's instead, and a
caller who passes ``None`` gets ``None`` into the arithmetic. Nothing in the
suite noticed, which means nothing in the suite ever called these functions with
a non-default value. Every motion-model test used Earth gravity, traction 1.0
and no yaw, so the entire optional-argument surface of the simulator was
unexercised.

That matters more here than it would elsewhere. Kodro ships Mars, Space and
Underwater worlds, and the gravity argument is exactly how a world changes what
the rover can do. A simulator whose gravity parameter is never tested with a
non-Earth value is not testing the thing it exists to model.

The gravity constants below are read from the shipped terrain table rather than
written as literals, so a world's gravity cannot drift away from what these
assertions assume.
"""

from __future__ import annotations

import math

import pytest

from kodro.engine import motion_model as mm
from kodro.engine.terrain import Terrain, params_for

EARTH_G = params_for(Terrain.EARTH).gravity_mps2
MARS_G = params_for(Terrain.MARS).gravity_mps2
SPACE_G = params_for(Terrain.SPACE).gravity_mps2


def test_the_worlds_really_do_differ_in_gravity() -> None:
    """Guard the guard: every assertion below is vacuous if these are equal."""
    assert MARS_G < EARTH_G, "Mars must be lighter than Earth for these tests to mean anything"
    assert SPACE_G < MARS_G
    assert float(mm.MODEL["gravityEarthMps2"]) == pytest.approx(EARTH_G)  # type: ignore[arg-type]


# --------------------------------------------------------------------------
# gravity
# --------------------------------------------------------------------------


def test_gravity_factor_follows_gravity() -> None:
    """A lighter world costs less to move through."""
    assert mm.gravity_factor(MARS_G) < mm.gravity_factor(EARTH_G)
    assert mm.gravity_factor(SPACE_G) < mm.gravity_factor(MARS_G)
    # None means Earth, which is the whole point of the `or` being an `or`.
    assert mm.gravity_factor(None) == pytest.approx(mm.gravity_factor(EARTH_G))


def test_move_drain_and_range_follow_gravity() -> None:
    drain_mars = mm.move_drain_pct(100.0, MARS_G, 1.0, 1.0)
    drain_earth = mm.move_drain_pct(100.0, EARTH_G, 1.0, 1.0)
    assert drain_mars < drain_earth, "Mars should drain less battery per centimetre"

    assert mm.cat_range_cm(1.0, MARS_G, 1.0) > mm.cat_range_cm(1.0, EARTH_G, 1.0)
    assert mm.cat_endurance_min(1.0, 1.0, MARS_G, 1.0) > mm.cat_endurance_min(
        1.0, 1.0, EARTH_G, 1.0
    )
    assert mm.move_drain_pct(100.0, None, 1.0, 1.0) == pytest.approx(drain_earth)


def test_mobility_and_acceleration_follow_gravity() -> None:
    """Less weight to push means more mobility and more acceleration."""
    assert mm.phys_mobility(20.0, 2.0, 1.0, MARS_G) > mm.phys_mobility(20.0, 2.0, 1.0, EARTH_G)
    assert mm.phys_mobility(20.0, 2.0, 1.0, None) == pytest.approx(
        mm.phys_mobility(20.0, 2.0, 1.0, EARTH_G)
    )

    # Rolling resistance scales with weight, so a lighter world accelerates harder.
    assert mm.phys_accel_cm_per_s2(20.0, 2.0, MARS_G) > mm.phys_accel_cm_per_s2(20.0, 2.0, EARTH_G)
    assert mm.phys_accel_cm_per_s2(20.0, 2.0, None) == pytest.approx(
        mm.phys_accel_cm_per_s2(20.0, 2.0, EARTH_G)
    )


def test_drain_and_runtime_follow_gravity() -> None:
    drain_mars = mm.phys_drain_pct_per_cm(2.0, 10.0, 30.0, MARS_G, 1.0)
    drain_earth = mm.phys_drain_pct_per_cm(2.0, 10.0, 30.0, EARTH_G, 1.0)
    assert drain_mars < drain_earth
    assert mm.phys_drain_pct_per_cm(2.0, 10.0, 30.0, None, 1.0) == pytest.approx(drain_earth)

    assert mm.phys_runtime_min(2.0, 10.0, 30.0, MARS_G, 1.0) > mm.phys_runtime_min(
        2.0, 10.0, 30.0, EARTH_G, 1.0
    )
    # phys_runtime_min has its own `traction or 1.0`, separate from the one in
    # phys_drain_pct_per_cm, and it needs its own assertion to be exercised.
    assert mm.phys_runtime_min(2.0, 10.0, 30.0, EARTH_G, 2.0) > mm.phys_runtime_min(
        2.0, 10.0, 30.0, EARTH_G, 1.0
    ), "more grip means less drive force and a longer runtime"


def test_stopping_distance_gets_WORSE_in_lower_gravity() -> None:
    """The one that runs the other way, and the reason to assert direction.

    Braking force comes from weight pressing the wheels down, so a lighter world
    gives less grip and a longer stop. A test that only asserted "Mars differs
    from Earth" would pass with the sign backwards.
    """
    stop_mars = mm.phys_stopping_distance_cm(50.0, 1.0, MARS_G)
    stop_earth = mm.phys_stopping_distance_cm(50.0, 1.0, EARTH_G)
    assert stop_mars > stop_earth, "lower gravity means less grip and a longer stop"
    assert mm.phys_stopping_distance_cm(50.0, 1.0, None) == pytest.approx(stop_earth)


def test_max_slope_follows_gravity_until_grip_caps_it() -> None:
    """Below the grip ceiling, a lighter world climbs steeper."""
    # A modest stall force so the force limit, not the grip limit, is the binding one.
    slope_mars = mm.phys_max_slope_deg(6.0, 2.0, MARS_G, 1.0)
    slope_earth = mm.phys_max_slope_deg(6.0, 2.0, EARTH_G, 1.0)
    assert slope_mars > slope_earth
    assert mm.phys_max_slope_deg(6.0, 2.0, None, 1.0) == pytest.approx(slope_earth)


def test_stall_verdict_follows_gravity() -> None:
    light = mm.phys_stall_verdict(20.0, 2.0, 1.0, MARS_G, 2.0, 3.0)
    heavy = mm.phys_stall_verdict(20.0, 2.0, 1.0, EARTH_G, 2.0, 3.0)
    assert float(light["mobility"]) > float(heavy["mobility"])  # type: ignore[arg-type]
    assert float(light["neededNm"]) < float(heavy["neededNm"])  # type: ignore[arg-type]

    default = mm.phys_stall_verdict(20.0, 2.0, 1.0, None, 2.0, 3.0)
    assert float(default["mobility"]) == pytest.approx(float(heavy["mobility"]))  # type: ignore[arg-type]


# --------------------------------------------------------------------------
# traction, speed multiplier, sensor yaw
# --------------------------------------------------------------------------


def test_traction_changes_drain_stopping_and_slope() -> None:
    """`traction or 1.0` appears five times and was never given a non-1.0 value."""
    assert mm.phys_drain_pct_per_cm(2.0, 10.0, 30.0, EARTH_G, 2.0) < mm.phys_drain_pct_per_cm(
        2.0, 10.0, 30.0, EARTH_G, 1.0
    )
    assert mm.phys_stopping_distance_cm(50.0, 2.0, EARTH_G) < mm.phys_stopping_distance_cm(
        50.0, 1.0, EARTH_G
    )
    assert mm.phys_max_slope_deg(60.0, 2.0, EARTH_G, 2.0) > mm.phys_max_slope_deg(
        60.0, 2.0, EARTH_G, 1.0
    ), "more grip must raise the grip-limited slope ceiling"
    assert (
        mm.phys_stall_verdict(20.0, 2.0, 2.0, EARTH_G, 2.0, 3.0)["neededNm"]
        < (mm.phys_stall_verdict(20.0, 2.0, 1.0, EARTH_G, 2.0, 3.0)["neededNm"])
    )


def test_speed_multiplier_shortens_a_turn() -> None:
    fast = mm.phys_turn_duration_ms(90.0, 30.0, 12.0, 2.0)
    normal = mm.phys_turn_duration_ms(90.0, 30.0, 12.0, 1.0)
    assert fast < normal
    assert mm.phys_turn_duration_ms(90.0, 30.0, 12.0, None) == pytest.approx(normal)


def test_sensor_yaw_rotates_the_reported_heading() -> None:
    straight = mm.sensor_pose(0.0, 0.0, 90.0, 5.0, 0.0, 0.0)
    yawed = mm.sensor_pose(0.0, 0.0, 90.0, 5.0, 0.0, 30.0)
    assert yawed["heading"] == pytest.approx(straight["heading"] + 30.0)
    # The mount position itself does not move with yaw, only the facing.
    assert yawed["x"] == pytest.approx(straight["x"])
    assert yawed["y"] == pytest.approx(straight["y"])


def test_turn_radius_is_infinite_only_when_there_is_no_steering() -> None:
    """Pins the `t > 1e-6` guard, which a boundary flip would otherwise reach."""
    assert mm.phys_turn_radius_cm(20.0, 0.0) == math.inf
    assert math.isfinite(mm.phys_turn_radius_cm(20.0, 30.0))
    assert mm.phys_turn_radius_cm(20.0, 30.0) > 0.0


def test_the_stall_verdict_boundary_is_not_stalled() -> None:
    """A rover exactly on the stall band is mobile, not stalled.

    `mob < mobilityStallBand` could be flipped to `<=` with no test noticing,
    which would fail a design that sits precisely on the limit. Constructed with
    gravity and mass of 1.0 so the mobility lands on the band exactly rather
    than near it.
    """
    band = float(mm.MODEL["mobilityStallBand"])  # type: ignore[arg-type]
    on_the_band = mm.phys_stall_verdict(band, 1.0, 1.0, 1.0, 1.0, 10.0)
    assert float(on_the_band["mobility"]) == band, "construction must be exact"  # type: ignore[arg-type]
    assert on_the_band["stalled"] is False, "exactly on the limit is not over it"

    just_under = mm.phys_stall_verdict(band * 0.99, 1.0, 1.0, 1.0, 1.0, 10.0)
    assert just_under["stalled"] is True, "below the band must still stall"
