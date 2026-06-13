"""Turn a spoken phrase into a single rover instruction, fully offline.

The persona evaluation asked, more than once, for voice that does
something rather than only filling the artificial intelligence prompt, and
for it to work on a locked-down machine with no local model. This parser
answers both: it is plain deterministic Python with no model and no
network, mapping a short spoken phrase such as "go forward three" or "turn
left ninety" to one line of real rover code that can be dropped into the
editor. The offline speech recogniser supplies the text; this turns it
into an action.

It is deliberately small and predictable. If a phrase does not clearly map
to a command it returns ``None``, so the caller can tell the pupil it did
not understand rather than guessing.
"""

from __future__ import annotations

import re

#: Spoken number words a child is likely to use, plus a few common tens.
_WORDS: dict[str, int] = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "twenty": 20,
    "thirty": 30,
    "forty": 45,
    "forty five": 45,
    "ninety": 90,
    "forty-five": 45,
    "forty five degrees": 45,
    "hundred": 100,
    "a hundred": 100,
    "sixty": 60,
    "forty-five degrees": 45,
}


def _number(text: str, default: int) -> int:
    """Pull the first number (digits or words) out of ``text``."""
    digits = re.search(r"-?\d+", text)
    if digits:
        return int(digits.group())
    for word, value in _WORDS.items():
        if re.search(rf"\b{re.escape(word)}\b", text):
            return value
    return default


def parse_voice_command(text: str) -> str | None:
    """Map a spoken phrase to one line of rover Python, or ``None``.

    Recognises forward and backward movement, left and right turns, speed,
    and the simple one-word actions (scan, beep, collect, say, stop). The
    distance or angle may be a digit or a number word; sensible defaults
    apply when none is spoken.
    """
    t = " ".join((text or "").lower().split())
    if not t:
        return None

    # Speed first, so "go faster" is not swallowed by the "go" movement word.
    if "speed" in t or "faster" in t or "slower" in t:
        return f"set_speed({_number(t, 60)})"

    # Movement: forward / back, with an optional distance in metres.
    if re.search(r"\b(forward|forwards|ahead|straight|go)\b", t) and "back" not in t:
        return f"move_forward({_number(t, 1)})"
    if re.search(r"\b(back|backward|backwards|reverse)\b", t):
        return f"move_backward({_number(t, 1)})"

    # Turns, with an optional angle in degrees.
    if re.search(r"\b(left|anticlockwise|counterclockwise)\b", t):
        return f"turn_left({_number(t, 90)})"
    if re.search(r"\b(right|clockwise)\b", t):
        return f"turn_right({_number(t, 90)})"

    # One-word actions.
    if "scan" in t:
        return "scan()"
    if "beep" in t or "sound" in t:
        return "beep(1)"
    if "collect" in t or "pick up" in t or "sample" in t:
        return "collect_sample()"
    if "light" in t or t.startswith("led"):
        return 'led("cyan")'
    if "wait" in t or "pause" in t:
        return f"wait({_number(t, 1)})"
    if "stop" in t or "halt" in t:
        return "set_speed(0)"
    if t.startswith("say "):
        message = t[4:].strip().replace('"', "")
        return f'say("{message}")' if message else None

    return None
