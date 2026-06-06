"""Logical UI tests for the main-window shell (Task 11).

Tests run headlessly via ``tk.Tk()`` (xvfb on Linux CI). Pixel-level
visual regressions are out of scope -- the renderer tests cover that.
"""

from __future__ import annotations

import tkinter as tk

import pytest

from robolearn.ui.main_window import (
    DEFAULT_GEOMETRY,
    TEACHER_DASHBOARD_SHORTCUT,
    MainWindow,
)
from robolearn.ui.theme import ThemeSettings, available_themes, get_palette


@pytest.fixture
def window():  # type: ignore[no-untyped-def]
    try:
        win = MainWindow()
        win.root.withdraw()
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover - xvfb-guarded
        pytest.skip(f"Tk unavailable in this environment: {exc}")
    try:
        yield win
    finally:
        win.destroy()


# --- Theme module ----------------------------------------------------------


def test_available_themes_lists_three_built_in() -> None:
    themes = available_themes()
    assert set(themes) == {"dark", "light", "high_contrast"}


def test_get_palette_returns_default_for_unknown_name() -> None:
    palette = get_palette("not_a_real_theme")
    assert palette.name == "dark"


@pytest.mark.parametrize("name", ["dark", "light", "high_contrast"])
def test_palette_lookup_round_trip(name: str) -> None:
    assert get_palette(name).name == name


def test_theme_settings_with_theme_returns_copy() -> None:
    s = ThemeSettings()
    s2 = s.with_theme("light")
    assert s2.palette.name == "light"
    assert s.palette.name == "dark"  # original untouched


def test_dyslexia_font_toggle_affects_effective_ui_font() -> None:
    s = ThemeSettings(dyslexia_font=True)
    assert "Atkinson" in s.effective_ui_font()
    s_no = ThemeSettings(dyslexia_font=False)
    assert s_no.effective_ui_font() == "TkDefaultFont"


def test_high_contrast_theme_sets_flag_on_settings() -> None:
    s = ThemeSettings()
    s2 = s.with_theme("high_contrast")
    assert s2.high_contrast is True


# --- Main window shell -----------------------------------------------------


def test_main_window_creates_root_with_title(window: MainWindow) -> None:
    assert window.root is not None
    assert window.root.title() == "RoboLearn · Orbital Rover"


def test_default_geometry_constant_is_wxh_string() -> None:
    width, height = DEFAULT_GEOMETRY.split("x")
    assert int(width) > 0
    assert int(height) > 0


def test_main_window_exposes_five_slots(window: MainWindow) -> None:
    expected = {"topbar", "editor", "sim", "sensors", "console"}
    for slot in expected:
        assert window.get_slot(slot) is None  # initially empty
        # Set a stub widget and confirm get_slot returns it.
        stub = tk.Frame(window.frames.asdict()[slot])
        window.set_slot(slot, stub)
        assert window.get_slot(slot) is stub


def test_set_slot_replaces_previous_widget(window: MainWindow) -> None:
    first = tk.Frame(window.frames.asdict()["editor"])
    second = tk.Frame(window.frames.asdict()["editor"])
    window.set_slot("editor", first)
    window.set_slot("editor", second)
    assert window.get_slot("editor") is second


def test_set_slot_rejects_unknown_slot(window: MainWindow) -> None:
    with pytest.raises(KeyError):
        window.set_slot("nope", tk.Frame(window.root))


def test_apply_theme_changes_palette(window: MainWindow) -> None:
    assert window.palette.name == "dark"
    window.apply_theme("light")
    assert window.palette.name == "light"


def test_apply_theme_no_op_with_same_theme(window: MainWindow) -> None:
    palette_before = window.palette
    window.apply_theme()
    assert window.palette is palette_before


def test_teacher_dashboard_callback_fires_when_handler_called(
    window: MainWindow,
) -> None:
    triggered: list[int] = []
    window.on_open_teacher_dashboard(lambda: triggered.append(1))
    # Invoke the bound handler directly -- Tk's event_generate is
    # unreliable on hidden / withdrawn windows across platforms.
    window._on_teacher_shortcut(None)  # type: ignore[arg-type]
    assert triggered == [1]


def test_teacher_dashboard_no_callback_returns_none(window: MainWindow) -> None:
    # No callback registered yet -- handler should return None silently.
    assert window._on_teacher_shortcut(None) is None  # type: ignore[arg-type]


def test_teacher_dashboard_shortcut_constant_targets_ctrl_shift_t() -> None:
    assert "Control" in TEACHER_DASHBOARD_SHORTCUT
    assert "Shift" in TEACHER_DASHBOARD_SHORTCUT
    assert "T" in TEACHER_DASHBOARD_SHORTCUT


def test_destroy_is_idempotent(window: MainWindow) -> None:
    window.destroy()
    window.destroy()  # second call must not raise
