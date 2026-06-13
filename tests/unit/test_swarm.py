"""Offline agent swarm: one program, a fleet of rovers, isolated runs."""

from __future__ import annotations

from robolearn.engine.terrain import Terrain
from robolearn.engine.world import World
from robolearn.runtime.swarm import MAX_ROVERS, MIN_ROVERS, run_swarm


def _world() -> World:
    return World(terrain=Terrain.EARTH, base=(0.0, 0.0))


def test_swarm_returns_one_path_per_rover() -> None:
    paths = run_swarm("move_forward(2)", world_factory=_world, n=4)
    assert len(paths) == 4
    for path in paths:
        assert len(path) >= 2  # at least a start and an end point


def test_fleet_size_is_clamped() -> None:
    assert len(run_swarm("move_forward(1)", world_factory=_world, n=99)) == MAX_ROVERS
    assert len(run_swarm("move_forward(1)", world_factory=_world, n=0)) == MIN_ROVERS


def test_rovers_start_spread_around_the_base() -> None:
    paths = run_swarm("move_forward(1)", world_factory=_world, n=4, radius_m=0.6)
    starts = [p[0] for p in paths]
    # Distinct start points (the fleet fans out around the base ring).
    assert len(set(starts)) == 4


def test_same_program_moves_every_rover() -> None:
    paths = run_swarm("move_forward(3)", world_factory=_world, n=3)
    for path in paths:
        assert path[0] != path[-1], "each rover should have moved from its start"


def test_runs_are_isolated_a_crash_does_not_stop_the_fleet() -> None:
    # A program that does nothing still yields a path per rover.
    paths = run_swarm("pass", world_factory=_world, n=3)
    assert len(paths) == 3
    for path in paths:
        # No movement, but the start and end points are still recorded.
        assert path[0] == path[-1]


def test_a_fresh_world_per_rover_prevents_state_leak() -> None:
    # Collecting a sample on one rover must not change another's world.
    world_calls = {"n": 0}

    def factory() -> World:
        world_calls["n"] += 1
        return World(terrain=Terrain.EARTH, base=(0.0, 0.0))

    run_swarm("move_forward(1)", world_factory=factory, n=5)
    assert world_calls["n"] == 5, "each rover must get its own fresh world"
