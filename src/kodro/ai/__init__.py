"""Optional local-AI subsystem powered by Ollama.

This package is a *strictly optional* enhancement. The RoboLearn core
runs 100% offline with zero AI; every public function here degrades
gracefully when no Ollama server is reachable on ``localhost:11434``.

Design constraints (mirrors the project's no-cloud rule):

* **Local only.** All traffic goes to ``http://localhost:11434`` — the
  user's own machine. No third-party host, no API key, no account.
* **No hard dependency.** The client uses the standard-library
  :mod:`urllib`; if the server is down, :func:`is_available` returns
  ``False`` and the UI hides every AI affordance.
* **Validated output.** Generated lessons are parsed through the same
  Pydantic schema the bundled lessons use, so a hallucinated lesson can
  never crash the app.
"""

from __future__ import annotations

from .lesson_generator import GenerationError, generate_lesson
from .ollama_client import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    OllamaClient,
    OllamaError,
    is_available,
    list_models,
)
from .tutor import explain_code, generate_quiz

__all__ = (
    "DEFAULT_BASE_URL",
    "DEFAULT_MODEL",
    "GenerationError",
    "OllamaClient",
    "OllamaError",
    "explain_code",
    "generate_lesson",
    "generate_quiz",
    "is_available",
    "list_models",
)
