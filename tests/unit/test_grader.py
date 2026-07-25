"""Grader tests with golden traces (Task 9)."""

from __future__ import annotations

from robolearn.lessons.grader import (
    SCORE_PENALTY_PER_FAILURE,
    GradeResult,
    _has_recursion,
    _source_uses,
    grade,
)
from robolearn.lessons.schema import Lesson, SuccessCriterion, WorldDef
from robolearn.runtime.tracer import Event, RoverSnapshot, Tracer

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _lesson(
    *,
    criteria: list[SuccessCriterion],
    base: tuple[float, float] = (1.0, 1.0),
    allowed_constructs: tuple[str, ...] = ("function_call",),
) -> Lesson:
    return Lesson(
        id="x",
        title="x",
        key_stage="KS3",
        ct_concepts=["sequence"],
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",
        intro="t",
        starter_code="move_forward(1)",
        allowed_constructs=list(allowed_constructs),
        max_lines=10,
        world=WorldDef(base=base),
        success_criteria=criteria,
    )


def _tracer_with(events: list[Event]) -> Tracer:
    t = Tracer()
    for e in events:
        t.record(e)
    return t


def _snap(
    x: float = 0.0,
    y: float = 0.0,
    battery: float = 100.0,
    distance: float = 0.0,
    collisions: int = 0,
) -> RoverSnapshot:
    return RoverSnapshot(
        x=x,
        y=y,
        heading_deg=0.0,
        battery_pct=battery,
        samples_held=0,
        samples_collected=0,
        collisions=collisions,
        distance_travelled_m=distance,
    )


# ---------------------------------------------------------------------------
# GradeResult shape
# ---------------------------------------------------------------------------


def test_grade_returns_gradeable_object() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(samples_collected=0)])
    result = grade(lesson, Tracer(), "")
    assert isinstance(result, GradeResult)
    assert isinstance(result.passed, bool)
    assert isinstance(result.reasons, list)
    assert isinstance(result.score, int)


def test_empty_lesson_passes_empty_trace() -> None:
    lesson = _lesson(criteria=[])
    result = grade(lesson, Tracer(), "")
    assert result.passed is True
    assert result.reasons == []
    assert result.score == 100


# ---------------------------------------------------------------------------
# samples_collected criterion
# ---------------------------------------------------------------------------


def test_samples_collected_pass() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(samples_collected=1)])
    tracer = _tracer_with(
        [Event(0, 0, "sample", "collect_sample", (), True, None)],
    )
    assert grade(lesson, tracer).passed is True


def test_samples_collected_fail_reports_count() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(samples_collected=3)])
    tracer = _tracer_with(
        [Event(0, 0, "sample", "collect_sample", (), True, None)],
    )
    result = grade(lesson, tracer)
    assert result.passed is False
    assert "1 of 3" in result.reasons[0]


def test_samples_collected_ignores_failed_collect() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(samples_collected=1)])
    tracer = _tracer_with(
        [
            Event(0, 0, "sample", "collect_sample", (), False, None),
            Event(0, 1, "sample", "collect_sample", (), False, None),
        ],
    )
    assert grade(lesson, tracer).passed is False


# ---------------------------------------------------------------------------
# no_collisions criterion
# ---------------------------------------------------------------------------


def test_no_collisions_pass_when_no_collision_events() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(no_collisions=True)])
    assert grade(lesson, Tracer()).passed is True


def test_no_collisions_fail_when_collision_recorded() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(no_collisions=True)])
    tracer = _tracer_with(
        [Event(0, 0, "call", "move_forward", (1.0,), None, _snap(collisions=1))],
    )
    result = grade(lesson, tracer)
    assert result.passed is False
    assert "collision" in result.reasons[0]


# ---------------------------------------------------------------------------
# max_battery_used criterion
# ---------------------------------------------------------------------------


def test_max_battery_used_pass_when_below_limit() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(max_battery_used=60.0)])
    tracer = _tracer_with(
        [
            Event(0, 0, "call", "move_forward", (5.0,), None, _snap(battery=95.0)),
        ],
    )
    assert grade(lesson, tracer).passed is True


