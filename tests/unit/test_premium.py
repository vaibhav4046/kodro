"""Premium canvas-helper tests (pure functions, no Tk needed)."""

from __future__ import annotations

import pytest

from robolearn.ui.premium import (
    ease_in_out_quintic,
    lerp,
    lerp_colour,
    rgb_to_hex,
    rounded_rect_points,
)


def test_lerp_endpoints() -> None:
    assert lerp(0.0, 10.0, 0.0) == 0.0
    assert lerp(0.0, 10.0, 1.0) == 10.0
    assert lerp(0.0, 10.0, 0.5) == 5.0


def test_lerp_colour_midpoint() -> None:
    assert lerp_colour((0, 0, 0), (255, 255, 255), 0.5) == (128, 128, 128)


def test_lerp_colour_clamps() -> None:
    assert lerp_colour((0, 0, 0), (255, 255, 255), -1.0) == (0, 0, 0)
    assert lerp_colour((0, 0, 0), (255, 255, 255), 2.0) == (255, 255, 255)


def test_rgb_to_hex() -> None:
    assert rgb_to_hex((255, 215, 0)) == "#ffd700"
    assert rgb_to_hex((0, 0, 0)) == "#000000"


@pytest.mark.parametrize("t", [0.0, 0.25, 0.5, 0.75, 1.0])
def test_ease_in_out_quintic_bounds(t: float) -> None:
    out = ease_in_out_quintic(t)
    assert 0.0 <= out <= 1.0


def test_ease_in_out_quintic_endpoints() -> None:
    assert ease_in_out_quintic(0.0) == 0.0
    assert ease_in_out_quintic(1.0) == pytest.approx(1.0)


def test_ease_in_out_quintic_symmetry() -> None:
    # Quintic ease-in-out is symmetric about t=0.5.
    assert ease_in_out_quintic(0.3) == pytest.approx(1.0 - ease_in_out_quintic(0.7), abs=1e-9)


def test_ease_clamps_out_of_range() -> None:
    assert ease_in_out_quintic(-1.0) == 0.0
    assert ease_in_out_quintic(2.0) == pytest.approx(1.0)


def test_rounded_rect_points_length() -> None:
    pts = rounded_rect_points(0, 0, 100, 50, 10)
    assert len(pts) % 2 == 0
    assert len(pts) >= 8
