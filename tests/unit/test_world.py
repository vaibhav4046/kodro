"""World container tests (Task 3)."""

from __future__ import annotations

import math

import pytest

from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World


def test_arena_bounds_contains_corners() -> None:
    b = ArenaBounds(width=10.0, height=10.0)
    assert b.contains(0.0, 0.0)
    assert b.contains(10.0, 10.0)
    assert b.contains(5.0, 5.0)


def test_arena_bounds_excludes_outside() -> None:
    b = ArenaBounds(width=10.0, height=10.0)
    assert not b.contains(-0.001, 5.0)
    assert not b.contains(10.001, 5.0)
    assert not b.contains(5.0, -0.001)
    assert not b.contains(5.0, 10.001)


def test_world_constructs_with_defaults() -> None:
    w = World(terrain=Terrain.MARS, base=(1.0, 1.0))
    assert w.terrain is Terrain.MARS
    assert w.samples == []
    assert w.obstacles == []
    assert isinstance(w.bounds, ArenaBounds)


def test_world_uncollected_filters_collected() -> None:
    w = World(
        terrain=Terrain.MARS,
        base=(0.0, 0.0),
        samples=[
            Sample(1.0, 1.0, collected=False),
            Sample(2.0, 2.0, collected=True),
            Sample(3.0, 3.0, collected=False),
        ],
    )
    pending = w.uncollected_samples()
    assert len(pending) == 2
    assert all(not s.collected for s in pending)


def test_world_all_collected_only_when_every_sample_done() -> None:
    w = World(
        terrain=Terrain.MARS,
        base=(0.0, 0.0),
        samples=[Sample(1.0, 1.0, collected=True), Sample(2.0, 2.0, collected=True)],
    )
    assert w.all_collected()

    w.samples[0].collected = False
    assert not w.all_collected()


def test_world_all_collected_true_when_no_samples() -> None:
    # Vacuously true: no sample left uncollected.
    w = World(terrain=Terrain.SPACE, base=(0.0, 0.0))
    assert w.all_collected()


def test_world_distance_to_base_is_euclidean() -> None:
    w = World(terrain=Terrain.EARTH, base=(3.0, 4.0))
    assert math.isclose(w.distance_to_base(0.0, 0.0), 5.0)
    assert math.isclose(w.distance_to_base(3.0, 4.0), 0.0)


@pytest.mark.parametrize("radius", [0.0, 0.1, 1.5])
def test_obstacle_stores_radius(radius: float) -> None:
    o = Obstacle(x=1.0, y=2.0, radius=radius)
    assert o.radius == pytest.approx(radius)
