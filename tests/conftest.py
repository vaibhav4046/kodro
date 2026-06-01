"""Shared pytest fixtures."""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

# Force SDL to a headless dummy audio device before pygame is imported
# anywhere, so the procedural sound effects can initialise the mixer in CI
# (and any machine without a sound card) without touching real hardware,
# raising, or blocking.
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

from robolearn.runtime import tracer as _tracer


@pytest.fixture(autouse=True)
def _reset_tracer_module_state() -> Iterator[None]:
    """Detach any active tracer / state provider before and after each test.

    The tracer module exposes module-level globals (``_active_tracer`` and
    ``_state_provider``); without this reset, a test that forgets to
    clean up could leak state into the next test.
    """
    _tracer.set_active(None)
    _tracer.set_state_provider(None)
    yield
    _tracer.set_active(None)
    _tracer.set_state_provider(None)
