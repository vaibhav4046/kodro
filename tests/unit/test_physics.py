"""Physics-space wrapper tests (Task 3)."""

from __future__ import annotations

import math

import pytest

from robolearn.engine.physics import (
    COLLISION_TYPE_OBSTACLE,
    ROVER_RADIUS_M,
    PhysicsSpace,
)
from robolearn.engine.terrain import Terrain, params_for


@pytest.mark.parametrize(
    "terrain",
    [Terrain.EARTH, Terrain.MARS, Terrain.UNDERWATER, Terrain.SPACE],
)
def test_space_init_applies_terrain_params(terrain: Terrain) -> None:
    space = PhysicsSpace(terrain)
    params = params_for(terrain)
    assert space.params == params
    # 2D top-down — gravity vector itself is always zero.
    assert tuple(space.space.gravity) == (0.0, 0.0)
    # Damping derives from drag.
    assert math.isclose(space.space.damping, 1.0 - params.drag)


def test_underwater_has_strong_damping() -> None:
    space = PhysicsSpace("underwater")
    assert math.isclose(space.space.damping, 0.3)


def test_walls_are_static_and_match_terrain_friction() -> None:
    space = PhysicsSpace(Terrain.MARS, width=4.0, height=3.0)
    # The four boundary walls plus the static_body itself live in the space.
    segments = [s for s in space.space.shapes if hasattr(s, "a") and hasattr(s, "b")]
    assert len(segments) == 4
    for segment in segments:
        assert math.isclose(segment.friction, params_for(Terrain.MARS).friction)


def test_add_rover_creates_body_and_shape_with_terrain_friction() -> None:
    space = PhysicsSpace(Terrain.EARTH)
    body = space.add_rover(x=1.0, y=2.0)
    assert body is space.rover_body
    assert body.position.x == pytest.approx(1.0)
    assert body.position.y == pytest.approx(2.0)
    circles = [s for s in space.space.shapes if hasattr(s, "radius")]
    assert any(math.isclose(c.radius, ROVER_RADIUS_M) for c in circles)
    assert all(
        math.isclose(c.friction, params_for(Terrain.EARTH).friction)
        for c in circles
        if math.isclose(getattr(c, "radius", -1.0), ROVER_RADIUS_M)
    )


def test_add_rover_twice_raises() -> None:
    space = PhysicsSpace(Terrain.MARS)
    space.add_rover()
    with pytest.raises(RuntimeError):
        space.add_rover()


def test_rover_body_accessor_raises_before_add() -> None:
    space = PhysicsSpace(Terrain.MARS)
    with pytest.raises(RuntimeError):
        _ = space.rover_body


def test_add_obstacle_returns_static_body() -> None:
    space = PhysicsSpace(Terrain.MARS, width=10.0, height=10.0)
    body = space.add_obstacle(5.0, 5.0, 0.3)
    import pymunk

    assert body.body_type == pymunk.Body.STATIC


def test_step_advances_without_error() -> None:
    space = PhysicsSpace(Terrain.MARS)
    space.add_rover(x=5.0, y=5.0)
    for _ in range(5):
        space.step()


def test_collision_with_wall_is_recorded() -> None:
    space = PhysicsSpace(Terrain.MARS, width=10.0, height=10.0)
    body = space.add_rover(x=0.5, y=5.0)
    body.velocity = (-3.0, 0.0)
    for _ in range(120):  # up to ~2 simulated seconds
        space.step()
        if space.collisions():
            break
    assert space.collisions(), "expected a wall collision to be recorded"


def test_collision_with_obstacle_is_recorded() -> None:
    space = PhysicsSpace(Terrain.EARTH, width=10.0, height=10.0)
    body = space.add_rover(x=5.0, y=5.0)
    space.add_obstacle(6.0, 5.0, 0.3)
    body.velocity = (2.0, 0.0)
    for _ in range(120):
        space.step()
        if any(e.other_type == COLLISION_TYPE_OBSTACLE for e in space.collisions()):
            break
    assert any(e.other_type == COLLISION_TYPE_OBSTACLE for e in space.collisions())


def test_clear_collisions_resets_buffer() -> None:
    space = PhysicsSpace(Terrain.MARS, width=10.0, height=10.0)
    body = space.add_rover(x=0.5, y=5.0)
    body.velocity = (-3.0, 0.0)
    for _ in range(120):
        space.step()
        if space.collisions():
            break
    assert space.collisions()
    space.clear_collisions()
    assert space.collisions() == []
