"""Canvas chart + mini-map tests (P2 polish task)."""

from __future__ import annotations

import tkinter as tk

import pytest

from kodro.ui.charts import MAX_POINTS, ArcGauge, Compass, LineChart, MiniMap


@pytest.fixture
def root():  # type: ignore[no-untyped-def]
    try:
        r = tk.Tk()
        r.withdraw()
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        pytest.skip(f"Tk unavailable: {exc}")
    try:
        yield r
    finally:
        r.destroy()


# --- Compass + ArcGauge -------------------------------------------


def test_compass_wraps_heading(root: tk.Tk) -> None:
    c = Compass(root)
    c.set_heading(450.0)
    assert c.heading == 90.0
    assert len(c.find_all()) > 0  # drew dial + needle


def test_arcgauge_stores_value_and_draws(root: tk.Tk) -> None:
    g = ArcGauge(root, label="BATTERY", max_value=100.0, unit="%")
    g.set(75.0)
    assert g.value == 75.0
    assert len(g.find_all()) > 0


# --- LineChart ----------------------------------------------------


def test_linechart_starts_empty(root: tk.Tk) -> None:
    chart = LineChart(root, label="x")
    assert chart.data == ()


def test_linechart_push_appends(root: tk.Tk) -> None:
    chart = LineChart(root, label="x")
    chart.push(1.0)
    chart.push(2.0)
    chart.push(3.0)
    assert chart.data == (1.0, 2.0, 3.0)


def test_linechart_downsamples_past_max_points(root: tk.Tk) -> None:
    chart = LineChart(root, label="x")
    for i in range(MAX_POINTS + 50):
        chart.push(float(i))
    assert len(chart.data) == MAX_POINTS


def test_linechart_clear_empties(root: tk.Tk) -> None:
    chart = LineChart(root, label="x")
    chart.push(5.0)
    chart.clear()
    assert chart.data == ()


def test_linechart_redraw_draws_label_when_empty(root: tk.Tk) -> None:
    chart = LineChart(root, label="LIDAR")
    chart.redraw()
    items = chart.find_all()
    assert items  # label text should render


def test_linechart_warning_band_present_when_below_threshold(root: tk.Tk) -> None:
    chart = LineChart(root, label="x", warn_below=20.0)
    chart.push(10.0)
    items = chart.find_all()
    # At least one of the items must be a rectangle (the warn band).
    types = {chart.type(i) for i in items}
    assert "rectangle" in types


# --- MiniMap ------------------------------------------------------


def test_minimap_starts_empty(root: tk.Tk) -> None:
    mm = MiniMap(root)
    assert mm.trail == ()


def test_minimap_push_appends_trail(root: tk.Tk) -> None:
    mm = MiniMap(root)
    mm.push_position(1.0, 1.0)
    mm.push_position(2.0, 2.0)
    assert mm.trail == ((1.0, 1.0), (2.0, 2.0))


def test_minimap_clear_empties_trail(root: tk.Tk) -> None:
    mm = MiniMap(root)
    mm.push_position(1.0, 1.0)
    mm.clear()
    assert mm.trail == ()


def test_minimap_set_world_bounds_clamps_zero(root: tk.Tk) -> None:
    mm = MiniMap(root)
    mm.set_world_bounds(0.0, 0.0)
    mm.push_position(1.0, 1.0)
    # No exception means clamping worked (would divide by zero otherwise).


def test_minimap_downsamples_past_max_points(root: tk.Tk) -> None:
    mm = MiniMap(root)
    for i in range(MAX_POINTS + 50):
        mm.push_position(float(i), float(i))
    assert len(mm.trail) == MAX_POINTS
