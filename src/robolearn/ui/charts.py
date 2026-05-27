"""Canvas-based mini-charts for the sensors panel (P2 polish task).

Matplotlib would balloon the PyInstaller bundle from 26 MB to ~120 MB.
For a classroom estate that's a real cost; we draw simple line charts
directly onto a :class:`tk.Canvas` instead. Same teaching value, zero
new dependencies. The chart auto-downsamples past 200 datapoints.
"""

from __future__ import annotations

import tkinter as tk
from collections import deque
from dataclasses import dataclass

#: Maximum stored datapoints before downsampling kicks in.
MAX_POINTS: int = 200


@dataclass(slots=True)
class _Series:
    """One coloured line and its data."""

    label: str
    colour: str
    data: deque[float]
    warn_below: float | None = None


class LineChart(tk.Canvas):
    """A tiny single-series line chart with an optional warning band."""

    def __init__(
        self,
        parent: tk.Misc,
        *,
        label: str,
        colour: str = "#58a6ff",
        warn_below: float | None = None,
        width: int = 220,
        height: int = 60,
    ) -> None:
        """Build the chart canvas."""
        super().__init__(parent, width=width, height=height, bg="#0d1117", highlightthickness=0)
        self._series = _Series(
            label=label, colour=colour, data=deque(maxlen=MAX_POINTS), warn_below=warn_below
        )
        self._width = width
        self._height = height

    def push(self, value: float) -> None:
        """Append ``value`` and redraw."""
        self._series.data.append(float(value))
        self.redraw()

    def clear(self) -> None:
        """Wipe stored data and redraw a blank canvas."""
        self._series.data.clear()
        self.redraw()

    def redraw(self) -> None:
        """Repaint the chart from current data."""
        self.delete("all")
        data = list(self._series.data)
        if not data:
            self.create_text(
                self._width // 2,
                self._height // 2,
                text=self._series.label,
                fill="#8b949e",
                font=("TkDefaultFont", 9),
            )
            return
        lo = min(data)
        hi = max(data)
        if hi == lo:
            hi = lo + 1.0  # avoid divide-by-zero
        span = hi - lo
        # Warning band.
        if self._series.warn_below is not None and lo < self._series.warn_below:
            warn_y = self._scale(self._series.warn_below, lo, span)
            self.create_rectangle(
                0,
                warn_y,
                self._width,
                self._height,
                fill="#3d1416",
                outline="",
            )
        # Series line.
        step = self._width / max(1, len(data) - 1)
        for i in range(1, len(data)):
            x0 = (i - 1) * step
            x1 = i * step
            y0 = self._scale(data[i - 1], lo, span)
            y1 = self._scale(data[i], lo, span)
            self.create_line(x0, y0, x1, y1, fill=self._series.colour, width=2)
        # Label + last value.
        self.create_text(
            6,
            6,
            anchor=tk.NW,
            text=f"{self._series.label}  {data[-1]:.2f}",
            fill="#c9d1d9",
            font=("TkDefaultFont", 9, "bold"),
        )

    @property
    def data(self) -> tuple[float, ...]:
        """Snapshot of the current data (used by tests)."""
        return tuple(self._series.data)

    def _scale(self, value: float, lo: float, span: float) -> float:
        """Map a data value into a canvas y-coordinate (inverted)."""
        margin = 8
        usable = self._height - 2 * margin
        ratio = (value - lo) / span
        return self._height - margin - ratio * usable


class MiniMap(tk.Canvas):
    """Top-down arena view with a rover trail."""

    def __init__(self, parent: tk.Misc, *, width: int = 220, height: int = 140) -> None:
        """Build the mini-map canvas."""
        super().__init__(parent, width=width, height=height, bg="#0d1117", highlightthickness=0)
        self._width = width
        self._height = height
        self._world_w = 10.0
        self._world_h = 10.0
        self._trail: list[tuple[float, float]] = []

    def set_world_bounds(self, world_w: float, world_h: float) -> None:
        """Tell the map how big the world is in metres."""
        self._world_w = max(0.1, world_w)
        self._world_h = max(0.1, world_h)

    def push_position(self, x: float, y: float) -> None:
        """Append a rover position to the trail and redraw."""
        self._trail.append((float(x), float(y)))
        if len(self._trail) > MAX_POINTS:
            self._trail = self._trail[-MAX_POINTS:]
        self.redraw()

    def clear(self) -> None:
        """Drop the trail and redraw the empty arena."""
        self._trail.clear()
        self.redraw()

    def redraw(self) -> None:
        """Repaint the trail."""
        self.delete("all")
        # Arena outline.
        self.create_rectangle(2, 2, self._width - 2, self._height - 2, outline="#30363d", width=1)
        if not self._trail:
            self.create_text(
                self._width // 2,
                self._height // 2,
                text="rover trail",
                fill="#8b949e",
                font=("TkDefaultFont", 9),
            )
            return
        # Trail polyline.
        pts: list[float] = []
        for wx, wy in self._trail:
            sx, sy = self._to_screen(wx, wy)
            pts.extend((sx, sy))
        if len(pts) >= 4:
            self.create_line(*pts, fill="#58a6ff", width=2, smooth=True)
        # Head marker.
        last_x, last_y = self._trail[-1]
        sx, sy = self._to_screen(last_x, last_y)
        self.create_oval(sx - 4, sy - 4, sx + 4, sy + 4, fill="#ff3c3c", outline="")

    @property
    def trail(self) -> tuple[tuple[float, float], ...]:
        """Snapshot of the trail (used by tests)."""
        return tuple(self._trail)

    def _to_screen(self, wx: float, wy: float) -> tuple[float, float]:
        sx = 4 + (wx / self._world_w) * (self._width - 8)
        sy = self._height - 4 - (wy / self._world_h) * (self._height - 8)
        return (sx, sy)
