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
  builtin, and which the program does not make visible at the call site -- a
  function or lambda it defines, or an alias chained (possibly through several
  ``a = b`` steps) to a fitted/builtin name. Visibility is scope-aware: a helper
  defined only inside another function does NOT exempt a call to that name in an
  enclosing scope, so a nested ``def`` cannot launder a top-level invented call
  (``def outer(): def fly(): ...`` does not ground a top-level ``fly()``);
* an attribute call is invention when it invents a symbol or an object surface:
  ``rover.forward()`` invents both an unknown ``rover`` object and an unknown
  ``forward``. There are two exemptions. (1) A REAL builtin-type method
  (``append``, ``upper``, ...) called on a KNOWN base -- a name bound to a literal
  container/string (``xs.append(1)``) or a fitted/builtin name. (2) ANY method on
  a genuinely-bound LOCAL base -- a name the program binds by iteration or
  context rather than conjures: a ``for``/``with``/``except`` target, a
  comprehension variable, or a tuple-unpacking target (``for s in xs:
  s.strip()``, ``a, b = f(); a.run()``). Such a base is a real local of unknown
  type, not an invented object surface. An unknown method on a fitted/builtin
  base (``move_forward.fly()``, ``range.launch()``), any method on an UNBOUND
  base (``rover.forward()``), a method on a name bound only by a plain
  ``x = <call/name>`` assignment (``rover = spawn(); rover.forward()`` -- the
  assign-the-object evasion), and a non-container method on a literal-container
  base (``x = []; x.fly()``) are all still invention, so neither a fitted
  command's bare-function nature nor a laundered base can be used as a free
  method surface;
* a bare decorator (``@fly``) or attribute decorator (``@obj.fly``) that names an
  unknown symbol, because a decorator invokes the name at definition time even
  though it is not itself a call node.

