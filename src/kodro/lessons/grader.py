"""Auto-grader that compares a recorded trace against lesson success criteria.

Given a :class:`~kodro.runtime.tracer.Tracer` produced by the pupil's
run and the matching :class:`~kodro.lessons.schema.Lesson`, the
grader emits a :class:`GradeResult` with three fields:

* ``passed`` — True when every success criterion is satisfied.
* ``reasons`` — one short, pupil-facing string per failing criterion. The
  hint engine (Task 10) maps these to actionable advice.
* ``score`` — 0-100. Starts at 100 and loses 20 points for every failed
  criterion. Collisions and battery use lower the score only through the
  ``no_collisions`` / ``max_battery_used`` criteria a lesson declares; there
  is no separate per-collision deduction (the old docstring promised one the
  code never applied - PERFECTION_PLAN E-A7). Collision counts are real now:
  the engine registers a collision whenever a move hits an obstacle or the
  arena wall, so ``no_collisions`` grades what actually happened.

The grader is pure: it reads the trace, the lesson definition and the
source string. No engine handles are required, which makes it trivial
to test with synthetic "golden" traces.
"""

from __future__ import annotations

import ast
import math
from dataclasses import dataclass, field

from kodro.runtime.tracer import Event, Tracer

from .schema import Lesson, SuccessCriterion

#: Points deducted from the starting 100 for each failing criterion.
SCORE_PENALTY_PER_FAILURE: int = 20

#: Tolerance for the "did the rover return to base" check, in metres.
RETURNS_TO_BASE_TOLERANCE_M: float = 0.4


@dataclass(frozen=True, slots=True)
class GradeResult:
    """Structured grader output (Section 6 of the spec)."""

    passed: bool
    reasons: list[str]
    score: int


@dataclass(frozen=True, slots=True)
class _Aggregates:
    """Per-submission rollups derived from the trace."""

    samples_collected: int = 0
    collisions: int = 0
    distance_travelled_m: float = 0.0
    battery_used_pct: float = 0.0
    step_count: int = 0
    final_x: float | None = None
    final_y: float | None = None


def grade(lesson: Lesson, tracer: Tracer, source: str = "") -> GradeResult:
    """Compare ``tracer`` events against ``lesson.success_criteria``.

    Args:
        lesson: The lesson definition.
        tracer: Tracer recorded during the pupil run.
        source: The pupil source code; used by ``uses_construct`` checks.

    Returns:
        A :class:`GradeResult` describing pass / fail, per-criterion
        reasons for any failures, and a 0-100 score.
    """
    aggregates = _compute_aggregates(tracer.events())
    reasons: list[str] = []
    for criterion in lesson.success_criteria:
        reason = _check_criterion(criterion, aggregates, lesson, source)
        if reason is not None:
            reasons.append(reason)
    score = max(0, 100 - SCORE_PENALTY_PER_FAILURE * len(reasons))
    return GradeResult(passed=not reasons, reasons=reasons, score=score)


# ---------------------------------------------------------------------------
# Aggregates
# ---------------------------------------------------------------------------


def _compute_aggregates(events: list[Event]) -> _Aggregates:
    samples = 0
    collisions = 0
    distance = 0.0
    final_x: float | None = None
    final_y: float | None = None
    battery_used = 0.0
    for event in events:
        if event.name == "collect_sample" and event.result is True:
            samples += 1
        if event.rover_state is not None:
            final_x = event.rover_state.x
            final_y = event.rover_state.y
            battery_used = max(battery_used, 100.0 - event.rover_state.battery_pct)
            # Real collision count from the engine snapshot, not a
            # kind=="collision" event stream (which is never emitted, so
            # no_collisions never actually failed). Collisions accumulate on the
            # rover, so the running max over snapshots is the total.
            collisions = max(collisions, event.rover_state.collisions)
            # Actual travelled distance from the engine, not the sum of commanded
            # move distances: a move clamped short by a wall or obstacle travels
            # less than commanded, so summing command args over-counts and could
            # pass a min_distance_travelled criterion the rover never met. The
            # engine accumulates true travel, so the running maximum over the
            # snapshots is the total distance actually covered.
            distance = max(distance, event.rover_state.distance_travelled_m)
    return _Aggregates(
        samples_collected=samples,
        collisions=collisions,
        distance_travelled_m=distance,
        battery_used_pct=battery_used,
        step_count=len(events),
        final_x=final_x,
        final_y=final_y,
    )


# ---------------------------------------------------------------------------
# Criterion dispatch
# ---------------------------------------------------------------------------


