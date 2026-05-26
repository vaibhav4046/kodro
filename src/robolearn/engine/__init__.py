"""Engine subsystem: terrain, world, rover, physics (Task 3) and sensors (Task 4).

The submodules are deliberately kept import-light: each one can be loaded in
isolation by the test suite. Public types are re-exported here so callers
can write ``from robolearn.engine import Rover`` rather than reach into the
nested module path.
"""

from __future__ import annotations

from .physics import (
    COLLISION_TYPE_OBSTACLE,
    COLLISION_TYPE_ROVER,
    COLLISION_TYPE_WALL,
    ROVER_MASS_KG,
    ROVER_RADIUS_M,
    TIMESTEP_S,
    CollisionEvent,
    PhysicsSpace,
)
from .rover import (
    BATTERY_PER_COLLISION,
    BATTERY_PER_DEGREE,
    BATTERY_PER_METRE,
    DEFAULT_DETECTION_RADIUS_M,
    Rover,
    RoverState,
)
from .terrain import Terrain, TerrainParams, all_terrains, params_for
from .world import ArenaBounds, Obstacle, Sample, World

__all__ = (
    "BATTERY_PER_COLLISION",
    "BATTERY_PER_DEGREE",
    "BATTERY_PER_METRE",
    "COLLISION_TYPE_OBSTACLE",
    "COLLISION_TYPE_ROVER",
    "COLLISION_TYPE_WALL",
    "DEFAULT_DETECTION_RADIUS_M",
    "ROVER_MASS_KG",
    "ROVER_RADIUS_M",
    "TIMESTEP_S",
    "ArenaBounds",
    "CollisionEvent",
    "Obstacle",
    "PhysicsSpace",
    "Rover",
    "RoverState",
    "Sample",
    "Terrain",
    "TerrainParams",
    "World",
    "all_terrains",
    "params_for",
)
