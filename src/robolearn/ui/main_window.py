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


def _lerp_hex(c1: str, c2: str, t: float) -> str:
    """Linear blend between two ``#rrggbb`` colours (``t`` in ``[0, 1]``)."""
    a = (int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16))
    b = (int(c2[1:3], 16), int(c2[3:5], 16), int(c2[5:7], 16))
    m = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return f"#{m[0]:02x}{m[1]:02x}{m[2]:02x}"


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
            self._root.title("RoboLearn · Orbital Rover")
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
        self._apply_ttk_palette(palette)
        for frame in self.frames.asdict().values():
            frame.configure(style="Robo.TFrame")
        self.frames.topbar.configure(style="Robo.Topbar.TFrame")

    def _apply_ttk_palette(self, palette: Palette) -> None:
        """Restyle every ttk widget class to the palette (clam honours this).

        Without this the ttk widgets keep clam's light-grey default, which
        clashes badly with the dark "Orbital Rover" chrome. clam is fully
        re-colourable via ``style.configure``/``map`` (unlike the image-based
        themes), so we paint buttons, scales, scrollbars, entries and frames
        to match.
        """
        s = self._style
        bg, bg_alt, fg = palette.bg, palette.bg_alt, palette.fg
        fg_muted, accent, border = palette.fg_muted, palette.accent, palette.border
        hover = _lerp_hex(bg_alt, fg, 0.14)
        press = _lerp_hex(bg_alt, fg, 0.22)
        ui_font = self.settings.effective_ui_font()

        # Base: everything inherits these unless overridden.
        s.configure(
            ".",
            background=bg,
            foreground=fg,
            fieldbackground=bg_alt,
            bordercolor=border,
            lightcolor=bg_alt,
            darkcolor=bg_alt,
            troughcolor=bg_alt,
            arrowcolor=fg_muted,
            insertcolor=fg,
            focuscolor=accent,
            font=(ui_font, 10),
        )
        s.configure("Robo.TFrame", background=bg)
        s.configure("Robo.Topbar.TFrame", background=bg_alt, borderwidth=0, relief="flat")
        s.configure("TFrame", background=bg)
        s.configure("TLabel", background=bg, foreground=fg)
        s.configure("TLabelframe", background=bg, bordercolor=border)
        s.configure("TLabelframe.Label", background=bg, foreground=fg_muted)

        # Ghost buttons (the design's default control: outlined, transparent).
        s.configure(
            "TButton",
            background=bg_alt,
            foreground=fg,
            bordercolor=border,
            relief="flat",
            padding=(12, 5),
            anchor="center",
        )
        s.map(
            "TButton",
            background=[("disabled", bg), ("pressed", press), ("active", hover)],
            foreground=[("disabled", fg_muted)],
            bordercolor=[("active", fg_muted), ("focus", accent)],
        )
        # Accent button (the cyan "Run" / primary action).
        s.configure(
            "Accent.TButton",
            background=accent,
            foreground=bg,
            bordercolor=accent,
            relief="flat",
            padding=(12, 5),
        )
        s.map(
            "Accent.TButton",
            background=[
                ("disabled", bg_alt),
                ("pressed", _lerp_hex(accent, bg, 0.30)),
                ("active", _lerp_hex(accent, bg, 0.15)),
            ],
            foreground=[("disabled", fg_muted)],
        )

        # Sliders, scrollbars, separators, entries.
        for scale in ("Horizontal.TScale", "Vertical.TScale", "TScale"):
            s.configure(scale, background=accent, troughcolor=bg_alt, bordercolor=border)
        for sb in ("Vertical.TScrollbar", "Horizontal.TScrollbar"):
            s.configure(sb, background=bg_alt, troughcolor=bg, bordercolor=bg, arrowcolor=fg_muted)
            s.map(sb, background=[("active", border)])
        s.configure("TSeparator", background=border)
        s.configure("TEntry", fieldbackground=bg_alt, foreground=fg, bordercolor=border)
        s.configure("TCombobox", fieldbackground=bg_alt, foreground=fg, bordercolor=border)
        s.configure("TCheckbutton", background=bg, foreground=fg)
        s.map("TCheckbutton", background=[("active", bg)])
        s.configure("TRadiobutton", background=bg, foreground=fg)
        s.map("TRadiobutton", background=[("active", bg)])
        s.configure("TNotebook", background=bg, bordercolor=border)
        s.configure("TNotebook.Tab", background=bg_alt, foreground=fg_muted, padding=(10, 4))
        s.map(
            "TNotebook.Tab",
            background=[("selected", bg)],
            foreground=[("selected", fg)],
        )

    def set_slot(self, slot: SlotName, widget: tk.Widget) -> None:
        """Place ``widget`` inside the named slot's frame.

        The widget must already have the slot frame as its parent;
        :meth:`set_slot` packs it with fill=BOTH, expand=True. Mixing
        pack-with-`in_=` and grid in the same window caused painting
        glitches on some Tk builds, so we pack directly.
        """
        if slot not in self._slots:
            raise KeyError(f"unknown slot: {slot}")
        previous = self._slots[slot]
        if previous is not None:
            previous.destroy()
        widget.pack(fill=tk.BOTH, expand=True)
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
        topbar.grid_propagate(False)
        editor = ttk.Frame(self._root, width=320, height=480)
        editor.grid(row=1, column=0, sticky="nsew")
        editor.pack_propagate(False)
        sim = ttk.Frame(self._root, width=520, height=480)
        sim.grid(row=1, column=1, sticky="nsew")
        sim.pack_propagate(False)
        sensors = ttk.Frame(self._root, width=300, height=480)
        sensors.grid(row=1, column=2, sticky="nsew")
        sensors.pack_propagate(False)
        console = ttk.Frame(self._root, height=180)
        console.grid(row=2, column=0, columnspan=3, sticky="ew")
        console.pack_propagate(False)
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
