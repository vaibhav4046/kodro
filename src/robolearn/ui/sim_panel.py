"""Simulation viewport rendered with tk.Canvas (Task 13 / post-build polish).

Earlier this module pushed each frame as a base64-PPM PhotoImage; that
path painted blank on some Tk builds because PhotoImage silently
rejects the format. We now draw the world directly with native canvas
items (no PhotoImage, no SDL handoff), which is what every classroom
machine renders reliably. The pygame Surface is still kept around so
the headless renderer tests in :mod:`robolearn.engine.renderer` stay
green.
"""

from __future__ import annotations

import math
import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from tkinter import ttk

import pygame

from robolearn.engine import renderer
from robolearn.engine.particles import ParticleSystem, system_for_terrain
from robolearn.engine.rover import Rover
from robolearn.engine.sensors import (
    COLOUR_BASE_INDICATOR,
    COLOUR_SAMPLE_INDICATOR,
    TERRAIN_COLOURS,
)
from robolearn.engine.world import World
from robolearn.ui import orbital

#: Default pixel dimensions for the embedded simulation surface.
DEFAULT_SIM_SIZE_PX: tuple[int, int] = (480, 480)


@dataclass(slots=True)
class SimCallbacks:
    """Optional callbacks fired by the sim panel."""

    on_frame: Callable[[], None] | None = None


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


#: Fraction of the viewport height given to the sky (above the horizon).
_HORIZON_FRAC: float = 0.16

#: How far the far edge of the floor is squeezed toward the centre (0..1).
_FAR_SQUEEZE: float = 0.42


class _PerspectiveView:
    """Wrap a flat :class:`renderer.ViewTransform` into a tilted 3-D floor.

    The design's hero viewport is a 3-D diorama. tk.Canvas has no real 3-D,
    so we fake it: take the flat top-down ``(sx, sy)`` and project it onto a
    receding ground plane — rows higher up the screen sit nearer the horizon
    and squeeze toward the centre, so straight world lines converge. Because
    every element (grid, trail, rover, obstacles) draws through
    ``view.to_screen``, wrapping the view tilts the whole scene at once.
    """

    def __init__(self, flat: renderer.ViewTransform, w: int, h: int) -> None:
        """Build the perspective wrapper around ``flat`` for a ``w``x``h`` canvas."""
        self._flat = flat
        self._w = w
        self._h = h
        self._horizon = h * _HORIZON_FRAC
        self.scale_x = getattr(flat, "scale_x", 1.0) * 0.72
        self.scale_y = getattr(flat, "scale_y", 1.0)

    def to_screen(self, wx: float, wy: float) -> tuple[float, float]:
        """Project a world point onto the tilted floor."""
        sx, sy = self._flat.to_screen(wx, wy)
        floor = self._h - self._horizon
        py = self._horizon + floor * (sy / self._h)
        depth = (py - self._horizon) / max(1.0, floor)  # 0 far .. 1 near
        scale = _FAR_SQUEEZE + (1.0 - _FAR_SQUEEZE) * depth
        cx = self._w / 2
        px = cx + (sx - cx) * scale
        return (px, py)


