"""KodroBench CLI, prompt and generation-failure paths (kodro.kodrobench).

test_kodrobench.py covers the deterministic floor and the pass@k maths. This
file covers what happens around a real model: the prompt that constrains the
command set, the CLI that writes the artefacts, and the failure handling that
must keep a benchmark run going when generation dies. No model is required -
the Ollama client is replaced with a stub.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from kodro.ai import ollama_client
from kodro.kodrobench import (
    RESULTS_SCHEMA,
    TASKS,
    Task,
    evaluate_model,
    evaluate_model_pass_at_k,
    generate_leaderboard,
    generate_ollama,
    main,
    run_bench,
)

DEV_TASK: Task = next(task for task in TASKS if task.split == "dev")
HELDOUT_TASK: Task = next(task for task in TASKS if task.split == "heldout")
LONG_ERROR = "boom " * 100


class _RecordingClient:
    """Stand-in for OllamaClient that records the call and returns a reply."""

    def __init__(self, reply: str = "```python\nmove_forward(3)\n```") -> None:
        self.reply = reply
        self.calls: list[dict[str, Any]] = []

    def generate(self, prompt: str, **kwargs: Any) -> str:
        self.calls.append({"prompt": prompt, **kwargs})
        return self.reply


class _FailingClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    def generate(self, *args: Any, **kwargs: Any) -> str:
        raise RuntimeError(LONG_ERROR)


# ---- prompt and generation ---------------------------------------------------


def test_generation_prompt_names_exactly_the_fitted_commands() -> None:
    # The invention metric is only meaningful if the model was actually told
    # which commands exist; a prompt that drops them would inflate every score.
    client = _RecordingClient()

    code = generate_ollama(client, "some-model", DEV_TASK)

    assert code == "move_forward(3)\n"  # fences stripped by extract_code
    call = client.calls[0]
    assert call["prompt"] == DEV_TASK.instruction
    assert call["model"] == "some-model"
    for command in DEV_TASK.fitted:
        assert command in call["system"]
    assert "no others" in call["system"]


def test_generation_is_run_at_the_documented_decoding_settings() -> None:
    # Benchmark numbers are only comparable across models if the decoding
    # settings are fixed; a silent change here would invalidate the leaderboard.
    client = _RecordingClient()

    generate_ollama(client, "some-model", DEV_TASK)

    call = client.calls[0]
    assert call["temperature"] == 0.2
    assert call["num_predict"] == 256
    assert call["keep_alive"] == "5m"


# ---- failure handling --------------------------------------------------------


def test_a_generation_failure_scores_zero_instead_of_aborting_the_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ollama_client, "OllamaClient", _FailingClient)

    result = evaluate_model("unreachable-model", seeds=1, tasks=(DEV_TASK,))

    assert result["gen_errors"] == 1
    assert result["success_at_n"] == 0.0
    row = result["per_task"][0]
    assert row["task"] == DEV_TASK.id
    assert row["code"] == ""
    assert row["invented"] == []
    # The recorded error is truncated so one exploding model cannot bloat the
    # results JSON with a full traceback repr per task.
    assert len(row["gen_error"]) == 200
    assert row["gen_error"].startswith("boom")


def test_pass_at_k_counts_a_failed_generation_as_a_non_pass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ollama_client, "OllamaClient", _FailingClient)

    result = evaluate_model_pass_at_k(
        "unreachable-model", k=1, n_samples=2, seeds_per_sample=1, tasks=(DEV_TASK,)
    )

    assert result["per_task"][0]["c"] == 0
    assert result["pass_at_k"] == 0.0


def test_an_absent_split_aggregates_to_zero_rather_than_dividing_by_zero() -> None:
    # Running a heldout-only task set leaves the dev split empty; it must
    # report zeros instead of raising on an empty mean.
    result = evaluate_model("deterministic", seeds=1, tasks=(HELDOUT_TASK,))

    assert result["dev_success_at_n"] == 0.0
    assert result["dev_invention_rate"] == 0.0
    assert result["heldout_success_at_n"] > 0.0


# ---- leaderboard rendering ---------------------------------------------------


def test_leaderboard_renders_the_pass_at_k_section_when_samples_were_drawn() -> None:
    board = generate_leaderboard(run_bench(["deterministic"], seeds=1, samples=2, k=2))

    assert "## pass@2 (2 independent generations per task per model)" in board
    assert "| Model | pass@k | dev pass@k | heldout pass@k |" in board


def test_leaderboard_skips_models_that_have_no_pass_at_k_block() -> None:
    # A mixed run (one model sampled, one not) must still render: the
    # unsampled row is omitted from the pass@k table, not rendered as blank.
    sampled = _leaderboard_row("sampled", invention_rate=0.0)
    sampled["pass_at_k"] = {
        "k": 1,
        "n_samples": 3,
        "pass_at_k": 0.5,
        "dev_pass_at_k": 0.5,
        "heldout_pass_at_k": 0.5,
    }
    results = {
        "seeds": 2,
        "tasks": ["a"],
        "models": [sampled, _leaderboard_row("unsampled", invention_rate=1.0)],
    }

    board = generate_leaderboard(results)
    pass_at_k_section = board.split("## pass@1")[1]

    assert "| sampled |" in pass_at_k_section
    assert "unsampled" not in pass_at_k_section


def _leaderboard_row(model: str, *, invention_rate: float) -> dict[str, Any]:
    return {
        "model": model,
        "success_at_n": 1.0,
        "invention_rate": invention_rate,
        "dev_success_at_n": 1.0,
        "heldout_success_at_n": 1.0,
        "dev_invention_rate": invention_rate,
        "heldout_invention_rate": invention_rate,
        "collision_rate": 0.0,
        "syntax_error_rate": 0.0,
        "gen_errors": 0,
    }


# ---- CLI ---------------------------------------------------------------------


def test_cli_writes_results_json_and_leaderboard(tmp_path: Path) -> None:
    json_path = tmp_path / "results.json"
    board_path = tmp_path / "leaderboard.md"

    code = main(
        [
            "--models",
            "deterministic",
            "--seeds",
            "1",
            "--json",
            str(json_path),
            "--leaderboard",
            str(board_path),
        ]
    )

    assert code == 0
    results = json.loads(json_path.read_text(encoding="utf-8"))
    assert results["schema"] == RESULTS_SCHEMA
    assert results["seeds"] == 1
    assert [row["model"] for row in results["models"]] == ["deterministic"]
    assert board_path.read_text(encoding="utf-8").startswith("# KodroBench")


def test_cli_splits_and_trims_the_model_list(tmp_path: Path) -> None:
    json_path = tmp_path / "results.json"

    main(["--models", " deterministic , ,deterministic ", "--seeds", "1", "--json", str(json_path)])

    results = json.loads(json_path.read_text(encoding="utf-8"))
    assert [row["model"] for row in results["models"]] == ["deterministic", "deterministic"]


def test_cli_writes_a_leaderboard_without_being_asked_for_json(tmp_path: Path) -> None:
    # --leaderboard must stand on its own; requiring --json alongside it would
    # be an undocumented coupling between two independent output flags.
    board_path = tmp_path / "leaderboard.md"

    code = main(["--models", "deterministic", "--seeds", "1", "--leaderboard", str(board_path)])

    assert code == 0
    assert board_path.read_text(encoding="utf-8").startswith("# KodroBench")
    assert list(tmp_path.iterdir()) == [board_path]


def test_cli_rejects_a_zero_sample_budget(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(["--models", "deterministic", "--samples", "0"])

    assert exit_info.value.code == 2
    assert "--samples must be at least 1 (got 0)" in capsys.readouterr().err


def test_cli_rejects_a_k_below_one(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(["--models", "deterministic", "--samples", "2", "--k", "0"])

    assert exit_info.value.code == 2
    assert "--k must be between 1 and --samples (2); got 0" in capsys.readouterr().err
