"""Terrain registry and per-terrain physics parameters.

Section 5 of the build spec fixes the gravity / friction / drag constants for
each of the four supported terrains. They live here, in one place, behind a
typed accessor (:func:`params_for`) so every other engine module reads them
the same way.

The :class:`Terrain` enum is a :class:`enum.StrEnum` so that lesson YAML files
can use the plain-text names (``"mars"``, ``"earth"``, ``"underwater"``,
``"space"``) without per-call conversion helpers.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Terrain(StrEnum):
    """Identifies one of the four supported terrains.

    The string values are deliberately the lowercase names used in the
    lesson YAML files; this lets ``Terrain("mars")`` parse a lesson value
    with no extra mapping.
    """

    EARTH = "earth"
    MARS = "mars"
    UNDERWATER = "underwater"
    SPACE = "space"


@dataclass(frozen=True, slots=True)
class TerrainParams:
    """Physical parameters that distinguish one terrain from another.

    Attributes:
        terrain: The :class:`Terrain` these parameters describe.
        gravity_mps2: Gravity magnitude in m/s^2 (used by the rover for
            wheel-friction calculations; the 2D physics space itself has
            zero gravity because the simulator is top-down).
        friction: Coulomb friction coefficient applied to rover-on-surface
            contacts. Zero for underwater (water gives no Coulomb friction).
        drag: Linear-velocity drag coefficient applied per second. Non-zero
            only for underwater terrain in the current spec.
    """

    terrain: Terrain
    gravity_mps2: float
    friction: float
    drag: float


# Per-terrain physics constants. Verbatim from Section 5 of the spec.
_PARAMS: dict[Terrain, TerrainParams] = {
    Terrain.EARTH: TerrainParams(Terrain.EARTH, gravity_mps2=9.81, friction=0.8, drag=0.0),
    Terrain.MARS: TerrainParams(Terrain.MARS, gravity_mps2=3.71, friction=0.6, drag=0.0),
    Terrain.UNDERWATER: TerrainParams(Terrain.UNDERWATER, gravity_mps2=0.0, friction=0.0, drag=0.7),
    Terrain.SPACE: TerrainParams(Terrain.SPACE, gravity_mps2=0.0, friction=0.05, drag=0.0),
}


def params_for(terrain: Terrain | str) -> TerrainParams:
    """Return the :class:`TerrainParams` for the given terrain.

    Args:
        terrain: Either a :class:`Terrain` member or its lowercase string
            name (``"earth"``, ``"mars"``, ``"underwater"``, ``"space"``).

    Returns:
        The matching :class:`TerrainParams` instance.

    Raises:
        ValueError: If ``terrain`` is a string that does not name a known
            terrain.
    """
    key = Terrain(terrain) if isinstance(terrain, str) else terrain
    return _PARAMS[key]


def all_terrains() -> tuple[Terrain, ...]:
    """Return every supported :class:`Terrain` in canonical declaration order."""
    return tuple(_PARAMS.keys())
