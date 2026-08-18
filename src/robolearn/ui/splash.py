"""Tiny launch splash screen.

Shows a small borderless Toplevel for ~250 ms while the main window
sets itself up. Centred on the primary monitor. Self-destroys.
"""

from __future__ import annotations

import tkinter as tk

from .. import __version__

#: Number of milliseconds the splash stays on screen.
SPLASH_DURATION_MS: int = 250

#: Width / height in pixels.
SPLASH_WIDTH_PX: int = 360
SPLASH_HEIGHT_PX: int = 140


def show_splash(parent: tk.Misc | None = None) -> tk.Toplevel:
    """Display the splash; return the Toplevel so caller can join on it."""
    if parent is None:
        owner: tk.Misc = tk.Tk()
        owner.withdraw()  # type: ignore[attr-defined]
    else:
        owner = parent
    top = tk.Toplevel(owner)
    top.overrideredirect(True)
    top.configure(bg="#0d1117")
    # Centre on screen.
    sw = top.winfo_screenwidth()
    sh = top.winfo_screenheight()
    x = (sw - SPLASH_WIDTH_PX) // 2
    y = (sh - SPLASH_HEIGHT_PX) // 2
    top.geometry(f"{SPLASH_WIDTH_PX}x{SPLASH_HEIGHT_PX}+{x}+{y}")
    inner = tk.Frame(top, bg="#161b22", bd=0)
    inner.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)
    tk.Label(
        inner,
        text="Kodro",
        font=("TkDefaultFont", 22, "bold"),
        fg="#58a6ff",
        bg="#161b22",
    ).pack(pady=(20, 4))
    tk.Label(
        inner,
        text=f"v{__version__} loading lessons…",
        fg="#8b949e",
        bg="#161b22",
    ).pack()
    top.update_idletasks()
    top.after(SPLASH_DURATION_MS, top.destroy)
    return top
