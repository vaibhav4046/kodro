"""Canvas-based mini-charts for the sensors panel (P2 polish task).

Matplotlib is deliberately not a dependency here. When this was written the
PyInstaller bundle was 26 MB and the estimate for adding matplotlib was
roughly 120 MB; neither figure describes the current builds, which are 71 MB
(Tk) and 188 MB (WebView2), and the 120 MB was never measured. The reasoning
stands whatever the baseline: a classroom estate pays for every megabyte, so
we draw simple line charts directly onto a :class:`tk.Canvas` instead. Same
teaching value, zero new dependencies. The chart auto-downsamples past 200
datapoints.
"""

from __future__ import annotations

import math
import tkinter as tk
from collections import deque
from dataclasses import dataclass

from kodro.ui import orbital

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
        colour: str = orbital.CYAN,
        warn_below: float | None = None,
        width: int = 220,
        height: int = 60,
    ) -> None:
        """Build the chart canvas."""
        super().__init__(parent, width=width, height=height, bg=orbital.NAVY, highlightthickness=0)
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
                fill=orbital.FG_MUTED,
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
            fill=orbital.PAPER,
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
        super().__init__(parent, width=width, height=height, bg=orbital.NAVY, highlightthickness=0)
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
        self.create_rectangle(
            2, 2, self._width - 2, self._height - 2, outline=orbital.BORDER, width=1
        )
        if not self._trail:
            self.create_text(
                self._width // 2,
                self._height // 2,
                text="rover trail",
                fill=orbital.FG_MUTED,
                font=("TkDefaultFont", 9),
            )
            return
        # Trail polyline.
        pts: list[float] = []
        for wx, wy in self._trail:
            sx, sy = self._to_screen(wx, wy)
            pts.extend((sx, sy))
        if len(pts) >= 4:
            self.create_line(*pts, fill=orbital.CYAN, width=2, smooth=True)
        # Head marker.
        last_x, last_y = self._trail[-1]
        sx, sy = self._to_screen(last_x, last_y)
        self.create_oval(sx - 4, sy - 4, sx + 4, sy + 4, fill=orbital.DANGER, outline="")

    @property
    def trail(self) -> tuple[tuple[float, float], ...]:
        """Snapshot of the trail (used by tests)."""
        return tuple(self._trail)

    def _to_screen(self, wx: float, wy: float) -> tuple[float, float]:
        sx = 4 + (wx / self._world_w) * (self._width - 8)
        sy = self._height - 4 - (wy / self._world_h) * (self._height - 8)
        return (sx, sy)


class Compass(tk.Canvas):
    """A heading dial with cardinal ticks and a cyan needle (design gauge)."""

    def __init__(self, parent: tk.Misc, *, size: int = 96) -> None:
        """Build the compass canvas."""
        super().__init__(parent, width=size, height=size, bg=orbital.NAVY, highlightthickness=0)
        self._size = size
        self._heading = 0.0
        self.redraw()

    def set_heading(self, heading_deg: float) -> None:
        """Point the needle at ``heading_deg`` (0 = north, clockwise)."""
        self._heading = float(heading_deg) % 360.0
        self.redraw()

    @property
    def heading(self) -> float:
        """Current heading in degrees (used by tests)."""
        return self._heading

    def redraw(self) -> None:
        """Repaint the dial + needle."""
        self.delete("all")
        c = self._size / 2
        r = c - 8
        self.create_oval(c - r, c - r, c + r, c + r, outline=orbital.BORDER, width=1)
        for label, ang in (("N", 0), ("E", 90), ("S", 180), ("W", 270)):
            rad = math.radians(ang)
            tx = c + (r - 8) * math.sin(rad)
            ty = c - (r - 8) * math.cos(rad)
            colour = orbital.CYAN if label == "N" else orbital.FG_MUTED
            self.create_text(tx, ty, text=label, fill=colour, font=("TkDefaultFont", 8, "bold"))
        # The rover heading is 0 = east, anticlockwise positive; the compass
        # labels are 0 = north, clockwise. Convert so the needle points where the
        # rover actually faces (heading 0 -> east/right, not north/up).
        rad = math.radians(90.0 - self._heading)
        nx = c + (r - 12) * math.sin(rad)
        ny = c - (r - 12) * math.cos(rad)
        # tail (muted) + head (cyan) needle.
        self.create_line(
            c,
            c,
            c - (r - 18) * math.sin(rad),
            c + (r - 18) * math.cos(rad),
            fill=orbital.FG_MUTED,
            width=2,
        )
        self.create_line(c, c, nx, ny, fill=orbital.CYAN, width=3)
        self.create_oval(c - 3, c - 3, c + 3, c + 3, fill=orbital.PAPER, outline="")
        self.create_text(
            c,
            self._size - 8,
            text=f"{self._heading:03.0f}°",
            fill=orbital.PAPER,
            font=("TkDefaultFont", 8, "bold"),
        )


class ArcGauge(tk.Canvas):
    """A 270-degree arc gauge filled to ``value / max_value`` (design gauge)."""

    def __init__(
        self,
        parent: tk.Misc,
        *,
        label: str,
        max_value: float = 100.0,
        colour: str = orbital.CYAN,
        unit: str = "",
        size: int = 96,
    ) -> None:
        """Build the gauge canvas."""
        super().__init__(parent, width=size, height=size, bg=orbital.NAVY, highlightthickness=0)
        self._size = size
        self._label = label
        self._max = max(1e-6, max_value)
        self._colour = colour
        self._unit = unit
        self._value = 0.0
        self.redraw()

    def set(self, value: float) -> None:
        """Set the gauge value and redraw."""
        self._value = float(value)
        self.redraw()

    @property
    def value(self) -> float:
        """Current value (used by tests)."""
        return self._value

    def redraw(self) -> None:
        """Repaint the track + value arc + readout."""
        self.delete("all")
        pad = 12
        box = (pad, pad, self._size - pad, self._size - pad)
        frac = min(1.0, max(0.0, self._value / self._max))
        # 270-degree sweep starting bottom-left (225) going clockwise.
        self.create_arc(*box, start=-45, extent=-270, style=tk.ARC, outline=orbital.BORDER, width=6)
        if frac > 0:
            self.create_arc(
                *box, start=-45, extent=-270 * frac, style=tk.ARC, outline=self._colour, width=6
            )
        c = self._size / 2
        self.create_text(
            c,
            c - 2,
            text=f"{self._value:.0f}{self._unit}",
            fill=orbital.PAPER,
            font=("TkDefaultFont", 11, "bold"),
        )
        self.create_text(
            c, c + 14, text=self._label, fill=orbital.FG_MUTED, font=("TkDefaultFont", 7)
        )
