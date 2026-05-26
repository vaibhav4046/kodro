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
        self.render_once()

    def render_once(self) -> None:
        """Composite a frame onto the canvas."""
        if self._world is None or self._rover is None:
            return
        self._canvas.delete("all")
        view = renderer.transform_for(self._surface, self._world)
        # 1) terrain background
        self._canvas.configure(background=_rgb_to_hex(TERRAIN_COLOURS[self._world.terrain]))
        # 2) base station
        bx, by = view.to_screen(*self._world.base)
        self._canvas.create_oval(
            bx - 12,
            by - 12,
            bx + 12,
            by + 12,
            fill=_rgb_to_hex(COLOUR_BASE_INDICATOR),
            outline="",
        )
        # 3) obstacles
        for obstacle in self._world.obstacles:
            cx, cy = view.to_screen(obstacle.x, obstacle.y)
            r = max(2, round(obstacle.radius * view.scale_x))
            self._canvas.create_oval(
                cx - r,
                cy - r,
                cx + r,
                cy + r,
                fill="#222222",
                outline="#444444",
                width=1,
            )
        # 4) uncollected samples
        for sample in self._world.samples:
            if sample.collected:
                continue
            sx, sy = view.to_screen(sample.x, sample.y)
            self._canvas.create_oval(
                sx - 7,
                sy - 7,
                sx + 7,
                sy + 7,
                fill=_rgb_to_hex(COLOUR_SAMPLE_INDICATOR),
                outline="#000000",
                width=1,
            )
        # 5) rover (body circle + heading triangle)
        rx, ry = view.to_screen(self._rover.state.x, self._rover.state.y)
        body_r = 16
        self._canvas.create_oval(
            rx - body_r,
            ry - body_r,
            rx + body_r,
            ry + body_r,
            fill="#dcdcdc",
            outline="#000000",
            width=1,
        )
        rad = math.radians(self._rover.state.heading_deg)
        tip_x = rx + round(body_r * math.cos(rad))
        tip_y = ry - round(body_r * math.sin(rad))
        left_rad = rad + math.radians(140)
        right_rad = rad - math.radians(140)
        left_x = rx + round(body_r * math.cos(left_rad))
        left_y = ry - round(body_r * math.sin(left_rad))
        right_x = rx + round(body_r * math.cos(right_rad))
        right_y = ry - round(body_r * math.sin(right_rad))
        self._canvas.create_polygon(
            tip_x,
            tip_y,
            left_x,
            left_y,
            right_x,
            right_y,
            fill="#ff3c3c",
            outline="#000000",
            width=1,
        )
        # 6) coordinate text in corner
        self._canvas.create_text(
            6,
            6,
            anchor=tk.NW,
            text=(
                f"pos ({self._rover.state.x:.1f}, {self._rover.state.y:.1f})  "
                f"heading {self._rover.state.heading_deg:.0f}°"
            ),
            fill="#ffffff",
            font=("TkFixedFont", 9),
        )
        if self._callbacks.on_frame is not None:
            self._callbacks.on_frame()

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
