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
    _MAX_TEMPLATE_SNIPPET,
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


# --------------------------------------------------------------------------
# reporting: a violation must name the thing it refused
# --------------------------------------------------------------------------


def names(source: str) -> list[str]:
    return [v.name for v in find_violations(source)]


def test_a_relative_import_is_named_rather_than_reported_as_empty() -> None:
    """Kills `node.module or "<relative>"` -> `and`.

    ``from . import x`` has no module name. Under the mutant the violation is
    named with the empty module instead of the placeholder, so the message a
    pupil reads loses the only clue about what was refused.
    """
    assert names("from . import x") == ["<relative>"]
    assert names("from os import path") == ["os"]


def test_a_leading_or_trailing_underscore_pair_is_not_a_dunder() -> None:
    """Kills `startswith("__") and endswith("__")` -> `or`.

    The mutant is over-restrictive rather than unsafe: it would refuse ordinary
    names like ``__total`` that begin with two underscores but are not dunders.
    A sandbox that refuses valid pupil code is still a broken sandbox.
    """
    assert find_violations("__foo = 1") == []
    assert find_violations("foo__ = 1") == []
    # And the real thing must still be caught, so the above is not passing
    # because dunder detection stopped working altogether.
    assert "dunder-attr" in [v.kind for v in find_violations("y = x.__class__")]


def test_a_format_template_without_attribute_access_is_allowed() -> None:
    """Kills the walker's final `return False` -> `return True`.

    Under the mutant every string literal that parses as a template is reported,
    so ordinary formatting is refused. Subscripting is explicitly legitimate per
    the function's own docstring.
    """
    assert find_violations('y = "{0}".format(a)') == []
    assert find_violations('y = "{0[0]}".format(a)') == []
    assert find_violations('y = "plain text"') == []
    # The escape it exists to catch must still be caught.
    assert "format-attr" in [v.kind for v in find_violations('y = "{0.__class__}".format(a)')]


def test_a_quoted_template_is_truncated_only_when_it_is_too_long() -> None:
    """Kills `len(text) <= _MAX_TEMPLATE_SNIPPET` -> `<` and the `- 1` offset.

    A template exactly at the limit is quoted whole; one past it is cut to
    exactly the limit with an ellipsis as the final character, so the message
    never grows past the width it promises.
    """
    exact = "{0." + "a" * (_MAX_TEMPLATE_SNIPPET - 4) + "}"
    assert len(exact) == _MAX_TEMPLATE_SNIPPET
    assert names(f'y = "{exact}".format(a)') == [exact], "at the limit, quote it whole"

    longer = "{0." + "a" * (_MAX_TEMPLATE_SNIPPET + 10) + "}"
    reported = names(f'y = "{longer}".format(a)')[0]
    assert len(reported) == _MAX_TEMPLATE_SNIPPET, "past the limit, cut to exactly the limit"
    assert reported.endswith("…"), "the cut must be visible as an ellipsis"
    assert reported[:-1] == longer[: _MAX_TEMPLATE_SNIPPET - 1]


def test_a_malformed_template_is_not_reported_as_an_attribute_walk() -> None:
    """Kills the `except ValueError` branch's `return False` -> `return True`.

    A template the formatter cannot parse has no field to walk, and
    ``str.format`` raises at runtime rather than leaking anything. Refusing it
    would fail ordinary pupil code containing a stray brace, which is a typo,
    not an escape attempt. This is a different `return False` from the one at
    the end of the function, and needed its own witness: the first version of
    this file killed that one and left this one alive.
    """
    for malformed in ('y = "{".format(a)', 'y = "}".format(a)', 'y = "{0".format(a)'):
        assert find_violations(malformed) == [], f"a typo is not an escape: {malformed}"
