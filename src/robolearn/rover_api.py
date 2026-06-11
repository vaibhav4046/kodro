"""Public, procedural API used by pupil code.

This is the single most important module in the project: every signature
is locked-in by Section 4 of the build spec and pupils write code
against the free functions in here. The bodies are deliberately thin:

* if a real engine is bound via :mod:`robolearn.runtime.binding`, each
  call drives it (drive the rover, read its sensors, attempt to collect
  a sample, etc.);
* otherwise every call returns its documented safe default so tests
  and standalone scripts keep working.

Design rules (Section 4):

* Every public function carries full type annotations using PEP 604
  unions.
* No function raises on bad input -- it clamps, warns via :mod:`logging`
  and returns a safe default.
* Every call is appended to the active tracer (if one is registered).
"""

from __future__ import annotations

import logging

from .runtime.binding import get_active_rover
from .runtime.tracer import emit as _emit_event

__all__ = (
    "at_base",
    "beep",
    "clear_props",
    "collect_sample",
    "drop_sample",
    "led",
    "log",
    "move_backward",
    "move_forward",
    "obstacle_ahead",
    "pen_down",
    "pen_up",
    "place",
    "read_battery",
    "read_colour",
    "read_distance",
    "read_heading",
    "sample_detected",
    "say",
    "scan",
    "set_speed",
    "turn_left",
    "turn_right",
    "wait",
)

logger = logging.getLogger(__name__)

# --- safe defaults & clamp bounds ------------------------------------------

#: Sentinel returned by :func:`read_distance` when no obstacle is visible.
INFINITY_METRES: float = float("inf")

#: Default RGB triple returned by :func:`read_colour` when no terrain is bound.
DEFAULT_COLOUR: tuple[int, int, int] = (0, 0, 0)

#: Default heading (degrees east of north, anticlockwise-positive) before the
#: engine is wired in.
DEFAULT_HEADING_DEG: float = 0.0

#: Default battery percentage before the engine is wired in.
DEFAULT_BATTERY_PCT: float = 100.0

# Argument clamp ranges (see Section 4).
_MIN_DISTANCE_M: float = 0.0
_MAX_DISTANCE_M: float = 1000.0
_MIN_ANGLE_DEG: float = -3600.0
_MAX_ANGLE_DEG: float = 3600.0
_MIN_WAIT_S: float = 0.0
_MAX_WAIT_S: float = 60.0
_MIN_BEEP_TIMES: int = 0
_MAX_BEEP_TIMES: int = 16


def _clamp_finite(value: float, low: float, high: float, *, name: str) -> float:
    """Clamp ``value`` into ``[low, high]``, replacing NaN/inf with ``low``."""
    if value != value:  # NaN
        logger.warning("rover_api: %s received NaN, clamping to %s", name, low)
        return low
    if value == float("inf") or value == float("-inf"):
        logger.warning(
            "rover_api: %s received non-finite value %r, clamping to %s",
            name,
            value,
            low,
        )
        return low
    if value < low:
        logger.warning("rover_api: %s=%r clamped to lower bound %s", name, value, low)
        return low
    if value > high:
        logger.warning("rover_api: %s=%r clamped to upper bound %s", name, value, high)
        return high
    return value


# --- Driving ---------------------------------------------------------------


def move_forward(distance: float) -> None:
    """Drive the rover forward by ``distance`` metres."""
    safe = _clamp_finite(float(distance), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="distance")
    rover = get_active_rover()
    if rover is not None:
        rover.move(safe)
    logger.debug("rover_api.move_forward distance=%s", safe)
    _emit_event("move_forward", (safe,), None, kind="call")


def move_backward(distance: float) -> None:
    """Drive the rover backward by ``distance`` metres."""
    safe = _clamp_finite(float(distance), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="distance")
    rover = get_active_rover()
    if rover is not None:
        rover.move(-safe)
    logger.debug("rover_api.move_backward distance=%s", safe)
    _emit_event("move_backward", (safe,), None, kind="call")


def turn_left(angle_deg: float) -> None:
    """Turn the rover ``angle_deg`` degrees anticlockwise."""
    safe = _clamp_finite(float(angle_deg), _MIN_ANGLE_DEG, _MAX_ANGLE_DEG, name="angle_deg")
    rover = get_active_rover()
    if rover is not None:
        rover.turn(safe)
    logger.debug("rover_api.turn_left angle_deg=%s", safe)
    _emit_event("turn_left", (safe,), None, kind="call")


def turn_right(angle_deg: float) -> None:
    """Turn the rover ``angle_deg`` degrees clockwise."""
    safe = _clamp_finite(float(angle_deg), _MIN_ANGLE_DEG, _MAX_ANGLE_DEG, name="angle_deg")
    rover = get_active_rover()
    if rover is not None:
        rover.turn(-safe)
    logger.debug("rover_api.turn_right angle_deg=%s", safe)
    _emit_event("turn_right", (safe,), None, kind="call")


def wait(seconds: float) -> None:
    """Pause for ``seconds`` seconds of simulated time."""
    safe = _clamp_finite(float(seconds), _MIN_WAIT_S, _MAX_WAIT_S, name="seconds")
    logger.debug("rover_api.wait seconds=%s", safe)
    _emit_event("wait", (safe,), None, kind="call")


# --- Sensing ---------------------------------------------------------------