class SimPanel(ttk.Frame):
    """A Tk widget that paints the engine world onto a :class:`tk.Canvas`."""

    def __init__(
        self,
        parent: tk.Misc,
        *,
        size_px: tuple[int, int] = DEFAULT_SIM_SIZE_PX,
        callbacks: SimCallbacks | None = None,
    ) -> None:
        """Build the sim panel."""
        super().__init__(parent)
        self._size_px = size_px
        self._callbacks = callbacks or SimCallbacks()
        renderer.init_headless()
        # The pygame Surface is kept so the existing renderer tests still
        # have something to assert against. It is no longer used to push
        # pixels into the UI.
        self._surface: pygame.Surface = renderer.make_surface(size_px)
        self._canvas = tk.Canvas(
            self,
            width=size_px[0],
            height=size_px[1],
            background=orbital.VOID,
            highlightthickness=0,
            bd=0,
        )
        self._canvas.pack(fill=tk.BOTH, expand=True)
        self._world: World | None = None
        self._rover: Rover | None = None
        self._particles: ParticleSystem | None = None
        self._celebrating = False
        self._trail: list[tuple[float, float]] = []
        self._perspective = True  # 3-D diorama by default (the design's hero)
        self._draw_blank()

    # --- public API ---------------------------------------------------------

    def set_perspective(self, enabled: bool) -> None:
        """Toggle the 3-D perspective floor (vs a flat top-down view)."""
        self._perspective = bool(enabled)
        if self._world is not None:
            self.render_once()

    @property
    def is_perspective(self) -> bool:
        """Whether the 3-D perspective floor is active (used by tests)."""
        return self._perspective

    @property
    def surface(self) -> pygame.Surface:
        """Return the underlying pygame :class:`Surface` (used by tests)."""
        return self._surface

    def set_world(self, world: World, rover: Rover) -> None:
        """Bind a world + rover and paint one frame (clears the pen trail)."""
        self._world = world
        self._rover = rover
        self._particles = system_for_terrain(world.terrain)
        self._trail = []
        self.render_once()

    @property
    def trail(self) -> tuple[tuple[float, float], ...]:
        """Snapshot of the rover's recorded pen trail (used by tests)."""
        return tuple(self._trail)

    def refresh(self) -> None:
        """Repaint the current world + rover without resetting particles."""
        self.render_once()

    #: Confetti palette for the celebration overlay.
    _CONFETTI = ("#f0883e", "#3fb950", "#58a6ff", "#d29922", "#ff7b72", "#a371f7")

    def celebrate(self) -> None:
        """Draw a static confetti + 'mission complete' overlay on the canvas.

        It is painted on top of the current frame and cleared by the next
        :meth:`render_once` (i.e. the next Run or Reset), so there is no
        timer/animation -- safe to call from any thread or platform.
        """
        canvas = self._canvas
        width = canvas.winfo_reqwidth() or self._size_px[0]
        height = canvas.winfo_reqheight() or self._size_px[1]
        for i in range(48):
            x = (i * 53) % max(8, width - 8)
            y = (i * 29) % max(8, height - 14)
            colour = self._CONFETTI[i % len(self._CONFETTI)]
            canvas.create_rectangle(x, y, x + 6, y + 10, fill=colour, outline="", tags="celebrate")
        canvas.create_text(
            width // 2,
            height // 2,
            text="🎉  MISSION COMPLETE  🎉",
            fill="#3fb950",
            font=("TkDefaultFont", 16, "bold"),
            tags="celebrate",
        )
        self._celebrating = True

    @property
    def is_celebrating(self) -> bool:
        """Whether a celebration overlay is currently painted (used by tests)."""
        return self._celebrating

    def render_once(self) -> None:
        """Composite a premium-styled frame onto the canvas."""
        if self._world is None or self._rover is None:
            return
        from robolearn.ui import premium

        self._canvas.delete("all")
        self._celebrating = False  # any celebration overlay is now cleared
        w = self._canvas.winfo_reqwidth() or self._size_px[0]
        h = self._canvas.winfo_reqheight() or self._size_px[1]
        flat = renderer.transform_for(self._surface, self._world)
        view: renderer.ViewTransform | _PerspectiveView = (
            _PerspectiveView(flat, w, h) if self._perspective else flat
        )
        base_colour = TERRAIN_COLOURS[self._world.terrain]
        # 1) backdrop: a sky band + receding ground split by a horizon when in
        #    3-D, or a single flat gradient in top-down mode.
        if self._perspective:
            horizon_y = round(h * _HORIZON_FRAC)
            sky_haze = premium.lerp_colour(base_colour, (22, 26, 38), 0.55)
            premium.draw_vertical_gradient(
                self._canvas, 0, 0, w, horizon_y, (8, 9, 15), sky_haze, bands=24
            )
            ground_top = premium.lerp_colour(base_colour, (255, 255, 255), 0.10)
            premium.draw_vertical_gradient(
                self._canvas, 0, horizon_y, w, h, ground_top, base_colour, bands=40
            )
            self._canvas.create_line(
                0, horizon_y, w, horizon_y, fill=_rgb_to_hex(sky_haze), width=2
            )
        else:
            top = premium.lerp_colour(base_colour, (10, 12, 18), 0.55)
            premium.draw_vertical_gradient(self._canvas, 0, 0, w, h, top, base_colour, bands=40)
        # 1b) faint metre grid (receding into the horizon in 3-D).
        self._draw_grid(view, w, h)
        # 1c) rover pen trail (Orbital Rover cyan), recorded as it drives.
        pos = (self._rover.state.x, self._rover.state.y)
        if not self._trail or self._trail[-1] != pos:
            self._trail.append(pos)
            if len(self._trail) > 400:
                self._trail = self._trail[-400:]
        if len(self._trail) >= 2:
            pts: list[float] = []
            for tx, ty in self._trail:
                sx, sy = view.to_screen(tx, ty)
                pts.extend((sx, sy))
            self._canvas.create_line(*pts, fill=orbital.CYAN, width=2, smooth=True)
        # 2) particles BELOW everything else so trails sit under the rover.
        if self._particles is not None:
            self._particles.emit(self._rover.state.x, self._rover.state.y, count=2)
            self._particles.update(0.05)
            for p in self._particles.alive():
                px, py = view.to_screen(p.x, p.y)
                self._canvas.create_oval(
                    px - p.radius_px,
                    py - p.radius_px,
                    px + p.radius_px,
                    py + p.radius_px,
                    fill=_rgb_to_hex(p.colour),
                    outline="",
                )
        # 3) base station with a green glow.
        bx, by = view.to_screen(*self._world.base)
        premium.draw_glow_circle(
            self._canvas, bx, by, 11, COLOUR_BASE_INDICATOR, base_colour, layers=4
        )
        # 4) obstacles with a soft drop shadow.
        for obstacle in self._world.obstacles:
            cx, cy = view.to_screen(obstacle.x, obstacle.y)
            r = max(3, round(obstacle.radius * view.scale_x))
            self._canvas.create_oval(
                cx - r + 2, cy - r + 3, cx + r + 2, cy + r + 3, fill="#05070b", outline=""
            )
            self._canvas.create_oval(
                cx - r, cy - r, cx + r, cy + r, fill="#1b1f27", outline="#3a3f4a", width=1
            )
        # 5) uncollected samples — pulsing gold glow.
        for sample in self._world.samples:
            if sample.collected:
                continue
            sx, sy = view.to_screen(sample.x, sample.y)
            premium.draw_glow_circle(
                self._canvas, sx, sy, 6, COLOUR_SAMPLE_INDICATOR, base_colour, layers=4
            )
        # 6) rover: shadow, body, ring, heading cone.
        self._draw_rover(view)
        # 7) HUD chip top-left.
        st = self._rover.state
        self._canvas.create_rectangle(
            6, 6, 196, 26, fill=orbital.NAVY, outline=orbital.BORDER, width=1
        )
        self._canvas.create_text(
            12,
            16,
            anchor=tk.W,
            text=(
                f"pos ({st.x:.1f}, {st.y:.1f})   "
                f"hdg {st.heading_deg:.0f}°   bat {st.battery_pct:.0f}%"
            ),
            fill="#c9d1d9",
            font=("TkFixedFont", 9),
        )
        if self._callbacks.on_frame is not None:
            self._callbacks.on_frame()

    def _draw_grid(self, view: renderer.ViewTransform | _PerspectiveView, w: int, h: int) -> None:
        """Draw a metre grid via ``view`` so it recedes in 3-D / squares in 2-D."""
        if self._world is None:
            return
        bw = self._world.bounds.width
        bh = self._world.bounds.height
        step = 1.0
        x = 0.0
        while x <= bw + 1e-9:
            x0, y0 = view.to_screen(x, 0.0)
            x1, y1 = view.to_screen(x, bh)
            self._canvas.create_line(x0, y0, x1, y1, fill="#ffffff", width=1, stipple="gray12")
            x += step
        y = 0.0
        while y <= bh + 1e-9:
            x0, y0 = view.to_screen(0.0, y)
            x1, y1 = view.to_screen(bw, y)
            self._canvas.create_line(x0, y0, x1, y1, fill="#ffffff", width=1, stipple="gray12")
            y += step

    def _draw_rover(self, view: renderer.ViewTransform | _PerspectiveView) -> None:
        """Draw a premium rover: shadow, gradient body, accent ring, cone."""
        if self._rover is None:
            return
        rx, ry = view.to_screen(self._rover.state.x, self._rover.state.y)
        body_r = 15
        rad = math.radians(self._rover.state.heading_deg)
        # Drop shadow.
        self._canvas.create_oval(
            rx - body_r + 2,
            ry - body_r + 4,
            rx + body_r + 2,
            ry + body_r + 4,
            fill="#04060a",
            outline="",
        )
        # Heading cone (direction beam).
        cone_len = 34
        spread = math.radians(26)
        cone = [
            rx,
            ry,
            rx + cone_len * math.cos(rad - spread),
            ry - cone_len * math.sin(rad - spread),
            rx + cone_len * math.cos(rad + spread),
            ry - cone_len * math.sin(rad + spread),
        ]
        self._canvas.create_polygon(cone, fill="#1f6feb", outline="", stipple="gray25")
        # Body.
        self._canvas.create_oval(
            rx - body_r, ry - body_r, rx + body_r, ry + body_r, fill="#e8ecf1", outline=""
        )
        # Accent ring.
        self._canvas.create_oval(
            rx - body_r, ry - body_r, rx + body_r, ry + body_r, outline="#58a6ff", width=3
        )
        # Heading nub.
        nub_x = rx + (body_r - 3) * math.cos(rad)
        nub_y = ry - (body_r - 3) * math.sin(rad)
        self._canvas.create_oval(
            nub_x - 4, nub_y - 4, nub_x + 4, nub_y + 4, fill="#ff3c3c", outline=""
        )

    def clear(self) -> None:
        """Detach the bound world/rover and paint a blank background."""
        self._world = None
        self._rover = None
        self._draw_blank()

    # --- private ------------------------------------------------------------

    def _draw_blank(self) -> None:
        self._canvas.delete("all")
        self._canvas.configure(background=orbital.VOID)
        self._canvas.create_text(
            self._size_px[0] // 2,
            self._size_px[1] // 2,
            text="Pick a lesson on the right and press Run.",
            fill="#8b949e",
            font=("TkDefaultFont", 10),
        )
