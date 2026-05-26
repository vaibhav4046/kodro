"""Module-level binding from :mod:`robolearn.rover_api` to the engine.

`rover_api` is a free-function module (Section 4 of the spec). For the
pupil to drive a real engine instance, the executor sets an "active
rover" + "active world" here just before running pupil code; every
public API function then consults this module to find them. When no
engine is bound (unit tests, standalone calls), the rover_api falls
back to its safe defaults.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from robolearn.engine.rover import Rover
    from robolearn.engine.world import World

_active_rover: Rover | None = None
_active_world: World | None = None


def set_active_rover(rover: Rover | None) -> None:
    """Install ``rover`` as the active engine instance, or detach with ``None``."""
    global _active_rover
    _active_rover = rover


def get_active_rover() -> Rover | None:
    """Return the active :class:`~robolearn.engine.rover.Rover`, or ``None``."""
    return _active_rover


def set_active_world(world: World | None) -> None:
    """Install ``world`` as the active engine world."""
    global _active_world
    _active_world = world


def get_active_world() -> World | None:
    """Return the active :class:`~robolearn.engine.world.World`, or ``None``."""
    return _active_world


def clear_active() -> None:
    """Detach both the rover and the world."""
    set_active_rover(None)
    set_active_world(None)
