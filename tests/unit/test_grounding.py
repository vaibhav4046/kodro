"""Tests for the grounding / invention metric (robolearn.grounding)."""

from __future__ import annotations

from robolearn.grounding import FITTED_DEFAULT, check_grounding

# A program that uses only fitted commands and allowed builtins.
_GROUNDED = "for i in range(4):\n    move_forward(1)\n    turn_left(90)\n"
# A program that invents a command the build does not expose.
_INVENTED = "read_gps()\nmove_forward(1)\nactivate_laser()\n"


def test_grounded_program_has_no_invented_symbols() -> None:
    result = check_grounding(_GROUNDED)
    assert result.grounded is True
    assert result.invented == ()
    assert result.syntax_error is None


def test_invented_symbols_are_reported_sorted_and_deduped() -> None:
    result = check_grounding(_INVENTED)
    assert result.grounded is False
    assert result.invented == ("activate_laser", "read_gps")  # sorted, no move_forward


def test_language_builtins_are_not_invented() -> None:
    # range / len / print are the only builtins the sandbox exposes; never invented.
    result = check_grounding("print(len(range(3)))\nmove_forward(1)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_fitted_set_is_per_build() -> None:
    # A build without a distance sensor does not expose read_distance, so a call
    # to it is invented for THAT build even though it is a real default command.
    no_sensor = FITTED_DEFAULT - {"read_distance"}
    result = check_grounding("if read_distance() > 1:\n    move_forward(1)\n", fitted=no_sensor)
    assert result.grounded is False
    assert "read_distance" in result.invented


def test_syntax_error_is_reported_not_raised() -> None:
    result = check_grounding("move_forward(\n")
    assert result.grounded is False
    assert result.syntax_error is not None
    assert result.invented == ()


def test_is_deterministic() -> None:
    assert check_grounding(_INVENTED) == check_grounding(_INVENTED)


def test_default_fitted_set_matches_rover_api() -> None:
    from robolearn import rover_api

    assert frozenset(rover_api.__all__) == FITTED_DEFAULT
    assert "move_forward" in FITTED_DEFAULT and len(FITTED_DEFAULT) >= 20
