"""Terrain registry tests (Task 3)."""

from __future__ import annotations

import math

import pytest

from robolearn.engine.terrain import Terrain, all_terrains, params_for


def test_enum_has_four_terrains() -> None:
    assert set(Terrain) == {Terrain.EARTH, Terrain.MARS, Terrain.UNDERWATER, Terrain.SPACE}


@pytest.mark.parametrize(
    ("terrain", "value"),
    [
        (Terrain.EARTH, "earth"),
        (Terrain.MARS, "mars"),
        (Terrain.UNDERWATER, "underwater"),
        (Terrain.SPACE, "space"),
    ],
)
def test_strenum_values_match_yaml_names(terrain: Terrain, value: str) -> None:
    assert terrain.value == value
    assert str(terrain) == value


def test_params_for_accepts_enum() -> None:
    p = params_for(Terrain.MARS)
    assert p.terrain is Terrain.MARS
    assert math.isclose(p.gravity_mps2, 3.71)


def test_params_for_accepts_string() -> None:
    p = params_for("space")
    assert p.terrain is Terrain.SPACE


def test_params_for_rejects_unknown_string() -> None:
    with pytest.raises(ValueError):
        params_for("ocean")


@pytest.mark.parametrize(
    ("terrain", "gravity", "friction", "drag"),
    [
        (Terrain.EARTH, 9.81, 0.8, 0.0),
        (Terrain.MARS, 3.71, 0.6, 0.0),
        (Terrain.UNDERWATER, 0.0, 0.0, 0.7),
        (Terrain.SPACE, 0.0, 0.05, 0.0),
    ],
)
def test_spec_constants_per_terrain(
    terrain: Terrain, gravity: float, friction: float, drag: float
) -> None:
    p = params_for(terrain)
    assert math.isclose(p.gravity_mps2, gravity)
    assert math.isclose(p.friction, friction)
    assert math.isclose(p.drag, drag)


def test_all_terrains_returns_four_in_canonical_order() -> None:
    ts = all_terrains()
    assert len(ts) == 4
    assert ts == (Terrain.EARTH, Terrain.MARS, Terrain.UNDERWATER, Terrain.SPACE)
