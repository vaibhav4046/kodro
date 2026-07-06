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


def _add_target(target: ast.expr, into: set[str]) -> None:
    """Collect the Name(s) bound by an assignment / for / with target."""
    if isinstance(target, ast.Name):
        into.add(target.id)
    elif isinstance(target, ast.Starred):
        _add_target(target.value, into)
    elif isinstance(target, ast.Tuple | ast.List):
        for element in target.elts:
            _add_target(element, into)


def _assigned_names(tree: ast.AST) -> set[str]:
    """Names bound locally (so ``xs.append()`` on a local list is not invention)."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                _add_target(target, names)
        elif isinstance(node, ast.AugAssign | ast.AnnAssign | ast.For | ast.comprehension):
            _add_target(node.target, names)
        elif isinstance(node, ast.withitem) and node.optional_vars is not None:
            _add_target(node.optional_vars, names)
    return names


def check_grounding(code: str, fitted: frozenset[str] = FITTED_DEFAULT) -> GroundingResult:
    """Report which called symbols ``code`` invented relative to ``fitted``.

    ``fitted`` is the build's command set (defaults to the full default-rover
    set). A symbol is invented when it is a bare call to a name outside
    ``fitted`` and the allowed builtins (e.g. ``fly()``), OR an attribute call on
    an object the program never created (e.g. ``rover.forward()`` on a build that
    exposes only bare functions). Attribute calls on a locally-assigned variable
    (``xs = []; xs.append(1)``) are ordinary Python and are not invention.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return GroundingResult(grounded=False, invented=(), called=(), syntax_error=str(exc))
    assigned = _assigned_names(tree)
    allowed = fitted | ALLOWED_BUILTINS
    called: set[str] = set()
    invented: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if isinstance(func, ast.Name):
            called.add(func.id)
            if func.id not in allowed:
                invented.add(func.id)
        elif isinstance(func, ast.Attribute):
            base = func.value
            if isinstance(base, ast.Name):
                called.add(f"{base.id}.{func.attr}")
                # A method on an object the program never created is an invented
                # API surface (the fitted API exposes bare functions, no objects).
                if base.id not in assigned and base.id not in allowed:
                    invented.add(f"{base.id}.{func.attr}")
            else:
                called.add(func.attr)
                invented.add(func.attr)
    return GroundingResult(
        grounded=not invented,
        invented=tuple(sorted(invented)),
        called=tuple(sorted(called)),
        syntax_error=None,
    )
