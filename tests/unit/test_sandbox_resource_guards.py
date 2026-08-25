"""The sandbox's resource-exhaustion guards must actually fire.

``runtime/sandbox.py`` is the security boundary between a pupil's program and
the machine. Mutation testing scored it at 30.0%: 21 of 30 mutants survived, and
two of the most consequential were confirmed to survive the entire 1,842-test
suite, not merely the sandbox-facing subset.

The two confirmed against everything were both ``or`` flipped to ``and`` inside
``_fold_const_int``:

    if left is None or right is None:              -> and
    if right < 0 or right > 32:                    -> and

The second one is the interesting failure. ``x < 0 and x > 32`` is never true
for any integer, so the mutant deletes the guard outright, and an exponent the
walker exists to refuse is instead computed. That guard is what stands between a
pupil typing ``10 ** 10 ** 7`` and a multi-megabyte integer allocated inside one
GIL-holding operation that the wall-clock timeout cannot interrupt.

The first is the same class as the ``RecursionError`` defects already in the
ledger: with ``and``, an expression where only one side folds to a constant
reaches ``abs(None)`` and ``is_safe`` raises out of a function documented never
to raise.

No test noticed either. Nothing here asserted that a size guard fires, only that
ordinary programs pass.

Every case below is constructed to sit exactly on the boundary it tests, since a
``<`` and a ``<=`` differ nowhere else, and each names the mutation it kills.
Values are read from the module's own constants so a retuned limit cannot leave
these assertions quietly testing the wrong number.
"""

from __future__ import annotations

from kodro.runtime.sandbox import (
    MAX_LITERAL_REPEAT,
    MAX_POW_EXP,
    find_violations,
    is_safe,
)


def kinds(source: str) -> list[str]:
    return [v.kind for v in find_violations(source)]


# --------------------------------------------------------------------------
# the attacks these guards exist to stop
# --------------------------------------------------------------------------


def test_a_bignum_bomb_is_refused() -> None:
    """The headline case, and the one the source comment describes."""
    assert "oversized-power" in kinds("y = 10 ** 10 ** 7")
    assert is_safe("y = 10 ** 10 ** 7") is False


def test_an_oversized_literal_repeat_is_refused() -> None:
    assert "oversized-repeat" in kinds(f"y = [0] * {MAX_LITERAL_REPEAT + 1}")
    assert "oversized-repeat" in kinds(f'y = "x" * {MAX_LITERAL_REPEAT + 1}')


# --------------------------------------------------------------------------
# is_safe must answer, never raise
# --------------------------------------------------------------------------


def test_a_half_constant_exponent_does_not_raise() -> None:
    """Kills `left is None or right is None` -> `and`.

    Only the left side of this exponent folds to a constant. Under the mutant
    the early return is skipped and `abs(None)` raises, so `is_safe` throws out
    of a function the rest of the product relies on never throwing. That is the
    same defect class as the RecursionError escapes already in the ledger.
    """
    assert is_safe("y = 2 ** (x + 5)") is True
    assert is_safe("y = 2 ** (5 + x)") is True
    assert is_safe("y = 2 ** (x * 5)") is True
    assert is_safe("y = 2 ** -x") is True


def test_a_non_constant_repeat_count_does_not_raise() -> None:
    """Kills the `and` chain in visit_BinOp becoming an `or`.

    Flipped, a non-Constant operand still reaches `operand.value` and the
    walker raises AttributeError on an ordinary pupil program.
    """
    assert is_safe("y = [0] * n") is True
    assert is_safe("y = n * [0]") is True


# --------------------------------------------------------------------------
# exactly on each boundary
# --------------------------------------------------------------------------


def test_an_exponent_exactly_at_the_limit_is_allowed() -> None:
    """Kills `abs(folded) > MAX_POW_EXP` -> `>=`."""
    assert kinds(f"y = 2 ** {MAX_POW_EXP}") == []
    assert "oversized-power" in kinds(f"y = 2 ** {MAX_POW_EXP + 1}")


def test_a_repeat_exactly_at_the_limit_is_allowed() -> None:
    """Kills `abs(operand.value) > MAX_LITERAL_REPEAT` -> `>=`."""
    assert kinds(f"y = [0] * {MAX_LITERAL_REPEAT}") == []
    assert "oversized-repeat" in kinds(f"y = [0] * {MAX_LITERAL_REPEAT + 1}")


