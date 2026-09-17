"""Candidate-comparison (Genesis) loop over the deterministic Prove engine.

Genesis reuses :mod:`kodro.prove` as its execution authority: fixed contracts,
fixed seeds, recorded metrics. It adds only the experiment layer -- run N
candidate controllers through the same evidence pipeline, rank them
deterministically, and point at the failing evidence. No model, network, or
heuristic touches measurement or verdicts.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from kodro import genesis
from kodro.prove import load_contracts

BROKEN = Path("tests/fixtures/broken_controller.py").read_text(encoding="utf-8")
GOOD = "move_forward(3)\n"
# Turns away from the corridor, so it misses the marker without colliding.
WRONG_TURN = "turn_left(90)\nmove_forward(3)\n"


def _one_contract() -> tuple:
    return tuple(c for c in load_contracts() if c.contract_id == "straight_transit")


def test_winner_prefers_the_passing_controller() -> None:
    experiment = genesis.run_experiment(
        {"good": GOOD, "broken": BROKEN},
        _one_contract(),
        runs=2,
        seed_root=4046,
    )
    assert experiment["winner"] == "good"
    assert experiment["ranking"][0] == "good"


def test_same_seeds_produce_byte_identical_experiments() -> None:
    first = genesis.canonical_experiment(
        genesis.run_experiment(
            {"good": GOOD, "bad": WRONG_TURN}, _one_contract(), runs=2, seed_root=7
        )
    )
    second = genesis.canonical_experiment(
        genesis.run_experiment(
            {"good": GOOD, "bad": WRONG_TURN}, _one_contract(), runs=2, seed_root=7
        )
    )
    assert first == second
    json.loads(first)


def test_tie_break_is_deterministic_by_candidate_name() -> None:
    experiment = genesis.run_experiment(
        {"beta": GOOD, "alpha": GOOD}, _one_contract(), runs=1, seed_root=4046
    )
    assert experiment["ranking"] == ["alpha", "beta"]
    assert experiment["winner"] == "alpha"


def test_diagnosis_names_the_failing_contract_and_evidence() -> None:
    experiment = genesis.run_experiment(
        {"wrong": WRONG_TURN}, _one_contract(), runs=2, seed_root=4046
    )
    diagnosis = experiment["diagnosis"]["wrong"]
    assert diagnosis["failed_contracts"] == ["straight_transit"]
    assert diagnosis["next_action"]
    assert "straight_transit" in genesis.human_report(experiment)


def test_evidence_boundary_is_preserved() -> None:
    experiment = genesis.run_experiment({"good": GOOD}, _one_contract(), runs=1, seed_root=4046)
    assert "Kinematic simulation evidence only" in experiment["evidence_boundary"]
    assert "Kinematic simulation evidence only" in genesis.human_report(experiment)


def test_budget_guards_reject_absurd_batches() -> None:
    contracts = _one_contract()
    with pytest.raises(ValueError, match="at most"):
        genesis.run_experiment({f"c{i}": GOOD for i in range(10)}, contracts, runs=1)
    with pytest.raises(ValueError, match="at least 1"):
        genesis.run_experiment({"good": GOOD}, contracts, runs=0)
    with pytest.raises(ValueError, match="at most"):
        genesis.run_experiment({"good": GOOD}, contracts, runs=999)
    with pytest.raises(ValueError, match="at least one candidate"):
        genesis.run_experiment({}, contracts, runs=1)
    with pytest.raises(ValueError, match="characters"):
        genesis.run_experiment({"huge": "x" * (genesis.MAX_CANDIDATE_CHARS + 1)}, contracts, runs=1)


def test_human_report_states_winner_and_verdict() -> None:
    experiment = genesis.run_experiment(
        {"good": GOOD, "broken": BROKEN}, _one_contract(), runs=1, seed_root=4046
    )
    report = genesis.human_report(experiment)
    assert "good" in report
    assert "PASS" in report or "FAIL" in report
