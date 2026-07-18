"""Sensor models: LIDAR, ultrasonic, colour, IMU.

Sensors read the current :class:`~robolearn.engine.rover.Rover` and its
bound :class:`~robolearn.engine.world.World` and return a quantity in the
units pupils see through the public API. The implementations are
deliberately analytical (closed-form ray casting rather than a Pymunk
ray-cast query) so they are deterministic and cheap to property-test.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .rover import Rover
from .terrain import Terrain
from .world import ArenaBounds

#: Maximum range the LIDAR can resolve, in metres.
LIDAR_MAX_RANGE_M: float = 50.0

#: Maximum range the ultrasonic sensor can resolve, in metres.
ULTRASONIC_MAX_RANGE_M: float = 5.0

#: Tolerance used by :func:`colour_under` for "is the rover over X?" checks.
COLOUR_PROBE_RADIUS_M: float = 0.3

#: Indicator colour returned by :func:`colour_under` when the rover sits over
#: an uncollected scientific sample.
COLOUR_SAMPLE_INDICATOR: tuple[int, int, int] = (255, 215, 0)  # gold

#: Indicator colour returned by :func:`colour_under` when the rover sits on
#: the base station.
COLOUR_BASE_INDICATOR: tuple[int, int, int] = (50, 205, 50)  # lime

#: Per-terrain background colour returned by :func:`colour_under` when the
#: rover is not over a sample or base.
TERRAIN_COLOURS: dict[Terrain, tuple[int, int, int]] = {
    Terrain.EARTH: (139, 195, 74),  # grass
    Terrain.MARS: (193, 68, 14),  # rust
    Terrain.UNDERWATER: (3, 80, 150),  # deep blue
    Terrain.SPACE: (10, 10, 30),  # near-black
}


@dataclass(frozen=True, slots=True)
class IMUReading:
    """Snapshot of an inertial-measurement-unit reading.

    Attributes:
        heading_deg: Instantaneous heading (degrees, 0 = east).
        accel_x_mps2: Body-frame acceleration along the rover's forward axis.
        accel_y_mps2: Body-frame acceleration perpendicular to the forward
            axis (positive = port / left).
    """

    heading_deg: float
    accel_x_mps2: float
    accel_y_mps2: float


# --- public sensor functions ------------------------------------------------


def lidar_distance(
    rover: Rover,
    *,
    angle_deg: float = 0.0,
    max_range_m: float = LIDAR_MAX_RANGE_M,
) -> float:
    """LIDAR distance reading at ``angle_deg`` relative to the rover heading.

    Args:
        rover: The rover whose position and heading set the ray origin.
        angle_deg: Angle offset added to the rover's heading. Zero means
            "directly ahead"; positive values rotate anticlockwise.
        max_range_m: Anything beyond this range is reported as ``inf``.

    Returns:
        Closed-form distance to the nearest wall or obstacle, in metres.
        Returns ``math.inf`` when no hit lies inside ``max_range_m``.
    """
    direction = math.radians((rover.state.heading_deg + angle_deg) % 360.0)
    dx = math.cos(direction)
    dy = math.sin(direction)
    rx, ry = rover.state.x, rover.state.y
    nearest = max_range_m
    for t in _wall_intersections(rx, ry, dx, dy, rover.world.bounds):
        nearest = min(nearest, t)
    for obstacle in rover.world.obstacles:
        hit = _circle_ray_intersection(rx, ry, dx, dy, obstacle.x, obstacle.y, obstacle.radius)
        if hit is not None:
            nearest = min(nearest, hit)
    if nearest >= max_range_m:
        return math.inf
    return rover.apply_range_noise(max(0.0, nearest))


def ultrasonic_distance(rover: Rover) -> float:
    """Forward-facing ultrasonic distance, capped at :data:`ULTRASONIC_MAX_RANGE_M`.

    The ultrasonic sensor is just a short-range LIDAR. If the LIDAR
    reading exceeds the ultrasonic ceiling, we return ``inf`` (the pupil
    sees "no obstacle in range").
    """
    distance = lidar_distance(rover, angle_deg=0.0, max_range_m=ULTRASONIC_MAX_RANGE_M)
    if math.isinf(distance):
        return math.inf
    return min(distance, ULTRASONIC_MAX_RANGE_M)


def colour_under(rover: Rover) -> tuple[int, int, int]:
    """Return the RGB triple immediately beneath the rover.

    Precedence: base station, then uncollected sample, then terrain
    background. All probe distances use :data:`COLOUR_PROBE_RADIUS_M`.
    """
    state = rover.state
    world = rover.world
    if math.hypot(state.x - world.base[0], state.y - world.base[1]) <= COLOUR_PROBE_RADIUS_M:
        return COLOUR_BASE_INDICATOR
    for sample in world.samples:
        if sample.collected:
            continue
        if math.hypot(state.x - sample.x, state.y - sample.y) <= COLOUR_PROBE_RADIUS_M:
            return COLOUR_SAMPLE_INDICATOR
    return TERRAIN_COLOURS[world.terrain]


def imu_reading(rover: Rover) -> IMUReading:
    """Return an :class:`IMUReading` for the rover's current state.

    Linear acceleration is reported as zero because :class:`Rover.move`
    teleports the position by a fixed step rather than integrating
    velocity. Once :mod:`robolearn.engine.physics` is wired into the
    motion loop (Task 5+) the IMU will derive accel from the Pymunk body.
    """
    return IMUReading(
        heading_deg=rover.state.heading_deg,
        accel_x_mps2=0.0,
        accel_y_mps2=0.0,
    )


# --- internal geometry helpers ---------------------------------------------


def _wall_intersections(
    x: float,
    y: float,
    dx: float,
    dy: float,
    bounds: ArenaBounds,
) -> list[float]:
    """Return positive ``t`` values where the ray hits any of the four walls."""
    hits: list[float] = []
    epsilon = 1e-12
    if abs(dx) > epsilon:
        for wall_x in (0.0, bounds.width):
            t = (wall_x - x) / dx
            if t <= epsilon:
                # Reject a ray that originates exactly on (or a hair inside) a
                # wall: a rover clamped against a boundary must read the far
                # wall, not 0 from the wall it is already touching.
                continue
            hit_y = y + t * dy
            if 0.0 <= hit_y <= bounds.height:
                hits.append(t)
    if abs(dy) > epsilon:
        for wall_y in (0.0, bounds.height):
            t = (wall_y - y) / dy
            if t <= epsilon:
                # Reject a ray that originates exactly on (or a hair inside) a
                # wall: a rover clamped against a boundary must read the far
                # wall, not 0 from the wall it is already touching.
                continue
            hit_x = x + t * dx
            if 0.0 <= hit_x <= bounds.width:
                hits.append(t)
    return hits


def _circle_ray_intersection(
    x: float,
    y: float,
    dx: float,
    dy: float,
    cx: float,
    cy: float,
    radius: float,
) -> float | None:
    """Return the smallest positive ``t`` where the ray hits the circle.

    The ray is parameterised as ``(x + t*dx, y + t*dy)`` for ``t >= 0`` and
    ``(dx, dy)`` must be a unit vector.
    """
    ox = x - cx
    oy = y - cy
    b = ox * dx + oy * dy
    c = ox * ox + oy * oy - radius * radius
    discriminant = b * b - c
    if discriminant < 0:
        return None
    sqrt_d = math.sqrt(discriminant)
    t1 = -b - sqrt_d
    if t1 >= 0:
        return t1
    t2 = -b + sqrt_d
    if t2 >= 0:
        return t2
    return None
