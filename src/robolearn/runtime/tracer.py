"""Tracer: per-call event log used by the grader (Task 9) and the replay UI (Task 16).

A :class:`Tracer` is an append-only list of :class:`Event` records plus a
frame counter and a monotonic millisecond clock. The pupil-facing API
(:mod:`robolearn.rover_api`) calls :func:`emit` for every function it
exposes; if a tracer is registered via :func:`set_active`, the call is
recorded — otherwise it is a no-op so calling pupil code outside the UI
shell never pays a cost.

The event payload is intentionally JSON-friendly: tuples are encoded as
lists so the whole log round-trips through :meth:`Tracer.to_json` and
:meth:`Tracer.from_json` without any custom serialisers.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import Any, Literal

EventKind = Literal["call", "sensor_read", "collision", "sample", "battery"]
"""The five event categories the tracer recognises (Section 10)."""


@dataclass(frozen=True, slots=True)
class RoverSnapshot:
    """Immutable snapshot of the rover state used by an :class:`Event`."""

    x: float
    y: float
    heading_deg: float
    battery_pct: float
    samples_held: int
    samples_collected: int
    collisions: int
    # Actual cumulative distance the rover travelled (metres). Optional with a
    # default so deserialising a trace saved before this field existed still
    # works. The grader reads this instead of summing commanded move distances,
    # which over-count when a move is clamped short by a wall or obstacle.
    distance_travelled_m: float = 0.0


@dataclass(frozen=True, slots=True)
class Event:
    """A single tracer event."""

    frame: int
    ts_ms: int
    kind: EventKind
    name: str
    args: tuple[Any, ...]
    result: Any
    rover_state: RoverSnapshot | None


class Tracer:
    """Append-only event log with a frame counter and millisecond clock."""

    def __init__(self) -> None:
        """Create an empty tracer with the clock pinned to ``time.monotonic_ns``."""
        self._events: list[Event] = []
        self._frame: int = 0
        self._start_ns: int = time.monotonic_ns()

    # --- inspectors --------------------------------------------------------

    @property
    def frame(self) -> int:
        """Return the current frame counter."""
        return self._frame

    def now_ms(self) -> int:
        """Return milliseconds elapsed since the tracer was created."""
        return (time.monotonic_ns() - self._start_ns) // 1_000_000

    def events(self) -> list[Event]:
        """Return a shallow copy of the recorded events (newest last)."""
        return list(self._events)

    def __len__(self) -> int:
        """Return the number of events currently recorded."""
        return len(self._events)

    # --- mutators ----------------------------------------------------------

    def advance_frame(self) -> None:
        """Increment the frame counter by one."""
        self._frame += 1

    def record(self, event: Event) -> None:
        """Append ``event`` to the log."""
        self._events.append(event)

    def clear(self) -> None:
        """Drop every event and reset the frame counter."""
        self._events.clear()
        self._frame = 0

    # --- (de)serialisation -------------------------------------------------

    def to_json(self) -> str:
        """Serialise the entire log to a JSON string.

        Tuple values inside ``args`` are encoded as lists; the reverse
        conversion happens in :meth:`from_json`.
        """
        return json.dumps(
            {
                "frame": self._frame,
                "events": [_event_to_dict(e) for e in self._events],
            }
        )

    @classmethod
    def from_json(cls, text: str) -> Tracer:
        """Recover a tracer from a string produced by :meth:`to_json`."""
        payload = json.loads(text)
        tracer = cls()
        tracer._frame = int(payload.get("frame", 0))
        for item in payload.get("events", []):
            tracer._events.append(_event_from_dict(item))
        return tracer


# --- module-level "active tracer" hooks ------------------------------------

_active_tracer: Tracer | None = None
_state_provider: Callable[[], RoverSnapshot | None] | None = None


def set_active(tracer: Tracer | None) -> None:
    """Install ``tracer`` as the active tracer. Use ``None`` to detach."""
    global _active_tracer
    _active_tracer = tracer


def get_active() -> Tracer | None:
    """Return the active tracer, or ``None`` if none is registered."""
    return _active_tracer


def clear_active() -> None:
    """Detach the active tracer (alias for ``set_active(None)``)."""
    set_active(None)


def set_state_provider(provider: Callable[[], RoverSnapshot | None] | None) -> None:
    """Register a callable that the tracer asks for a fresh :class:`RoverSnapshot`."""
    global _state_provider
    _state_provider = provider


def get_state_provider() -> Callable[[], RoverSnapshot | None] | None:
    """Return the currently registered state provider, or ``None``."""
    return _state_provider


def emit(
    name: str,
    args: tuple[Any, ...],
    result: Any,
    *,
    kind: EventKind = "call",
) -> None:
    """Record an event on the active tracer, if any.

    If there is no active tracer this is a fast no-op. Otherwise a fresh
    :class:`Event` is appended with the current frame, monotonic
    millisecond timestamp, and (when a state provider is registered) a
    :class:`RoverSnapshot` of the engine state.
    """
    tracer = _active_tracer
    if tracer is None:
        return
    snapshot: RoverSnapshot | None = None
    if _state_provider is not None:
        snapshot = _state_provider()
    tracer.record(
        Event(
            frame=tracer.frame,
            ts_ms=tracer.now_ms(),
            kind=kind,
            name=name,
            args=args,
            result=result,
            rover_state=snapshot,
        )
    )


# --- helpers ---------------------------------------------------------------


def _event_to_dict(event: Event) -> dict[str, Any]:
    return {
        "frame": event.frame,
        "ts_ms": event.ts_ms,
        "kind": event.kind,
        "name": event.name,
        "args": list(event.args),
        "result": event.result,
        "rover_state": (asdict(event.rover_state) if event.rover_state is not None else None),
    }


def _event_from_dict(payload: dict[str, Any]) -> Event:
    snapshot_dict = payload.get("rover_state")
    snapshot: RoverSnapshot | None = (
        RoverSnapshot(**snapshot_dict) if snapshot_dict is not None else None
    )
    return Event(
        frame=int(payload["frame"]),
        ts_ms=int(payload["ts_ms"]),
        kind=payload["kind"],
        name=payload["name"],
        args=tuple(payload.get("args", [])),
        result=payload.get("result"),
        rover_state=snapshot,
    )
