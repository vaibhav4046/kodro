"""Generate the Kodro app icon (assets/icon.ico) from the brand mark.

Reproducible: a dark rounded "world" tile with a trajectory swept across it
and the robot as a bright node at the head of its path, rendered at every
Windows icon size. Matches ORBIT_SVG in app.jsx. No binary asset has to be
checked in by hand.

Usage::

    python scripts/make_icon.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT = REPO_ROOT / "src" / "robolearn" / "assets" / "icon.ico"

NAVY = (15, 18, 32, 255)
NAVY_EDGE = (31, 36, 64, 255)
CYAN = (92, 224, 216, 255)
CYAN_DIM = (92, 224, 216, 77)


def _quad_bezier(p0, p1, p2, n=64):
    """Sample a quadratic Bezier (start, control, end) into a point list."""
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
        y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def draw_mark(size: int) -> Image.Image:
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # The tile itself is the "world".
    radius = s * 0.22
    d.rounded_rectangle(
        [0, 0, s - 1, s - 1], radius=radius, fill=NAVY, outline=NAVY_EDGE, width=max(1, s // 64)
    )

    # Map the ORBIT_SVG 64-unit coordinate space into a padded inner area.
    pad = s * 0.18
    span = s - 2 * pad

    def m(x, y):
        return (pad + x / 64.0 * span, pad + y / 64.0 * span)

    # Trajectory: M16 48 Q23 25 47 19
    traj = _quad_bezier(m(16, 48), m(23, 25), m(47, 19))
    d.line(traj, fill=CYAN, width=max(2, s // 28), joint="curve")

    # Start waypoint (dim).
    sx, sy = m(16, 48)
    sr = 2.8 / 64.0 * span
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=CYAN_DIM)

    # Robot node: bright solid dot at the head of the path.
    rx, ry = m(47, 19)
    rr = 6.2 / 64.0 * span
    d.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], fill=CYAN)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    base = draw_mark(256)
    base.save(OUT, format="ICO", sizes=[(n, n) for n in sizes])
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, sizes {sizes})")


if __name__ == "__main__":
    main()
