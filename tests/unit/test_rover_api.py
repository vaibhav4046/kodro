"""Per-function tests for the public rover API (Task 2)."""

from __future__ import annotations

import logging
import math

import pytest

from robolearn import rover_api

# --- Driving: types, defaults, clamps ---------------------------------------


@pytest.mark.parametrize("dist", [0.0, 1.0, 5.5, 999.0])
def test_move_forward_accepts_nonneg(dist: float) -> None:
    assert rover_api.move_forward(dist) is None


@pytest.mark.parametrize("dist", [-10.0, -0.001])
def test_move_forward_clamps_negative(caplog: pytest.LogCaptureFixture, dist: float) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.move_forward(dist)
    assert any("clamped to lower bound" in r.getMessage() for r in caplog.records)


def test_move_forward_clamps_huge(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.move_forward(1e9)
    assert any("clamped to upper bound" in r.getMessage() for r in caplog.records)


def test_move_forward_handles_nan(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.move_forward(float("nan"))
    assert any("NaN" in r.getMessage() for r in caplog.records)


def test_move_forward_handles_inf(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.move_forward(float("inf"))
    assert any("non-finite" in r.getMessage() for r in caplog.records)


def test_move_backward_accepts() -> None:
    assert rover_api.move_backward(2.5) is None


def test_move_backward_clamps_negative(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.move_backward(-1.0)
    assert any("clamped" in r.getMessage() for r in caplog.records)


@pytest.mark.parametrize("deg", [-3600.0, -90.0, 0.0, 90.0, 360.0, 3600.0])
def test_turn_left_returns_none(deg: float) -> None:
    assert rover_api.turn_left(deg) is None


def test_turn_left_clamps_huge(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.turn_left(1e6)
    assert any("clamped to upper bound" in r.getMessage() for r in caplog.records)


def test_turn_left_handles_nan(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.turn_left(float("nan"))
    assert any("NaN" in r.getMessage() for r in caplog.records)


@pytest.mark.parametrize("deg", [-90.0, 0.0, 90.0])
def test_turn_right_returns_none(deg: float) -> None:
    assert rover_api.turn_right(deg) is None


def test_turn_right_clamps_negative(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.turn_right(-1e9)
    assert any("clamped to lower bound" in r.getMessage() for r in caplog.records)


def test_wait_returns_none() -> None:
    assert rover_api.wait(0.1) is None


def test_wait_clamps_negative(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.wait(-1.0)
    assert any("clamped to lower bound" in r.getMessage() for r in caplog.records)


def test_wait_clamps_huge(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.wait(1e6)
    assert any("clamped to upper bound" in r.getMessage() for r in caplog.records)


def test_wait_handles_inf(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.wait(float("-inf"))
    assert any("non-finite" in r.getMessage() for r in caplog.records)


# --- Sensing: types & sane ranges -------------------------------------------


def test_read_distance_returns_nonneg_or_inf() -> None:
    v = rover_api.read_distance()
    assert isinstance(v, float)
    assert v >= 0.0 or math.isinf(v)


def test_read_colour_returns_rgb_tuple() -> None:
    rgb = rover_api.read_colour()
    assert isinstance(rgb, tuple)
    assert len(rgb) == 3
    for channel in rgb:
        assert isinstance(channel, int)
        assert 0 <= channel <= 255


def test_read_heading_returns_float() -> None:
    heading = rover_api.read_heading()
    assert isinstance(heading, float)


def test_read_battery_returns_float_in_range() -> None:
    battery = rover_api.read_battery()
    assert isinstance(battery, float)
    assert 0.0 <= battery <= 100.0


def test_obstacle_ahead_default_threshold_returns_bool() -> None:
    result = rover_api.obstacle_ahead()
    assert isinstance(result, bool)


def test_obstacle_ahead_custom_threshold() -> None:
    assert rover_api.obstacle_ahead(threshold_m=1.0) is False


def test_obstacle_ahead_clamps_negative_threshold(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.obstacle_ahead(threshold_m=-1.0)
    assert any("clamped" in r.getMessage() for r in caplog.records)


def test_sample_detected_default_radius_returns_bool() -> None:
    result = rover_api.sample_detected()
    assert isinstance(result, bool)


def test_sample_detected_custom_radius() -> None:
    assert rover_api.sample_detected(radius_m=2.0) is False


def test_sample_detected_clamps_huge_radius(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.sample_detected(radius_m=1e9)
    assert any("clamped" in r.getMessage() for r in caplog.records)


def test_at_base_returns_bool() -> None:
    assert isinstance(rover_api.at_base(), bool)


# --- Acting: types ----------------------------------------------------------


def test_collect_sample_returns_bool() -> None:
    assert rover_api.collect_sample() is False


def test_drop_sample_returns_bool() -> None:
    assert rover_api.drop_sample() is False


def test_beep_default_returns_none() -> None:
    assert rover_api.beep() is None


def test_beep_accepts_zero() -> None:
    assert rover_api.beep(times=0) is None


def test_beep_clamps_huge_times(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.beep(times=99999)
    assert any("clamped to upper bound" in r.getMessage() for r in caplog.records)


def test_beep_clamps_negative_times(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.beep(times=-5)
    assert any("clamped to lower bound" in r.getMessage() for r in caplog.records)


def test_log_emits_info_record_for_string(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="robolearn.rover_api"):
        rover_api.log("hello rover")
    assert any("hello rover" in r.getMessage() for r in caplog.records)


def test_log_accepts_int() -> None:
    rover_api.log(42)


def test_log_accepts_dict() -> None:
    rover_api.log({"step": 1, "msg": "ok"})


class _RaisingObject:
    def __str__(self) -> str:
        raise RuntimeError("kaboom")


def test_log_never_raises_on_str_failure(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="robolearn.rover_api"):
        rover_api.log(_RaisingObject())
    assert any("unprintable" in r.getMessage() for r in caplog.records)


# --- Re-exports from the package root --------------------------------------


def test_package_root_reexports_full_api() -> None:
    import robolearn

    for name in (
        "move_forward",
        "move_backward",
        "turn_left",
        "turn_right",
        "wait",
        "read_distance",
        "read_colour",
        "read_heading",
        "read_battery",
        "obstacle_ahead",
        "sample_detected",
        "at_base",
        "collect_sample",
        "drop_sample",
        "beep",
        "log",
    ):
        assert hasattr(robolearn, name), f"robolearn.{name} missing"
        assert getattr(robolearn, name) is getattr(rover_api, name)
