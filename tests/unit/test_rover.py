"""Rover entity tests (Task 3)."""

from __future__ import annotations

import math

import pytest

from robolearn.engine.rover import (
    BATTERY_PER_COLLISION,
    BATTERY_PER_DEGREE,
    BATTERY_PER_METRE,
    Rover,
)
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Sample, World


def _world() -> World:
    return World(
        terrain=Terrain.MARS,
        base=(5.0, 5.0),
        samples=[Sample(5.5, 5.0), Sample(7.0, 7.0)],
        bounds=ArenaBounds(width=10.0, height=10.0),
    )


def test_rover_starts_at_base_with_full_battery() -> None:
    r = Rover(_world())
    assert r.state.x == pytest.approx(5.0)
    assert r.state.y == pytest.approx(5.0)
    assert r.state.battery_pct == pytest.approx(100.0)


def test_move_forward_east_default_heading() -> None:
    r = Rover(_world())
    dx, dy = r.move(2.0)
    assert dx == pytest.approx(2.0)
    assert dy == pytest.approx(0.0, abs=1e-9)
    assert r.state.x == pytest.approx(7.0)


def test_move_clamps_to_arena_bounds() -> None:
    r = Rover(_world())
    r.move(999.0)
    assert r.state.x == pytest.approx(10.0)


def test_move_drains_battery_per_metre() -> None:
    r = Rover(_world())
    r.move(10.0)
    assert r.state.battery_pct == pytest.approx(100.0 - 10.0 * BATTERY_PER_METRE)


def test_move_backward_drains_battery_by_absolute_distance() -> None:
    r = Rover(_world())
    r.move(-3.0)
    assert r.state.battery_pct == pytest.approx(100.0 - 3.0 * BATTERY_PER_METRE)


def test_turn_left_rotates_heading() -> None:
    r = Rover(_world())
    r.turn(90.0)
    assert r.state.heading_deg == pytest.approx(90.0)
    # After turning to north, forward motion should add to y rather than x.
    r.move(1.0)
    assert r.state.y == pytest.approx(6.0)
    assert r.state.x == pytest.approx(5.0, abs=1e-9)


def test_turn_drains_battery_per_degree() -> None:
    r = Rover(_world())
    r.turn(180.0)
    assert r.state.battery_pct == pytest.approx(100.0 - 180.0 * BATTERY_PER_DEGREE)


def test_turn_wraps_to_0_360() -> None:
    r = Rover(_world())
    r.turn(720.0)
    assert r.state.heading_deg == pytest.approx(0.0)
    r.turn(-90.0)
    # -90 mod 360 in Python is 270.
    assert r.state.heading_deg == pytest.approx(270.0)


def test_battery_cannot_go_below_zero() -> None:
    r = Rover(_world())
    r.move(10000.0)  # would drain far past zero
    assert r.state.battery_pct == 0.0


def test_collision_drains_extra_battery_and_counter() -> None:
    r = Rover(_world())
    r.register_collision()
    assert r.state.collisions == 1
    assert r.state.battery_pct == pytest.approx(100.0 - BATTERY_PER_COLLISION)


def test_try_collect_picks_up_sample_in_range() -> None:
    r = Rover(_world())
    # Sample at (5.5, 5.0) is 0.5 m from base. Within default detection radius 0.3? No.
    # Drive 0.4 m east to bring sample within range.
    r.move(0.4)
    assert r.try_collect(radius_m=0.5) is True
    assert r.state.samples_held == 1
    assert r.state.samples_collected == 1
    assert r.world.samples[0].collected


def test_try_collect_misses_when_no_sample_in_range() -> None:
    r = Rover(_world())
    assert r.try_collect(radius_m=0.01) is False


def test_try_collect_skips_already_collected() -> None:
    w = _world()
    w.samples[0].collected = True
    r = Rover(w)
    assert r.try_collect(radius_m=2.0) is False


def test_try_drop_requires_held_sample() -> None:
    r = Rover(_world())
    assert r.try_drop() is False
    r.state.samples_held = 2
    assert r.try_drop() is True
    assert r.state.samples_held == 1


def test_at_base_within_tolerance() -> None:
    r = Rover(_world())
    assert r.at_base() is True
    r.move(0.5)
    assert r.at_base(tolerance_m=0.1) is False


def test_distance_to_is_euclidean() -> None:
    r = Rover(_world())
    assert r.distance_to(8.0, 9.0) == pytest.approx(5.0)


def test_heading_radians_matches_degrees() -> None:
    r = Rover(_world())
    r.turn(180.0)
    assert r.heading_radians() == pytest.approx(math.pi)
