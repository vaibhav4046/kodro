"""Web UI: pywebview desktop window rendering the vendored Claude design.

The design itself (``src/robolearn/assets/web/*``) is the actual React/CSS
prototype from the Claude Design handoff, vendored offline. This package
boots a pywebview desktop window pointing at it and exposes a Python API
that bridges the design's JS shell into RoboLearn's existing engine
(``lessons``, ``grader``, ``memory.store``, etc.).

Entry point: ``python -m robolearn.web``.

The Tk app at ``python -m robolearn`` is unchanged and stays as a fallback
for environments without Edge WebView2.
"""

from .app import WebApp, launch

__all__ = ["WebApp", "launch"]
