"""Grounding (invention) metric for kodro-core and KodroBench.

This is Kodro's research contribution, made concrete: given a robot control
program and the set of commands the BUILT robot actually exposes (its
fitted-command set), which called symbols did the program INVENT? An invented
symbol is a call that is neither a fitted robot command nor an allowed language
builtin, e.g. ``read_gps()`` on a build with no GPS or ``activate_laser()`` on a
build with no laser.

Why this is novel (see docs/MARKET_RESEARCH.md and the dissertation): prior
LLM-for-robotics evaluations (RoboEval/CodeBotler, Robo-Instruct) measure an
invalid ARGUMENT to a valid primitive (e.g. GoTo an invalid location). This
measures an invented SYMBOL outside a per-build API set. Because the fitted set
is derived from the user's build, the ground-truth valid API is per-design, not
a fixed DSL. That intersection is unoccupied by the surveyed prior art.

The function is pure and deterministic: the same ``(code, fitted)`` always
returns the same result, and a syntax error is reported, never raised.

What counts as invented (the rule this module actually enforces, precisely):

* a bare-name call (``fly()``) whose name is neither in ``fitted`` nor an allowed
  builtin, and which the program neither defines itself (``def helper(): ...``)
  nor aliases from a fitted/builtin name (``mv = move_forward``);
* an attribute call on an object the program never created (``rover.forward()``),
  because the fitted API is a set of bare functions and exposes no objects. An
  attribute call on a name bound to a literal container/string is exempt ONLY
  when the method is a real built-in container/string method (``xs.append(1)``),
  so binding a name to ``[]``/``{}``/an f-string cannot launder an invented
  method (``x = []; x.fly()`` is still invention);
* a bare decorator (``@fly``) or attribute decorator (``@obj.fly``) that names an
  unknown symbol, because a decorator invokes the name at definition time even
  though it is not itself a call node.

This resists the common evasions (assigning the object first, aliasing a
container, hiding a call in a decorator) but is a static, best-effort check and
not a proof: a program determined to defeat any purely syntactic analysis still
can.
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

#: Real built-in method names on Python's container/str/bytes/tuple/set/dict
#: types. An attribute call whose base is a name bound to a literal
#: container/string is exempt from the invention check ONLY when the method is
#: one of these; any other method name on a container-bound base
#: (``x = []; x.launch_missiles()``) is an invented API surface the metric must
#: still flag, so binding to a literal cannot launder it.
_CONTAINER_METHODS: frozenset[str] = frozenset(
    {
        # list
        "append",
        "extend",
        "insert",
        "remove",
        "pop",
        "clear",
        "index",
        "count",
        "sort",
        "reverse",
        "copy",
        # dict
        "keys",
        "values",
        "items",
        "get",
        "setdefault",
        "update",
        "popitem",
        "fromkeys",
        # set / frozenset
        "add",
        "discard",
        "union",
        "intersection",
        "difference",
        "symmetric_difference",
        "intersection_update",
        "difference_update",
        "symmetric_difference_update",
        "issubset",
        "issuperset",
        "isdisjoint",
        # str
        "join",
        "split",
        "rsplit",
        "splitlines",
        "strip",
        "lstrip",
        "rstrip",
        "replace",
        "format",
        "format_map",
        "lower",
        "upper",
        "title",
        "capitalize",
        "casefold",
        "swapcase",
        "center",
        "ljust",
        "rjust",
        "zfill",
        "expandtabs",
        "startswith",
        "endswith",
        "find",
        "rfind",
        "rindex",
        "partition",
        "rpartition",
        "translate",
        "encode",
        "removeprefix",
        "removesuffix",
        "isalpha",
        "isalnum",
        "isdigit",
        "isdecimal",
        "isnumeric",
        "isspace",
        "isupper",
        "islower",
        "istitle",
        "isidentifier",
        "isprintable",
        "isascii",
        # bytes / bytearray
        "decode",
        "hex",
        "fromhex",
    }
)


@dataclass(frozen=True, slots=True)
class GroundingResult:
    """Whether a program stays within its build's fitted-command set."""

    grounded: bool
    invented: tuple[str, ...]  # sorted invented symbols (empty when grounded)
    called: tuple[str, ...]  # every call symbol, sorted
    syntax_error: str | None

    def to_dict(self) -> dict[str, object]:
        """JSON-ready view (drops the full call list, keeps what matters)."""
        return {
            "grounded": self.grounded,
            "invented": list(self.invented),
            "syntax_error": self.syntax_error,
        }


