"""Module-level binding from :mod:`kodro.rover_api` to the engine.

`rover_api` is a free-function module (Section 4 of the spec). For the
pupil to drive a real engine instance, the executor sets an "active
rover" + "active world" here just before running pupil code; every
public API function then consults this module to find them. When no
engine is bound (unit tests, standalone calls), the rover_api falls
back to its safe defaults.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterator

    from kodro.engine.rover import Rover
    from kodro.engine.world import World

_active_rover: Rover | None = None
_active_world: World | None = None

# The active rover/world are PROCESS-GLOBAL, and pupil code runs on a daemon
# worker thread (executor) while the web app also runs AI code-validation and
# swarm jobs on their own threads. Without serialisation a background run could
# rebind the rover mid-way through a live submission (hijacking whose vehicle
# the pupil API drives). This reentrant lock makes "bind -> run -> clear" a
# single atomic critical section; every run site holds it for the whole run.
binding_lock = threading.RLock()


def set_active_rover(rover: Rover | None) -> None:
    """Install ``rover`` as the active engine instance, or detach with ``None``."""
    global _active_rover
    _active_rover = rover


def get_active_rover() -> Rover | None:
    """Return the active :class:`~kodro.engine.rover.Rover`, or ``None``."""
    return _active_rover


def set_active_world(world: World | None) -> None:
    """Install ``world`` as the active engine world."""
    global _active_world
    _active_world = world


def get_active_world() -> World | None:
    """Return the active :class:`~kodro.engine.world.World`, or ``None``."""
    return _active_world


def clear_active() -> None:
    """Detach both the rover and the world."""
    set_active_rover(None)
    set_active_world(None)


@contextmanager
def active_engine(rover: Rover | None, world: World | None) -> Iterator[None]:
    """Serialise a bind -> run -> clear window on the process-global engine.

    Holds :data:`binding_lock` for the whole ``with`` block so concurrent
    threads (AI code validation, swarm runs, a live submission) can never see
    each other's rover/world. The bindings are cleared on exit, even on error.
    Callers still manage the tracer / state-provider around this block.
    """
    with binding_lock:
        set_active_rover(rover)
        set_active_world(world)
        try:
            yield
        finally:
            clear_active()
