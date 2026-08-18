"""Mission-control design-token + helper tests (Tk-free)."""

from __future__ import annotations

from pathlib import Path

import robolearn
from robolearn.ui import orbital

# Read app.py as text rather than importing it: the mission bar can only be
# built with a live Tk root, which this host does not have, and a skipped test
# would not guard the wordmark at all.
_APP_SOURCE = (Path(robolearn.__file__).parent / "app.py").read_text(encoding="utf-8")


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


def test_product_name_is_the_shipped_brand() -> None:
    # The web hub header renders "Kodro" (assets/web/app.jsx, .brand-name).
    # The desktop mission bar has to say the same thing.
    assert orbital.PRODUCT_NAME == "Kodro"
    assert orbital.PRODUCT_TAGLINE == "TEST BEFORE YOU BUILD"


def test_mission_bar_reads_the_brand_from_the_token_module() -> None:
    assert "text=orbital.PRODUCT_NAME" in _APP_SOURCE
    assert "text=orbital.PRODUCT_TAGLINE" in _APP_SOURCE


def test_desktop_ui_shows_no_prototype_wordmark() -> None:
    # Regression: the mission bar shipped the prototype's own name, so the
    # desktop window introduced itself as a different product to anyone
    # watching a demo.
    for stale in ('"Orbital Rover"', '"ROVER SIMULATOR"'):
        assert stale not in _APP_SOURCE
