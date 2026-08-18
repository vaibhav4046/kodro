"""CLI and validation coverage for the Prove evidence tool (kodro.prove).

test_prove.py covers the library surface (manifest determinism, comparison,
report text). This file covers the ``main()`` entry point and the validation
paths that reject a malformed contract catalogue, since a broken CLI or a
silently accepted bad catalogue would ship unusable evidence.
"""

from __future__ import annotations

import json
from importlib.resources import files
from pathlib import Path
from typing import Any

import pytest

from kodro import prove
from kodro.prove import (
    MANIFEST_SCHEMA,
    build_manifest,
    load_contracts,
    main,
)

BROKEN_CONTROLLER = Path("tests/fixtures/broken_controller.py")
# One contract at one run keeps every CLI test to a single simulated episode.
FAST = ["--contract", "straight_transit", "--runs", "1"]


def _catalogue() -> dict[str, Any]:
    raw = files("kodro").joinpath("prove_contracts.json").read_text(encoding="utf-8")
    document: dict[str, Any] = json.loads(raw)
    return document


def _write_catalogue(path: Path, document: dict[str, Any]) -> Path:
    path.write_text(json.dumps(document), encoding="utf-8")
    return path


# ---- load_contracts validation ---------------------------------------------


def test_load_contracts_rejects_an_unknown_schema(tmp_path: Path) -> None:
    document = _catalogue()
    document["schema"] = "kodro.contracts/2"
    path = _write_catalogue(tmp_path / "contracts.json", document)

    with pytest.raises(ValueError, match="unsupported Prove contract schema"):
        load_contracts(path)


def test_load_contracts_rejects_a_missing_perturbation_axis(tmp_path: Path) -> None:
    # Every contract must declare all four perturbation axes; dropping one
    # would quietly shrink the evidence envelope instead of failing loudly.
    document = _catalogue()
    del document["contracts"][0]["perturbations"]["sensor_noise_m"]
    path = _write_catalogue(tmp_path / "contracts.json", document)

    with pytest.raises(ValueError, match="must declare exactly"):
        load_contracts(path)


def test_load_contracts_rejects_a_malformed_range_pair(tmp_path: Path) -> None:
    document = _catalogue()
    document["contracts"][0]["perturbations"]["sensor_noise_m"] = [0.0, 0.01, 0.02]
    path = _write_catalogue(tmp_path / "contracts.json", document)

    with pytest.raises(ValueError, match="must contain exactly two numbers"):
        load_contracts(path)


def test_load_contracts_rejects_a_catalogue_outside_the_declared_size(tmp_path: Path) -> None:
    document = _catalogue()
    document["contracts"] = document["contracts"][:2]
    path = _write_catalogue(tmp_path / "contracts.json", document)

    with pytest.raises(ValueError, match="expected 3 to 5 Prove contracts, found 2"):
        load_contracts(path)


def test_build_manifest_rejects_a_zero_run_budget() -> None:
    with pytest.raises(ValueError, match="runs must be at least 1"):
        build_manifest(load_contracts(), runs=0)


# ---- main() ----------------------------------------------------------------


def test_main_writes_manifest_and_report_into_new_directories(tmp_path: Path) -> None:
    manifest_path = tmp_path / "out" / "evidence" / "manifest.json"
    report_path = tmp_path / "out" / "evidence" / "report.md"

    code = main([*FAST, "--manifest", str(manifest_path), "--report", str(report_path)])

    assert code == 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["schema"] == MANIFEST_SCHEMA
    assert [row["contract_id"] for row in manifest["contracts"]] == ["straight_transit"]
    assert manifest["verdict"] == "pass"
    assert "Kodro Prove report" in report_path.read_text(encoding="utf-8")


def test_main_writes_lf_only_evidence_files(tmp_path: Path) -> None:
    # The manifest is hashed and diffed across machines, so a CRLF translation
    # on Windows would break byte-for-byte reproducibility.
    manifest_path = tmp_path / "manifest.json"
    report_path = tmp_path / "report.md"

    main([*FAST, "--manifest", str(manifest_path), "--report", str(report_path)])

    assert b"\r\n" not in manifest_path.read_bytes()
    assert b"\r\n" not in report_path.read_bytes()


