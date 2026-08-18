"""Web UI: pywebview desktop window rendering the vendored web design.

The design itself (``src/kodro/assets/web/*``) is the actual React/CSS
prototype from the design handoff, vendored offline. This package
boots a pywebview desktop window pointing at it and exposes a Python API
that bridges the design's JS shell into RoboLearn's existing engine
(``lessons``, ``grader``, ``memory.store``, etc.).

Entry point: ``python -m kodro.web``.

The Tk app at ``python -m kodro`` is unchanged and stays as a fallback
for environments without Edge WebView2.
"""

from .app import WebApp, launch

__all__ = ["WebApp", "launch"]