# RHS node types that produce a genuine Python container/string: an attribute
# call on a name bound to one of these (``xs.append()``, ``s.split()``) is
# ordinary code, not an invented robot API -- but only when the METHOD is a real
# container method (see ``_CONTAINER_METHODS``). Binding a name to anything else
# -- a call result (``rover = make_rover()``), another name, an attribute -- does
# NOT exempt it, so ``rover = make(); rover.forward()`` cannot launder an
# invented API surface past the metric just by assigning the base name first.
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

    A name in this set exempts attribute calls on it from the invention check,
    but only for real container methods (``xs = []; xs.append(1)``); an object
    minted from an unknown call (``rover = spawn(); rover.forward()``) is still
    flagged. Assignments with a non-container RHS, or with anything other than a
    single ``Name`` target (tuple unpacking, ``with`` items, ``for`` targets),
    are treated conservatively as non-containers.
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


def _exempt_bare_names(tree: ast.AST, allowed: frozenset[str]) -> set[str]:
    """Bare-call names that are legitimate rather than invented.

    Two kinds of name are ordinary code even though they are not themselves in
    the fitted set, so calling them is not invention:

    * functions the program defines itself -- ``def helper(): ...; helper()``;
    * a single-level alias of a name already allowed -- ``mv = move_forward;
      mv(3)`` (also ``mv: Callable = move_forward`` and the walrus ``(mv :=
      move_forward)``).

    Only an alias whose RHS is a plain name already in ``allowed`` counts;
    ``bot = something`` (RHS not fitted) does NOT exempt ``bot``, so it cannot be
    used to launder an invented surface.
    """
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            names.add(node.name)
        elif isinstance(node, ast.Assign) and isinstance(node.value, ast.Name):
            if node.value.id in allowed:
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        names.add(target.id)
        elif (
            isinstance(node, ast.AnnAssign | ast.NamedExpr)
            and isinstance(node.target, ast.Name)
            and isinstance(node.value, ast.Name)
            and node.value.id in allowed
        ):
            # ``mv: Callable = move_forward`` (AnnAssign) and ``(mv :=
            # move_forward)`` (walrus) both bind a single Name target.
            names.add(node.target.id)
    return names


def check_grounding(code: str, fitted: frozenset[str] = FITTED_DEFAULT) -> GroundingResult:
    """Report which called symbols ``code`` invented relative to ``fitted``.

    ``fitted`` is the build's command set (defaults to the full default-rover
    set). A symbol is invented when it is: (a) a bare call to a name outside
    ``fitted`` and the allowed builtins that the program neither defines nor
    aliases from a fitted/builtin name (``fly()``); (b) an attribute call on an
    object the program never created (``rover.forward()``), unless the base is a
    name bound to a literal container/string AND the method is a real built-in
    container method (``xs = []; xs.append(1)``); or (c) a bare or attribute
    decorator that names an unknown symbol (``@fly``). This resists the common
    evasions (assigning the object first, aliasing a container, hiding the call
    in a decorator) but is a static best-effort check, not a proof.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return GroundingResult(grounded=False, invented=(), called=(), syntax_error=str(exc))
    allowed = fitted | ALLOWED_BUILTINS
    containers = _container_names(tree)
    exempt_bare = _exempt_bare_names(tree, allowed)
    called: set[str] = set()
    invented: set[str] = set()

    def _record_bare(name: str) -> None:
        called.add(name)
        if name not in allowed and name not in exempt_bare:
            invented.add(name)

    def _record_attr(base_id: str, method: str) -> None:
        symbol = f"{base_id}.{method}"
        called.add(symbol)
        # A method on an object the program never created is an invented API
        # surface. The only exemption is a real container/string method on a
        # name bound to a literal container/string; a method that is NOT a real
        # container method is invented even on a container-bound base.
        if (base_id in containers and method in _CONTAINER_METHODS) or base_id in allowed:
            return
        invented.add(symbol)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name):
                _record_bare(func.id)
            elif isinstance(func, ast.Attribute):
                base = func.value
                if isinstance(base, ast.Name):
                    _record_attr(base.id, func.attr)
                else:
                    called.add(func.attr)
                    invented.add(func.attr)
        elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            # A decorator invokes its name at definition time. ``@deco(x)`` is an
            # ast.Call and is already handled above; only bare ``@fly`` (Name)
            # and ``@obj.fly`` (Attribute) decorators need catching here.
            for dec in node.decorator_list:
                if isinstance(dec, ast.Name):
                    _record_bare(dec.id)
                elif isinstance(dec, ast.Attribute) and isinstance(dec.value, ast.Name):
                    _record_attr(dec.value.id, dec.attr)

    return GroundingResult(
        grounded=not invented,
        invented=tuple(sorted(invented)),
        called=tuple(sorted(called)),
        syntax_error=None,
    )
