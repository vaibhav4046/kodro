"""Per-terrain particle effects rendered behind the rover.

Pure-Python, pure-function. Each :class:`ParticleSystem` exposes
``emit``, ``update``, ``draw`` so it can be plugged into the renderer
loop and tested headlessly. The system uses a deterministic-seeded
``random.Random`` instance so unit tests assert exact particle counts.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Literal

from .terrain import Terrain

#: How many particles may live concurrently per system before old ones are
#: dropped (FIFO).
MAX_PARTICLES: int = 256


@dataclass(slots=True)
class Particle:
    """One independent particle: position, velocity, age, max-age, colour."""

    x: float
    y: float
    vx: float
    vy: float
    age_s: float
    max_age_s: float
    colour: tuple[int, int, int]
    radius_px: int = 2


@dataclass(slots=True)
class ParticleSystem:
    """A terrain-specific particle emitter and integrator."""

    terrain: Terrain
    kind: Literal["dust", "bubbles", "stars", "grass"]
    particles: list[Particle] = field(default_factory=list)
    rng: random.Random = field(default_factory=lambda: random.Random(0))

    # --- mutation ----------------------------------------------------------

    def emit(self, x: float, y: float, count: int = 1) -> None:
        """Spawn ``count`` new particles centred on ``(x, y)`` in world units."""
        for _ in range(count):
            angle = self.rng.uniform(0.0, 2.0 * math.pi)
            speed = self.rng.uniform(*_SPEED_RANGES[self.kind])
            particle = Particle(
                x=x + self.rng.uniform(-0.05, 0.05),
                y=y + self.rng.uniform(-0.05, 0.05),
                vx=math.cos(angle) * speed,
                vy=math.sin(angle) * speed,
                age_s=0.0,
                max_age_s=self.rng.uniform(*_LIFETIME_RANGES[self.kind]),
                colour=self._pick_colour(),
                radius_px=self.rng.randint(*_RADIUS_RANGES[self.kind]),
            )
            self.particles.append(particle)
        if len(self.particles) > MAX_PARTICLES:
            del self.particles[: len(self.particles) - MAX_PARTICLES]

    def update(self, dt_s: float) -> None:
        """Advance every particle by ``dt_s`` seconds, prune the dead ones."""
        alive: list[Particle] = []
        for particle in self.particles:
            new_age = particle.age_s + dt_s
            if new_age >= particle.max_age_s:
                continue
            particle.x += particle.vx * dt_s
            particle.y += particle.vy * dt_s
            particle.age_s = new_age
            alive.append(particle)
        self.particles = alive

    def clear(self) -> None:
        """Remove every active particle."""
        self.particles.clear()

    # --- read-only --------------------------------------------------------

    def __len__(self) -> int:
        """Return the live particle count (used by tests + the renderer)."""
        return len(self.particles)

    def alive(self) -> tuple[Particle, ...]:
        """Snapshot of every live particle."""
        return tuple(self.particles)

    # --- private ----------------------------------------------------------

    def _pick_colour(self) -> tuple[int, int, int]:
        """Pick a colour from the terrain's palette."""
        palette = _PALETTES[self.kind]
        return palette[self.rng.randrange(len(palette))]


# ---------------------------------------------------------------------------
# Per-kind tunables
# ---------------------------------------------------------------------------

_SPEED_RANGES: dict[str, tuple[float, float]] = {
    "dust": (0.4, 1.2),
    "bubbles": (0.1, 0.4),
    "stars": (0.02, 0.06),
    "grass": (0.3, 0.7),
}

_LIFETIME_RANGES: dict[str, tuple[float, float]] = {
    "dust": (0.4, 0.8),
    "bubbles": (1.0, 2.0),
    "stars": (6.0, 12.0),
    "grass": (0.3, 0.6),
}

_RADIUS_RANGES: dict[str, tuple[int, int]] = {
    "dust": (1, 3),
    "bubbles": (2, 4),
    "stars": (1, 2),
    "grass": (1, 2),
}

_PALETTES: dict[str, tuple[tuple[int, int, int], ...]] = {
    "dust": ((200, 120, 60), (220, 140, 80), (180, 100, 40)),
    "bubbles": ((180, 220, 255), (140, 200, 240), (210, 235, 255)),
    "stars": ((255, 255, 255), (200, 200, 220), (220, 230, 255)),
    "grass": ((100, 180, 80), (120, 200, 100), (80, 160, 60)),
}


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def system_for_terrain(terrain: Terrain | str, *, seed: int = 0) -> ParticleSystem:
    """Return a fresh :class:`ParticleSystem` tuned for ``terrain``."""
    if isinstance(terrain, str):
        terrain = Terrain(terrain)
    kind = _KIND_BY_TERRAIN[terrain]
    return ParticleSystem(terrain=terrain, kind=kind, rng=random.Random(seed))


_KIND_BY_TERRAIN: dict[Terrain, Literal["dust", "bubbles", "stars", "grass"]] = {
    Terrain.EARTH: "grass",
    Terrain.MARS: "dust",
    Terrain.UNDERWATER: "bubbles",
    Terrain.SPACE: "stars",
}
