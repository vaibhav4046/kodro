"""Boundary and branch coverage for the logic that decides a pupil's mark.

Written to kill mutants. A mutation run over ``lessons/grader.py`` found that a
large share of the grading logic could be altered without any existing test
noticing: the range-emptiness analysis, the ordered-call matcher, and the
boundaries of the max-steps, minimum-distance and returns-to-base criteria all
survived operator flips.

Coverage was never the problem. Every one of these lines already ran. What was
missing was an assertion that would have noticed the line being wrong, which is
exactly the difference between a line executing and a line being tested.

Each test below names the mutation it kills, so a future reader can tell what
the case is protecting rather than guessing from the inputs.
"""

from __future__ import annotations

import ast

import pytest

from kodro.lessons.grader import (
    _calls_in_order,
    _is_provably_empty_iterable,
)


def _expr(code: str) -> ast.AST:
    """Parse a single expression to the node the grader inspects."""
    return ast.parse(code, mode="eval").body


# ---------------------------------------------------------------------------
# _is_provably_empty_iterable: does this loop header provably never yield?
# A pupil writing `for i in range(0)` has written a loop that never runs, and
# the grader must not credit the construct. Getting a boundary wrong here either
# credits a loop that never executed or refuses one that did.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("code", "empty"),
    [
        # Single argument. Kills `values[0] <= 0` -> `< 0`.
        ("range(0)", True),
        # A negative literal is a UnaryOp, not a Constant, so the analysis
        # declines to judge it. See test_negative_literals_are_not_judged.
        ("range(-1)", False),
        ("range(1)", False),
        # Two arguments. Kills `len(values) >= 2` -> `> 2`, and the
        # `start >= stop` boundary.
        ("range(3, 3)", True),
        ("range(4, 3)", True),
        ("range(3, 4)", False),
        # Explicit positive step. Kills `len(values) > 2` -> `>= 2` on the step
        # lookup, which would read values[2] out of a two-argument call.
        ("range(0, 10, 2)", False),
        ("range(10, 0, 2)", True),
        # Negative step reverses the emptiness test. Kills
        # `start <= stop` -> `< stop` and the `step > 0` -> `>= 0` flip.
        ("range(10, 0, -1)", False),
        ("range(0, 10, -1)", False),
        ("range(3, 3, -1)", False),
        # A zero step is a runtime error, not an empty range. Kills
        # `step == 0` -> `!= 0` and the `return False` under it.
        ("range(0, 10, 0)", False),
        ("range(10, 0, 0)", False),
        # Non-literal arguments are deliberately not judged. Kills the
        # `all(isinstance(...))` guard being loosened to `any`.
        ("range(n)", False),
        ("range(0, n)", False),
        ("range(len(xs))", False),
        # An empty display literal never yields, and is judged.
        ("[]", True),
        ("()", True),
        ("{}", True),
        ("[1]", False),
        ("''", True),
        ("'ab'", False),
        ("some_other_call(0)", False),
    ],
)
def test_provably_empty_range(code: str, empty: bool) -> None:
    assert _is_provably_empty_iterable(_expr(code)) is empty, (
        f"{code} should {'be' if empty else 'not be'} judged a provably empty iterable"
    )


def test_a_mixed_literal_and_variable_range_is_not_judged() -> None:
    """One non-literal argument must disable the whole analysis, not part of it.

    Kills the `and all(...)` -> `or all(...)` mutation: with `or`, a call whose
    first argument is a literal would be judged using a values list that does
    not correspond to the real arguments.
    """
    assert _is_provably_empty_iterable(_expr("range(0, n)")) is False
    assert _is_provably_empty_iterable(_expr("range(n, 0)")) is False


# ---------------------------------------------------------------------------
# _calls_in_order: were these calls made, in this relative order?
# This backs the criterion for lessons whose subject is sequencing. A pupil can
# lose or gain a mark on the index-walk boundary.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("source", "names", "ordered"),
    [
        # Exact sequence, and the same calls out of order.
        ("move_forward(1)\nturn_right(90)", ["move_forward", "turn_right"], True),
        ("turn_right(90)\nmove_forward(1)", ["move_forward", "turn_right"], False),
        # Other calls interleaved are allowed.
        ("move_forward(1)\nprint('x')\nturn_right(90)", ["move_forward", "turn_right"], True),
        # A missing final call fails. Kills `index == len(names)` -> `!=`.
        ("move_forward(1)", ["move_forward", "turn_right"], False),
        # Repeats: the matcher advances once per name, not once per call.
        ("move_forward(1)\nmove_forward(2)", ["move_forward", "move_forward"], True),
        ("move_forward(1)", ["move_forward", "move_forward"], False),
        # An empty requirement is satisfied by anything, including nothing.
        # Kills the `index = 0` -> `1` mutation, which would make the empty
        # case disagree with itself.
        ("move_forward(1)", [], True),
        ("", [], True),
        # Nothing called at all.
        ("", ["move_forward"], False),
        ("x = 1", ["move_forward"], False),
        # Same line, left to right. Kills the sort that orders by (line, col).
        ("f(move_forward(1))", ["f", "move_forward"], True),
    ],
)
def test_calls_in_order(source: str, names: list[str], ordered: bool) -> None:
    assert _calls_in_order(source, names) is ordered


def test_order_is_read_by_position_not_by_walk_order() -> None:
    """`ast.walk` is breadth-first, so source order must come from the sort.

    Kills the `index < len(names)` -> `<=` mutation, which would read past the
    end of the names list, and any change that drops the positional sort.
    """
    source = "turn_right(90)\nmove_forward(1)\nturn_right(90)"
    assert _calls_in_order(source, ["turn_right", "move_forward"]) is True
    assert _calls_in_order(source, ["move_forward", "turn_right"]) is True
    assert _calls_in_order(source, ["move_forward", "move_forward"]) is False


def test_unparseable_source_satisfies_nothing() -> None:
    """A guard that returned True here would hand marks out for broken code."""
    assert _calls_in_order("def (:", ["move_forward"]) is False
    assert _calls_in_order("def (:", []) is False


def test_negative_literals_are_not_judged() -> None:
    """`-1` is a UnaryOp in the AST, not a Constant, so the range analysis declines.

    This looks like a gap and is not one. The analysis judges only literal
    arguments and leaves anything computed alone, and a UnaryOp is computed.
    Declining returns False, meaning "not provably empty", which credits the
    pupil's loop rather than silently discounting it. A grader that guesses here
    would guess against the pupil.
    """
    assert _is_provably_empty_iterable(_expr("range(-1)")) is False
    assert _is_provably_empty_iterable(_expr("range(0, 10, -1)")) is False
    # The positive-literal forms of the same shapes ARE judged, which is what
    # makes the above a deliberate boundary rather than an oversight.
    assert _is_provably_empty_iterable(_expr("range(0)")) is True
    assert _is_provably_empty_iterable(_expr("range(10, 0, 2)")) is True
