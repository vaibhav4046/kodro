"""Grounding (invention) metric for kodro-core and KodroBench.

This is Kodro's research contribution, made concrete: given a robot control
program and the set of commands the BUILT robot actually exposes (its
fitted-command set), which called symbols did the program INVENT? An invented
symbol is a bare function call that is neither a fitted robot command nor an
allowed language builtin, e.g. ``read_gps()`` on a build with no GPS or
``activate_laser()`` on a build with no laser.

Why this is novel (see docs/MARKET_RESEARCH.md and the dissertation): prior
LLM-for-robotics evaluations (RoboEval/CodeBotler, Robo-Instruct) measure an
invalid ARGUMENT to a valid primitive (e.g. GoTo an invalid location). This
measures an invented SYMBOL outside a per-build API set. Because the fitted set
is derived from the user's build, the ground-truth valid API is per-design, not
a fixed DSL. That intersection is unoccupied by the surveyed prior art.

The function is pure and deterministic: the same ``(code, fitted)`` always
returns the same result, and a syntax error is reported, never raised. Only
bare-name calls (``move_forward(...)``) are the invention surface; attribute
calls (``x.append(...)``) are ordinary Python idioms and are not counted.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass

from robolearn import rover_api

#: Language builtins the sandbox exposes to pupil code (runtime/sandbox.py
#: restricted_globals gives only these three). They are never "invented".
ALLOWED_BUILTINS: frozenset[str] = frozenset({"range", "len", "print"})

#: The default build's fitted-command set: every command rover_api exposes.
#: A specific build exposes a SUBSET of this; pass that subset as ``fitted``.
FITTED_DEFAULT: frozenset[str] = frozenset(rover_api.__all__)


@dataclass(frozen=True, slots=True)
class GroundingResult:
    """Whether a program stays within its build's fitted-command set."""

    grounded: bool
    invented: tuple[str, ...]  # sorted invented symbols (empty when grounded)
    called: tuple[str, ...]  # every bare-name call, sorted
    syntax_error: str | None

    def to_dict(self) -> dict[str, object]:
        """JSON-ready view (drops the full call list, keeps what matters)."""
        return {
            "grounded": self.grounded,
            "invented": list(self.invented),
            "syntax_error": self.syntax_error,
        }


def _called_names(tree: ast.AST) -> set[str]:
    """Bare function-call names in ``tree`` (``foo(...)`` -> ``foo``)."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            names.add(node.func.id)
    return names


def check_grounding(code: str, fitted: frozenset[str] = FITTED_DEFAULT) -> GroundingResult:
    """Report which called symbols ``code`` invented relative to ``fitted``.

    ``fitted`` is the build's command set (defaults to the full default-rover
    set). A call to a name outside ``fitted`` and outside the allowed builtins
    is an invented symbol; a program with no invented symbols is grounded.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return GroundingResult(grounded=False, invented=(), called=(), syntax_error=str(exc))
    called = _called_names(tree)
    allowed = fitted | ALLOWED_BUILTINS
    invented = tuple(sorted(name for name in called if name not in allowed))
    return GroundingResult(
        grounded=not invented,
        invented=invented,
        called=tuple(sorted(called)),
        syntax_error=None,
    )
