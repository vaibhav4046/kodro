"""Time-travel debugger that scrubs through a recorded trace.

Pupils click "Replay" after a run and a modal :class:`ReplayDialog` opens.
A ``ttk.Scale`` slider scrubs through the recorded
:class:`robolearn.runtime.tracer.Event` list; each scrub updates a
read-out (event name, arguments, frame number, captured rover snapshot).

Implemented in Task 16 of the build plan.
"""

from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from tkinter import ttk

from robolearn.runtime.tracer import Event, Tracer

#: Format string for the read-out label.
_INFO_FORMAT: str = "Frame {frame:>4d} / {total} | {ts_ms:>6d} ms | {kind:<11s} {name}({args})"


@dataclass(slots=True)
class _Widgets:
    """References to the Tk widgets created by :class:`ReplayDialog`."""

    scale: ttk.Scale
    info_label: ttk.Label
    snapshot_label: ttk.Label
    canvas: tk.Canvas
    prev_btn: ttk.Button
    next_btn: ttk.Button


class ReplayDialog:
    """Modal time-travel debugger.

    Construct with a Tk parent and a :class:`Tracer`; call
    :meth:`destroy` when done. Tests can drive the dialog headlessly via
    :meth:`scrub_to` and :meth:`current_frame`.
    """

    def __init__(
        self,
        parent: tk.Misc,
        tracer: Tracer,
        *,
        on_scrub: Callable[[Event], None] | None = None,
    ) -> None:
        """Build the modal dialog."""
        self._tracer = tracer
        self._on_scrub = on_scrub
        self._events: tuple[Event, ...] = tuple(tracer.events())
        self._window = tk.Toplevel(parent)
        self._window.title("Time-travel debugger")
        self._window.transient(parent.winfo_toplevel())
        self._scrubbing = False
        self._widgets = self._build_widgets()
        self.scrub_to(0)

    # --- public API ---------------------------------------------------------

    def set_tracer(self, tracer: Tracer) -> None:
        """Swap in a different :class:`Tracer` and reset the slider."""
        self._tracer = tracer
        self._events = tuple(tracer.events())
        self._reconfigure_scale()
        self.scrub_to(0)

    def scrub_to(self, frame: int) -> None:
        """Move the slider to ``frame`` (clamped) and refresh the read-out."""
        total = len(self._events)
        if total == 0:
            self._widgets.info_label.configure(text="(no events recorded)")
            self._widgets.snapshot_label.configure(text="")
            return
        idx = max(0, min(int(frame), total - 1))
        # Setting the scale fires its command (_on_scale_move) again; guard
        # against re-entering scrub_to in an infinite callback loop.
        self._scrubbing = True
        try:
            self._widgets.scale.set(idx)
        finally:
            self._scrubbing = False
        event = self._events[idx]
        self._widgets.info_label.configure(
            text=_INFO_FORMAT.format(
                frame=idx,
                total=total - 1,
                ts_ms=event.ts_ms,
                kind=event.kind,
                name=event.name,
                args=", ".join(repr(a) for a in event.args),
            )
        )
        snapshot = event.rover_state
        if snapshot is None:
            self._widgets.snapshot_label.configure(text="(no snapshot at this frame)")
        else:
            self._widgets.snapshot_label.configure(
                text=(
                    f"pos ({snapshot.x:5.2f}, {snapshot.y:5.2f})  "
                    f"heading {snapshot.heading_deg:6.1f}°  "
                    f"battery {snapshot.battery_pct:5.1f}%  "
                    f"samples {snapshot.samples_collected}"
                )
            )
        self._draw_ghost_trail(idx)
        if self._on_scrub is not None:
            self._on_scrub(event)

    def _draw_ghost_trail(self, current_idx: int) -> None:
        """Paint a 320x200 mini-arena with translucent ghost positions."""
        c = self._widgets.canvas
        c.delete("all")
        c.create_rectangle(2, 2, 318, 198, outline="#30363d", width=1)
        snapshots = [
            (i, e.rover_state)
            for i, e in enumerate(self._events[: current_idx + 1])
            if e.rover_state is not None
        ]
        if not snapshots:
            c.create_text(160, 100, text="(no rover snapshots)", fill="#8b949e")
            return
        # Assume a 10x10 world for ghost-trail layout if no other info.
        world_w, world_h = 10.0, 10.0

        def to_screen(wx: float, wy: float) -> tuple[float, float]:
            sx = 4 + (wx / world_w) * 312
            sy = 196 - (wy / world_h) * 192
            return (sx, sy)

        # Translucent ghosts every 5 frames.
        for _i, snap in snapshots[::5]:
            gx, gy = to_screen(snap.x, snap.y)
            c.create_oval(gx - 5, gy - 5, gx + 5, gy + 5, fill="#1f6feb", outline="")
        # Current rover position on top.
        last = snapshots[-1][1]
        lx, ly = to_screen(last.x, last.y)
        c.create_oval(lx - 8, ly - 8, lx + 8, ly + 8, fill="#ff3c3c", outline="#ffffff")

    def current_frame(self) -> int:
        """Return the current slider position as an integer frame index."""
        return int(float(self._widgets.scale.get()))

    def step(self, delta: int) -> None:
        """Move the slider by ``delta`` frames (clamped)."""
        self.scrub_to(self.current_frame() + delta)

    def destroy(self) -> None:
        """Close the dialog."""
        self._window.destroy()

    # --- private ------------------------------------------------------------

    def _build_widgets(self) -> _Widgets:
        outer = ttk.Frame(self._window, padding=8)
        outer.pack(fill=tk.BOTH, expand=True)
        total = len(self._events)
        nav = ttk.Frame(outer)
        nav.pack(fill=tk.X, padx=4)
        prev_btn = ttk.Button(nav, text="◀", width=3, command=lambda: self.step(-1))
        prev_btn.pack(side=tk.LEFT)
        scale = ttk.Scale(
            nav,
            from_=0,
            to=max(0, total - 1),
            orient=tk.HORIZONTAL,
            command=self._on_scale_move,
        )
        scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=4)
        next_btn = ttk.Button(nav, text="▶", width=3, command=lambda: self.step(1))
        next_btn.pack(side=tk.LEFT)
        canvas = tk.Canvas(outer, width=320, height=200, bg="#0d1117", highlightthickness=0)
        canvas.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
        info_label = ttk.Label(outer, text="", font=("TkFixedFont", 10))
        info_label.pack(fill=tk.X, padx=4, pady=(8, 2))
        snapshot_label = ttk.Label(outer, text="", font=("TkFixedFont", 10))
        snapshot_label.pack(fill=tk.X, padx=4, pady=(0, 4))
        # Vim-style J / K / L stepping.
        self._window.bind("<KeyPress-j>", lambda _e: self.step(-1))
        self._window.bind("<KeyPress-l>", lambda _e: self.step(1))
        self._window.bind("<KeyPress-k>", lambda _e: self.step(0))
        return _Widgets(
            scale=scale,
            info_label=info_label,
            snapshot_label=snapshot_label,
            canvas=canvas,
            prev_btn=prev_btn,
            next_btn=next_btn,
        )

    def _reconfigure_scale(self) -> None:
        total = len(self._events)
        self._widgets.scale.configure(from_=0, to=max(0, total - 1))

    def _on_scale_move(self, raw: str) -> None:
        if self._scrubbing:
            return
        try:
            value = int(float(raw))
        except ValueError:
            return
        self.scrub_to(value)
