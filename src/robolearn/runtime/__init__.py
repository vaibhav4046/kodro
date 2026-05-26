"""Runtime subsystem: tracer (Task 6), sandbox + executor (Task 7)."""

from __future__ import annotations

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
    "emit",
    "execute",
    "find_violations",
    "get_active",
    "get_state_provider",
    "is_safe",
    "restricted_globals",
    "set_active",
    "set_state_provider",
)
