"""AST-based sandbox that restricts pupil-code imports and builtins.

Section 9 of the build spec lists the categories that must be rejected:
``Import``, ``ImportFrom``, double-underscore attribute access, and a small
set of builtin names that allow trivial sandbox escape (``open``, ``eval``,
``exec``, ``compile``, ``getattr``, ``setattr``, ``globals``, ``locals``).
We also reject the most common companion names (``__import__``, ``exit``,
``quit``, ``input``) because pupil code has no legitimate need for them.

One vector deliberately sidesteps the ``Attribute``/``Name`` dunder checks:
``str.format`` and ``str.format_map`` evaluate their replacement-field names at
*runtime*, so a template like ``"{0.__class__.__init__.__globals__}"`` walks an
exposed object all the way to the real module globals without ever emitting a
``__dunder__`` node the walker can see. We close it by inspecting template
*strings* for attribute-access field specs (see
:func:`_format_template_walks_attribute`).

The sandbox check happens *before* execution. If any violations are found
the executor (:mod:`kodro.runtime.executor`) refuses to run the
snippet at all and reports the violation with its line number.
"""

from __future__ import annotations

import ast
import string
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

#: Largest constant multiplier allowed in a sequence-repeat expression. A pupil
#: typo like ``[0] * 500000000`` allocates gigabytes in about a second, well
#: under the wall-clock timeout, and can exhaust the machine's RAM (a
#: self-inflicted denial of service on this single-user offline app). We reject
#: an oversized *literal* multiplier at parse time. This does NOT catch a size
#: computed at runtime (``n = 500000000; [0] * n``); a hard memory cap for that
#: needs the out-of-process executor the design deliberately declined, so it
#: stays a documented residual rather than a false guarantee.
MAX_LITERAL_REPEAT: int = 1_000_000

#: Largest constant exponent allowed in a ``**`` expression. ``10 ** 10 ** 7``
#: builds a ten-million-digit integer in a single bytecode op that holds the
#: GIL, so the thread-based wall-clock timeout cannot interrupt it and an
#: over-budget run is graded as a clean pass. A teaching program never needs an
#: exponent past a few hundred (``2 ** 64`` bit math is fine), so we reject a
#: constant-foldable exponent above this bound at parse time. A runtime-computed
#: exponent (``e = 10_000_000; 10 ** e``) stays a documented residual, like the
#: runtime-computed repeat above -- a true hard cap needs the out-of-process
#: executor the design deliberately declined.
MAX_POW_EXP: int = 4096


def _fold_const_int(node: ast.expr) -> int | None:
    """Fold a constant integer arithmetic subtree, or return ``None``.

    Used only to inspect a ``**`` exponent. It SHORT-CIRCUITS: any intermediate
    value whose magnitude exceeds :data:`MAX_POW_EXP` returns that magnitude
    immediately, so this never materialises the very bignum it exists to forbid.
    Returns ``None`` when the subtree references a name/call (not constant).
    """
    if isinstance(node, ast.Constant):
        return (
            node.value if isinstance(node.value, int) and not isinstance(node.value, bool) else None
        )
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        inner = _fold_const_int(node.operand)
        return None if inner is None else -inner
    if isinstance(node, ast.BinOp):
        left = _fold_const_int(node.left)
        right = _fold_const_int(node.right)
        if left is None or right is None:
            return None
        if abs(left) > MAX_POW_EXP or abs(right) > MAX_POW_EXP:
            return MAX_POW_EXP + 1  # already too big; do not compute further
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Pow):
            if right < 0 or right > 32:
                return MAX_POW_EXP + 1
            return int(left**right)  # right >= 0 guaranteed, so this is an int
    return None


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

    # --- oversized sequence repeat ------------------------------------------

    def visit_BinOp(self, node: ast.BinOp) -> None:
        # Reject e.g. ``[0] * 500000000`` / ``"x" * 500000000`` where a literal
        # int multiplier would allocate far more than any lesson needs, before
        # the wall-clock timeout can fire. Runtime-computed sizes are out of
        # reach here (see MAX_LITERAL_REPEAT).
        if isinstance(node.op, ast.Mult):
            for operand in (node.left, node.right):
                if (
                    isinstance(operand, ast.Constant)
                    and isinstance(operand.value, int)
                    and not isinstance(operand.value, bool)
                    and abs(operand.value) > MAX_LITERAL_REPEAT
                ):
                    self.violations.append(
                        SandboxViolation("oversized-repeat", str(operand.value), node.lineno)
                    )
        # Reject a bignum-bomb exponent (``10 ** 10 ** 7``): a constant-foldable
        # exponent above MAX_POW_EXP allocates a giant integer in one GIL-holding
        # op that the wall-clock timeout cannot interrupt.
        elif isinstance(node.op, ast.Pow):
            folded = _fold_const_int(node.right)
            if folded is not None and abs(folded) > MAX_POW_EXP:
                self.violations.append(
                    SandboxViolation(
                        "oversized-power", str(node.right.__class__.__name__), node.lineno
                    )
                )
        self.generic_visit(node)

    # --- format-string field specs ------------------------------------------

    def visit_Constant(self, node: ast.Constant) -> None:
        # ``str.format`` / ``str.format_map`` templates resolve their field
        # names at runtime, so an attribute walk inside the template
        # (e.g. ``"{0.__class__.__init__.__globals__}"``) never appears as an
        # ``Attribute`` node for :meth:`visit_Attribute` to reject. Catch it by
        # inspecting the literal template string itself, regardless of how it is
        # later used (``"...".format(x)``, ``fmt = "..."; fmt.format(x)``, ...).
        if isinstance(node.value, str) and _format_template_walks_attribute(node.value):
            self.violations.append(
                SandboxViolation("format-attr", _truncate(node.value), node.lineno)
            )
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


