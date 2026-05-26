"""Runtime subsystem: tracer (Task 6), sandbox + executor (Task 7)."""

from __future__ import annotations

from .binding import (
    clear_active as clear_active_engine,
)
from .binding import (
    get_active_rover,
    get_active_world,
    set_active_rover,
    set_active_world,
)
from .executor import DEFAULT_TIMEOUT_S, ExecutionResult, execute
from .sandbox import (
    FORBIDDEN_NAMES,
    SandboxViolation,
    find_violations,
    is_safe,
    restricted_globals,
)
from .tracer import (
    Event,
    EventKind,
    RoverSnapshot,
    Tracer,
    clear_active,
    emit,
    get_active,
    get_state_provider,
    set_active,
    set_state_provider,
)

__all__ = (
    "DEFAULT_TIMEOUT_S",
    "FORBIDDEN_NAMES",
    "Event",
    "EventKind",
    "ExecutionResult",
    "RoverSnapshot",
    "SandboxViolation",
    "Tracer",
    "clear_active",
    "clear_active_engine",
    "emit",
    "execute",
    "find_violations",
    "get_active",
    "get_active_rover",
    "get_active_world",
    "get_state_provider",
    "is_safe",
    "restricted_globals",
    "set_active",
    "set_active_rover",
    "set_active_world",
    "set_state_provider",
)
