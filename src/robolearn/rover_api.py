"""Public, procedural API used by pupil code.

This is the single most important module in the project: every signature is
locked-in by Section 4 of the build spec and pupils write code against the
free functions in here. The bodies are intentionally thin -- they will be
wired through :mod:`robolearn.runtime.tracer` (Task 6) and into the OO
engine (Tasks 3-5) by later build-plan tasks. Until then they return safe
defaults and clamp their inputs so that no pupil call can ever raise.

Design rules (Section 4):

* Every public function carries full type annotations using PEP 604 unions.
* No function raises on bad input -- it clamps, warns via :mod:`logging`
  and returns a safe default.
* Every call will eventually be appended to the active tracer; this hookup
  lands in Task 6 without changing any of the signatures below.
"""

from __future__ import annotations

import logging

__all__ = (
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
    "sample_detected",
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

# Argument clamp ranges. Picked to be generous enough that legitimate pupil
# code is never silently truncated, but tight enough that fat-finger inputs
# (a stray ``1e9`` for ``move_forward`` say) do not flood the engine.
_MIN_DISTANCE_M: float = 0.0
_MAX_DISTANCE_M: float = 1000.0
_MIN_ANGLE_DEG: float = -3600.0
_MAX_ANGLE_DEG: float = 3600.0
_MIN_WAIT_S: float = 0.0
_MAX_WAIT_S: float = 60.0
_MIN_BEEP_TIMES: int = 0
_MAX_BEEP_TIMES: int = 16


def _clamp_finite(value: float, low: float, high: float, *, name: str) -> float:
    """Clamp ``value`` into ``[low, high]``, replacing NaN/inf with ``low``.

    Args:
        value: The candidate value to clamp.
        low: Inclusive lower bound.
        high: Inclusive upper bound.
        name: Argument name, used in warning messages.

    Returns:
        A finite ``float`` inside ``[low, high]``.
    """
    if value != value:  # NaN check; NaN is the only value not equal to itself.
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
    """Drive the rover forward by ``distance`` metres.

    Negative distances and non-finite values are clamped to zero and logged.
    The maximum allowed step is :data:`_MAX_DISTANCE_M` (1000 m); larger
    values are clamped down.
    """
    safe = _clamp_finite(float(distance), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="distance")
    logger.debug("rover_api.move_forward distance=%s", safe)


def move_backward(distance: float) -> None:
    """Drive the rover backward by ``distance`` metres.

    Same clamping rules as :func:`move_forward`.
    """
    safe = _clamp_finite(float(distance), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="distance")
    logger.debug("rover_api.move_backward distance=%s", safe)


def turn_left(angle_deg: float) -> None:
    """Turn the rover ``angle_deg`` degrees anticlockwise.

    Values outside ``[-3600, 3600]`` are clamped (ten full revolutions either
    way is far more than any lesson needs).
    """
    safe = _clamp_finite(float(angle_deg), _MIN_ANGLE_DEG, _MAX_ANGLE_DEG, name="angle_deg")
    logger.debug("rover_api.turn_left angle_deg=%s", safe)


def turn_right(angle_deg: float) -> None:
    """Turn the rover ``angle_deg`` degrees clockwise.

    Same clamping rules as :func:`turn_left`.
    """
    safe = _clamp_finite(float(angle_deg), _MIN_ANGLE_DEG, _MAX_ANGLE_DEG, name="angle_deg")
    logger.debug("rover_api.turn_right angle_deg=%s", safe)


def wait(seconds: float) -> None:
    """Pause for ``seconds`` seconds of simulated time.

    Values outside ``[0, 60]`` are clamped — a single ``wait`` call should
    never freeze the simulator for longer than a minute of in-world time.
    """
    safe = _clamp_finite(float(seconds), _MIN_WAIT_S, _MAX_WAIT_S, name="seconds")
    logger.debug("rover_api.wait seconds=%s", safe)


# --- Sensing ---------------------------------------------------------------


def read_distance() -> float:
    """Return distance in metres to the nearest obstacle directly ahead.

    Returns:
        ``float``: A non-negative distance, or :data:`INFINITY_METRES` when
        no obstacle is visible. Before the engine is wired in (Task 3), the
        stub always returns :data:`INFINITY_METRES`.
    """
    return INFINITY_METRES


def read_colour() -> tuple[int, int, int]:
    """Return the ``(red, green, blue)`` colour directly beneath the rover.

    Returns:
        Three integers in ``[0, 255]``. Before the engine is wired in
        (Task 3), the stub always returns :data:`DEFAULT_COLOUR`.
    """
    return DEFAULT_COLOUR


def read_heading() -> float:
    """Return the current heading in degrees.

    Zero degrees corresponds to "east"; anticlockwise rotation is positive.
    The value is wrapped into ``[0, 360)`` before being returned.
    """
    return DEFAULT_HEADING_DEG


def read_battery() -> float:
    """Return the rover's battery level as a percentage in ``[0, 100]``."""
    return DEFAULT_BATTERY_PCT


def obstacle_ahead(threshold_m: float = 0.5) -> bool:
    """Return True if an obstacle is closer than ``threshold_m`` metres.

    Args:
        threshold_m: Distance threshold in metres. Clamped to
            ``[0, _MAX_DISTANCE_M]``.

    Returns:
        ``True`` if the front-facing distance is at most ``threshold_m``.
        Before the engine is wired in (Task 3), the stub always returns
        ``False``.
    """
    _clamp_finite(float(threshold_m), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="threshold_m")
    return False


def sample_detected(radius_m: float = 0.3) -> bool:
    """Return True if a collectible sample is within ``radius_m`` metres.

    Args:
        radius_m: Detection radius. Clamped to ``[0, _MAX_DISTANCE_M]``.

    Returns:
        ``True`` when a sample is in range. Before the engine is wired in
        (Task 3), the stub always returns ``False``.
    """
    _clamp_finite(float(radius_m), _MIN_DISTANCE_M, _MAX_DISTANCE_M, name="radius_m")
    return False


def at_base() -> bool:
    """Return True when the rover currently overlaps the base tile."""
    return False


# --- Acting ----------------------------------------------------------------


def collect_sample() -> bool:
    """Attempt to collect a nearby sample.

    Returns:
        ``True`` if a sample was picked up; otherwise ``False``. Before the
        engine is wired in (Task 3), the stub always returns ``False``.
    """
    return False


def drop_sample() -> bool:
    """Attempt to drop a held sample at the rover's current position.

    Returns:
        ``True`` if a sample was dropped; otherwise ``False``. Before the
        engine is wired in (Task 3), the stub always returns ``False``.
    """
    return False


def beep(times: int = 1) -> None:
    """Play an audible cue ``times`` times.

    Args:
        times: Number of beeps in ``[0, 16]``. Values outside this range are
            clamped and a warning is logged.
    """
    clamped = int(
        _clamp_finite(
            float(times),
            float(_MIN_BEEP_TIMES),
            float(_MAX_BEEP_TIMES),
            name="times",
        )
    )
    logger.debug("rover_api.beep times=%s", clamped)


def log(message: object) -> None:
    """Print ``message`` to the simulator console.

    Args:
        message: Anything stringifiable. Non-string values are coerced via
            :func:`str`. Errors during coercion are caught and replaced with
            a fallback so this function never raises.
    """
    try:
        text = message if isinstance(message, str) else str(message)
    except Exception:
        text = "<unprintable object>"
        logger.warning(
            "rover_api.log: failed to stringify %r",
            type(message).__name__,
        )
    logger.info("pupil-log: %s", text)
