"""Tests for the headless batch runner (robolearn.bench)."""

from __future__ import annotations

import json

import pytest

from robolearn.bench import REPORT_SCHEMA, run_batch, run_seed

# A program that drives, turns, and drives again: enough to travel and to hit a
# jittered obstacle on some seeds, so the batch produces a mix of outcomes.
_DRIVE = "move_forward(2)\nturn_left(90)\nmove_forward(1)\n"


def test_report_has_versioned_schema_and_shape() -> None:
    # Arrange / Act
    report = run_batch(_DRIVE, seeds=3)

    # Assert
    assert report["schema"] == REPORT_SCHEMA
    assert report["seeds"] == 3
    assert len(report["runs"]) == 3
    agg = report["aggregate"]
    assert agg["successes"] + agg["failures"] == 3
    assert set(report["runs"][0]) >= {"seed", "success", "collisions", "distance_m", "error"}


def test_report_carries_the_grounding_block() -> None:
    # v2: a grounded program reports no invented symbols; an invented one does.
    grounded = run_batch(_DRIVE, seeds=1)["grounding"]
    assert grounded["grounded"] is True and grounded["invented"] == []

    invented = run_batch("read_gps()\nmove_forward(1)\n", seeds=1)["grounding"]
    assert invented["grounded"] is False and "read_gps" in invented["invented"]


def test_same_seed_is_deterministic() -> None:
    # The determinism contract: identical (code, seed) -> identical run record.
    assert run_seed(_DRIVE, 7) == run_seed(_DRIVE, 7)


def test_batch_is_byte_identical_across_runs() -> None:
    a = json.dumps(run_batch(_DRIVE, seeds=5), sort_keys=True)
    b = json.dumps(run_batch(_DRIVE, seeds=5), sort_keys=True)
    assert a == b


def test_domain_randomisation_varies_outcomes() -> None:
    # Jittered obstacles must actually change results across seeds, otherwise the
    # randomisation is not doing anything.
    runs = run_batch(_DRIVE, seeds=8)["runs"]
    collision_counts = {r["collisions"] for r in runs}
    assert len(collision_counts) > 1


def test_program_error_is_recorded_not_raised() -> None:
    # A bad program becomes a recorded run error, never an exception out of the
    # runner, and never a success.
    result = run_seed("no_such_command(1)\n", 0)
    assert result.success is False
    assert result.error is not None


def test_seeds_must_be_positive() -> None:
    with pytest.raises(ValueError):
        run_batch(_DRIVE, seeds=0)
