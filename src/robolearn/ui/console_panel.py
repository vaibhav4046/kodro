"""Console + hint-card panel.

Bottom strip of the main window. Two stacked sub-widgets:

* :class:`ConsolePanel` -- a read-only ``tk.Text`` that shows colour-coded
  log lines (info / warn / error / hint).
* :class:`HintCardArea` -- a small frame that surfaces hint cards from
  :mod:`robolearn.memory.hint_engine`.

Implemented in Task 15 of the build plan.
"""

from __future__ import annotations

import time
import tkinter as tk
from dataclasses import dataclass
from tkinter import ttk
from typing import Literal

from robolearn.memory.hint_engine import Hint
from robolearn.ui import orbital

#: Log levels surfaced by :class:`ConsolePanel`.
LogLevel = Literal["info", "warn", "error", "hint"]


@dataclass(slots=True)
class _ConsoleTags:
    """Tk tag names + colours per log level."""

    info: str = "lvl-info"
    warn: str = "lvl-warn"
    error: str = "lvl-error"
    hint: str = "lvl-hint"


class ConsolePanel(ttk.Frame):
    """Colour-coded log line view."""

    def __init__(self, parent: tk.Misc) -> None:
        """Build the console widget."""
        super().__init__(parent)
        self._text = tk.Text(self, height=8, state=tk.DISABLED, wrap=tk.WORD)
        scrollbar = ttk.Scrollbar(self, orient=tk.VERTICAL, command=self._text.yview)
        self._text.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self._text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self._tags = _ConsoleTags()
        # Orbital Rover console chrome: navy panel, warm-paper text, cyan
        # hints, brass warnings, danger errors.
        self._text.configure(background=orbital.NAVY, foreground=orbital.PAPER)
        self._text.tag_configure(self._tags.info, foreground=orbital.PAPER)
        self._text.tag_configure(self._tags.warn, foreground=orbital.WARNING)
        self._text.tag_configure(self._tags.error, foreground=orbital.DANGER)
        self._text.tag_configure(self._tags.hint, foreground=orbital.CYAN)
        self._line_count = 0
        # Remember the theme defaults so high-contrast mode can toggle back.
        self._default_bg = self._text.cget("background")
        self._default_fg = self._text.cget("foreground")

    # --- public API ---------------------------------------------------------

    def log(self, message: str, level: LogLevel = "info") -> None:
        """Append ``message`` with the colour for ``level``."""
        self._text.configure(state=tk.NORMAL)
        tag = getattr(self._tags, level)
        timestamp = time.strftime("%H:%M:%S")
        self._text.insert(tk.END, f"[{timestamp}] {message}\n", tag)
        self._text.see(tk.END)
        self._text.configure(state=tk.DISABLED)
        self._line_count += 1

    def clear(self) -> None:
        """Drop every line."""
        self._text.configure(state=tk.NORMAL)
        self._text.delete("1.0", tk.END)
        self._text.configure(state=tk.DISABLED)
        self._line_count = 0

    @property
    def line_count(self) -> int:
        """Number of lines emitted so far."""
        return self._line_count

    def text(self) -> str:
        """Return the full console contents (used by tests)."""
        return self._text.get("1.0", "end-1c")

    def set_font_size(self, size: int) -> None:
        """Rescale the console font (accessibility text scaling)."""
        self._text.configure(font=("TkFixedFont", size))

    def set_high_contrast(self, enabled: bool) -> None:
        """Switch the console to a pure black/white palette (or back)."""
        if enabled:
            self._text.configure(background="#000000", foreground="#ffffff")
        else:
            self._text.configure(background=self._default_bg, foreground=self._default_fg)


class HintCardArea(ttk.Frame):
    """Shows the top hint from :mod:`robolearn.memory.hint_engine`."""

    def __init__(self, parent: tk.Misc) -> None:
        """Build the hint card area."""
        super().__init__(parent)
        self._label = tk.Label(
            self,
            text="",
            anchor=tk.W,
            justify=tk.LEFT,
            wraplength=520,
            padx=8,
            pady=6,
            bg=orbital.NAVY_2,
            fg=orbital.WARNING,
        )
        self._label.pack(side=tk.TOP, fill=tk.X)
        self._rule_name: str | None = None

    def show(self, hint: Hint) -> None:
        """Render ``hint`` as a single visible balloon (amber)."""
        self._rule_name = hint.rule_name
        self._label.configure(text=f"💡  {hint.message}", fg="#d29922")

    def show_success(self, message: str) -> None:
        """Render a green pass banner (no hint rule attached)."""
        self._rule_name = None
        self._label.configure(text=f"✅  {message}", fg="#3fb950")

    def show_failure(self, message: str) -> None:
        """Render an orange not-passed banner when no specific hint matched."""
        self._rule_name = None
        self._label.configure(text=f"⚠  {message}", fg="#f0883e")

    def set_font_size(self, size: int) -> None:
        """Rescale the hint-card font (accessibility text scaling)."""
        self._label.configure(font=("TkDefaultFont", size))

    def clear(self) -> None:
        """Hide any visible hint."""
        self._rule_name = None
        self._label.configure(text="")

    def text(self) -> str:
        """Return the currently displayed banner text (used by tests)."""
        return str(self._label.cget("text"))

    @property
    def current_rule(self) -> str | None:
        """Rule name of the hint currently shown, or ``None``."""
        return self._rule_name
