"""Exact-boundary behaviour of every numeric success criterion.

A second mutation run over ``lessons/grader.py``, after the first round of
boundary tests, left four operator flips alive in ``_check_criterion`` and
``_returns_to_base``:

    max_battery_used        >  ->  >=
    max_steps               >  ->  >=
    min_distance_travelled  <  ->  <=
    returns-to-base         <= ->  <

Each one decides pass or fail for a pupil sitting exactly on the limit. A
submission that uses precisely the battery allowance, takes precisely the step
budget, travels precisely the required distance, or stops precisely on the
tolerance circle must pass: the criterion is a limit, not a strict inequality.
Nothing asserted that, so all four could be inverted silently.

These call ``_check_criterion`` with constructed aggregates rather than driving
a whole run, because landing a simulated rover exactly on a boundary is not
reproducible, and a boundary test that cannot hit the boundary proves nothing.
"""

from __future__ import annotations

import math

import pytest

from kodro.lessons.grader import (
    RETURNS_TO_BASE_TOLERANCE_M,
    _Aggregates,
    _check_criterion,
    _returns_to_base,
)
from kodro.lessons.schema import Lesson, SuccessCriterion, load_library

LESSON: Lesson = load_library()[0]


def _crit(**kwargs: object) -> SuccessCriterion:
    return SuccessCriterion(**kwargs)  # type: ignore[arg-type]


# --------------------------------------------------------------- battery
@pytest.mark.parametrize(
    ("used", "limit", "passes"),
    [(9.9, 10.0, True), (10.0, 10.0, True), (10.1, 10.0, False)],
)
def test_battery_limit_is_inclusive(used: float, limit: float, passes: bool) -> None:
    """Kills `battery_used_pct > limit` -> `>=`, which fails a pupil exactly on budget."""
    reason = _check_criterion(
        _crit(max_battery_used=limit), _Aggregates(battery_used_pct=used), LESSON, ""
    )
    assert (reason is None) is passes, f"{used}% against a {limit}% limit: {reason}"


# ----------------------------------------------------------------- steps
@pytest.mark.parametrize(
    ("steps", "limit", "passes"),
    [(9, 10, True), (10, 10, True), (11, 10, False)],
)
def test_step_budget_is_inclusive(steps: int, limit: int, passes: bool) -> None:
    """Kills `step_count > max_steps` -> `>=`, which fails a pupil on the exact budget."""
    reason = _check_criterion(_crit(max_steps=limit), _Aggregates(step_count=steps), LESSON, "")
    assert (reason is None) is passes, f"{steps} steps against a {limit} budget: {reason}"


# -------------------------------------------------------------- distance
@pytest.mark.parametrize(
    ("travelled", "required", "passes"),
    [(2.9, 3.0, False), (3.0, 3.0, True), (3.1, 3.0, True)],
)
def test_minimum_distance_is_inclusive(travelled: float, required: float, passes: bool) -> None:
    """Kills `distance < min_distance` -> `<=`, which fails a pupil at exactly the distance."""
    reason = _check_criterion(
        _crit(min_distance_travelled=required),
        _Aggregates(distance_travelled_m=travelled),
        LESSON,
        "",
    )
    assert (reason is None) is passes, f"{travelled} m against {required} m: {reason}"


# -------------------------------------------------------- returns to base
def _lesson_based_at_origin() -> Lesson:
    """A lesson identical to the real one but based at (0, 0).

    No shipped lesson allows this test to be written honestly. The tolerance is
    0.4 and every real base is a value like 1.0, and `1.0 + 0.4 - 1.0` is
    0.3999999999999999 in binary floating point, strictly inside the circle. The
    exact boundary is therefore unreachable for all 24 lessons, which makes the
    `<=` to `<` flip an equivalent mutant in practice.

    It is still worth pinning the intended semantics: from the origin the
    arithmetic is exact, so this states that the tolerance is inclusive and will
    catch the flip if a lesson ever adopts a base where the boundary is
    reachable.
    """
    world = LESSON.world.model_copy(update={"base": (0.0, 0.0)})
    return LESSON.model_copy(update={"world": world})


def test_the_tolerance_is_inclusive() -> None:
    """Kills `hypot(...) <= TOLERANCE` -> `<`, which rejects a rover on the circle."""
    lesson = _lesson_based_at_origin()

    # Guard the guard: if this stops being exact the assertion below goes vacuous.
    assert math.hypot(RETURNS_TO_BASE_TOLERANCE_M, 0.0) == RETURNS_TO_BASE_TOLERANCE_M

    on_the_line = _Aggregates(final_x=RETURNS_TO_BASE_TOLERANCE_M, final_y=0.0)
    just_inside = _Aggregates(final_x=RETURNS_TO_BASE_TOLERANCE_M * 0.99, final_y=0.0)
    just_outside = _Aggregates(final_x=RETURNS_TO_BASE_TOLERANCE_M * 1.01, final_y=0.0)

    assert _returns_to_base(on_the_line, lesson) is True, "exactly on the tolerance must count"
    assert _returns_to_base(just_inside, lesson) is True
    assert _returns_to_base(just_outside, lesson) is False


def test_real_lesson_bases_still_behave_either_side_of_the_tolerance() -> None:
    """The shipped bases cannot hit the boundary, but must still bracket it."""
    bx, by = LESSON.world.base
    inside = _Aggregates(final_x=bx + RETURNS_TO_BASE_TOLERANCE_M * 0.5, final_y=by)
    outside = _Aggregates(final_x=bx + RETURNS_TO_BASE_TOLERANCE_M * 2.0, final_y=by)
    assert _returns_to_base(inside, LESSON) is True
    assert _returns_to_base(outside, LESSON) is False


def test_a_run_with_no_final_position_has_not_returned() -> None:
    """Kills the `final_x is None or final_y is None` -> `and` mutation.

    With `and`, a run that recorded one coordinate but not the other would fall
    through to the distance maths and raise on the missing one.
    """
    bx, by = LESSON.world.base
    assert _returns_to_base(_Aggregates(final_x=None, final_y=None), LESSON) is False
    assert _returns_to_base(_Aggregates(final_x=bx, final_y=None), LESSON) is False
    assert _returns_to_base(_Aggregates(final_x=None, final_y=by), LESSON) is False


# ------------------------------------------------------ existing criteria
@pytest.mark.parametrize(
    ("collected", "required", "passes"),
    [(1, 2, False), (2, 2, True), (3, 2, True)],
)
def test_sample_count_is_inclusive(collected: int, required: int, passes: bool) -> None:
    reason = _check_criterion(
        _crit(samples_collected=required), _Aggregates(samples_collected=collected), LESSON, ""
    )
    assert (reason is None) is passes


@pytest.mark.parametrize(("collisions", "passes"), [(0, True), (1, False), (5, False)])
def test_no_collisions_means_exactly_zero(collisions: int, passes: bool) -> None:
    reason = _check_criterion(
        _crit(no_collisions=True), _Aggregates(collisions=collisions), LESSON, ""
    )
    assert (reason is None) is passes


def test_a_failing_criterion_names_the_measurement() -> None:
    """A pupil needs the number, not just a verdict."""
    reason = _check_criterion(
        _crit(max_battery_used=10.0), _Aggregates(battery_used_pct=42.5), LESSON, ""
    )
    assert reason is not None
    assert "42.5" in reason, f"the reason does not quote what the pupil actually used: {reason}"
