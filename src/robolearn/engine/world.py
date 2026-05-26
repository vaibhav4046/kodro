"""World state: arena bounds, terrain, sample sites, obstacles, base station.

A :class:`World` is the data container that the rest of the engine reads and
writes during a mission. It is deliberately a plain dataclass rather than an
object with behaviour — that way lesson YAMLs can construct a world by
literal value, and the renderer / physics layer can take read-only snapshots
for rendering and collision setup respectively.

Lesson YAMLs build a :class:`World` via :func:`World.from_mapping` (filled in
when the lesson schema lands in Task 8); for Tasks 3-5 the engine constructs
worlds directly through the dataclass constructor.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from .terrain import Terrain


@dataclass(slots=True)
class Sample:
    """A collectible scientific sample sitting on the surface."""

    x: float
    y: float
    collected: bool = False


@dataclass(slots=True)
class Obstacle:
    """A circular static obstacle the rover must avoid."""

    x: float
    y: float
    radius: float


@dataclass(slots=True)
class ArenaBounds:
    """Rectangular world bounds in metres.

    The origin is at the lower-left corner; positive ``x`` is east, positive
    ``y`` is north.
    """

    width: float = 10.0
    height: float = 10.0

    def contains(self, x: float, y: float) -> bool:
        """Return True if ``(x, y)`` lies inside the arena (inclusive bounds)."""
        return 0.0 <= x <= self.width and 0.0 <= y <= self.height


@dataclass(slots=True)
class World:
    """A complete world snapshot consumed by the engine and the renderer."""

    terrain: Terrain
    base: tuple[float, float]
    samples: list[Sample] = field(default_factory=list)
    obstacles: list[Obstacle] = field(default_factory=list)
    bounds: ArenaBounds = field(default_factory=ArenaBounds)

    # --- read-only convenience accessors ------------------------------------

    def uncollected_samples(self) -> list[Sample]:
        """Return the list of samples that have not yet been collected."""
        return [s for s in self.samples if not s.collected]

    def all_collected(self) -> bool:
        """Return True if every sample in the world has been collected."""
        return all(s.collected for s in self.samples)

    def distance_to_base(self, x: float, y: float) -> float:
        """Return the Euclidean distance from ``(x, y)`` to the base station."""
        bx, by = self.base
        return math.hypot(x - bx, y - by)
