"""Auto-grader that compares a recorded trace against lesson success criteria.

Given a :class:`~robolearn.runtime.tracer.Tracer` produced by the pupil's
run and the matching :class:`~robolearn.lessons.schema.Lesson`, the
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

from robolearn.runtime.tracer import Event, Tracer

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
        if event.kind == "collision":
            collisions += 1
        if event.rover_state is not None:
            final_x = event.rover_state.x
            final_y = event.rover_state.y
            battery_used = max(battery_used, 100.0 - event.rover_state.battery_pct)
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


def _source_uses(source: str, construct: str) -> bool:
    """Return True if ``source`` contains an AST node of the given construct."""
    if not source.strip():
        return False
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return False
    if construct == "recursion":
        return _has_recursion(tree)
    node_types = _CONSTRUCT_NODE_TYPES.get(construct)
    if node_types is None:
        return False
    return any(isinstance(node, node_types) for node in ast.walk(tree))


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
