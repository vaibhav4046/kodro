"""Frozen-app entry point for PyInstaller.

PyInstaller runs the entry script as ``__main__`` with no package context, so a
relative import (``from .app import launch``) fails. This launcher uses an
absolute import instead -- the ``robolearn`` package is bundled, so it resolves
when frozen. ``python -m robolearn.web`` still uses ``__main__.py``.
"""

from __future__ import annotations

from robolearn.web.app import launch

if __name__ == "__main__":
    launch()