def test_a_folded_operand_exactly_at_the_limit_is_not_short_circuited() -> None:
    """Kills both `abs(left) > MAX_POW_EXP` / `abs(right) > MAX_POW_EXP` -> `>=`.

    An operand exactly on the cap is not over it, so folding continues and the
    product is judged on its real value. Asserted from both sides because the
    comparison appears once per operand and each needs its own witness.
    """
    assert kinds(f"y = 2 ** ({MAX_POW_EXP} * 1)") == []
    assert kinds(f"y = 2 ** (1 * {MAX_POW_EXP})") == []


def test_a_pow_exponent_of_zero_is_computed_not_refused() -> None:
    """Kills `right < 0` -> `right <= 0` in the nested-power guard."""
    assert kinds("y = 2 ** (2 ** 0)") == []


def test_a_nested_pow_exponent_of_exactly_32_is_computed() -> None:
    """Kills `right > 32` -> `right >= 32`.

    32 is the documented ceiling for actually evaluating a nested power. At
    exactly 32 the fold proceeds, and 1 ** 32 is 1, which is harmless.
    """
    assert kinds("y = 2 ** (1 ** 32)") == []


# --------------------------------------------------------------------------
# the conservative short-circuit, pinned as deliberate
# --------------------------------------------------------------------------


def test_folding_refuses_early_rather_than_computing_a_bignum() -> None:
    """Kills the two `or` -> `and` flips that delete the short-circuit.

    Both of these are arithmetically harmless: 99999 * 0 is 0, and 1 ** 4000 is
    1, so a folder that evaluated them would pass both. The sandbox refuses them
    anyway, because evaluating an intermediate that large is exactly what it
    exists not to do. The refusal is a deliberate false positive, documented in
    `_fold_const_int`, and pinning it here is what makes the mutants die: under
    `and` the guard is skipped, the value is computed, and both come back clean.
    """
    assert "oversized-power" in kinds("y = 2 ** (99999 * 0)"), (
        "an operand past the cap must refuse immediately, not be multiplied out"
    )
    assert "oversized-power" in kinds("y = 2 ** (1 ** 4000)"), (
        "a nested exponent past 32 must refuse immediately, not be evaluated"
    )


def test_ordinary_arithmetic_is_still_allowed() -> None:
    """Guard the guard: none of the above may make the sandbox refuse everything."""
    for source in (
        "y = 2 ** 2",
        "y = 2 ** 10",
        "y = [0] * 10",
        "y = 'x' * 3",
        "y = 5 + 3 * 2",
        "move_forward(10)",
    ):
        assert kinds(source) == [], f"refused an ordinary program: {source}"


# --------------------------------------------------------------------------
# the bypass mutation testing found
# --------------------------------------------------------------------------


def test_a_bool_in_the_exponent_does_not_launder_a_bignum_bomb() -> None:
    """Regression for a real sandbox bypass, found by mutation testing.

    ``_fold_const_int`` used to return None for a bool, on the reasonable-looking
    grounds that a bool is not really an integer. One unfoldable operand makes
    the whole subtree fold to None, so the walker never saw an exponent at all:

        2 ** (1 * 10 ** 9)      refused
        2 ** (True * 10 ** 9)   ALLOWED

    Python evaluates ``True`` as 1 either way, so the allowed form still built a
    roughly 125 MB integer inside one GIL-holding operation that the wall-clock
    timeout cannot interrupt. Writing ``True`` instead of ``1`` was the entire
    bypass.

    These assertions only inspect the AST. None of them evaluates the
    expression, which is the point of catching it statically.
    """
    for laundered in (
        "y = 2 ** (True * 10 ** 9)",
        "y = 2 ** (True + 999999999)",
        "y = 2 ** (False + 10 ** 9)",
        "y = 2 ** (10 ** 9 * True)",
    ):
        assert "oversized-power" in kinds(laundered), f"bignum bomb slipped through: {laundered}"

    # The plain forms must still be refused, so the above is not passing because
    # the guard now refuses everything.
    assert "oversized-power" in kinds("y = 2 ** (1 * 10 ** 9)")
    assert "oversized-power" in kinds("y = 2 ** (10 ** 9)")


def test_folding_a_bool_does_not_refuse_ordinary_programs() -> None:
    """The other side of that fix: a small bool exponent is still fine."""
    assert kinds("y = 2 ** True") == []
    assert kinds("y = 2 ** (True + 1)") == []
    assert kinds("y = 2 ** False") == []


def test_non_integer_constants_still_do_not_fold() -> None:
    """Floats and strings are not integers and must stay unfoldable."""
    assert kinds("y = 2 ** 1.5") == []
    assert kinds("y = 2 ** 'x'") == []
