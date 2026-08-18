"""Deterministic Prove contract and evidence tests."""

from __future__ import annotations

import json
from pathlib import Path

from kodro.prove import (
    build_manifest,
    canonical_manifest,
    compare_manifests,
    human_report,
    load_contracts,
)


def test_catalogue_has_four_declarative_contracts() -> None:
    contracts = load_contracts()
    assert len(contracts) == 4
    assert len({contract.contract_id for contract in contracts}) == 4


def test_reference_contracts_pass_and_manifest_has_traceability() -> None:
    manifest = build_manifest(load_contracts(), runs=3, seed_root=4046)
    assert manifest["verdict"] == "pass"
    assert len(manifest["engine"]["source_sha256"]) == 64
    for contract in manifest["contracts"]:
        assert len(contract["controller_sha256"]) == 64
        assert contract["aggregate"]["verdict"] == "pass"
        for run in contract["runs"]:
            assert set(run["conditions"]) == {
                "obstacle_offset_m",
                "sensor_noise_m",
                "start_delay_s",
                "initial_battery_pct",
            }
            assert run["contract_id"] == contract["contract_id"]


def test_same_seed_manifest_is_byte_identical() -> None:
    contracts = load_contracts()
    first = canonical_manifest(build_manifest(contracts, runs=5, seed_root=99))
    second = canonical_manifest(build_manifest(contracts, runs=5, seed_root=99))
    assert first == second
    json.loads(first)


def test_deliberately_broken_controller_fails() -> None:
    broken = Path("tests/fixtures/broken_controller.py").read_text(encoding="utf-8")
    manifest = build_manifest(load_contracts(), runs=2, seed_root=4046, controller_override=broken)
    assert manifest["verdict"] == "fail"
    assert all(contract["aggregate"]["verdict"] == "fail" for contract in manifest["contracts"])


def test_regression_compare_detects_metric_change() -> None:
    manifest = build_manifest(load_contracts(), runs=2, seed_root=4046)
    changed = json.loads(canonical_manifest(manifest))
    changed["contracts"][0]["aggregate"]["mean_distance_m"] += 1
    assert compare_manifests(manifest, changed)
    assert compare_manifests(manifest, json.loads(canonical_manifest(manifest))) == []


def test_human_report_states_evidence_boundary() -> None:
    report = human_report(build_manifest(load_contracts(), runs=1, seed_root=4046))
    assert "Kinematic simulation evidence only" in report
    assert "not evidence of real-world equivalence" in report
