"""Code editor panel with Run / Step / Stop / Reset buttons.

The editor is intentionally a ``tk.Text`` widget rather than an external
syntax-highlighting library so the desktop install stays lean. A small
regex-based highlighter recolours keywords, strings, comments and
:mod:`robolearn.rover_api` function names whenever the text changes.

Implemented in Task 12 of the build plan.
"""

from __future__ import annotations

import re
import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from tkinter import ttk

from robolearn import rover_api

from .theme import Palette, ThemeSettings, get_palette

#: Highlight tag names used by the regex highlighter.
TAG_KEYWORD: str = "kw"
TAG_BUILTIN: str = "bi"
TAG_STRING: str = "str"
TAG_COMMENT: str = "com"
TAG_NUMBER: str = "num"

#: Python keywords highlighted in the editor (a curated subset; full list
#: would obscure pupil-facing logic).
_KEYWORDS: frozenset[str] = frozenset(
    {
        "and",
        "or",
        "not",
        "if",
        "elif",
        "else",
        "for",
        "while",
        "break",
        "continue",
        "def",
        "return",
        "True",
        "False",
        "None",
        "in",
        "is",
        "pass",
        "import",
        "from",
        "class",
        "with",
        "as",
        "try",
        "except",
        "finally",
        "raise",
        "yield",
    }
)

#: All public rover-API names — highlighted distinctly so pupils spot them.
_BUILTINS: frozenset[str] = frozenset(rover_api.__all__)


@dataclass(slots=True)
class EditorCallbacks:
    """Optional callbacks the parent UI registers."""

    on_run: Callable[[str], None] | None = None
    on_step: Callable[[str], None] | None = None
    on_stop: Callable[[], None] | None = None
    on_reset: Callable[[], None] | None = None
    on_change: Callable[[str], None] | None = None


@dataclass(slots=True)
class _ButtonRefs:
    """Holds references to the four action buttons for tests."""

    run: ttk.Button
    step: ttk.Button
    stop: ttk.Button
    reset: ttk.Button


