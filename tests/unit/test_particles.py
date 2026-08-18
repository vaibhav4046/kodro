"""Particle system tests (P1 polish task)."""

from __future__ import annotations

import pytest

from kodro.engine.particles import (
    MAX_PARTICLES,
    Particle,
    system_for_terrain,
)
from kodro.engine.terrain import Terrain


def test_factory_returns_per_terrain_kind() -> None:
    assert system_for_terrain(Terrain.MARS).kind == "dust"
    assert system_for_terrain(Terrain.UNDERWATER).kind == "bubbles"
    assert system_for_terrain(Terrain.SPACE).kind == "stars"
    assert system_for_terrain(Terrain.EARTH).kind == "grass"


def test_factory_accepts_string_terrain() -> None:
    assert system_for_terrain("mars").kind == "dust"


def test_emit_creates_particles() -> None:
    sys = system_for_terrain(Terrain.MARS, seed=0)
    sys.emit(1.0, 1.0, count=5)
    assert len(sys) == 5


def test_emit_clamps_at_max_particles() -> None:
    sys = system_for_terrain(Terrain.MARS, seed=0)
    sys.emit(0.0, 0.0, count=MAX_PARTICLES + 50)
    assert len(sys) == MAX_PARTICLES


def test_update_advances_position() -> None:
    sys = system_for_terrain(Terrain.MARS, seed=42)
    sys.emit(0.0, 0.0, count=1)
    # Snapshot the floats; the slotted dataclass is mutated in-place.
    before_x = sys.alive()[0].x
    before_y = sys.alive()[0].y
    sys.update(0.1)
    after = sys.alive()[0]
    assert (after.x, after.y) != (before_x, before_y)


def test_update_prunes_dead_particles() -> None:
    sys = system_for_terrain(Terrain.MARS, seed=0)
    sys.emit(0.0, 0.0, count=3)
    sys.update(100.0)  # well past every lifetime
    assert len(sys) == 0


def test_clear_drops_all() -> None:
    sys = system_for_terrain(Terrain.MARS)
    sys.emit(0.0, 0.0, count=10)
    sys.clear()
    assert len(sys) == 0


@pytest.mark.parametrize("terrain", list(Terrain))
def test_each_terrain_picks_a_palette_colour(terrain: Terrain) -> None:
    sys = system_for_terrain(terrain, seed=1)
    sys.emit(0.0, 0.0, count=4)
    for p in sys.alive():
        assert isinstance(p, Particle)
        for channel in p.colour:
            assert 0 <= channel <= 255


def test_deterministic_under_same_seed() -> None:
    a = system_for_terrain(Terrain.MARS, seed=7)
    b = system_for_terrain(Terrain.MARS, seed=7)
    a.emit(0.0, 0.0, count=3)
    b.emit(0.0, 0.0, count=3)
    assert [(p.colour, p.radius_px) for p in a.alive()] == [
        (p.colour, p.radius_px) for p in b.alive()
    ]
