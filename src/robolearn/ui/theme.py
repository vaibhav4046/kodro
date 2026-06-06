"""Theme system: dark / light, high contrast, dyslexia-friendly font toggle.

Section 8.2 of the spec fixes the high-level appearance rules; this module
keeps them in one place so every UI panel reads from the same palette.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

#: Built-in theme identifiers.
ThemeName = Literal["dark", "light", "high_contrast"]

#: Atkinson Hyperlegible is shipped via :mod:`robolearn.assets.fonts` for
#: WCAG-friendly UI text; JetBrains Mono is used for the code editor.
DEFAULT_UI_FONT: str = "Atkinson Hyperlegible"
DEFAULT_CODE_FONT: str = "JetBrains Mono"

#: Fallback fonts when the bundled fonts cannot be loaded by Tk.
FALLBACK_UI_FONT: str = "TkDefaultFont"
FALLBACK_CODE_FONT: str = "TkFixedFont"


@dataclass(frozen=True, slots=True)
class Palette:
    """RGB colours and font selections that make up one theme."""

    name: ThemeName
    bg: str
    bg_alt: str
    fg: str
    fg_muted: str
    accent: str
    warn: str
    error: str
    ok: str
    border: str
    ui_font: str = DEFAULT_UI_FONT
    code_font: str = DEFAULT_CODE_FONT


# Dark theme retuned to the "Orbital Rover" mission-control palette
# (void / navy chrome, phosphor-cyan accent, warm paper text) from the
# Claude Design handoff -- see robolearn.ui.orbital for the source tokens.
_DARK_PALETTE: Palette = Palette(
    name="dark",
    bg="#08090f",
    bg_alt="#161a2d",
    fg="#f5f0e4",
    fg_muted="#9a958a",
    accent="#5ce0d8",
    warn="#e0b45c",
    error="#d06a6a",
    ok="#7cc49b",
    border="#2a2d3d",
)


_LIGHT_PALETTE: Palette = Palette(
    name="light",
    bg="#ffffff",
    bg_alt="#f6f8fa",
    fg="#24292f",
    fg_muted="#57606a",
    accent="#0969da",
    warn="#bf8700",
    error="#cf222e",
    ok="#1a7f37",
    border="#d0d7de",
)


_HIGH_CONTRAST_PALETTE: Palette = Palette(
    name="high_contrast",
    bg="#000000",
    bg_alt="#111111",
    fg="#ffffff",
    fg_muted="#cccccc",
    accent="#ffff00",
    warn="#ffaa00",
    error="#ff4040",
    ok="#00ff66",
    border="#ffffff",
)


_PALETTES: dict[ThemeName, Palette] = {
    "dark": _DARK_PALETTE,
    "light": _LIGHT_PALETTE,
    "high_contrast": _HIGH_CONTRAST_PALETTE,
}


def get_palette(name: ThemeName | str) -> Palette:
    """Return the :class:`Palette` for ``name`` (default if unknown)."""
    try:
        return _PALETTES[name]  # type: ignore[index]
    except KeyError:
        return _DARK_PALETTE


def available_themes() -> tuple[ThemeName, ...]:
    """Return every built-in theme identifier."""
    return tuple(_PALETTES.keys())


@dataclass(slots=True)
class ThemeSettings:
    """Mutable UI preferences resolved at runtime."""

    palette: Palette = field(default_factory=lambda: _DARK_PALETTE)
    dyslexia_font: bool = True
    high_contrast: bool = False

    def with_theme(self, name: ThemeName | str) -> ThemeSettings:
        """Return a copy of these settings with ``name`` applied."""
        return ThemeSettings(
            palette=get_palette(name),
            dyslexia_font=self.dyslexia_font,
            high_contrast=self.high_contrast or (name == "high_contrast"),
        )

    def effective_ui_font(self) -> str:
        """Return the UI font to use, honouring the dyslexia toggle."""
        return self.palette.ui_font if self.dyslexia_font else FALLBACK_UI_FONT

    def effective_code_font(self) -> str:
        """Return the editor font (always monospaced)."""
        return self.palette.code_font
