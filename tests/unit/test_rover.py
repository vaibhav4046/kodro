"""Rover entity tests (Task 3)."""

from __future__ import annotations

import math

import pytest

from kodro.engine.rover import (
    BATTERY_PER_COLLISION,
    BATTERY_PER_DEGREE,
    BATTERY_PER_METRE,
    Rover,
)
from kodro.engine.terrain import Terrain
from kodro.engine.world import ArenaBounds, Obstacle, Sample, World


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
    # Driving into the wall is a collision now (E-A7), not a silent clamp.
    assert r.state.collisions == 1


def test_move_drains_battery_per_metre() -> None:
    r = Rover(_world())
    r.move(3.0)
    assert r.state.battery_pct == pytest.approx(100.0 - 3.0 * BATTERY_PER_METRE)


def test_clamped_move_drains_actual_distance_only() -> None:
    """A wall-clamped move drains the distance TRAVELLED, not commanded.

    From base x=5 a 10 m command stops at the 10 m wall after 5 m; the old
    model still charged the full 10 m (the JS/Python divergence the shared
    motion model closed). The wall hit also registers one collision.
    """
    r = Rover(_world())
    r.move(10.0)
    assert r.state.x == pytest.approx(10.0)
    assert r.state.distance_travelled_m == pytest.approx(5.0)
    assert r.state.collisions == 1
    assert r.state.battery_pct == pytest.approx(
        100.0 - 5.0 * BATTERY_PER_METRE - BATTERY_PER_COLLISION
    )


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
    # Shuttle 4 m back and forth WITHIN the arena so every metre is real
    # travelled distance (a single huge command would clamp at the wall and
    # only drain the metres actually covered). 40 legs x 4 m x 1.1 %/m
    # drains far past zero; the floor must hold at exactly 0.
    for _ in range(40):
        r.move(4.0)
        r.turn(180.0)
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


def _open_world(obstacles: list[Obstacle]) -> World:
    """A wide, obstacle-carrying arena for the collision-geometry regressions."""
    return World(
        terrain=Terrain.EARTH,
        base=(5.0, 5.0),
        bounds=ArenaBounds(width=30.0, height=30.0),
        obstacles=obstacles,
    )


def test_move_stops_at_nearest_obstacle_regardless_of_list_order() -> None:
    """A farther obstacle listed FIRST must not let the rover cut into a nearer one.

    Regression: the old sweep shortened the target inside the loop yet rescaled
    by the full ideal displacement, so an earlier-listed farther obstacle made
    the rover overshoot the true nearer contact and end up inside it. Ordering
    must not change where the body stops. Near obstacle surface (grown by the
    rover radius 0.3) sits at x = 7 - (0.3 + 0.3) = 6.4.
    """
    near = Obstacle(7.0, 5.0, 0.3)
    far = Obstacle(9.0, 5.0, 0.3)
    r = Rover(_open_world([far, near]))  # farther one FIRST on purpose
    r.move(6.0)  # east, far enough to reach both
    assert r.state.x == pytest.approx(6.4, abs=0.02)  # stopped AT the nearer body
    assert r.state.collisions >= 1


def test_touching_rover_can_reverse_away_and_is_not_trapped() -> None:
    """A rover in contact with an obstacle may back off; only driving deeper hits.

    Regression: segment_circle_hit returned t=0 for ANY move starting inside the
    grown radius, so a touching rover was trapped forever, every move (even one
    pointed straight away) reporting an immediate collision.
    """
    obstacle = Obstacle(5.4, 5.0, 0.2)  # grown radius 0.5; rover at (5,5) is inside
    r = Rover(_open_world([obstacle]))
    collisions_before = r.state.collisions
    r.move(-1.0)  # reverse WEST, straight away from the east obstacle
    assert r.state.x == pytest.approx(4.0, abs=1e-6)  # moved fully, not trapped
    assert r.state.collisions == collisions_before  # backing off is not a hit


def test_touching_rover_driving_deeper_still_collides() -> None:
    """Backing off is free, but driving INTO the obstacle still registers a hit."""
    obstacle = Obstacle(5.4, 5.0, 0.2)  # grown 0.5; rover at (5,5) inside
    r = Rover(_open_world([obstacle]))
    before = r.state.collisions
    r.move(1.0)  # east, straight into the obstacle centre
    assert r.state.collisions == before + 1
    assert r.state.x == pytest.approx(5.0, abs=1e-6)  # held at the contact point


def test_default_drain_scale_reproduces_the_fixed_per_metre_drain() -> None:
    """The default build (mass factor 1) drains exactly as before -- no golden shift."""
    r = Rover(_world())
    r.move(1.0)  # 1 m east from base, no wall/obstacle
    assert 100.0 - r.state.battery_pct == pytest.approx(BATTERY_PER_METRE)


def test_heavier_build_drains_proportionally_more_under_grading() -> None:
    """A spec-aware grade: mass factor scales per-metre drain (mirrors the sim)."""
    light = Rover(_world())
    heavy = Rover(_world(), drain_scale=1.5)
    light.move(2.0)
    heavy.move(2.0)
    light_used = 100.0 - light.state.battery_pct
    heavy_used = 100.0 - heavy.state.battery_pct
    assert heavy_used == pytest.approx(1.5 * light_used)
    assert heavy_used > light_used


def test_invalid_drain_scale_falls_back_to_one() -> None:
    """A zero/negative mass factor must not zero out or reverse battery drain."""
    r = Rover(_world(), drain_scale=0.0)
    r.move(1.0)
    assert 100.0 - r.state.battery_pct == pytest.approx(BATTERY_PER_METRE)
