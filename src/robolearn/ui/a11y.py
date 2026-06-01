"""Offline accessibility settings: text scaling and high contrast.

This module is deliberately **Tk-free** so the scaling/persistence logic
unit-tests without a display. The UI layer reads an :class:`A11ySettings`,
applies it to the editor / console / hint widgets, and persists it to
``~/.robolearn/a11y.toml`` -- no cloud, no account, in keeping with the
project's offline constraint.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

#: Smallest / largest text-scale multiplier the A-/A+ controls allow.
MIN_SCALE: float = 0.8
MAX_SCALE: float = 2.0

#: Increment applied per A-/A+ press.
SCALE_STEP: float = 0.1

#: Base point sizes the multiplier is applied to.
BASE_CODE_SIZE: int = 11
BASE_TEXT_SIZE: int = 10

#: High-contrast palette applied to the console + hint card when enabled.
HIGH_CONTRAST_BG: str = "#000000"
HIGH_CONTRAST_FG: str = "#ffffff"


@dataclass(slots=True)
class A11ySettings:
    """A pupil's accessibility preferences."""

    text_scale: float = 1.0
    high_contrast: bool = False

    def code_size(self) -> int:
        """Scaled point size for the monospaced editor font."""
        return max(1, round(BASE_CODE_SIZE * self.text_scale))

    def text_size(self) -> int:
        """Scaled point size for prose (console + hint card)."""
        return max(1, round(BASE_TEXT_SIZE * self.text_scale))


def clamp_scale(value: float) -> float:
    """Clamp ``value`` to ``[MIN_SCALE, MAX_SCALE]`` (rounded to 2 dp)."""
    return min(MAX_SCALE, max(MIN_SCALE, round(value, 2)))


def stepped_scale(scale: float, *, larger: bool) -> float:
    """Return ``scale`` nudged one :data:`SCALE_STEP`, clamped to range."""
    return clamp_scale(scale + (SCALE_STEP if larger else -SCALE_STEP))


def to_toml(settings: A11ySettings) -> str:
    """Serialise ``settings`` to a minimal TOML document."""
    flag = "true" if settings.high_contrast else "false"
    return f"text_scale = {clamp_scale(settings.text_scale)}\nhigh_contrast = {flag}\n"


def from_mapping(data: dict[str, object]) -> A11ySettings:
    """Build settings from a parsed-TOML mapping, tolerating bad values."""
    raw = data.get("text_scale", 1.0)
    try:
        scale = clamp_scale(float(raw))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        scale = 1.0
    return A11ySettings(text_scale=scale, high_contrast=bool(data.get("high_contrast", False)))


def load(path: Path) -> A11ySettings:
    """Load settings from ``path``; return defaults if missing or invalid."""
    try:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError):
        return A11ySettings()
    return from_mapping(data)


def save(path: Path, settings: A11ySettings) -> None:
    """Persist ``settings`` to ``path`` (best-effort; creates parents)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(to_toml(settings), encoding="utf-8")