def test_max_battery_used_fail_above_limit() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(max_battery_used=10.0)])
    tracer = _tracer_with(
        [
            Event(0, 0, "call", "move_forward", (5.0,), None, _snap(battery=70.0)),
        ],
    )
    result = grade(lesson, tracer)
    assert result.passed is False
    assert "limit 10" in result.reasons[0]


# ---------------------------------------------------------------------------
# uses_construct criterion
# ---------------------------------------------------------------------------


def test_uses_construct_pass_when_source_contains_while() -> None:
    lesson = _lesson(
        criteria=[SuccessCriterion(uses_construct="while")],
        allowed_constructs=("while", "function_call"),
    )
    source = "while True:\n    move_forward(1)\n"
    assert grade(lesson, Tracer(), source).passed is True


def test_uses_construct_fail_when_source_missing() -> None:
    lesson = _lesson(
        criteria=[SuccessCriterion(uses_construct="while")],
        allowed_constructs=("while", "function_call"),
    )
    source = "move_forward(5)\n"
    result = grade(lesson, Tracer(), source)
    assert result.passed is False
    assert "'while'" in result.reasons[0]


def test_source_uses_returns_false_for_empty_source() -> None:
    assert _source_uses("", "while") is False


def test_source_uses_returns_false_for_unknown_construct() -> None:
    assert _source_uses("move_forward(1)", "telekinesis") is False


def test_source_uses_returns_false_on_syntax_error() -> None:
    assert _source_uses("def broken(", "function_def") is False


def test_source_uses_detects_for_loop() -> None:
    assert _source_uses("for i in range(3): pass", "for") is True


def test_source_uses_detects_if_statement() -> None:
    assert _source_uses("if True: pass", "if") is True


def test_source_uses_detects_function_def() -> None:
    assert _source_uses("def f():\n    pass\n\nf()\n", "function_def") is True


def test_source_uses_rejects_a_function_that_is_never_called() -> None:
    """A definition nobody names is dead code, not modular design.

    The lessons that require ``function_def`` are teaching pupils to decompose
    a route into reusable procedures. A ``def`` that is never called satisfies
    a bare node-presence check while doing none of that, so it does not count.
    This test previously asserted the opposite and was pinning the weaker
    behaviour in place.
    """
    assert _source_uses("def f():\n    pass", "function_def") is False


def test_source_uses_rejects_provably_dead_constructs() -> None:
    """The construct must be able to run, or it teaches nothing.

    ``if False:`` satisfies "the source contains an If node" while guaranteeing
    the body never executes, which let a pupil pass a sensor-reading lesson
    without reading the sensor. Only provably dead constructs are rejected:
    ``while True:`` is an ordinary idiom and ``if True:`` still runs its body,
    so both still count.
    """
    assert _source_uses("if False:\n    pass", "if") is False
    assert _source_uses("while False:\n    pass", "while") is False
    assert _source_uses("for i in range(0):\n    pass", "for") is False
    assert _source_uses("for i in []:\n    pass", "for") is False
    # Live constructs are unaffected.
    assert _source_uses("while True:\n    move_forward(1)", "while") is True
    assert _source_uses("for i in range(4):\n    move_forward(1)", "for") is True


def test_source_uses_detects_recursion() -> None:
    src = "def f(n):\n    if n == 0:\n        return\n    f(n - 1)\n"
    assert _has_recursion(__import__("ast").parse(src)) is True


def test_recursion_not_detected_without_self_call() -> None:
    src = "def f(n):\n    return n + 1\n"
    assert _has_recursion(__import__("ast").parse(src)) is False


# ---------------------------------------------------------------------------
# returns_to_base criterion
# ---------------------------------------------------------------------------


def test_returns_to_base_pass_when_final_pos_near_base() -> None:
    lesson = _lesson(
        criteria=[SuccessCriterion(returns_to_base=True)],
        base=(5.0, 5.0),
    )
    tracer = _tracer_with(
        [
            Event(0, 0, "call", "move_forward", (1.0,), None, _snap(x=5.1, y=5.0)),
        ],
    )
    assert grade(lesson, tracer).passed is True