This resists the common evasions (assigning the object first, aliasing a
container, chaining aliases, hiding a helper's name in an inner scope, hiding a
call in a decorator) but is a static, best-effort check and not a proof: a
program determined to defeat any purely syntactic analysis still can. The scope
model is a reasonable static approximation -- a name is treated as visible if a
``def``/lambda/alias binds it in the same or an enclosing function (or the
module), and class scopes are treated leniently as ordinary enclosing scopes.
Genuinely-bound locals (loop/with/except/comprehension/unpacking targets) are
tracked leniently, scope-blind like the container set, so a name the program
really does bind is not misreported as invented; this trades a little precision
for a lower false-positive rate on the headline invention metric.
"""

from __future__ import annotations

import ast
from collections.abc import Iterator
from dataclasses import dataclass

from robolearn import rover_api

#: Language builtins the sandbox exposes to pupil code (runtime/sandbox.py
#: restricted_globals gives only these three). They are never "invented".
ALLOWED_BUILTINS: frozenset[str] = frozenset({"range", "len", "print"})

#: The default build's fitted-command set: every command rover_api exposes.
#: A specific build exposes a SUBSET of this; pass that subset as ``fitted``.
FITTED_DEFAULT: frozenset[str] = frozenset(rover_api.__all__)

#: Real built-in method names on Python's container/str/bytes/tuple/set/dict
#: types. An attribute call whose method is one of these is exempt from the
#: invention check ONLY when its base is a KNOWN name (a name bound to a literal
#: container/string, ``x = []; x.append(1)``, or a fitted/builtin name); any
#: other method name, or any method on an unknown base (``rover.launch()``), is
#: an invented API surface the metric must still flag.
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

# Nodes that open a new naming scope. Bindings inside one of these are NOT
# visible to an enclosing scope, so a name defined only here cannot exempt a
# call to that name outside it.
_SCOPE_NODES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)


def _is_container_rhs(value: ast.expr | None) -> bool:
    """True when ``value`` is a literal container/string (see ``_CONTAINER_RHS``)."""
    if value is None:
        return False
    if isinstance(value, _CONTAINER_RHS):
        return True
    return isinstance(value, ast.Constant) and isinstance(value.value, str | bytes)


def _target_names(target: ast.expr) -> set[str]:
    """Every ``Name`` a binding target introduces, descending unpacking.

    Handles a bare ``Name`` (``x``), a ``Starred`` capture (``*rest``), and
    arbitrarily nested tuple/list unpacking (``(a, [b, *c]) = ...``). Anything
    else (an attribute or subscript store target, ``obj.attr = ...``) binds no
    plain local name and contributes nothing.
    """
    if isinstance(target, ast.Name):
        return {target.id}
    if isinstance(target, ast.Starred):
        return _target_names(target.value)
    if isinstance(target, (ast.Tuple, ast.List)):
        names: set[str] = set()
        for elt in target.elts:
            names |= _target_names(elt)
        return names
    return set()


def _unpack_container_names(target: ast.expr, value: ast.expr | None) -> set[str]:
    """Unpacking-target names whose POSITIONAL right-hand side is a literal container.

    ``a, b = [], {}`` binds ``a`` and ``b`` to a list and a dict, so both are
    containers; ``a, b = [], f()`` makes only ``a`` one. Matching is positional
    and only attempted when both sides are same-length tuples/lists with no
    ``Starred`` element (which would break the position mapping); otherwise no
    name is claimed as a container here (the names are still tracked as
    genuinely-bound locals elsewhere).
    """
    if (
        isinstance(target, (ast.Tuple, ast.List))
        and isinstance(value, (ast.Tuple, ast.List))
        and len(target.elts) == len(value.elts)
        and not any(isinstance(e, ast.Starred) for e in target.elts)
    ):
        names: set[str] = set()
        for t_elt, v_elt in zip(target.elts, value.elts, strict=True):
            if isinstance(t_elt, ast.Name):
                if _is_container_rhs(v_elt):
                    names.add(t_elt.id)
            else:
                names |= _unpack_container_names(t_elt, v_elt)
        return names
    return set()


def _container_names(tree: ast.AST) -> set[str]:
    """Names bound to a literal container/string.

    A name in this set exempts attribute calls on it from the invention check,
    but only for real container methods (``xs = []; xs.append(1)``); an object
    minted from an unknown call (``rover = spawn(); rover.forward()``) is still
    flagged. Single-``Name`` targets (``x = []``, ``x = y = {}``) and annotated
    assignments (``x: list = []``) are matched directly; tuple/list unpacking is
    matched positionally against a literal tuple/list RHS (``a, b = [], {}``). A
    non-container RHS binds no container name.
    """
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    if _is_container_rhs(node.value):
                        names.add(target.id)
                else:
                    names |= _unpack_container_names(target, node.value)
        elif (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and _is_container_rhs(node.value)
        ):
            names.add(node.target.id)
    return names


def _bound_local_names(tree: ast.AST) -> set[str]:
    """Names the program genuinely binds by iteration or context, not by conjuring.

    These are the ``for``/``with``/``except`` targets, comprehension variables,
    and tuple/list unpacking targets whose RHS is not a literal container. Such a
    name is a real local of unknown type, so a bare call to it, or a method call
    on it, is ordinary code rather than an invented symbol -- unlike an UNBOUND
    base (``rover.forward()``) or a name bound only by a plain ``x = <call>``
    assignment (the assign-the-object evasion), which stay flagged. Names that
    unpack positionally to a literal container are deliberately excluded here so
    they remain in the method-restricted container set (``a, b = [], {}`` keeps
    ``a.launch()`` an invention). The walk is scope-blind, matching the container
    set: a lenient over-approximation that lowers false positives.
    """
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.AsyncFor)):
            names |= _target_names(node.target)
        elif isinstance(node, (ast.With, ast.AsyncWith)):
            for item in node.items:
                if item.optional_vars is not None:
                    names |= _target_names(item.optional_vars)
        elif isinstance(node, ast.ExceptHandler):
            if node.name:
                names.add(node.name)
        elif isinstance(node, ast.comprehension):
            names |= _target_names(node.target)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, (ast.Tuple, ast.List)):
                    names |= _target_names(target) - _unpack_container_names(target, node.value)
    return names


def _arg_names(args: ast.arguments) -> set[str]:
    """Every parameter name a ``def``/``lambda`` binds in its own scope."""
    names = {a.arg for a in (*args.posonlyargs, *args.args, *args.kwonlyargs)}
    if args.vararg is not None:
        names.add(args.vararg.arg)
    if args.kwarg is not None:
        names.add(args.kwarg.arg)
    return names


def _arg_default_values(args: ast.arguments) -> list[ast.expr]:
    """Default-value expressions of a signature (evaluated when the def runs)."""
    return [*args.defaults, *(d for d in args.kw_defaults if d is not None)]


def _iter_same_scope(body: list[ast.stmt]) -> Iterator[ast.AST]:
    """Yield every node inside ``body`` that shares its scope.

    Descends through control flow (``if``/``for``/``while``/``with``/``try``)
    but stops at a nested scope boundary (``def``/``lambda``/``class``): the
    boundary node itself is yielded (so its bound name can be collected) but its
    body is not, because names bound there belong to that inner scope.
    """
    stack: list[ast.AST] = list(body)
    while stack:
        node = stack.pop()
        yield node
        if isinstance(node, _SCOPE_NODES):
            continue
        stack.extend(ast.iter_child_nodes(node))


def _scope_local(scope_node: ast.AST) -> tuple[set[str], dict[str, str]]:
    """Names a scope binds directly: local defs/callables and single-step aliases.

    Returns ``(defs, aliases)`` where ``defs`` are names bound to a callable the
    program controls (a ``def``/``async def``/``class`` in this scope, a
    lambda-bound name, or a parameter) and ``aliases`` maps ``name -> rhs_name``
    for plain ``name = other_name`` bindings. Bindings inside nested scopes are
    excluded; alias chains are resolved later against the merged scope view.
    """
    defs: set[str] = set()
    aliases: dict[str, str] = {}
    if isinstance(scope_node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
        defs |= _arg_names(scope_node.args)
    if isinstance(scope_node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        body: list[ast.stmt] = scope_node.body
    else:  # ast.Lambda has a single expression body and binds only its parameters
        body = []
    for node in _iter_same_scope(body):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            defs.add(node.name)
        elif isinstance(node, ast.Assign):
            if isinstance(node.value, ast.Lambda):
                defs |= {t.id for t in node.targets if isinstance(t, ast.Name)}
            elif isinstance(node.value, ast.Name):
                for t in node.targets:
                    if isinstance(t, ast.Name):
                        aliases[t.id] = node.value.id
        elif isinstance(node, (ast.AnnAssign, ast.NamedExpr)):
            target = node.target
            if isinstance(target, ast.Name) and node.value is not None:
                if isinstance(node.value, ast.Lambda):
                    defs.add(target.id)
                elif isinstance(node.value, ast.Name):
                    aliases[target.id] = node.value.id
    return defs, aliases


def _scope_body_children(scope_node: ast.AST) -> list[ast.AST]:
    """The child nodes whose code executes inside ``scope_node``'s own scope.

    Decorators are excluded (they run in the enclosing scope and are handled by
    the caller); default-value expressions are included because a call hidden in
    a default still runs. A lambda's ``body`` is its single expression.
    """
    if isinstance(scope_node, ast.Lambda):
        return [scope_node.body, *_arg_default_values(scope_node.args)]
    if isinstance(scope_node, ast.ClassDef):
        return [*scope_node.body, *scope_node.bases, *(kw.value for kw in scope_node.keywords)]
    if isinstance(scope_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return [*scope_node.body, *_arg_default_values(scope_node.args)]
    if isinstance(scope_node, ast.Module):
        return list(scope_node.body)
    return []


def _resolve_exempt(
    name: str,
    defs: set[str],
    aliases: dict[str, str],
    allowed: frozenset[str],
    bound_locals: set[str],
) -> bool:
    """True when a bare-call ``name`` is legitimate rather than invented.

    A name is exempt if it is a fitted/builtin symbol, a callable the program
    defines in a visible scope (``def``/lambda/parameter), a genuinely-bound
    local (a loop/with/except/comprehension/unpacking target), or an alias that
    chains -- through any number of ``a = b`` steps -- to one of those. Alias
    chains are followed with a cycle guard, so ``a = move_forward; b = a; b()``
    resolves ``b -> a -> move_forward`` and ``x = y; y = x`` terminates.
    """
    seen: set[str] = set()
    current = name
    while True:
        if current in allowed or current in defs or current in bound_locals:
            return True
        if current in aliases and current not in seen:
            seen.add(current)
            current = aliases[current]
            continue
        return False


def check_grounding(code: str, fitted: frozenset[str] = FITTED_DEFAULT) -> GroundingResult:
    """Report which called symbols ``code`` invented relative to ``fitted``.

    ``fitted`` is the build's command set (defaults to the full default-rover
    set). A symbol is invented when it is: (a) a bare call to a name outside
    ``fitted`` and the allowed builtins that the program does not make visible at
    the call site -- a ``def``/lambda/parameter or an alias chained to a
    fitted/builtin name -- where visibility is scope-aware, so a name defined
    only in an inner scope does not exempt a call in an enclosing one; (b) an
    attribute call that invents an object surface (``rover.forward()``), unless
    the method is a real builtin-type container/string method on a KNOWN base (a
    name bound to a literal container/string, or a fitted/builtin name); or (c) a
    bare or attribute decorator that names an unknown symbol (``@fly``). This
    resists the common evasions (assigning the object first, aliasing or chaining
    aliases, laundering a name through an inner scope, hiding the call in a
    decorator) but is a static best-effort check, not a proof.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return GroundingResult(grounded=False, invented=(), called=(), syntax_error=str(exc))
    allowed = fitted | ALLOWED_BUILTINS
    containers = _container_names(tree)
    bound_locals = _bound_local_names(tree)
    called: set[str] = set()
    invented: set[str] = set()

    def _record_bare(name: str, defs: set[str], aliases: dict[str, str]) -> None:
        called.add(name)
        if not _resolve_exempt(name, defs, aliases, allowed, bound_locals):
            invented.add(name)

    def _record_attr(base_id: str, method: str) -> None:
        symbol = f"{base_id}.{method}"
        called.add(symbol)
        # A method on an object the program never created is an invented API
        # surface. Two exemptions. (1) A REAL builtin-type method on a KNOWN
        # base: a name bound to a literal container/string, or a fitted/builtin
        # name -- a fitted command is a bare function, not a free object surface,
        # so ``move_forward.fly()`` and ``range.launch()`` stay invented, and a
        # non-container method like ``x = []; x.launch()`` stays invented too.
        # (2) ANY method on a genuinely-bound LOCAL base (a loop/with/except/
        # comprehension/unpacking target): a real local of unknown type, not a
        # conjured surface -- but an unbound base (``rover.forward()``) or one
        # bound only by ``rover = spawn()`` is not, so those stay invented.
        if method in _CONTAINER_METHODS and (base_id in containers or base_id in allowed):
            return
        if base_id in bound_locals:
            return
        invented.add(symbol)

    def _handle_call(node: ast.Call, defs: set[str], aliases: dict[str, str]) -> None:
        func = node.func
        if isinstance(func, ast.Name):
            _record_bare(func.id, defs, aliases)
        elif isinstance(func, ast.Attribute):
            base = func.value
            if isinstance(base, ast.Name):
                _record_attr(base.id, func.attr)
            else:
                # A method on a non-name base (a call result, subscript, ...) is
                # an object the program never created: still invention.
                called.add(func.attr)
                invented.add(func.attr)

    def _handle_decorator(dec: ast.expr, defs: set[str], aliases: dict[str, str]) -> None:
        # ``@fly`` (Name) and ``@obj.fly`` (Attribute) invoke a name at def time
        # but are not Call nodes; ``@deco(...)`` IS a Call and is visited normally.
        if isinstance(dec, ast.Name):
            _record_bare(dec.id, defs, aliases)
        elif isinstance(dec, ast.Attribute) and isinstance(dec.value, ast.Name):
            _record_attr(dec.value.id, dec.attr)
        else:
            _visit(dec, defs, aliases)

    def _enter_scope(scope_node: ast.AST, enc_defs: set[str], enc_aliases: dict[str, str]) -> None:
        local_defs, local_aliases = _scope_local(scope_node)
        defs = enc_defs | local_defs
        aliases = {**enc_aliases, **local_aliases}
        for child in _scope_body_children(scope_node):
            _visit(child, defs, aliases)

    def _visit(node: ast.AST, defs: set[str], aliases: dict[str, str]) -> None:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            for dec in node.decorator_list:
                _handle_decorator(dec, defs, aliases)
            _enter_scope(node, defs, aliases)
            return
        if isinstance(node, ast.Lambda):
            _enter_scope(node, defs, aliases)
            return
        if isinstance(node, ast.Call):
            _handle_call(node, defs, aliases)
            for child in ast.iter_child_nodes(node):
                _visit(child, defs, aliases)
            return
        for child in ast.iter_child_nodes(node):
            _visit(child, defs, aliases)

    _enter_scope(tree, set(), {})

    return GroundingResult(
        grounded=not invented,
        invented=tuple(sorted(invented)),
        called=tuple(sorted(called)),
        syntax_error=None,
    )
