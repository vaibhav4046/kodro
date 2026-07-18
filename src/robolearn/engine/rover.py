"""Rover entity and actuators (drive, steer, collect, drop, beep, log).

The :class:`Rover` is the engine's authoritative state for the vehicle.
Pupil-facing functions in :mod:`robolearn.rover_api` will, once wired up in
Task 6, ultimately call methods on a singleton :class:`Rover`. Keeping this
class small and well-tested up front means later wiring is just plumbing.

Battery model (PERFECTION_PLAN E-P1): the constants come from the SHARED
motion model (:mod:`robolearn.engine.motion_model`), the same table the JS
tick reads, so a metre costs the same battery on screen and under the
grader. Historically this module used 0.1 %/m and 0.05 %/deg while the
visible sim drained 1.1 %/m and 0.004 %/deg - an 11x/12.5x divergence the
golden-trace suite now pins closed.

* ``1.1 %`` per metre actually travelled (wall-clamped moves drain only the
  distance covered, matching the JS tick).
* ``0.004 %`` per degree turned.
* ``+1 %`` extra on each hard collision.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from hashlib import sha256

from .motion_model import (
    BATTERY_PCT_PER_COLLISION,
    BATTERY_PCT_PER_DEGREE,
    BATTERY_PCT_PER_METRE,
    ROVER_RADIUS_M,
    segment_circle_hit,
)
from .world import Sample, World

logger = logging.getLogger(__name__)

#: Battery cost per metre travelled (forwards or backwards). Shared constant.
BATTERY_PER_METRE: float = BATTERY_PCT_PER_METRE

#: Battery cost per degree turned (left or right). Shared constant.
BATTERY_PER_DEGREE: float = BATTERY_PCT_PER_DEGREE

#: Extra battery cost added on each registered collision event.
BATTERY_PER_COLLISION: float = BATTERY_PCT_PER_COLLISION

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

    def __init__(
        self,
        world: World,
        state: RoverState | None = None,
        *,
        drain_scale: float = 1.0,
        sensor_noise_m: float = 0.0,
        sensor_seed: int = 0,
    ) -> None:
        """Bind the rover to a world.

        Args:
            world: The :class:`World` this rover lives inside. The rover's
                position is initialised to the world's base station.
            state: Optional pre-existing :class:`RoverState`. If omitted, a
                fresh state at full battery is created at the base position.
            drain_scale: Per-metre battery-drain multiplier for the fitted
                build. 1.0 (the default) reproduces the pre-existing fixed
                drain, so all current callers and golden traces are unchanged.
                The desktop grader passes the build's mass factor here so a
                heavier robot drains faster, mirroring the web sim's
                mass-scaled drain (KodroMotion.moveDrainPct) instead of grading
                every build spec-blind.
            sensor_noise_m: Maximum absolute deterministic range noise in metres.
                The default of zero preserves normal product behaviour.
            sensor_seed: Seed used for deterministic range-noise samples.
        """
        self.world = world
        if state is None:
            bx, by = world.base
            state = RoverState(x=bx, y=by)
        self.state = state
        self._drain_scale = drain_scale if drain_scale and drain_scale > 0 else 1.0
        self._sensor_noise_m = max(0.0, sensor_noise_m)
        self._sensor_seed = sensor_seed
        self._sensor_read_index = 0

    def apply_range_noise(self, distance_m: float) -> float:
        """Apply the configured deterministic range error to one reading."""
        if self._sensor_noise_m == 0.0 or math.isinf(distance_m):
            return distance_m
        sample_key = f"{self._sensor_seed}:{self._sensor_read_index}".encode()
        self._sensor_read_index += 1
        raw = int.from_bytes(sha256(sample_key).digest()[:8], "big") / float(2**64)
        error_m = (raw * 2.0 - 1.0) * self._sensor_noise_m
        return max(0.0, distance_m + error_m)

    # --- driving --------------------------------------------------------------

    def move(self, distance_m: float) -> tuple[float, float]:
        """Translate the rover by ``distance_m`` metres along its heading.

        Negative distances drive backwards. The swept path is tested against
        the world's circular obstacles (grown by the rover radius, the same
        swept-circle shape the JS tick uses): a hit stops the rover AT the
        contact point and registers a real collision (PERFECTION_PLAN E-A7 -
        ``register_collision`` previously had zero production callers, so a
        program that visibly crashed could still grade collision-free). The
        destination is then clamped to the arena bounds; a clamped move also
        registers a collision, because driving into the wall is one.

        Battery and the odometer are charged for the distance ACTUALLY
        travelled, not the distance commanded (the old behaviour drained the
        full command even when the wall stopped the rover short).

        Returns:
            The ``(dx, dy)`` displacement actually applied, after any
            obstacle stop or clamping at the arena walls.
        """
        rad = math.radians(self.state.heading_deg)
        ideal_dx = distance_m * math.cos(rad)
        ideal_dy = distance_m * math.sin(rad)
        start_x, start_y = self.state.x, self.state.y
        target_x = start_x + ideal_dx
        target_y = start_y + ideal_dy
        # Obstacle sweep: stop at the FIRST contact along the segment, i.e.
        # the minimum t across all obstacles tested against the ORIGINAL
        # segment. The old loop shortened the target inside the loop while
        # still scaling by the full ideal displacement, so when a farther
        # obstacle appeared earlier in world.obstacles its rescaled fraction
        # overshot the true nearer contact and left the rover inside the
        # nearer obstacle (order-dependent).
        hit_obstacle = False
        first_t: float | None = None
        for obstacle in self.world.obstacles:
            t = segment_circle_hit(
                start_x,
                start_y,
                target_x,
                target_y,
                obstacle.x,
                obstacle.y,
                obstacle.radius + ROVER_RADIUS_M,
            )
            if t is not None and (first_t is None or t < first_t):
                first_t = t
        if first_t is not None:
            target_x = start_x + ideal_dx * first_t
            target_y = start_y + ideal_dy * first_t
            hit_obstacle = True
        bounds = self.world.bounds
        self.state.x = min(max(target_x, 0.0), bounds.width)
        self.state.y = min(max(target_y, 0.0), bounds.height)
        hit_wall = self.state.x != target_x or self.state.y != target_y
        actual_dx = self.state.x - start_x
        actual_dy = self.state.y - start_y
        travelled = math.hypot(actual_dx, actual_dy)
        self.state.distance_travelled_m += travelled
        self._drain_battery(travelled * BATTERY_PER_METRE * self._drain_scale)
        if hit_obstacle or hit_wall:
            self.register_collision()
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
