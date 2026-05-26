"""Smoke test — confirms the package installs cleanly and exposes a version."""

from __future__ import annotations

import importlib

import robolearn


def test_package_exposes_version() -> None:
    assert isinstance(robolearn.__version__, str)
    assert robolearn.__version__  # non-empty


def test_subpackages_importable() -> None:
    for name in (
        "robolearn.engine",
        "robolearn.lessons",
        "robolearn.memory",
        "robolearn.runtime",
        "robolearn.ui",
    ):
        assert importlib.import_module(name) is not None
