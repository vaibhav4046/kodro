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

#: Default pixel dimensions for the embedded simulation surface.
DEFAULT_SIM_SIZE_PX: tuple[int, int] = (480, 480)


@dataclass(slots=True)
class SimCallbacks:
    """Optional callbacks fired by the sim panel."""

    on_frame: Callable[[], None] | None = None


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


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
            background="#0d1117",
            highlightthickness=0,
            bd=0,
        )
        self._canvas.pack(fill=tk.BOTH, expand=True)
        self._world: World | None = None
        self._rover: Rover | None = None
        self._particles: ParticleSystem | None = None
        self._celebrating = False
        self._draw_blank()

    # --- public API ---------------------------------------------------------

    @property
    def surface(self) -> pygame.Surface:
        """Return the underlying pygame :class:`Surface` (used by tests)."""
        return self._surface

    def set_world(self, world: World, rover: Rover) -> None:
        """Bind a world + rover and paint one frame."""
        self._world = world
        self._rover = rover
        self._particles = system_for_terrain(world.terrain)
        self.render_once()

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
        view = renderer.transform_for(self._surface, self._world)
        w = self._canvas.winfo_reqwidth() or self._size_px[0]
        h = self._canvas.winfo_reqheight() or self._size_px[1]
        base_colour = TERRAIN_COLOURS[self._world.terrain]
        # 1) terrain gradient background (darker top -> base colour bottom).
        top = premium.lerp_colour(base_colour, (10, 12, 18), 0.55)
        premium.draw_vertical_gradient(self._canvas, 0, 0, w, h, top, base_colour, bands=40)
        # 1b) faint metre grid.
        self._draw_grid(view, w, h)
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
        self._canvas.create_rectangle(6, 6, 196, 26, fill="#0d1117", outline="#30363d", width=1)
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

    def _draw_grid(self, view: renderer.ViewTransform, w: int, h: int) -> None:
        """Draw a faint metre grid for depth."""
        if self._world is None:
            return
        scale_x = w / max(0.1, self._world.bounds.width)
        scale_y = h / max(0.1, self._world.bounds.height)
        step = 1.0
        x = 0.0
        while x <= self._world.bounds.width + 1e-9:
            sx = round(x * scale_x)
            self._canvas.create_line(sx, 0, sx, h, fill="#ffffff", width=1, stipple="gray12")
            x += step
        y = 0.0
        while y <= self._world.bounds.height + 1e-9:
            sy = round(h - y * scale_y)
            self._canvas.create_line(0, sy, w, sy, fill="#ffffff", width=1, stipple="gray12")
            y += step

    def _draw_rover(self, view: renderer.ViewTransform) -> None:
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
        self._canvas.configure(background="#0d1117")
        self._canvas.create_text(
            self._size_px[0] // 2,
            self._size_px[1] // 2,
            text="Pick a lesson on the right and press Run.",
            fill="#8b949e",
            font=("TkDefaultFont", 10),
        )