def _check_criterion(
    criterion: SuccessCriterion,
    aggregates: _Aggregates,
    lesson: Lesson,
    source: str,
) -> str | None:
    """Return a pupil-facing failure reason, or ``None`` if the criterion passes."""
    if (
        criterion.samples_collected is not None
        and aggregates.samples_collected < criterion.samples_collected
    ):
        return f"Collected {aggregates.samples_collected} of {criterion.samples_collected} samples."
    if criterion.no_collisions is True and aggregates.collisions > 0:
        return f"Recorded {aggregates.collisions} collision(s); none were expected."
    if (
        criterion.max_battery_used is not None
        and aggregates.battery_used_pct > criterion.max_battery_used
    ):
        return (
            f"Battery used {aggregates.battery_used_pct:.1f}% "
            f"(limit {criterion.max_battery_used:.1f}%)."
        )
    if criterion.uses_construct is not None and not _source_uses(source, criterion.uses_construct):
        return f"Code did not use the required '{criterion.uses_construct}' construct."
    if criterion.calls_in_order and not _calls_in_order(source, criterion.calls_in_order):
        names = ", ".join(f"{n}()" for n in criterion.calls_in_order)
        return f"The program does not call {names}, in that order."
    if criterion.returns_to_base is True and not _returns_to_base(aggregates, lesson):
        return "Rover did not return to base."
    if criterion.max_steps is not None and aggregates.step_count > criterion.max_steps:
        return f"Used {aggregates.step_count} API calls (limit {criterion.max_steps})."
    if (
        criterion.min_distance_travelled is not None
        and aggregates.distance_travelled_m < criterion.min_distance_travelled
    ):
        return (
            f"Travelled {aggregates.distance_travelled_m:.1f} m "
            f"(minimum {criterion.min_distance_travelled:.1f} m)."
        )
    return None


def _returns_to_base(aggregates: _Aggregates, lesson: Lesson) -> bool:
    if aggregates.final_x is None or aggregates.final_y is None:
        return False
    bx, by = lesson.world.base
    return (
        math.hypot(aggregates.final_x - bx, aggregates.final_y - by) <= RETURNS_TO_BASE_TOLERANCE_M
    )


# ---------------------------------------------------------------------------
# AST helpers for `uses_construct`
# ---------------------------------------------------------------------------

_CONSTRUCT_NODE_TYPES: dict[str, tuple[type[ast.AST], ...]] = {
    "while": (ast.While,),
    "for": (ast.For,),
    "if": (ast.If,),
    "function_def": (ast.FunctionDef, ast.AsyncFunctionDef),
    "function_call": (ast.Call,),
    "comparison": (ast.Compare,),
    "arithmetic": (ast.BinOp,),
    "assignment": (ast.Assign, ast.AugAssign),
    "logical": (ast.BoolOp,),
    "return": (ast.Return,),
}


def _is_constant_falsy(node: ast.AST) -> bool:
    """True when a test expression is a literal that can never be truthy."""
    if isinstance(node, ast.Constant):
        return not bool(node.value)
    # An empty display literal is a constant too: `while []:` never runs.
    if isinstance(node, ast.List | ast.Tuple | ast.Set):
        return not node.elts
    if isinstance(node, ast.Dict):
        return not node.keys
    return False


def _is_provably_empty_iterable(node: ast.AST) -> bool:
    """True when a ``for`` iterates something that is literally empty."""
    if isinstance(node, ast.List | ast.Tuple | ast.Set):
        return not node.elts
    if isinstance(node, ast.Dict):
        return not node.keys
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value == ""
    # range(0) and range(n, n) never yield. Only literal arguments are judged;
    # anything computed is left alone rather than guessed at.
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "range"
        and node.args
        and all(isinstance(a, ast.Constant) and isinstance(a.value, int) for a in node.args)
    ):
        # Narrowed to int explicitly: ast.Constant.value is typed Any, so the
        # comparisons below would otherwise leak Any into a bool return.
        values: list[int] = [
            a.value for a in node.args if isinstance(a, ast.Constant) and isinstance(a.value, int)
        ]
        if len(values) == 1:
            return values[0] <= 0
        if len(values) >= 2:
            start, stop = values[0], values[1]
            step = values[2] if len(values) > 2 else 1
            if step == 0:
                return False
            return start >= stop if step > 0 else start <= stop
    return False


