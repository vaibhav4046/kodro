"""Editor-panel unit tests (Task 12)."""

from __future__ import annotations

import tkinter as tk

import pytest

from robolearn.ui.editor_panel import (
    TAG_BUILTIN,
    TAG_COMMENT,
    TAG_KEYWORD,
    TAG_NUMBER,
    TAG_STRING,
    EditorCallbacks,
    EditorPanel,
)


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


@pytest.fixture
def panel(root: tk.Tk) -> EditorPanel:
    return EditorPanel(root, initial_source="move_forward(3)")


def test_initial_source_round_trips(panel: EditorPanel) -> None:
    assert panel.get_source() == "move_forward(3)"


def test_set_source_replaces_contents(panel: EditorPanel) -> None:
    panel.set_source("turn_left(90)\nmove_forward(5)\n")
    assert panel.get_source().startswith("turn_left(90)")


def test_high_contrast_toggles_editor_colours(panel: EditorPanel) -> None:
    default_bg = panel._text.cget("background")  # type: ignore[attr-defined]
    panel.set_high_contrast(True)
    assert panel._text.cget("background") == "#000000"  # type: ignore[attr-defined]
    assert panel._text.cget("foreground") == "#ffffff"  # type: ignore[attr-defined]
    panel.set_high_contrast(False)
    assert panel._text.cget("background") == default_bg  # type: ignore[attr-defined]


def test_set_font_size_changes_font(panel: EditorPanel) -> None:
    panel.set_font_size(20)
    # tk returns the font spec; the size component should be present.
    assert "20" in str(panel._text.cget("font"))  # type: ignore[attr-defined]


def test_clear_empties_editor(panel: EditorPanel) -> None:
    panel.clear()
    assert panel.get_source() == ""


def test_on_change_fires_on_set_source(root: tk.Tk) -> None:
    changes: list[str] = []
    cb = EditorCallbacks(on_change=lambda s: changes.append(s))
    EditorPanel(root, callbacks=cb, initial_source="x = 1")
    assert changes == ["x = 1"]


def test_run_button_invokes_on_run(panel: EditorPanel) -> None:
    received: list[str] = []
    panel._callbacks.on_run = received.append  # type: ignore[attr-defined]
    panel.buttons.run.invoke()
    assert received == ["move_forward(3)"]


def test_step_button_invokes_on_step(panel: EditorPanel) -> None:
    received: list[str] = []
    panel._callbacks.on_step = received.append  # type: ignore[attr-defined]
    panel.buttons.step.invoke()
    assert received == ["move_forward(3)"]


def test_stop_button_invokes_on_stop(panel: EditorPanel) -> None:
    fired: list[int] = []
    panel._callbacks.on_stop = lambda: fired.append(1)  # type: ignore[attr-defined]
    panel.buttons.stop.invoke()
    assert fired == [1]


def test_reset_button_invokes_on_reset(panel: EditorPanel) -> None:
    fired: list[int] = []
    panel._callbacks.on_reset = lambda: fired.append(1)  # type: ignore[attr-defined]
    panel.buttons.reset.invoke()
    assert fired == [1]


def test_buttons_with_no_callbacks_are_silent(panel: EditorPanel) -> None:
    # Default panel has no callbacks; clicking must not raise.
    panel.buttons.run.invoke()
    panel.buttons.step.invoke()
    panel.buttons.stop.invoke()
    panel.buttons.reset.invoke()


def test_apply_palette_changes_text_background(root: tk.Tk) -> None:
    panel = EditorPanel(root)
    panel.apply_palette("light")
    bg = panel._text.cget("background")  # type: ignore[attr-defined]
    # Light palette uses #f6f8fa for bg_alt.
    assert bg == "#f6f8fa"


def test_keyword_highlight_applied(panel: EditorPanel) -> None:
    panel.set_source("if True:\n    move_forward(3)\n")
    # tag_ranges returns flat list of indices when keyword present.
    ranges = panel._text.tag_ranges(TAG_KEYWORD)  # type: ignore[attr-defined]
    assert ranges  # non-empty -- some keyword tagged


def test_builtin_highlight_applied(panel: EditorPanel) -> None:
    panel.set_source("move_forward(5)\n")
    ranges = panel._text.tag_ranges(TAG_BUILTIN)  # type: ignore[attr-defined]
    assert ranges


def test_string_highlight_applied(panel: EditorPanel) -> None:
    panel.set_source('log("hello")\n')
    ranges = panel._text.tag_ranges(TAG_STRING)  # type: ignore[attr-defined]
    assert ranges


def test_comment_highlight_applied(panel: EditorPanel) -> None:
    panel.set_source("# drive\nmove_forward(1)\n")
    ranges = panel._text.tag_ranges(TAG_COMMENT)  # type: ignore[attr-defined]
    assert ranges


def test_number_highlight_applied(panel: EditorPanel) -> None:
    panel.set_source("move_forward(42)\n")
    ranges = panel._text.tag_ranges(TAG_NUMBER)  # type: ignore[attr-defined]
    assert ranges


def test_tags_cleared_when_source_replaced(panel: EditorPanel) -> None:
    panel.set_source("# comment\n")
    panel.set_source("plain text")  # no comment any more
    ranges = panel._text.tag_ranges(TAG_COMMENT)  # type: ignore[attr-defined]
    assert ranges == ()
