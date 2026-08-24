"""Which constructs count toward a "use a while loop" style lesson, and the one
place the detector could crash on a pupil's program.

A third mutation pass over ``lessons/grader.py`` left three killable mutants in
the construct detector, each deciding whether a pupil gets credit:

    _is_live catch-all     `return True` -> `return False`
        governs every construct whose AST node is not special-cased: while, if,
        return, arithmetic, logical. Flipped, a pupil who satisfied a "use a
        while loop" lesson with a real while loop would stop getting credit.

    _is_live tuple target  `return True` -> `return False`
        an assignment with a tuple or subscript target (`a, b = 1, 2`). Flipped,
        a pupil demonstrating variables through unpacking loses the mark.

    _has_recursion         `and` -> `or`
        `isinstance(func, ast.Name) and func.id == name`. Flipped to `or`, a
        method-style call like `obj.method()` reaches `func.id` on an
        ast.Attribute, which has no `.id`, and the grader raises AttributeError
        on a pupil's program. The grader must never crash on pupil input.

Verified on the real grader before writing: every case below reflects current
behaviour, and each is the exact input that separates the live value from the
mutant.
"""

from __future__ import annotations

import ast

import pytest

from kodro.lessons.grader import _has_recursion, _source_uses

# A sensor read makes a test expression "live" (varies between runs), which the
# comparison/logical constructs need to count. Kept in a constant so the intent
# is obvious.
SENSE = "read_distance()"


@pytest.mark.parametrize(
    ("source", "construct"),
    [
        (f"while {SENSE} > 0.5:\n    move_forward(1)", "while"),
        (f"if {SENSE} > 1:\n    move_forward(1)", "if"),
        ("def f():\n    return 1\nf()", "return"),
        (f"if {SENSE} > 1 and {SENSE} < 5:\n    move_forward(1)", "logical"),
        ("move_forward(1 + 2)", "arithmetic"),
    ],
)
def test_unhandled_constructs_still_count(source: str, construct: str) -> None:
    """Kills the `_is_live` catch-all `return True` -> `return False`.

    None of these node types is special-cased in ``_is_live``, so each relies on
    the catch-all. If it flipped, a lesson requiring the construct would reject a
    pupil who used it correctly.
    """
    assert _source_uses(source, construct) is True, (
        f"a real {construct} construct stopped counting toward its lesson"
    )


def test_a_tuple_target_assignment_counts_as_an_assignment() -> None:
    """Kills the tuple/subscript-target `return True` -> `return False`.

    `a, b = 1, 2` has no simple Name target, so the detector falls to the
    "beyond this rule's remit" branch and counts it. A pupil demonstrating
    variables through unpacking must not be told they used no variable.
    """
    assert _source_uses("a, b = 1, 2\nmove_forward(a)", "assignment") is True
    # A subscript target is the same shape.
    assert _source_uses("xs = [0]\nxs[0] = 1\nmove_forward(xs[0])", "assignment") is True
    # The ordinary case must still work, so the above is not passing for the
    # wrong reason.
    assert _source_uses("x = 1\nmove_forward(x)", "assignment") is True


def test_a_dead_store_does_not_count() -> None:
    """Guard the guard: `_is_live` must still reject an assignment nobody reads.

    Otherwise a test that only ever expects True would pass even if the whole
    liveness check were disabled.
    """
    assert _source_uses("x = 1\nmove_forward(2)", "assignment") is False


def test_recursion_detection_survives_a_method_style_call() -> None:
    """Kills `_has_recursion`'s `and` -> `or`.

    Under `or`, a Call whose func is an ast.Attribute (a method-style call) makes
    the expression reach `func.id`, which an Attribute node does not have, and
    the grader raises. A pupil's program must never crash the grader, so this
    both pins the no-crash property and the correct verdicts.
    """
    # The mutant raises here rather than returning a bool.
    assert _has_recursion(ast.parse("def f():\n    return obj.method()")) is False
    assert _has_recursion(ast.parse("def f():\n    x.y.z()")) is False
    # Real self-recursion must still be detected.
    assert _has_recursion(ast.parse("def f():\n    return f()")) is True
    assert _has_recursion(ast.parse("def spin(n):\n    if n:\n        spin(n - 1)")) is True
    # A call to a different name is not recursion.
    assert _has_recursion(ast.parse("def f():\n    g()")) is False