def test_returns_to_base_fail_when_final_pos_far_from_base() -> None:
    lesson = _lesson(
        criteria=[SuccessCriterion(returns_to_base=True)],
        base=(5.0, 5.0),
    )
    tracer = _tracer_with(
        [
            Event(0, 0, "call", "move_forward", (1.0,), None, _snap(x=8.0, y=8.0)),
        ],
    )
    result = grade(lesson, tracer)
    assert result.passed is False
    assert "return to base" in result.reasons[0]


def test_returns_to_base_fail_when_no_snapshots() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(returns_to_base=True)])
    tracer = _tracer_with(
        [Event(0, 0, "call", "move_forward", (1.0,), None, None)],
    )
    assert grade(lesson, tracer).passed is False


# ---------------------------------------------------------------------------
# max_steps + min_distance_travelled
# ---------------------------------------------------------------------------


def test_max_steps_pass_when_below_limit() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(max_steps=5)])
    tracer = _tracer_with(
        [Event(0, i, "call", "move_forward", (1.0,), None, None) for i in range(3)],
    )
    assert grade(lesson, tracer).passed is True


def test_max_steps_fail_above_limit() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(max_steps=2)])
    tracer = _tracer_with(
        [Event(0, i, "call", "move_forward", (1.0,), None, None) for i in range(5)],
    )
    result = grade(lesson, tracer)
    assert result.passed is False
    assert "5 API calls" in result.reasons[0]


def test_min_distance_travelled_pass() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(min_distance_travelled=3.0)])
    tracer = _tracer_with(
        [
            Event(0, 0, "call", "move_forward", (2.0,), None, _snap(distance=2.0)),
            Event(0, 1, "call", "move_forward", (2.0,), None, _snap(distance=4.0)),
        ],
    )
    assert grade(lesson, tracer).passed is True


def test_min_distance_travelled_counts_actual_not_commanded() -> None:
    # A rover commanded to move far but clamped short by a wall or obstacle must
    # NOT pass a min_distance_travelled criterion it did not physically meet: the
    # grader reads the engine's actual travelled distance, not the command args.
    lesson = _lesson(criteria=[SuccessCriterion(min_distance_travelled=3.0)])
    tracer = _tracer_with(
        [
            Event(0, 0, "call", "move_forward", (5.0,), None, _snap(distance=1.0)),
            Event(0, 1, "call", "move_forward", (5.0,), None, _snap(distance=1.0)),
        ],
    )
    assert grade(lesson, tracer).passed is False


def test_min_distance_travelled_fail() -> None:
    lesson = _lesson(criteria=[SuccessCriterion(min_distance_travelled=10.0)])
    tracer = _tracer_with(
        [Event(0, 0, "call", "move_forward", (1.0,), None, _snap(distance=1.0))],
    )
    result = grade(lesson, tracer)
    assert result.passed is False
    assert "minimum 10" in result.reasons[0]


# ---------------------------------------------------------------------------
# Score arithmetic + multi-criterion accumulation
# ---------------------------------------------------------------------------


def test_score_loses_points_per_failed_criterion() -> None:
    lesson = _lesson(
        criteria=[
            SuccessCriterion(samples_collected=5),
            SuccessCriterion(no_collisions=True),
        ],
    )
    tracer = _tracer_with(
        [
            Event(0, 0, "call", "move_forward", (1.0,), None, _snap(collisions=1)),
        ],
    )
    result = grade(lesson, tracer)
    assert result.passed is False
    assert len(result.reasons) == 2
    assert result.score == 100 - 2 * SCORE_PENALTY_PER_FAILURE


def test_score_never_goes_below_zero() -> None:
    lesson = _lesson(
        criteria=[SuccessCriterion(samples_collected=i) for i in range(1, 12)],
    )
    result = grade(lesson, Tracer())
    assert result.score == 0
