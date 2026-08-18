"""Shared helper to surface a Toplevel above the main window on open."""

from __future__ import annotations

import tkinter as tk


def bring_to_front(window: tk.Toplevel, *, flash_ms: int = 300) -> None:
    """Lift ``window`` to the top and briefly pin it topmost, then release."""
    try:
        window.lift()
        window.attributes("-topmost", True)
        window.after(flash_ms, lambda: window.attributes("-topmost", False))
        window.focus_force()
    except tk.TclError:  # pragma: no cover - platform-specific
        pass
