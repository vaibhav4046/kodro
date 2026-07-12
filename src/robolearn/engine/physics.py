"""Pymunk physics-space wrapper.

The 2D top-down view treats gravity as zero (the rover does not fall) and
uses Pymunk only for collision detection between the rover circle, the
arena walls, and any static obstacle circles. Per-terrain friction and drag
are read from :mod:`robolearn.engine.terrain` and applied as Pymunk shape
friction and a per-step velocity damping factor respectively.

The wrapper exposes a :meth:`PhysicsSpace.step` method that the engine
loop calls at the fixed 1/60 s timestep. Tests in
``tests/unit/test_physics.py`` exercise the body / shape lifecycle and
verify that the per-terrain friction values reach the Pymunk shapes.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import pymunk

from .terrain import Terrain, TerrainParams, params_for

#: Fixed engine timestep in seconds. Matches the value in
#: ``~/.robolearn/config.toml`` under ``[engine] timestep``.
TIMESTEP_S: float = 1.0 / 60.0

#: Mass of the rover body in kilograms. Educational rover, not a real one.
ROVER_MASS_KG: float = 5.0

#: Collision radius of the rover (it is modelled as a single circle).
ROVER_RADIUS_M: float = 0.25

#: Pymunk collision-type IDs.
COLLISION_TYPE_ROVER: int = 1
COLLISION_TYPE_WALL: int = 2
COLLISION_TYPE_OBSTACLE: int = 3


@dataclass(slots=True)
class CollisionEvent:
    """Recorded when the rover comes into contact with a non-rover shape."""

    other_type: int
    impulse: float


class PhysicsSpace:
    """A thin wrapper around :class:`pymunk.Space` configured for a terrain."""

    def __init__(
        self,
        terrain: Terrain | str,
        *,
        width: float = 10.0,
        height: float = 10.0,
    ) -> None:
        """Build a physics space for ``terrain`` with an arena of ``width`` x ``height``.

        Args:
            terrain: Terrain identifier (string or :class:`Terrain` enum).
            width: Arena width in metres.
            height: Arena height in metres.
        """
        self.params: TerrainParams = params_for(terrain)
        self.width = float(width)
        self.height = float(height)
        self._collisions: list[CollisionEvent] = []
        self._space = pymunk.Space()
        # 2D top-down — physics gravity vector is zero; the per-terrain
        # gravity magnitude is consumed by the rover-friction model in
        # :mod:`robolearn.engine.rover` instead.
        self._space.gravity = (0.0, 0.0)
        # Damping models linear velocity drag. For underwater terrain we use
        # ``1 - drag * dt`` per step; the wrapper achieves this by setting
        # Pymunk's overall damping to ``1 - drag`` (drag fraction lost per
        # second of free flight). Friction coefficients are applied per-shape.
        self._space.damping = 1.0 - self.params.drag
        self._add_walls()
        self._rover_body: pymunk.Body | None = None
        self._rover_shape: pymunk.Shape | None = None

    # --- accessors ----------------------------------------------------------

    @property
    def space(self) -> pymunk.Space:
        """Return the underlying :class:`pymunk.Space`."""
        return self._space

    @property
    def rover_body(self) -> pymunk.Body:
        """Return the Pymunk body representing the rover.

        Raises:
            RuntimeError: If :meth:`add_rover` has not yet been called.
        """
        if self._rover_body is None:
            raise RuntimeError("rover body not created; call add_rover() first")
        return self._rover_body

    def collisions(self) -> list[CollisionEvent]:
        """Return the list of collision events recorded so far (newest last)."""
        return list(self._collisions)

    def clear_collisions(self) -> None:
        """Clear the recorded collision events buffer."""
        self._collisions.clear()

    # --- mutation -----------------------------------------------------------

    def add_rover(self, x: float = 0.0, y: float = 0.0) -> pymunk.Body:
        """Create the rover body and shape, add them to the space, return the body."""
        if self._rover_body is not None:
            raise RuntimeError("rover body already added to this space")
        moment = pymunk.moment_for_circle(ROVER_MASS_KG, 0, ROVER_RADIUS_M)
        body = pymunk.Body(ROVER_MASS_KG, moment)
        body.position = (x, y)
        shape = pymunk.Circle(body, ROVER_RADIUS_M)
        shape.friction = self.params.friction
        shape.collision_type = COLLISION_TYPE_ROVER
        self._space.add(body, shape)
        self._rover_body = body
        self._rover_shape = shape
        self._wire_collision_handler()
        return body

    def add_obstacle(self, x: float, y: float, radius: float) -> pymunk.Body:
        """Add a static circular obstacle. Returns the created body."""
        body = pymunk.Body(body_type=pymunk.Body.STATIC)
        body.position = (x, y)
        shape = pymunk.Circle(body, radius)
        shape.friction = self.params.friction
        shape.collision_type = COLLISION_TYPE_OBSTACLE
        self._space.add(body, shape)
        return body

    def step(self, dt: float = TIMESTEP_S) -> None:
        """Advance the physics space by ``dt`` seconds (default: one timestep)."""
        self._space.step(dt)

    # --- private ------------------------------------------------------------

    def _add_walls(self) -> None:
        """Create four static walls around the arena boundary."""
        wall_thickness = 0.01
        static = self._space.static_body
        walls = [
            pymunk.Segment(static, (0.0, 0.0), (self.width, 0.0), wall_thickness),
            pymunk.Segment(static, (self.width, 0.0), (self.width, self.height), wall_thickness),
            pymunk.Segment(static, (self.width, self.height), (0.0, self.height), wall_thickness),
            pymunk.Segment(static, (0.0, self.height), (0.0, 0.0), wall_thickness),
        ]
        for wall in walls:
            wall.friction = self.params.friction
            wall.collision_type = COLLISION_TYPE_WALL
            self._space.add(wall)

    def _wire_collision_handler(self) -> None:
        """Wire a collision handler that pushes events into ``_collisions``.

        Pymunk 7 exposes :meth:`Space.on_collision`; we record an event each
        time the rover *begins* contact with a non-rover shape. Impulse
        magnitude is recorded by a post-solve callback because Pymunk
        evaluates contact impulse during the solve step, not on begin.
        """
        space = self._space
        space.on_collision(
            COLLISION_TYPE_ROVER,
            COLLISION_TYPE_WALL,
            begin=self._on_begin_wall,
            post_solve=self._on_post_solve_wall,
        )
        space.on_collision(
            COLLISION_TYPE_ROVER,
            COLLISION_TYPE_OBSTACLE,
            begin=self._on_begin_obstacle,
            post_solve=self._on_post_solve_obstacle,
        )

    def _on_begin_wall(
        self,
        _arbiter: object,
        _space: object,
        _data: object,
    ) -> None:
        self._collisions.append(CollisionEvent(COLLISION_TYPE_WALL, 0.0))

    def _on_begin_obstacle(
        self,
        _arbiter: object,
        _space: object,
        _data: object,
    ) -> None:
        self._collisions.append(CollisionEvent(COLLISION_TYPE_OBSTACLE, 0.0))

    def _record_impulse(self, other_type: int, arbiter: object) -> None:
        """Attach the solved impulse to the most recent event of ``other_type``.

        Post-solve fires per contact pair. The old code only updated
        ``_collisions[-1]``: on a SAME-STEP double contact (rover touching a
        wall AND an obstacle) the second begin event pushed the other type on
        top, so the first type's post-solve saw a mismatched last element and
        silently dropped its impulse, leaving the near-zero begin value. Walk
        back to the newest matching event instead so both impulses are kept.
        """
        for i in range(len(self._collisions) - 1, -1, -1):
            if self._collisions[i].other_type == other_type:
                self._collisions[i] = CollisionEvent(other_type, _impulse_magnitude(arbiter))
                return

    def _on_post_solve_wall(
        self,
        arbiter: object,
        _space: object,
        _data: object,
    ) -> None:
        self._record_impulse(COLLISION_TYPE_WALL, arbiter)

    def _on_post_solve_obstacle(
        self,
        arbiter: object,
        _space: object,
        _data: object,
    ) -> None:
        self._record_impulse(COLLISION_TYPE_OBSTACLE, arbiter)


def _impulse_magnitude(arbiter: object) -> float:
    """Best-effort impulse magnitude extraction from a Pymunk arbiter."""
    impulse = getattr(arbiter, "total_impulse", None)
    if impulse is None:
        return 0.0
    x_attr = getattr(impulse, "x", None)
    y_attr = getattr(impulse, "y", None)
    if x_attr is not None and y_attr is not None:
        return math.hypot(float(x_attr), float(y_attr))
    try:
        return math.hypot(float(impulse[0]), float(impulse[1]))
    except (TypeError, IndexError, ValueError):
        return 0.0
