"""Design tokens + helpers for the "Orbital Rover" mission-control look.

Ported from the Claude Design handoff (``Rover Simulator.html`` — the
*Orbital Rover* mission-control IDE). The full prototype is a React/CSS web
app; this module captures the parts that translate to the Tk desktop UI:
the colour tokens, the run-status palette, and the sim-speed scaling used by
the mission bar. It is deliberately free of Tk imports so the numeric
helpers unit-test without a display.
"""

from __future__ import annotations

# --- Orbital Rover colour tokens (from styles.css :root) -------------------
VOID: str = "#08090f"
NAVY: str = "#0f1220"
NAVY_2: str = "#161a2d"
NAVY_3: str = "#1f2440"
CYAN: str = "#5ce0d8"
CYAN_2: str = "#3bc0b8"
MARS: str = "#c8685a"
BRASS: str = "#c9a86a"
PAPER: str = "#f5f0e4"
FG_MUTED: str = "#9a958a"
SUCCESS: str = "#7cc49b"
WARNING: str = "#e0b45c"
DANGER: str = "#d06a6a"
BORDER: str = "#2a2d3d"

# --- Fonts (fall back silently in Tk when not installed) -------------------
FONT_DISPLAY: str = "Cormorant Garamond"
FONT_BODY: str = "Inter Tight"
FONT_MONO: str = "JetBrains Mono"

#: Run-lifecycle states shown by the mission-bar status dot, mapped to the
#: design's status-dot colours.
STATUS_COLOURS: dict[str, str] = {
    "idle": FG_MUTED,
    "run": CYAN,
    "paused": WARNING,
    "done": SUCCESS,
    "error": DANGER,
}

#: Human-facing label for each status.
STATUS_LABELS: dict[str, str] = {
    "idle": "IDLE",
    "run": "RUNNING",
    "paused": "PAUSED",
    "done": "COMPLETE",
    "error": "ERROR",
}

#: Sim-speed slider bounds (multiplier on real-time playback).
MIN_SPEED: float = 0.25
MAX_SPEED: float = 4.0


def status_colour(state: str) -> str:
    """Return the dot colour for a run state (cyan default if unknown)."""
    return STATUS_COLOURS.get(state, CYAN)


def status_label(state: str) -> str:
    """Return the short label for a run state."""
    return STATUS_LABELS.get(state, state.upper())


def clamp_speed(value: float) -> float:
    """Clamp a sim-speed multiplier to ``[MIN_SPEED, MAX_SPEED]``."""
    return min(MAX_SPEED, max(MIN_SPEED, round(value, 2)))


def scaled_delay(base_ms: int, speed: float) -> int:
    """Scale an animation delay by ``speed`` (faster speed = shorter delay).

    A speed of 2.0 halves the frame delay; 0.5 doubles it. Always at least
    1 ms so the Tk ``after`` scheduler keeps firing.
    """
    return max(1, round(base_ms / clamp_speed(speed)))
