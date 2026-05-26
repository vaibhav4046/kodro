"""RoboLearn package — see :mod:`robolearn.rover_api` for the pupil-facing API."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("robolearn")
except PackageNotFoundError:  # pragma: no cover
    __version__ = "0.0.0+unknown"

__all__ = ("__version__",)
