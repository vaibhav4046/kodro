"""Tests for the KodroBench harness (robolearn.kodrobench).

These use only the deterministic adapter, so they need no model and are fully
reproducible in CI. The Ollama path is exercised separately when a model is
present.
"""

from __future__ import annotations

from robolearn.kodrobench import (
    TASKS,
    _evaluate_program,
    extract_code,
    generate_leaderboard,
    run_bench,
)


def test_deterministic_floor_is_grounded() -> None:
    results = run_bench(["deterministic"], seeds=3)
    assert results["schema"] == "kodrobench.results/1"
    assert len(results["models"]) == 1
    row = results["models"][0]
    assert row["model"] == "deterministic"
    assert row["tasks"] == len(TASKS)
    # The canned programs use only fitted commands, so the floor never invents.
    assert row["invention_rate"] == 0.0
    assert 0.0 <= row["success_at_n"] <= 1.0


def test_leaderboard_is_generated_from_results() -> None:
    board = generate_leaderboard(run_bench(["deterministic"], seeds=2))
    assert "invention_rate" in board
    assert "deterministic" in board
    assert board.startswith("# KodroBench")


def test_extract_code_strips_fences() -> None:
    assert extract_code("```python\nmove_forward(1)\n```") == "move_forward(1)\n"
    assert extract_code("move_forward(2)") == "move_forward(2)\n"


def test_evaluate_flags_an_invented_command() -> None:
    # A program that calls a command outside the task's fitted set is caught.
    result = _evaluate_program("read_gps()\nmove_forward(1)\n", TASKS[0], seeds=2)
    assert result["grounded"] is False
    assert "read_gps" in result["invented"]


def test_adversarial_task_catches_a_missing_sensor() -> None:
    # no_sensor_scan's build has no distance sensor; calling it is invention.
    no_sensor = next(t for t in TASKS if t.id == "no_sensor_scan")
    result = _evaluate_program("d = read_distance()\nmove_forward(1)\n", no_sensor, seeds=2)
    assert result["grounded"] is False
    assert "read_distance" in result["invented"]
