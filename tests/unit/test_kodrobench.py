"""Tests for the KodroBench harness (robolearn.kodrobench).

These use only the deterministic adapter, so they need no model and are fully
reproducible in CI. The Ollama path is exercised separately when a model is
present.
"""

from __future__ import annotations

import pytest

from robolearn.kodrobench import (
    TASKS,
    _evaluate_program,
    evaluate_model_pass_at_k,
    extract_code,
    generate_leaderboard,
    pass_at_k,
    run_bench,
)


def test_deterministic_floor_is_grounded() -> None:
    results = run_bench(["deterministic"], seeds=3)
    assert results["schema"] == "kodrobench.results/2"
    assert len(results["models"]) == 1
    row = results["models"][0]
    assert row["model"] == "deterministic"
    assert row["tasks"] == len(TASKS)
    # The canned programs use only fitted commands, so the floor never invents.
    assert row["invention_rate"] == 0.0
    assert 0.0 <= row["success_at_n"] <= 1.0


def test_dev_heldout_split_is_reported() -> None:
    # Two tasks (no_sensor_scan, no_arm_collect) are held out; the rest are dev.
    row = run_bench(["deterministic"], seeds=2)["models"][0]
    heldout_tasks = [t for t in TASKS if t.split == "heldout"]
    dev_tasks = [t for t in TASKS if t.split == "dev"]
    assert {t.id for t in heldout_tasks} == {"no_sensor_scan", "no_arm_collect"}
    assert len(dev_tasks) == len(TASKS) - len(heldout_tasks)
    for key in (
        "dev_success_at_n",
        "heldout_success_at_n",
        "dev_invention_rate",
        "heldout_invention_rate",
    ):
        assert key in row


def test_pass_at_k_known_values() -> None:
    # All samples pass -> pass@k is certain.
    assert pass_at_k(n=10, c=10, k=1) == 1.0
    # No samples pass -> pass@k is impossible.
    assert pass_at_k(n=10, c=0, k=1) == 0.0
    # Exactly one of five samples passes: P(that one drawn in 1 pick) = 1/5.
    assert pass_at_k(n=5, c=1, k=1) == pytest.approx(0.2)
    # Fewer failures than k means any k-subset must include a pass.
    assert pass_at_k(n=5, c=4, k=2) == 1.0


def test_pass_at_k_rejects_k_greater_than_n() -> None:
    with pytest.raises(ValueError):
        pass_at_k(n=3, c=1, k=5)


def test_evaluate_model_pass_at_k_deterministic_is_all_or_nothing() -> None:
    # The deterministic floor's canned program is identical on every draw, so
    # each task's c is either 0 or n_samples (never partial).
    result = evaluate_model_pass_at_k("deterministic", k=1, n_samples=3, seeds_per_sample=3)
    assert result["model"] == "deterministic"
    assert result["n_samples"] == 3
    for row in result["per_task"]:
        assert row["c"] in (0, 3)


def test_run_bench_attaches_pass_at_k_only_when_samples_over_one() -> None:
    without = run_bench(["deterministic"], seeds=2)
    with_samples = run_bench(["deterministic"], seeds=2, samples=2, k=1)
    assert "pass_at_k" not in without["models"][0]
    assert "pass_at_k" in with_samples["models"][0]


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
