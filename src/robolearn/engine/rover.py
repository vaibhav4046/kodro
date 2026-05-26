"""Rover entity and actuators (drive, steer, collect, drop, beep, log).

The :class:`Rover` is the engine's authoritative state for the vehicle.
Pupil-facing functions in :mod:`robolearn.rover_api` will, once wired up in
Task 6, ultimately call methods on a singleton :class:`Rover`. Keeping this
class small and well-tested up front means later wiring is just plumbing.

Battery model — Section 5 of the spec:

* ``0.1 %`` per metre moved.
* ``0.05 %`` per degree turned.
* ``+1 %`` extra on each hard collision.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

from .world import Sample, World

logger = logging.getLogger(__name__)

#: Battery cost per metre travelled (forwards or backwards).
BATTERY_PER_METRE: float = 0.1

#: Battery cost per degree turned (left or right).
BATTERY_PER_DEGREE: float = 0.05

#: Extra battery cost added on each registered collision event.
BATTERY_PER_COLLISION: float = 1.0

#: Default radius (metres) the rover uses for sample / base detection.
DEFAULT_DETECTION_RADIUS_M: float = 0.3


@dataclass(slots=True)
class RoverState:
    """Plain dataclass holding every mutable quantity the rover tracks.

    Kept separate from :class:`Rover` so a state snapshot can be serialised
    into a tracer event (Task 6) without dragging method references along.
    """

    x: float = 0.0
    y: float = 0.0
    heading_deg: float = 0.0  # 0 = east, anticlockwise positive
    battery_pct: float = 100.0
    samples_held: int = 0
    samples_collected: int = 0
    collisions: int = 0
    distance_travelled_m: float = 0.0
    degrees_turned: float = 0.0


class Rover:
    """The vehicle the pupil controls.

    The methods here change the rover's state and the bound :class:`World`
    in lock-step. They never raise on out-of-range inputs; the
    :mod:`robolearn.rover_api` layer above already clamps everything.
    """

    def __init__(self, world: World, state: RoverState | None = None) -> None:
        """Bind the rover to a world.

        Args:
            world: The :class:`World` this rover lives inside. The rover's
                position is initialised to the world's base station.
            state: Optional pre-existing :class:`RoverState`. If omitted, a
                fresh state at full battery is created at the base position.
        """
        self.world = world
        if state is None:
            bx, by = world.base
            state = RoverState(x=bx, y=by)
        self.state = state

    # --- driving --------------------------------------------------------------

    def move(self, distance_m: float) -> tuple[float, float]:
        """Translate the rover by ``distance_m`` metres along its heading.

        Negative distances drive backwards. Movement does not check for
        collisions here -- that is the physics layer's job. The destination
        is clamped to the arena bounds so the rover cannot leave the world.

        Returns:
            The ``(dx, dy)`` displacement actually applied, after any
            clamping at the arena walls.
        """
        rad = math.radians(self.state.heading_deg)
        ideal_dx = distance_m * math.cos(rad)
        ideal_dy = distance_m * math.sin(rad)
        start_x, start_y = self.state.x, self.state.y
        target_x = start_x + ideal_dx
        target_y = start_y + ideal_dy
        bounds = self.world.bounds
        self.state.x = min(max(target_x, 0.0), bounds.width)
        self.state.y = min(max(target_y, 0.0), bounds.height)
        actual_dx = self.state.x - start_x
        actual_dy = self.state.y - start_y
        self.state.distance_travelled_m += abs(distance_m)
        self._drain_battery(abs(distance_m) * BATTERY_PER_METRE)
        return (actual_dx, actual_dy)

    def turn(self, angle_deg: float) -> None:
        """Rotate the rover by ``angle_deg`` degrees.

        Positive angles turn anticlockwise (i.e. "left" when looking at the
        top-down map with east being 0°).
        """
        self.state.heading_deg = (self.state.heading_deg + angle_deg) % 360.0
        self.state.degrees_turned += abs(angle_deg)
        self._drain_battery(abs(angle_deg) * BATTERY_PER_DEGREE)

    # --- sample handling ------------------------------------------------------

    def try_collect(self, radius_m: float = DEFAULT_DETECTION_RADIUS_M) -> bool:
        """Try to pick up the nearest sample within ``radius_m`` metres.

        Returns:
            ``True`` if a sample was collected; ``False`` if nothing was in
            range or every sample has already been collected.
        """
        nearest = self._nearest_sample(radius_m)
        if nearest is None:
            return False
        nearest.collected = True
        self.state.samples_held += 1
        self.state.samples_collected += 1
        return True

    def try_drop(self) -> bool:
        """Drop a held sample at the rover's current position.

        Returns:
            ``True`` if a sample was held and has now been dropped;
            ``False`` if the rover was empty-handed.
        """
        if self.state.samples_held <= 0:
            return False
        self.state.samples_held -= 1
        return True

    def at_base(self, tolerance_m: float = DEFAULT_DETECTION_RADIUS_M) -> bool:
        """Return True if the rover is within ``tolerance_m`` of the base."""
        return self.world.distance_to_base(self.state.x, self.state.y) <= tolerance_m

    # --- collisions / battery -------------------------------------------------

    def register_collision(self) -> None:
        """Record a hard collision: bump the counter and drain extra battery."""
        self.state.collisions += 1
        self._drain_battery(BATTERY_PER_COLLISION)

    def _drain_battery(self, amount_pct: float) -> None:
        before = self.state.battery_pct
        self.state.battery_pct = max(0.0, before - amount_pct)
        if before > 0 and self.state.battery_pct == 0:
            logger.info("rover: battery depleted")

    # --- query helpers --------------------------------------------------------

    def heading_radians(self) -> float:
        """Return the current heading converted to radians."""
        return math.radians(self.state.heading_deg)

    def distance_to(self, x: float, y: float) -> float:
        """Return the Euclidean distance from the rover to ``(x, y)``."""
        return math.hypot(self.state.x - x, self.state.y - y)

    def _nearest_sample(self, radius_m: float) -> Sample | None:
        """Return the closest uncollected sample within ``radius_m`` metres."""
        best: Sample | None = None
        best_d = radius_m
        for sample in self.world.samples:
            if sample.collected:
                continue
            d = self.distance_to(sample.x, sample.y)
            if d <= best_d:
                best, best_d = sample, d
        return best
