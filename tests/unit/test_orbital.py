"""Orbital Rover design-token + helper tests (Tk-free)."""

from __future__ import annotations

from robolearn.ui import orbital


def test_status_colour_and_label_known_states() -> None:
    assert orbital.status_colour("run") == orbital.CYAN
    assert orbital.status_colour("error") == orbital.DANGER
    assert orbital.status_colour("done") == orbital.SUCCESS
    assert orbital.status_label("idle") == "IDLE"
    assert orbital.status_label("done") == "COMPLETE"


def test_status_colour_unknown_falls_back_to_cyan() -> None:
    assert orbital.status_colour("nonsense") == orbital.CYAN


def test_clamp_speed_bounds() -> None:
    assert orbital.clamp_speed(0.01) == orbital.MIN_SPEED
    assert orbital.clamp_speed(99.0) == orbital.MAX_SPEED
    assert orbital.clamp_speed(1.0) == 1.0


def test_scaled_delay_inverse_with_speed() -> None:
    base = 90
    assert orbital.scaled_delay(base, 1.0) == 90
    assert orbital.scaled_delay(base, 2.0) == 45  # faster -> shorter
    assert orbital.scaled_delay(base, 0.5) == 180  # slower -> longer
    # never zero, even at max speed
    assert orbital.scaled_delay(1, orbital.MAX_SPEED) >= 1
