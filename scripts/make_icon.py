"""Generate the RoboLearn app icon (assets/icon.ico) from the orbit mark.

Reproducible: a dark rounded square, a tilted cyan orbit ring, planet dot and
satellite dot -- the brand mark from the mission bar -- rendered at every
Windows icon size. No binary asset has to be checked in by hand.

Usage::

    python scripts/make_icon.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT = REPO_ROOT / "src" / "robolearn" / "assets" / "icon.ico"

NAVY = (15, 18, 32, 255)
NAVY_EDGE = (31, 36, 64, 255)
CYAN = (92, 224, 216, 255)
PAPER = (245, 240, 228, 255)


def draw_mark(size: int) -> Image.Image:
    """Render the orbit mark at ``size``x``size`` (4x supersampled)."""
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded-square tile.
    radius = s * 0.22
    d.rounded_rectangle(
        [0, 0, s - 1, s - 1], radius=radius, fill=NAVY, outline=NAVY_EDGE, width=max(1, s // 64)
    )

    cx = cy = s / 2

    # Planet.
    pr = s * 0.16
    d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=PAPER)

    # Tilted orbit ring (ellipse approximated by rotated points).
    a, b = s * 0.34, s * 0.13  # semi-axes
    tilt = math.radians(-24)
    pts = []
    for i in range(120):
        t = 2 * math.pi * i / 120
        x, y = a * math.cos(t), b * math.sin(t)
        xr = x * math.cos(tilt) - y * math.sin(tilt)
        yr = x * math.sin(tilt) + y * math.cos(tilt)
        pts.append((cx + xr, cy + yr))
    d.line([*pts, pts[0]], fill=CYAN, width=max(2, s // 36), joint="curve")

    # Satellite dot on the ring.
    t = math.radians(40)
    x, y = a * math.cos(t), b * math.sin(t)
    xr = x * math.cos(tilt) - y * math.sin(tilt)
    yr = x * math.sin(tilt) + y * math.cos(tilt)
    sr = s * 0.055
    d.ellipse([cx + xr - sr, cy + yr - sr, cx + xr + sr, cy + yr + sr], fill=CYAN)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    base = draw_mark(256)
    base.save(OUT, format="ICO", sizes=[(n, n) for n in sizes])
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, sizes {sizes})")


if __name__ == "__main__":
    main()
