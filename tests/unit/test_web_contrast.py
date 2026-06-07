"""WCAG 2.1 contrast checks for the web UI's key text tokens.

The re-score panel noted the new lesson-card verdict colours weren't
contrast-tested. This parses the actual hex tokens out of ``styles.css`` and
asserts the text/background pairs a pupil reads clear the WCAG AA threshold
(4.5:1 for body text, 3:1 for large/bold UI text). Pure -- no browser.
"""

from __future__ import annotations

import re
from pathlib import Path

STYLES = Path(__file__).resolve().parents[2] / "src" / "robolearn" / "assets" / "web" / "styles.css"


def _tokens() -> dict[str, str]:
    """Pull ``--name:#hex`` custom properties from :root in styles.css."""
    text = STYLES.read_text(encoding="utf-8")
    return {m[0]: m[1] for m in re.findall(r"--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})", text)}


def _luminance(hex_colour: str) -> float:
    r, g, b = (int(hex_colour[i : i + 2], 16) / 255 for i in (1, 3, 5))

    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def _ratio(fg: str, bg: str) -> float:
    l1, l2 = _luminance(fg), _luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def test_core_text_pairs_meet_wcag_aa() -> None:
    t = _tokens()
    # (foreground token, background token, minimum ratio, label)
    pairs = [
        ("fg-1", "navy", 4.5, "body text on navy"),
        ("fg-1", "void", 4.5, "body text on void"),
        ("fg-2", "navy", 4.5, "secondary text on navy"),
        ("cyan", "void", 3.0, "cyan accent on void"),
        ("success", "navy-2", 3.0, "verdict PASS on lesson card"),
        ("warning", "navy-2", 3.0, "verdict NOT-YET on lesson card"),
    ]
    failures = []
    for fg, bg, minimum, label in pairs:
        assert fg in t, f"missing token --{fg}"
        assert bg in t, f"missing token --{bg}"
        ratio = _ratio(t[fg], t[bg])
        if ratio < minimum:
            failures.append(f"{label}: {t[fg]} on {t[bg]} = {ratio:.2f}:1 (< {minimum})")
    assert not failures, "WCAG AA contrast failures:\n" + "\n".join(failures)