def test_main_runs_only_the_requested_contracts(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"

    main(
        [
            "--contract",
            "straight_transit",
            "--contract",
            "battery_reserve",
            "--runs",
            "1",
            "--manifest",
            str(manifest_path),
        ]
    )

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert sorted(row["contract_id"] for row in manifest["contracts"]) == [
        "battery_reserve",
        "straight_transit",
    ]


def test_main_rejects_an_unknown_contract_id(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main([*FAST, "--contract", "no_such_contract"])

    assert exit_info.value.code == 2
    assert "unknown contract ids: no_such_contract" in capsys.readouterr().err


def test_main_verify_reproducible_reports_a_matching_second_run(
    capsys: pytest.CaptureFixture[str],
) -> None:
    code = main([*FAST, "--verify-reproducible"])

    assert code == 0
    assert "kodro-prove: reproducibility check passed" in capsys.readouterr().out


def test_main_compare_against_its_own_manifest_passes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    baseline = tmp_path / "baseline.json"
    main([*FAST, "--manifest", str(baseline)])
    capsys.readouterr()

    code = main([*FAST, "--compare", str(baseline)])

    assert code == 0
    assert "kodro-prove: baseline comparison passed" in capsys.readouterr().out


def test_main_compare_reports_a_regression_and_exits_non_zero(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    baseline_path = tmp_path / "baseline.json"
    main([*FAST, "--manifest", str(baseline_path)])
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    baseline["contracts"][0]["aggregate"]["mean_distance_m"] += 1.0
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")
    capsys.readouterr()

    code = main([*FAST, "--compare", str(baseline_path)])

    assert code == 1
    assert "kodro-prove: regression: straight_transit: aggregate" in capsys.readouterr().out


def test_main_compare_flags_a_changed_contract_set(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    baseline_path = tmp_path / "baseline.json"
    main(["--contract", "corner_route", "--runs", "1", "--manifest", str(baseline_path)])
    capsys.readouterr()

    code = main([*FAST, "--compare", str(baseline_path)])

    assert code == 1
    assert "kodro-prove: regression: contract set changed" in capsys.readouterr().out


def test_main_compare_flags_a_changed_controller_hash(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # Only the recorded controller hash moves; the per-seed evidence in the
    # baseline is left alone, so this isolates the hash comparison branch.
    baseline_path = tmp_path / "baseline.json"
    main([*FAST, "--manifest", str(baseline_path)])
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    baseline["contracts"][0]["controller_sha256"] = "0" * 64
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")
    capsys.readouterr()

    code = main([*FAST, "--compare", str(baseline_path)])

    assert code == 1
    assert "kodro-prove: regression: straight_transit: controller hash changed" in (
        capsys.readouterr().out
    )


def test_main_compare_flags_changed_per_seed_evidence(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # A per-seed metric can move while the rounded aggregate stays put; the
    # comparison must still catch it, because that IS the reproducibility claim.
    baseline_path = tmp_path / "baseline.json"
    main([*FAST, "--manifest", str(baseline_path)])
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    baseline["contracts"][0]["runs"][0]["metrics"]["distance_m"] += 0.5
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")
    capsys.readouterr()

    code = main([*FAST, "--compare", str(baseline_path)])

    assert code == 1
    assert "kodro-prove: regression: straight_transit: per-seed evidence changed" in (
        capsys.readouterr().out
    )


def test_main_verify_reproducible_fails_when_the_repeat_run_differs(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    # The determinism guarantee is only worth anything if a mismatch is caught,
    # so force the second build to differ and require a non-zero exit.
    real_build = prove.build_manifest
    calls = {"count": 0}

    def flaky_build(*args: Any, **kwargs: Any) -> dict[str, Any]:
        manifest = real_build(*args, **kwargs)
        calls["count"] += 1
        if calls["count"] == 2:
            manifest["seed_root"] = -1
        return manifest

    monkeypatch.setattr(prove, "build_manifest", flaky_build)

    code = main([*FAST, "--verify-reproducible"])

    assert code == 1
    assert "kodro-prove: reproducibility check failed" in capsys.readouterr().out


def test_main_exits_non_zero_when_the_override_controller_fails(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"

    code = main([*FAST, "--controller", str(BROKEN_CONTROLLER), "--manifest", str(manifest_path)])

    assert code == 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["verdict"] == "fail"


def test_main_accepts_an_external_contract_catalogue(tmp_path: Path) -> None:
    # --contracts must actually be read: a stale default would silently prove
    # the shipped catalogue instead of the caller's.
    document = _catalogue()
    document["contracts"] = document["contracts"][:3]
    document["contracts"][0]["id"] = "renamed_transit"
    catalogue = _write_catalogue(tmp_path / "contracts.json", document)
    manifest_path = tmp_path / "manifest.json"

    # No --contract filter: the whole external catalogue must be proven.
    code = main(["--contracts", str(catalogue), "--runs", "1", "--manifest", str(manifest_path)])

    assert code == 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    contract_ids = [row["contract_id"] for row in manifest["contracts"]]
    assert len(contract_ids) == 3
    assert "renamed_transit" in contract_ids
