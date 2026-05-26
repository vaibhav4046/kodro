"""Main Tk window layout -- topbar, editor, sim panel, sensors, console.

Section 8.1 of the spec fixes the overall layout. This module owns the
:class:`MainWindow` shell; each subsequent build-plan task fills one of
the named slots (editor in Task 12, sim panel in Task 13, sensors / lessons
panels in Task 14, console + hint cards in Task 15, replay dialog in
Task 16, teacher dashboard in Task 17).

The shell is testable without a real display: tests create a Tk root via
``tk.Tk()`` (xvfb on Linux CI), build a :class:`MainWindow`, and assert
the widget tree, theme colours, and slot wiring.
"""

from __future__ import annotations

import contextlib
import tkinter as tk
from dataclasses import dataclass
from tkinter import ttk
from typing import Any

from .theme import Palette, ThemeName, ThemeSettings

#: Hidden hotkey that opens the teacher dashboard (Section 8.4).
TEACHER_DASHBOARD_SHORTCUT: str = "<Control-Shift-T>"

#: Default window size on cold start. Picked to fit a 1280x720 laptop.
DEFAULT_GEOMETRY: str = "1180x720"

#: Slot identifiers used by :meth:`MainWindow.set_slot`.
SlotName = str  # "topbar", "editor", "sim", "sensors", "lessons", "console"


@dataclass(slots=True)
class _SlotFrames:
    """The five Tk frames that make up the main window."""

    topbar: ttk.Frame
    editor: ttk.Frame
    sim: ttk.Frame
    sensors: ttk.Frame
    console: ttk.Frame

    def asdict(self) -> dict[str, ttk.Frame]:
        """Return the frames keyed by slot name."""
        return {
            "topbar": self.topbar,
            "editor": self.editor,
            "sim": self.sim,
            "sensors": self.sensors,
            "console": self.console,
        }


class MainWindow:
    """Owns the Tk root and arranges the five panel slots.

    The class is deliberately a thin facade: every interesting behaviour
    lives in the child panels. The main window only manages the layout,
    the theme, and the global keyboard shortcuts.
    """

    def __init__(
        self,
        root: tk.Misc | None = None,
        *,
        settings: ThemeSettings | None = None,
        geometry: str = DEFAULT_GEOMETRY,
    ) -> None:
        """Build the shell on ``root`` (or create a fresh ``tk.Tk()``).

        Args:
            root: An existing Tk-derived widget. ``None`` (the default)
                creates a hidden ``tk.Tk()`` -- useful for tests.
            settings: Theme settings; defaults to a dark theme.
            geometry: Window size in Tk geometry syntax.
        """
        owns_root = root is None
        if root is None:
            self._root = tk.Tk()
        else:
            self._root = _ensure_root(root)
        self._owns_root = owns_root
        self.settings: ThemeSettings = settings or ThemeSettings()
        if owns_root:
            self._root.title("RoboLearn")
            self._root.geometry(geometry)
            self._root.minsize(960, 600)
        self._style = ttk.Style(self._root)
        self.frames: _SlotFrames = self._build_layout()
        self._slots: dict[SlotName, tk.Widget | None] = {
            "topbar": None,
            "editor": None,
            "sim": None,
            "sensors": None,
            "console": None,
        }
        self.apply_theme()
        self._teacher_callback: Any = None
        self._root.bind_all(TEACHER_DASHBOARD_SHORTCUT, self._on_teacher_shortcut)

    # --- public API ---------------------------------------------------------

    @property
    def root(self) -> tk.Tk:
        """Return the Tk root window."""
        return self._root

    @property
    def palette(self) -> Palette:
        """Return the active palette."""
        return self.settings.palette

    def apply_theme(self, name: ThemeName | str | None = None) -> None:
        """Apply ``name`` (or the current settings' palette) to every frame."""
        if name is not None:
            self.settings = self.settings.with_theme(name)
        palette = self.settings.palette
        if self._owns_root:
            self._root.configure(bg=palette.bg)
        self._style.theme_use("clam")
        self._style.configure("Robo.TFrame", background=palette.bg)
        self._style.configure(
            "Robo.Topbar.TFrame",
            background=palette.bg_alt,
            borderwidth=1,
            relief="flat",
        )
        for frame in self.frames.asdict().values():
            frame.configure(style="Robo.TFrame")
        self.frames.topbar.configure(style="Robo.Topbar.TFrame")

    def set_slot(self, slot: SlotName, widget: tk.Widget) -> None:
        """Place ``widget`` inside the named slot's frame.

        Tests pass small ``tk.Frame`` stubs; real panels (Tasks 12-17)
        supply their own widget subclasses.
        """
        if slot not in self._slots:
            raise KeyError(f"unknown slot: {slot}")
        previous = self._slots[slot]
        if previous is not None:
            previous.destroy()
        widget.pack(in_=self.frames.asdict()[slot], fill=tk.BOTH, expand=True)
        self._slots[slot] = widget

    def get_slot(self, slot: SlotName) -> tk.Widget | None:
        """Return the widget installed in ``slot`` (or ``None``)."""
        return self._slots.get(slot)

    def on_open_teacher_dashboard(self, callback: Any) -> None:
        """Register ``callback`` to fire when ``Ctrl+Shift+T`` is pressed."""
        self._teacher_callback = callback

    def destroy(self) -> None:
        """Tear down the shell. Idempotent."""
        with contextlib.suppress(tk.TclError):
            self._root.destroy()

    # --- private ------------------------------------------------------------

    def _build_layout(self) -> _SlotFrames:
        """Create the five slot frames and grid them per Section 8.1."""
        topbar = ttk.Frame(self._root, height=44)
        topbar.grid(row=0, column=0, columnspan=3, sticky="ew")
        editor = ttk.Frame(self._root)
        editor.grid(row=1, column=0, sticky="nsew")
        sim = ttk.Frame(self._root)
        sim.grid(row=1, column=1, sticky="nsew")
        sensors = ttk.Frame(self._root)
        sensors.grid(row=1, column=2, sticky="nsew")
        console = ttk.Frame(self._root, height=140)
        console.grid(row=2, column=0, columnspan=3, sticky="ew")
        # Column weights: editor 2 / sim 4 / sensors 2.
        self._root.grid_columnconfigure(0, weight=2)
        self._root.grid_columnconfigure(1, weight=4)
        self._root.grid_columnconfigure(2, weight=2)
        self._root.grid_rowconfigure(1, weight=1)
        return _SlotFrames(topbar=topbar, editor=editor, sim=sim, sensors=sensors, console=console)

    def _on_teacher_shortcut(self, _event: tk.Event[tk.Misc]) -> str | None:
        if self._teacher_callback is None:
            return None
        self._teacher_callback()
        return "break"


def _ensure_root(widget: tk.Misc) -> tk.Tk:
    """Return the Tk root for any widget."""
    root = widget.winfo_toplevel()
    if isinstance(root, tk.Tk):
        return root
    return widget._root()  # type: ignore[attr-defined,no-any-return]
