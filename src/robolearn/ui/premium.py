"""Premium canvas-drawing helpers: gradients, rounded rects, glow, easing.

Tk's canvas has no native gradient, alpha, or rounded primitives. These
pure functions fake all three with cheap integer maths so the simulator
viewport reads as a modern, designed surface rather than flat fills.
Every helper is deterministic and unit-testable.
"""

from __future__ import annotations

import tkinter as tk


def lerp(a: float, b: float, t: float) -> float:
    """Linear interpolate ``a`` -> ``b`` by ``t`` in ``[0, 1]``."""
    return a + (b - a) * t


def lerp_colour(
    c0: tuple[int, int, int], c1: tuple[int, int, int], t: float
) -> tuple[int, int, int]:
    """Interpolate two RGB colours by ``t`` and clamp to ``[0, 255]``."""
    t = max(0.0, min(1.0, t))
    return (
        round(lerp(c0[0], c1[0], t)),
        round(lerp(c0[1], c1[1], t)),
        round(lerp(c0[2], c1[2], t)),
    )


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    """Format an RGB triple as ``#rrggbb``."""
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def ease_in_out_quintic(t: float) -> float:
    """Quintic ease-in-out over ``t`` in ``[0, 1]`` (smooth start + stop)."""
    t = max(0.0, min(1.0, t))
    if t < 0.5:
        return 16.0 * t * t * t * t * t
    f = (2.0 * t) - 2.0
    return 0.5 * f * f * f * f * f + 1.0


def draw_vertical_gradient(
    canvas: tk.Canvas,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    top: tuple[int, int, int],
    bottom: tuple[int, int, int],
    *,
    bands: int = 48,
) -> None:
    """Paint a top→bottom gradient as ``bands`` horizontal rectangles."""
    height = y1 - y0
    if height <= 0 or bands <= 0:
        return
    band_h = max(1, height // bands)
    y = y0
    i = 0
    while y < y1:
        t = i / max(1, bands - 1)
        colour = rgb_to_hex(lerp_colour(top, bottom, t))
        canvas.create_rectangle(x0, y, x1, min(y + band_h, y1), fill=colour, outline=colour)
        y += band_h
        i += 1


def draw_glow_circle(
    canvas: tk.Canvas,
    cx: float,
    cy: float,
    radius: float,
    core: tuple[int, int, int],
    halo_bg: tuple[int, int, int],
    *,
    layers: int = 4,
) -> None:
    """Draw a soft glow: faint outer halos fading to a solid core circle."""
    for i in range(layers, 0, -1):
        frac = i / layers
        r = radius * (1.0 + frac * 1.4)
        colour = rgb_to_hex(lerp_colour(halo_bg, core, 1.0 - frac * 0.7))
        canvas.create_oval(cx - r, cy - r, cx + r, cy + r, fill=colour, outline="")
    canvas.create_oval(
        cx - radius, cy - radius, cx + radius, cy + radius, fill=rgb_to_hex(core), outline=""
    )


def rounded_rect_points(x0: float, y0: float, x1: float, y1: float, r: float) -> list[float]:
    """Return a flat point list approximating a rounded rectangle polygon."""
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    return [
        x0 + r,
        y0,
        x1 - r,
        y0,
        x1,
        y0,
        x1,
        y0 + r,
        x1,
        y1 - r,
        x1,
        y1,
        x1 - r,
        y1,
        x0 + r,
        y1,
        x0,
        y1,
        x0,
        y1 - r,
        x0,
        y0 + r,
        x0,
        y0,
    ]
