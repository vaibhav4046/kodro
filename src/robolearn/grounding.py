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


# RHS node types that produce a genuine Python container/string: calling a
# method on one of these (``xs.append()``, ``s.split()``) is ordinary code, not
# an invented robot API. Binding a name to anything else -- a call result
# (``rover = make_rover()``), another name, an attribute -- does NOT exempt it,
# so ``rover = make(); rover.forward()`` can no longer launder an invented API
# surface past the metric just by assigning the base name first.
_CONTAINER_RHS = (
    ast.List,
    ast.Dict,
    ast.Set,
    ast.Tuple,
    ast.ListComp,
    ast.DictComp,
    ast.SetComp,
    ast.GeneratorExp,
    ast.JoinedStr,  # f-string
)


def _is_container_rhs(value: ast.expr | None) -> bool:
    """True when ``value`` is a literal container/string (see ``_CONTAINER_RHS``)."""
    if value is None:
        return False
    if isinstance(value, _CONTAINER_RHS):
        return True
    return isinstance(value, ast.Constant) and isinstance(value.value, str | bytes)


def _container_names(tree: ast.AST) -> set[str]:
    """Names bound to a literal container/string.

    Only these exempt attribute calls on the name from the invention check, so a
    local list stays fine (``xs = []; xs.append(1)``) while an object minted from
    an unknown call (``rover = spawn(); rover.forward()``) is still flagged.
    Assignments with a non-container RHS, or with anything other than a single
    ``Name`` target (tuple unpacking, ``with`` items, ``for`` targets), are
    treated conservatively as non-containers.
    """
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            if _is_container_rhs(node.value):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        names.add(target.id)
        elif (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and _is_container_rhs(node.value)
        ):
            names.add(node.target.id)
    return names


def check_grounding(code: str, fitted: frozenset[str] = FITTED_DEFAULT) -> GroundingResult:
    """Report which called symbols ``code`` invented relative to ``fitted``.

    ``fitted`` is the build's command set (defaults to the full default-rover
    set). A symbol is invented when it is a bare call to a name outside
    ``fitted`` and the allowed builtins (e.g. ``fly()``), OR an attribute call on
    an object the program never created (e.g. ``rover.forward()`` on a build that
    exposes only bare functions). Attribute calls on a name bound to a literal
    container/string (``xs = []; xs.append(1)``) are ordinary Python and are not
    invention; binding the base to anything else (``rover = spawn()``) does not
    exempt it, so the metric cannot be gamed by assigning the object first.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return GroundingResult(grounded=False, invented=(), called=(), syntax_error=str(exc))
    containers = _container_names(tree)
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
                if base.id not in containers and base.id not in allowed:
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
