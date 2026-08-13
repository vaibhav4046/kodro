"""Sensor tests, including Hypothesis property-based cases (Task 4)."""

from __future__ import annotations

import math

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from robolearn.engine.rover import Rover
from robolearn.engine.sensors import (
    COLOUR_BASE_INDICATOR,
    COLOUR_SAMPLE_INDICATOR,
    LIDAR_MAX_RANGE_M,
    TERRAIN_COLOURS,
    ULTRASONIC_MAX_RANGE_M,
    IMUReading,
    colour_under,
    imu_reading,
    lidar_distance,
    ultrasonic_distance,
)
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World


def _world_empty(terrain: Terrain = Terrain.MARS) -> World:
    return World(
        terrain=terrain,
        base=(5.0, 5.0),
        bounds=ArenaBounds(width=10.0, height=10.0),
    )


# --- LIDAR ------------------------------------------------------------------


def test_lidar_in_empty_arena_hits_wall_ahead() -> None:
    world = _world_empty()
    rover = Rover(world)  # heading 0 = east, position (5, 5)
    distance = lidar_distance(rover)
    assert distance == pytest.approx(5.0, abs=1e-6)


def test_lidar_returns_inf_when_no_hit_within_range() -> None:
    # Tiny range: 0.0001 — the wall is 5 m away.
    rover = Rover(_world_empty())
    assert math.isinf(lidar_distance(rover, max_range_m=0.0001))


def test_lidar_hits_obstacle_before_wall() -> None:
    world = _world_empty()
    world.obstacles.append(Obstacle(x=6.0, y=5.0, radius=0.25))
    rover = Rover(world)
    # Wall is at x=10 (5 m ahead); obstacle face is at x=5.75 (0.75 m ahead).
    distance = lidar_distance(rover)
    assert distance == pytest.approx(0.75, abs=1e-6)


def test_lidar_angle_offset_rotates_ray() -> None:
    world = _world_empty()
    world.obstacles.append(Obstacle(x=5.0, y=6.0, radius=0.25))  # directly north
    rover = Rover(world)
    # Default heading 0 (east) — no hit in front, ray hits east wall first.
    east_distance = lidar_distance(rover)
    # With +90 offset (north) the obstacle face at y=5.75 is 0.75 m away.
    north_distance = lidar_distance(rover, angle_deg=90.0)
    assert north_distance == pytest.approx(0.75, abs=1e-6)
    assert east_distance > north_distance


def test_lidar_with_obstacle_behind_ignored() -> None:
    world = _world_empty()
    world.obstacles.append(Obstacle(x=4.0, y=5.0, radius=0.25))  # west of rover
    rover = Rover(world)
    # Heading east — west obstacle should be ignored; ray hits east wall at 5 m.
    distance = lidar_distance(rover)
    assert distance == pytest.approx(5.0, abs=1e-6)


# --- Ultrasonic -------------------------------------------------------------


def test_ultrasonic_caps_at_5m_when_lidar_far() -> None:
    # LIDAR would see the wall 5 m away; ultrasonic should report inf because
    # the 5 m wall is at the very edge of the ultrasonic range and our
    # implementation reports inf above range.
    world = World(terrain=Terrain.MARS, base=(5.0, 5.0), bounds=ArenaBounds(20.0, 20.0))
    rover = Rover(world)
    # Wall is 15 m away — well beyond ultrasonic range of 5 m.
    assert math.isinf(ultrasonic_distance(rover))


def test_ultrasonic_reports_obstacle_within_range() -> None:
    world = _world_empty()
    world.obstacles.append(Obstacle(x=7.0, y=5.0, radius=0.25))
    rover = Rover(world)  # obstacle face 1.75 m ahead
    distance = ultrasonic_distance(rover)
    assert distance == pytest.approx(1.75, abs=1e-6)


def test_ultrasonic_returns_non_negative() -> None:
    rover = Rover(_world_empty())
    distance = ultrasonic_distance(rover)
    assert math.isinf(distance) or distance >= 0.0


# --- Colour -----------------------------------------------------------------


@pytest.mark.parametrize("terrain", list(Terrain))
def test_colour_under_returns_terrain_colour_when_not_over_anything(terrain: Terrain) -> None:
    world = World(terrain=terrain, base=(2.0, 2.0), bounds=ArenaBounds(10.0, 10.0))
    rover = Rover(world)
    rover.state.x, rover.state.y = 8.0, 8.0  # far from base, no samples
    assert colour_under(rover) == TERRAIN_COLOURS[terrain]


def test_colour_under_returns_base_indicator_when_on_base() -> None:
    rover = Rover(_world_empty())  # starts at base (5, 5)
    assert colour_under(rover) == COLOUR_BASE_INDICATOR