def read_distance() -> float:
    """Return distance in metres to the nearest obstacle directly ahead."""
    rover = get_active_rover()
    if rover is not None:
        from .engine.sensors import lidar_distance

        result = lidar_distance(rover)
    else:
        result = INFINITY_METRES
    _emit_event("read_distance", (), result, kind="sensor_read")
    return result


def read_colour() -> tuple[int, int, int]:
    """Return the RGB colour directly beneath the rover."""
    rover = get_active_rover()
    if rover is not None:
        from .engine.sensors import colour_under

        result = colour_under(rover)
    else:
        result = DEFAULT_COLOUR
    _emit_event("read_colour", (), list(result), kind="sensor_read")
    return result


def read_heading() -> float:
    """Return the current heading in degrees."""
    rover = get_active_rover()
    result = float(rover.state.heading_deg) if rover is not None else DEFAULT_HEADING_DEG
    _emit_event("read_heading", (), result, kind="sensor_read")
    return result


def read_battery() -> float:
    """Return the rover's battery level as a percentage in ``[0, 100]``."""
    rover = get_active_rover()
    result = float(rover.state.battery_pct) if rover is not None else DEFAULT_BATTERY_PCT
    _emit_event("read_battery", (), result, kind="sensor_read")
    return result


def obstacle_ahead(threshold_m: float = 0.5) -> bool:
    """Return True if an obstacle is closer than ``threshold_m`` metres."""
    safe = _clamp_finite(float(threshold_m), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="threshold_m")
    rover = get_active_rover()
    if rover is not None:
        from .engine.sensors import lidar_distance

        result = bool(lidar_distance(rover) <= safe)
    else:
        result = False
    _emit_event("obstacle_ahead", (safe,), result, kind="sensor_read")
    return result


def sample_detected(radius_m: float = 0.3) -> bool:
    """Return True if a collectible sample is within ``radius_m`` metres."""
    safe = _clamp_finite(float(radius_m), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="radius_m")
    rover = get_active_rover()
    if rover is not None:
        nearest = rover._nearest_sample(safe)
        result = nearest is not None
    else:
        result = False
    _emit_event("sample_detected", (safe,), result, kind="sensor_read")
    return result


def at_base() -> bool:
    """Return True when the rover currently overlaps the base tile."""
    rover = get_active_rover()
    result = bool(rover.at_base()) if rover is not None else False
    _emit_event("at_base", (), result, kind="sensor_read")
    return result


# --- Acting ----------------------------------------------------------------


def collect_sample() -> bool:
    """Attempt to collect a nearby sample."""
    rover = get_active_rover()
    result = bool(rover.try_collect()) if rover is not None else False
    _emit_event("collect_sample", (), result, kind="sample")
    return result


def drop_sample() -> bool:
    """Attempt to drop a held sample at the rover's current position."""
    rover = get_active_rover()
    result = bool(rover.try_drop()) if rover is not None else False
    _emit_event("drop_sample", (), result, kind="sample")
    return result


def beep(times: int = 1) -> None:
    """Play an audible cue ``times`` times."""
    clamped = int(
        _clamp_finite(
            float(times),
            float(_MIN_BEEP_TIMES),
            float(_MAX_BEEP_TIMES),
            name="times",
        )
    )
    logger.debug("rover_api.beep times=%s", clamped)
    _emit_event("beep", (clamped,), None, kind="call")


def log(message: object) -> None:
    """Print ``message`` to the simulator console."""
    try:
        text = message if isinstance(message, str) else str(message)
    except Exception:
        text = "<unprintable object>"
        logger.warning(
            "rover_api.log: failed to stringify %r",
            type(message).__name__,
        )
    logger.info("pupil-log: %s", text)
    _emit_event("log", (text,), None, kind="call")


def say(message: object) -> None:
    """Show a short speech bubble above the rover (a friendlier ``log``)."""
    try:
        text = message if isinstance(message, str) else str(message)
    except Exception:
        text = "<unprintable object>"
    logger.debug("rover_api.say %s", text)
    _emit_event("say", (text,), None, kind="call")


def led(colour: str = "cyan") -> None:
    """Light the rover's status LED a colour (visual cue only)."""
    _emit_event("led", (str(colour),), None, kind="call")


def place(kind: str = "flag", x: float | None = None, y: float | None = None) -> None:
    """Place a prop in the world: a flag, beacon, rock, tree, person or crate.

    With no coordinates the prop is placed where the rover is standing
    ("drive somewhere, plant a flag"); with ``x``/``y`` (metres) it is placed
    at that spot. Props are visual world-building -- they never collide.
    """
    if x is None or y is None:
        _emit_event("place", (str(kind),), None, kind="call")
    else:
        _emit_event("place", (str(kind), float(x), float(y)), None, kind="call")


def clear_props() -> None:
    """Remove every prop placed with :func:`place`."""
    _emit_event("clear_props", (), None, kind="call")


def scan() -> None:
    """Sweep the surroundings with a radar ping (a visual flourish)."""
    _emit_event("scan", (), None, kind="call")


def set_speed(percent: float) -> None:
    """Set the rover's drive speed as a percentage (clamped 0-100)."""
    clamped = _clamp_finite(float(percent), 0.0, 100.0, name="percent")
    _emit_event("set_speed", (clamped,), None, kind="call")


def pen_down() -> None:
    """Lower the trail pen so the rover draws its path."""
    _emit_event("pen_down", (), None, kind="call")


def pen_up() -> None:
    """Lift the trail pen so the rover stops drawing."""
    _emit_event("pen_up", (), None, kind="call")
