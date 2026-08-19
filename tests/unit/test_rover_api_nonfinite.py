"""A value that means nothing must make the rover do nothing.

``_clamp_finite`` used to resolve NaN and the infinities to ``low``. For the
unsigned ranges ``low`` is 0.0, so that read as "ignore it". For a turn ``low``
is -3600.0, so a pupil whose arithmetic produced NaN watched the rover spin ten
full rotations backwards: the loudest possible response to a value that carries
no instruction, and the hardest to connect back to the line that caused it.

Ordinary clamping is unchanged; only the non-finite path moved.
"""

from __future__ import annotations

import math

import pytest

from kodro.rover_api import (
    _MAX_ANGLE_DEG,
    _MAX_DISTANCE_M,
    _MAX_WAIT_S,
    _MIN_ANGLE_DEG,
    _MIN_DISTANCE_M,
    _MIN_WAIT_S,
    _clamp_finite,
)

NON_FINITE = (float("nan"), float("inf"), float("-inf"))

RANGES = {
    "angle": (_MIN_ANGLE_DEG, _MAX_ANGLE_DEG),
    "distance": (_MIN_DISTANCE_M, _MAX_DISTANCE_M),
    "wait": (_MIN_WAIT_S, _MAX_WAIT_S),
    "percent": (0.0, 100.0),
}


@pytest.mark.parametrize("range_name", sorted(RANGES))
@pytest.mark.parametrize("value", NON_FINITE, ids=["nan", "inf", "-inf"])
def test_non_finite_input_does_nothing(range_name: str, value: float) -> None:
    low, high = RANGES[range_name]
    assert _clamp_finite(value, low, high, name=range_name) == 0.0


def test_the_signed_range_is_the_one_that_regressed() -> None:
    """Pin the specific case: a signed low is not a sane default for NaN."""
    assert _MIN_ANGLE_DEG < 0.0, "the angle range must stay signed for this to matter"
    assert _clamp_finite(float("nan"), _MIN_ANGLE_DEG, _MAX_ANGLE_DEG, name="angle") == 0.0, (
        "NaN resolved to the minimum angle, which turns the rover ten times backwards"
    )


@pytest.mark.parametrize(
    ("value", "expected"),
    [(45.0, 45.0), (-45.0, -45.0), (0.0, 0.0), (9999.0, _MAX_ANGLE_DEG), (-9999.0, _MIN_ANGLE_DEG)],
)
def test_finite_clamping_is_unchanged(value: float, expected: float) -> None:
    assert _clamp_finite(value, _MIN_ANGLE_DEG, _MAX_ANGLE_DEG, name="angle") == expected


def test_the_no_op_stays_inside_a_range_that_excludes_zero() -> None:
    """A range starting above zero still gets a value it can represent."""
    assert _clamp_finite(float("nan"), 5.0, 10.0, name="offset") == 5.0
    assert math.isfinite(_clamp_finite(float("inf"), 5.0, 10.0, name="offset"))
