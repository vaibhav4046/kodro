"""Console + hint-card panel tests (Task 15)."""

from __future__ import annotations

import tkinter as tk

import pytest

from kodro.memory.hint_engine import Hint
from kodro.ui.console_panel import ConsolePanel, HintCardArea


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


def test_console_starts_empty(root: tk.Tk) -> None:
    panel = ConsolePanel(root)
    assert panel.line_count == 0
    assert panel.text() == ""


def test_console_log_appends_line(root: tk.Tk) -> None:
    panel = ConsolePanel(root)
    panel.log("hello rover")
    assert "hello rover" in panel.text()
    assert panel.line_count == 1


def test_console_log_records_each_level(root: tk.Tk) -> None:
    panel = ConsolePanel(root)
    panel.log("info line", level="info")
    panel.log("warn line", level="warn")
    panel.log("error line", level="error")
    panel.log("hint line", level="hint")
    assert panel.line_count == 4


def test_console_clear_resets_count(root: tk.Tk) -> None:
    panel = ConsolePanel(root)
    panel.log("x")
    panel.clear()
    assert panel.line_count == 0
    assert panel.text() == ""


def test_console_is_read_only_to_user(root: tk.Tk) -> None:
    panel = ConsolePanel(root)
    # The underlying Text widget should be disabled outside log() calls.
    assert panel._text["state"] == tk.DISABLED  # type: ignore[attr-defined]


def test_hint_card_starts_blank(root: tk.Tk) -> None:
    area = HintCardArea(root)
    assert area.current_rule is None


def test_hint_card_show_records_rule_name(root: tk.Tk) -> None:
    area = HintCardArea(root)
    area.show(Hint(rule_name="while_no_progress", message="Try adding a move."))
    assert area.current_rule == "while_no_progress"


def test_hint_card_show_renders_message(root: tk.Tk) -> None:
    area = HintCardArea(root)
    area.show(Hint(rule_name="x", message="Hello hint"))
    assert "Hello hint" in area._label.cget("text")  # type: ignore[attr-defined]


def test_hint_card_clear_resets_rule(root: tk.Tk) -> None:
    area = HintCardArea(root)
    area.show(Hint(rule_name="x", message="msg"))
    area.clear()
    assert area.current_rule is None


def test_hint_card_show_success_green_banner(root: tk.Tk) -> None:
    area = HintCardArea(root)
    area.show(Hint(rule_name="x", message="msg"))  # leave a stale rule
    area.show_success("Mission complete! Score 100/100")
    assert area.current_rule is None  # success carries no rule
    assert "Mission complete" in area.text()
    assert "✅" in area.text()


def test_hint_card_show_failure_orange_banner(root: tk.Tk) -> None:
    area = HintCardArea(root)
    area.show_failure("Not passed yet — score 60/100.")
    assert area.current_rule is None
    assert "Not passed yet" in area.text()


def test_hint_card_text_roundtrips(root: tk.Tk) -> None:
    area = HintCardArea(root)
    area.show(Hint(rule_name="r", message="do the thing"))
    assert "do the thing" in area.text()