#: Shared parser for ``str.format`` templates (stateless, safe to reuse).
_FORMATTER = string.Formatter()

#: Longest template fragment quoted back in a violation message.
_MAX_TEMPLATE_SNIPPET: int = 40


def _truncate(text: str) -> str:
    """Return ``text`` shortened to a readable length for a violation message."""
    if len(text) <= _MAX_TEMPLATE_SNIPPET:
        return text
    return text[: _MAX_TEMPLATE_SNIPPET - 1] + "…"


def _format_template_walks_attribute(template: str) -> bool:
    """Return True if a ``str.format`` template reaches into an attribute.

    ``str.format`` / ``str.format_map`` evaluate the replacement-field name at
    runtime, so a template such as ``"{0.__class__.__init__.__globals__}"`` steps
    from an exposed object (e.g. a ``rover_api`` function) to the real module
    globals -- and thus the unrestricted builtins -- without ever producing an
    ``Attribute`` node for the walker to reject. This inspects the template
    string for that pattern.

    Only attribute access (``.``) in a field name is treated as a violation.
    Pure subscripting (``"{0[0]}".format(read_colour())``) is legitimate pupil
    formatting and cannot, on its own, escape an object the pupil already holds;
    every escalation walk needs at least one attribute hop to reach a dunder.
    Nested format specs (``"{0:{1.__class__}}"``) are inspected recursively.

    Args:
        template: A candidate ``str.format`` template string.

    Returns:
        True if any (possibly nested) replacement field selects an attribute.
    """
    try:
        fields = list(_FORMATTER.parse(template))
    except ValueError:
        # Malformed template (e.g. a stray "{"). ``str.format`` would raise at
        # runtime rather than leak, and there is no usable field to walk.
        return False
    for _literal_text, field_name, format_spec, _conversion in fields:
        if field_name is not None and "." in field_name:
            return True
        # A nested replacement field lives inside the format spec, e.g.
        # ``"{0:{1.__class__}}"`` -- recurse so a walk hidden there is caught.
        if format_spec and _format_template_walks_attribute(format_spec):
            return True
    return False


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

    * Every public symbol of :mod:`kodro.rover_api`.
    * ``range``, ``len``, ``print`` — with ``print`` rewired to
      :func:`kodro.rover_api.log` per Section 9 of the spec.
    """
    # Imported lazily -- at import time of this module, kodro.rover_api may
    # itself still be mid-load (rover_api imports from this package's tracer).
    from kodro import rover_api

    builtins_dict: dict[str, Any] = {
        "range": range,
        "len": len,
        "print": rover_api.log,
    }
    namespace: dict[str, Any] = {"__builtins__": builtins_dict}
    for name in rover_api.__all__:
        namespace[name] = getattr(rover_api, name)
    # Browser-compatible sensor spellings. The static interpreter exposes
    # distance() in centimetres plus heading()/battery(), while the canonical
    # Python API uses read_distance() in metres and read_* for the other two.
    # Keep these as compatibility aliases (not rover_api.__all__) so a program
    # written or AI-drafted in either Kodro surface runs with the same units,
    # without widening KodroBench's fitted-command research surface.
    namespace["distance"] = lambda: rover_api.read_distance() * 100.0
    namespace["heading"] = rover_api.read_heading
    namespace["battery"] = rover_api.read_battery
    return namespace