class EditorPanel(ttk.Frame):
    """Code editor + action buttons.

    Construct with a Tk parent and an optional :class:`EditorCallbacks`;
    install via :meth:`MainWindow.set_slot('editor', editor_panel)`.
    """

    def __init__(
        self,
        parent: tk.Misc,
        *,
        callbacks: EditorCallbacks | None = None,
        settings: ThemeSettings | None = None,
        initial_source: str = "",
    ) -> None:
        """Build the editor."""
        super().__init__(parent)
        self._callbacks = callbacks or EditorCallbacks()
        self._settings = settings or ThemeSettings()
        self._build_widgets()
        self.set_source(initial_source)

    # --- public API ---------------------------------------------------------

    def get_source(self) -> str:
        """Return the editor's current source text (without trailing newline)."""
        text = self._text.get("1.0", "end-1c")
        return text

    def set_source(self, source: str) -> None:
        """Replace the editor contents with ``source`` and re-highlight."""
        self._text.delete("1.0", tk.END)
        self._text.insert("1.0", source)
        self._highlight()
        if self._callbacks.on_change is not None:
            self._callbacks.on_change(source)

    def clear(self) -> None:
        """Empty the editor (alias for ``set_source('')``)."""
        self.set_source("")

    def set_font_size(self, size: int) -> None:
        """Rescale the code font, keeping the configured family."""
        self._text.configure(font=(self._settings.effective_code_font(), size))

    def apply_palette(self, palette: Palette | str) -> None:
        """Re-style the editor with the given palette."""
        if isinstance(palette, str):
            palette = get_palette(palette)
        self._settings = self._settings.with_theme(palette.name)
        self._text.configure(
            background=palette.bg_alt,
            foreground=palette.fg,
            insertbackground=palette.accent,
            selectbackground=palette.accent,
            selectforeground=palette.bg,
            font=(self._settings.effective_code_font(), 11),
        )
        self._text.tag_configure(TAG_KEYWORD, foreground=palette.accent)
        self._text.tag_configure(TAG_BUILTIN, foreground=palette.ok)
        self._text.tag_configure(TAG_STRING, foreground=palette.warn)
        self._text.tag_configure(TAG_COMMENT, foreground=palette.fg_muted)
        self._text.tag_configure(TAG_NUMBER, foreground=palette.error)

    # --- button properties for tests ---------------------------------------

    @property
    def buttons(self) -> _ButtonRefs:
        """Return references to the four action buttons (mainly for tests)."""
        return self._buttons

    # --- private ------------------------------------------------------------

    def _build_widgets(self) -> None:
        toolbar = ttk.Frame(self)
        toolbar.pack(side=tk.TOP, fill=tk.X, padx=2, pady=2)

        run_btn = ttk.Button(toolbar, text="Run", command=self._on_run)
        run_btn.pack(side=tk.LEFT, padx=2)
        step_btn = ttk.Button(toolbar, text="Step", command=self._on_step)
        step_btn.pack(side=tk.LEFT, padx=2)
        stop_btn = ttk.Button(toolbar, text="Stop", command=self._on_stop)
        stop_btn.pack(side=tk.LEFT, padx=2)
        reset_btn = ttk.Button(toolbar, text="Reset", command=self._on_reset)
        reset_btn.pack(side=tk.LEFT, padx=2)
        self._buttons = _ButtonRefs(run=run_btn, step=step_btn, stop=stop_btn, reset=reset_btn)

        self._text = tk.Text(self, wrap=tk.NONE, undo=True, tabs="4c")
        scrollbar = ttk.Scrollbar(self, orient=tk.VERTICAL, command=self._text.yview)
        self._text.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self._text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self._text.bind("<<Modified>>", self._on_modified)

        self.apply_palette(self._settings.palette)

    def _on_run(self) -> None:
        if self._callbacks.on_run is not None:
            self._callbacks.on_run(self.get_source())

    def _on_step(self) -> None:
        if self._callbacks.on_step is not None:
            self._callbacks.on_step(self.get_source())

    def _on_stop(self) -> None:
        if self._callbacks.on_stop is not None:
            self._callbacks.on_stop()

    def _on_reset(self) -> None:
        if self._callbacks.on_reset is not None:
            self._callbacks.on_reset()

    def _on_modified(self, _event: tk.Event[tk.Misc]) -> None:
        """Re-highlight when the editor is edited; reset the Modified flag."""
        if not self._text.edit_modified():
            return
        self._highlight()
        if self._callbacks.on_change is not None:
            self._callbacks.on_change(self.get_source())
        self._text.edit_modified(False)

    # --- highlighting -------------------------------------------------------

    def _highlight(self) -> None:
        source = self.get_source()
        for tag in (TAG_KEYWORD, TAG_BUILTIN, TAG_STRING, TAG_COMMENT, TAG_NUMBER):
            self._text.tag_remove(tag, "1.0", tk.END)
        for kind, pattern in _PATTERNS:
            for match in pattern.finditer(source):
                start, end = match.span()
                if kind == "word":
                    word = match.group()
                    if word in _KEYWORDS:
                        self._tag(TAG_KEYWORD, start, end)
                    elif word in _BUILTINS:
                        self._tag(TAG_BUILTIN, start, end)
                elif kind == "string":
                    self._tag(TAG_STRING, start, end)
                elif kind == "comment":
                    self._tag(TAG_COMMENT, start, end)
                elif kind == "number":
                    self._tag(TAG_NUMBER, start, end)

    def _tag(self, name: str, start: int, end: int) -> None:
        self._text.tag_add(
            name,
            f"1.0+{start}c",
            f"1.0+{end}c",
        )


# --- module-level regex patterns ------------------------------------------

_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("comment", re.compile(r"#[^\n]*")),
    ("string", re.compile(r"(?:\".*?\"|'.*?')")),
    ("number", re.compile(r"\b\d+(?:\.\d+)?\b")),
    ("word", re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*\b")),
)
