"""Smoke test — confirms the package installs cleanly and exposes a version."""

from __future__ import annotations

import importlib

import kodro


def test_package_exposes_version() -> None:
    assert isinstance(kodro.__version__, str)
    assert kodro.__version__  # non-empty


def test_subpackages_importable() -> None:
    for name in (
        "kodro.engine",
        "kodro.lessons",
        "kodro.memory",
        "kodro.runtime",
        "kodro.ui",
    ):
        assert importlib.import_module(name) is not None