def _calls_in_order(source: str, names: list[str]) -> bool:
    """Are all of ``names`` called, in this relative order, somewhere in source?

    Static, like ``uses_construct``: the executor detaches its trace hooks, so
    the call sequence is read from the parse tree in source order rather than
    from a runtime trace. Other calls may appear between them. A lesson whose
    whole subject is "these steps, in this order" needs to be able to say so;
    checking distance alone let a pupil delete two thirds of the taught program
    and still score 100.
    """
    try:
        tree = ast.parse(source)
    except (SyntaxError, RecursionError):
        # Deep nesting exhausts the parser's stack, which is a RecursionError,
        # not a SyntaxError. Unreadable source cannot satisfy the criterion.
        return False
    called: list[tuple[int, int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            called.append((node.lineno, node.col_offset, node.func.id))
    index = 0
    for _lineno, _col, name in sorted(called):
        if index < len(names) and name == names[index]:
            index += 1
    return index == len(names)


def _has_variable_leaf(node: ast.AST) -> bool:
    """Does this expression contain anything that can differ between two runs?

    A tree of pure literals (``1 > 0``, ``2 + 2 == 4``) answers the same every
    time, so branching on it is not a decision. Mirrors lesson-grader.jsx
    hasVariableLeaf.
    """
    for child in ast.walk(node):
        if isinstance(child, ast.Name | ast.Call | ast.Attribute | ast.Subscript):
            return True
    return False


def _is_live(node: ast.AST, tree: ast.AST) -> bool:
    """Reject constructs that provably cannot do the work the lesson asks for.

    A criterion such as ``uses_construct: if`` exists because the lesson is
    teaching selection. A dead ``if False:`` satisfies the node-presence test
    while teaching nothing and doing nothing, which lets a pupil pass a
    sensor-reading lesson without ever reading the sensor.

    This is a STATIC check, and deliberately so: the executor detaches every
    trace hook (``sys.settrace(None)``) because tracing a force-killed pupil
    thread could deadlock the run, so runtime line coverage is not available
    here. It therefore rejects what is *provably* dead at parse time rather
    than everything that happens not to run on a given input. That covers the
    deliberate-gaming cases; a condition that is merely false at runtime is
    still counted, and that is the honest limit of the check.
    """
    if isinstance(node, ast.While):
        # `while True:` with a break is an ordinary idiom, so only a body that
        # can never run is rejected here.
        return not _is_constant_falsy(node.test)
    if isinstance(node, ast.If):
        # An `if` on a literal is not selection. `if False:` never runs and
        # `if True:` always does; neither asks a question, so neither
        # demonstrates the concept a lesson requiring `if` is teaching. A pupil
        # could write `if True:` around a fixed route and be told they had
        # learned to choose. The condition has to depend on something.
        #
        # Rejecting only bare literals was not enough: `if 1 > 0:` is a Compare
        # of two Constants, not a Constant, and it satisfied every selection
        # lesson without reading a sensor. The test must contain something that
        # can vary between runs.
        return _has_variable_leaf(node.test) and not _is_constant_falsy(node.test)
    if isinstance(node, ast.For):
        return not _is_provably_empty_iterable(node.iter)
    if isinstance(node, ast.Assign | ast.AugAssign):
        # A variable nobody reads is not "using variables", it is a dead store.
        # `x = 2` followed by nothing satisfies the node-presence test while
        # demonstrating none of what a variables lesson teaches: that a named
        # value can be defined once and used elsewhere. The same rule as a
        # function nobody calls, for the same reason.
        targets = []
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    targets.append(t.id)
        elif isinstance(node.target, ast.Name):
            targets.append(node.target.id)
        if not targets:
            return True  # tuple/subscript targets: beyond this rule's remit
        for other in ast.walk(tree):
            if (
                isinstance(other, ast.Name)
                and isinstance(other.ctx, ast.Load)
                and other.id in targets
            ):
                return True
        return False
    if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
        # A definition nobody ever names is not modular design, it is dead
        # code. Any mention of the name outside the definition counts, so a
        # function passed as a value still qualifies.
        for other in ast.walk(tree):
            if isinstance(other, ast.Name) and other.id == node.name:
                return True
        return False
    return True


def _source_uses(source: str, construct: str) -> bool:
    """Return True if ``source`` contains an AST node of the given construct."""
    if not source.strip():
        return False
    try:
        tree = ast.parse(source)
    except (SyntaxError, RecursionError):
        # Deep nesting exhausts the parser's stack, which is a RecursionError,
        # not a SyntaxError. Unreadable source cannot satisfy the criterion.
        return False
    if construct == "recursion":
        return _has_recursion(tree)
    node_types = _CONSTRUCT_NODE_TYPES.get(construct)
    if node_types is None:
        return False
    return any(isinstance(node, node_types) and _is_live(node, tree) for node in ast.walk(tree))


def _has_recursion(tree: ast.AST) -> bool:
    """Return True if any function defined in ``tree`` calls itself by name."""
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            name = node.name
            for inner in ast.walk(node):
                if isinstance(inner, ast.Call):
                    func = inner.func
                    if isinstance(func, ast.Name) and func.id == name:
                        return True
    return False


# ---------------------------------------------------------------------------
# Re-exports for callers that prefer a flat import path
# ---------------------------------------------------------------------------

__all__ = ("GradeResult", "grade")

# Silence the "unused import" rule for the dataclass `field` import that
# tests sometimes patch through; kept for symmetry with other modules.
_ = field
