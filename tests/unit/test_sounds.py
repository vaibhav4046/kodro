"""Procedural sound-effect tests (headless dummy audio driver)."""

from __future__ import annotations

import pytest

from robolearn.ui import sounds


def test_is_available_with_dummy_driver() -> None:
    # conftest sets SDL_AUDIODRIVER=dummy, so the mixer initialises headless.
    sounds.reset()
    assert sounds.is_available() is True


def test_play_helpers_never_raise() -> None:
    sounds.reset()
    sounds.play_pass()
    sounds.play_fail()
    sounds.play_collect()
    sounds.play_collision()
    # Second call exercises the cached-sound path.
    sounds.play_pass()


def test_play_is_noop_when_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    sounds.reset()
    monkeypatch.setattr(sounds, "_state", False)
    # Must silently do nothing -- no audio device.
    sounds.play_pass()
    sounds.play_collision()
    assert sounds.is_available() is False


def test_tone_builds_audible_buffer() -> None:
    sounds.reset()
    assert sounds.is_available()
    snd = sounds._tone(440.0, 50)
    assert snd is not None
    assert snd.get_length() > 0.0
