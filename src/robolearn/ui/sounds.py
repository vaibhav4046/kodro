"""Offline, procedural sound effects -- no asset files, no network.

Tones are synthesised at runtime with the standard library (``math`` +
``struct``) and played through pygame's mixer. Everything is hard-guarded:
if no audio device is available (CI runners, locked-down classroom
machines) the module disables itself and every ``play_*`` call becomes a
silent no-op. It never raises and never blocks, so it is safe to call from
the Run/grade path on any platform.

Tests run with ``SDL_AUDIODRIVER=dummy`` (set in ``tests/conftest.py``) so
the mixer initialises against a headless dummy device -- deterministic,
silent, and hang-free.
"""

from __future__ import annotations

import math
import struct
from collections.abc import Callable
from typing import Any

#: Tri-state init flag: ``None`` = not yet probed, then ``True`` / ``False``.
_state: bool | None = None

#: Cache of built Sound objects keyed by effect name.
_cache: dict[str, Any] = {}

#: User mute switch. When ``False`` every ``play_*`` is a no-op even if a
#: device is available (for SEN pupils and quiet classrooms).
_enabled: bool = True


def set_enabled(enabled: bool) -> None:
    """Enable or mute all sound effects."""
    global _enabled
    _enabled = bool(enabled)


def is_enabled() -> bool:
    """Whether sound effects are currently un-muted."""
    return _enabled


def _ensure_init() -> bool:
    """Lazily initialise the mixer once; return whether audio is usable."""
    global _state
    if _state is not None:
        return _state
    try:
        import pygame

        # Access via an Any-typed handle: pygame-ce's stubs declare get_init()
        # non-optional, which would make these runtime guards look unreachable.
        mixer: Any = pygame.mixer
        if not mixer.get_init():
            mixer.init()
        _state = bool(mixer.get_init())
    except Exception:
        _state = False
    return _state


def is_available() -> bool:
    """Return ``True`` when an audio device is initialised and usable."""
    return _ensure_init()


def reset() -> None:
    """Forget the cached init state + sounds, and un-mute (used by tests)."""
    global _state, _enabled
    _state = None
    _enabled = True
    _cache.clear()


def _tone(frequency: float, duration_ms: int, volume: float = 0.3) -> Any:
    """Build a fading sine-tone :class:`pygame.mixer.Sound`, or ``None``."""
    import pygame

    mixer: Any = pygame.mixer
    init = mixer.get_init()
    if not init:
        return None
    sample_rate, fmt, channels = init
    if abs(int(fmt)) != 16:  # we only synthesise signed-16-bit frames
        return None
    n_samples = max(1, int(sample_rate * duration_ms / 1000))
    amplitude = int(32767 * max(0.0, min(1.0, volume)))
    data = bytearray()
    for i in range(n_samples):
        envelope = 1.0 - (i / n_samples)  # linear fade-out avoids clicks
        value = int(amplitude * envelope * math.sin(2 * math.pi * frequency * i / sample_rate))
        data += struct.pack("<h", value) * channels
    return mixer.Sound(buffer=bytes(data))


def _play(name: str, builder: Callable[[], Any]) -> None:
    """Play (and cache) the named effect; never raise."""
    if not _enabled or not _ensure_init():
        return
    try:
        sound = _cache.get(name)
        if sound is None:
            sound = builder()
            if sound is None:
                return
            _cache[name] = sound
        sound.play()
    except Exception:
        return


def play_pass() -> None:
    """Bright, high chime when a mission is passed."""
    _play("pass", lambda: _tone(784.0, 150))


def play_fail() -> None:
    """Low, short buzz when a mission is not yet passed."""
    _play("fail", lambda: _tone(196.0, 200))


def play_collect() -> None:
    """Quick blip when a sample is collected."""
    _play("collect", lambda: _tone(988.0, 70))


def play_collision() -> None:
    """Dull low thud on a collision."""
    _play("collision", lambda: _tone(110.0, 160))
