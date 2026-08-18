"""RoboLearn package.

The top-level namespace re-exports the procedural :mod:`kodro.rover_api`
surface so pupils can write either::

    from kodro import move_forward, turn_left

    move_forward(50)
    turn_left(90)

or the explicit form::

    from kodro.rover_api import move_forward, turn_left
"""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

from . import rover_api
from .rover_api import (
    at_base,
    beep,
    collect_sample,
    drop_sample,
    log,
    move_backward,
    move_forward,
    obstacle_ahead,
    read_battery,
    read_colour,
    read_distance,
    read_heading,
    sample_detected,
    turn_left,
    turn_right,
    wait,
)

try:
    __version__ = version("kodro")
except PackageNotFoundError:  # pragma: no cover
    __version__ = "0.0.0+unknown"

__all__ = (
    "__version__",
    "at_base",
    "beep",
    "collect_sample",
    "drop_sample",
    "log",
    "move_backward",
    "move_forward",
    "obstacle_ahead",
    "read_battery",
    "read_colour",
    "read_distance",
    "read_heading",
    "rover_api",
    "sample_detected",
    "turn_left",
    "turn_right",
    "wait",
)