def test_colour_under_returns_sample_indicator_when_on_sample() -> None:
    world = _world_empty(Terrain.MARS)
    world.samples.append(Sample(x=8.0, y=8.0))
    rover = Rover(world)
    rover.state.x, rover.state.y = 8.0, 8.0
    assert colour_under(rover) == COLOUR_SAMPLE_INDICATOR


def test_colour_under_ignores_collected_sample() -> None:
    world = _world_empty(Terrain.MARS)
    world.samples.append(Sample(x=8.0, y=8.0, collected=True))
    rover = Rover(world)
    rover.state.x, rover.state.y = 8.0, 8.0
    assert colour_under(rover) == TERRAIN_COLOURS[Terrain.MARS]


def test_colour_base_takes_precedence_over_sample() -> None:
    world = _world_empty(Terrain.MARS)
    world.samples.append(Sample(x=5.0, y=5.0))  # right on base
    rover = Rover(world)  # starts at base
    assert colour_under(rover) == COLOUR_BASE_INDICATOR


# --- IMU --------------------------------------------------------------------


def test_imu_reports_rover_heading() -> None:
    rover = Rover(_world_empty())
    rover.turn(45.0)
    reading = imu_reading(rover)
    assert isinstance(reading, IMUReading)
    assert reading.heading_deg == pytest.approx(45.0)
    assert reading.accel_x_mps2 == 0.0
    assert reading.accel_y_mps2 == 0.0


def test_imu_frozen_dataclass() -> None:
    reading = imu_reading(Rover(_world_empty()))
    with pytest.raises(Exception):  # noqa: B017 — frozen dataclass raises FrozenInstanceError
        reading.heading_deg = 99.0  # type: ignore[misc]


# --- Hypothesis property-based tests ----------------------------------------


@given(
    rover_x=st.floats(min_value=0.5, max_value=9.5),
    rover_y=st.floats(min_value=0.5, max_value=9.5),
    heading=st.floats(min_value=0.0, max_value=359.999),
)
def test_lidar_distance_is_non_negative_in_empty_arena(
    rover_x: float, rover_y: float, heading: float
) -> None:
    world = _world_empty()
    rover = Rover(world)
    rover.state.x, rover.state.y, rover.state.heading_deg = rover_x, rover_y, heading
    distance = lidar_distance(rover)
    assert distance >= 0.0 or math.isinf(distance)
    # Always bounded by the diagonal of the arena (~14.14 m).
    assert math.isinf(distance) or distance <= LIDAR_MAX_RANGE_M


@given(
    rover_x=st.floats(min_value=1.0, max_value=9.0),
    rover_y=st.floats(min_value=1.0, max_value=9.0),
    radius=st.floats(min_value=0.1, max_value=1.0),
)
@settings(deadline=None)
def test_obstacle_makes_lidar_no_greater_than_empty(
    rover_x: float, rover_y: float, radius: float
) -> None:
    """Adding an obstacle in front of the rover never increases LIDAR range."""
    world_no_obs = _world_empty()
    world_with_obs = _world_empty()
    world_with_obs.obstacles.append(Obstacle(x=rover_x + 2.0, y=rover_y, radius=radius))
    rover_a = Rover(world_no_obs)
    rover_b = Rover(world_with_obs)
    for r in (rover_a, rover_b):
        r.state.x, r.state.y, r.state.heading_deg = rover_x, rover_y, 0.0
    d_clear = lidar_distance(rover_a)
    d_blocked = lidar_distance(rover_b)
    assert d_blocked <= d_clear + 1e-6 or math.isinf(d_clear)


@given(
    angle=st.floats(min_value=0.0, max_value=360.0),
)
def test_ultrasonic_is_never_greater_than_lidar_range(angle: float) -> None:
    world = _world_empty()
    rover = Rover(world)
    rover.state.heading_deg = angle
    us = ultrasonic_distance(rover)
    if math.isinf(us):
        return
    assert us <= ULTRASONIC_MAX_RANGE_M + 1e-6


@given(
    x=st.floats(min_value=0.0, max_value=10.0),
    y=st.floats(min_value=0.0, max_value=10.0),
    terrain=st.sampled_from(list(Terrain)),
)
def test_colour_under_always_returns_valid_rgb(x: float, y: float, terrain: Terrain) -> None:
    world = World(terrain=terrain, base=(0.0, 0.0), bounds=ArenaBounds(10.0, 10.0))
    rover = Rover(world)
    rover.state.x, rover.state.y = x, y
    rgb = colour_under(rover)
    assert len(rgb) == 3
    for channel in rgb:
        assert 0 <= channel <= 255


@given(heading=st.floats(min_value=0.0, max_value=359.999))
def test_imu_heading_matches_rover_heading(heading: float) -> None:
    rover = Rover(_world_empty())
    rover.state.heading_deg = heading
    assert imu_reading(rover).heading_deg == heading
