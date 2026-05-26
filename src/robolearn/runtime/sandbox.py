"""AST-based sandbox that restricts pupil-code imports and builtins.

Section 9 of the build spec lists the categories that must be rejected:
``Import``, ``ImportFrom``, double-underscore attribute access, and a small
set of builtin names that allow trivial sandbox escape (``open``, ``eval``,
``exec``, ``compile``, ``getattr``, ``setattr``, ``globals``, ``locals``).
We also reject the most common companion names (``__import__``, ``exit``,
``quit``, ``input``) because pupil code has no legitimate need for them.

The sandbox check happens *before* execution. If any violations are found
the executor (:mod:`robolearn.runtime.executor`) refuses to run the
snippet at all and reports the violation with its line number.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

#: Names whose mere appearance in the AST is rejected. These either provide
#: sandbox escape (``eval``, ``exec``) or unnecessary file / OS access
#: (``open``, ``input``).
FORBIDDEN_NAMES: frozenset[str] = frozenset(
    {
        "__import__",
        "compile",
        "eval",
        "exec",
        "exit",
        "getattr",
        "globals",
        "input",
        "locals",
        "open",
        "quit",
        "setattr",
        "vars",
        "delattr",
        "breakpoint",
    }
)


@dataclass(frozen=True, slots=True)
class SandboxViolation:
    """One reason the AST walker rejected a snippet."""

    kind: str
    name: str
    lineno: int

    def message(self) -> str:
        """Return a one-line human-readable description of the violation."""
        return f"line {self.lineno}: {self.kind} '{self.name}' is not allowed"


class _SandboxWalker(ast.NodeVisitor):
    """AST visitor that records violations as it walks."""

    def __init__(self) -> None:
        self.violations: list[SandboxViolation] = []

    # --- import statements --------------------------------------------------

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.violations.append(SandboxViolation("import", alias.name, node.lineno))
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        name = node.module or "<relative>"
        self.violations.append(SandboxViolation("import-from", name, node.lineno))
        self.generic_visit(node)

    # --- attribute access ---------------------------------------------------

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if _is_dunder(node.attr):
            self.violations.append(SandboxViolation("dunder-attr", node.attr, node.lineno))
        self.generic_visit(node)

    # --- name references ----------------------------------------------------

    def visit_Name(self, node: ast.Name) -> None:
        self._check_name(node.id, node.lineno)
        self.generic_visit(node)

    def visit_arg(self, node: ast.arg) -> None:
        # Parameter names are still names — reject e.g. ``def f(__hack): ...``.
        self._check_name(node.arg, node.lineno)
        self.generic_visit(node)

    def _check_name(self, name: str, lineno: int) -> None:
        if name in FORBIDDEN_NAMES:
            self.violations.append(SandboxViolation("forbidden-name", name, lineno))
        if _is_dunder(name):
            self.violations.append(SandboxViolation("dunder-name", name, lineno))


def _is_dunder(name: str) -> bool:
    """Return True if ``name`` is a double-underscore identifier like ``__class__``."""
    return name.startswith("__") and name.endswith("__")


# --- public API ------------------------------------------------------------


def find_violations(source: str) -> list[SandboxViolation]:
    """Parse ``source`` and walk it for sandbox violations.

    Args:
        source: Pupil source code.

    Returns:
        A list of :class:`SandboxViolation` instances; empty if the
        snippet is safe.

    Raises:
        SyntaxError: If ``source`` does not parse. Callers should catch
            this and report it as a syntax error rather than a sandbox
            violation.
    """
    tree = ast.parse(source, mode="exec")
    walker = _SandboxWalker()
    walker.visit(tree)
    return walker.violations


def is_safe(source: str) -> bool:
    """Return True if ``source`` parses and contains no sandbox violations."""
    try:
        return not find_violations(source)
    except SyntaxError:
        return False


def restricted_globals() -> dict[str, Any]:
    """Return a fresh globals mapping suitable for ``exec``-ing pupil code.

    The mapping exposes:

    * Every public symbol of :mod:`robolearn.rover_api`.
    * ``range``, ``len``, ``print`` — with ``print`` rewired to
      :func:`robolearn.rover_api.log` per Section 9 of the spec.
    """
    # Imported lazily -- at import time of this module, robolearn.rover_api may
    # itself still be mid-load (rover_api imports from this package's tracer).
    from robolearn import rover_api

    builtins_dict: dict[str, Any] = {
        "range": range,
        "len": len,
        "print": rover_api.log,
    }
    namespace: dict[str, Any] = {"__builtins__": builtins_dict}
    for name in rover_api.__all__:
        namespace[name] = getattr(rover_api, name)
    return namespace
