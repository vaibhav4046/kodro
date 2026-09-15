import json
from pathlib import Path

import pytest

from kodro.earthproof import Interval, Scenario, compare, evaluate, main, report_fingerprint


def test_energy_and_battery_are_calculated_with_ranges():
    scenario = Scenario(
        name="class rover",
        average_power_w=Interval(18, 20, 24),
        runtime_hours=Interval(1, 1.5, 2),
        battery_voltage_v=Interval(11.0, 11.1, 11.2),
        battery_capacity_ah=Interval(2.0, 2.2, 2.4),
    )
    report = evaluate(scenario)
    assert report["metrics"]["operating_energy_kwh"] == {
        "low": pytest.approx(0.018),
        "central": pytest.approx(0.03),
        "high": pytest.approx(0.048),
    }
    assert report["metrics"]["battery_capacity_wh"]["central"] == pytest.approx(24.42)


def test_no_carbon_claim_is_created_without_user_factor():
    report = evaluate(
        Scenario(
            name="rover",
            average_power_w=Interval.point(20),
            runtime_hours=Interval.point(1),
        )
    )
    assert report["metrics"]["operational_emissions_kgco2e"] is None
    assert any(
        str(item).startswith("No grid-carbon factor supplied") for item in report["limitations"]
    )


def test_avoided_material_and_embodied_carbon_are_scenario_based():
    report = evaluate(
        Scenario(
            name="rover",
            average_power_w=Interval.point(20),
            runtime_hours=Interval.point(1),
            physical_prototypes_avoided=2,
            prototype_material_mass_kg=Interval(0.8, 1.0, 1.4),
            prototype_embodied_kgco2e=Interval(3, 4, 6),
        )
    )
    assert report["metrics"]["scenario_material_avoided_kg"]["central"] == pytest.approx(2.0)
    assert report["metrics"]["scenario_embodied_emissions_avoided_kgco2e"][
        "central"
    ] == pytest.approx(8.0)
    assert report["claims"]["avoided_hardware"]["basis"] == "user-supplied scenario assumption"


def test_emissions_require_explicit_grid_factor():
    report = evaluate(
        Scenario(
            name="rover",
            average_power_w=Interval.point(100),
            runtime_hours=Interval.point(10),
            grid_carbon_kgco2e_per_kwh=Interval(0.1, 0.2, 0.4),
        )
    )
    assert report["metrics"]["operational_emissions_kgco2e"] == {
        "low": pytest.approx(0.1),
        "central": pytest.approx(0.2),
        "high": pytest.approx(0.4),
    }


def test_invalid_or_partial_battery_inputs_are_rejected():
    with pytest.raises(ValueError):
        Interval(2, 1, 3)
    with pytest.raises(ValueError):
        Scenario(
            name="bad",
            average_power_w=Interval.point(10),
            runtime_hours=Interval.point(1),
            battery_voltage_v=Interval.point(12),
        )


def test_report_is_deterministic_and_fingerprint_changes_with_evidence():
    a = evaluate(
        Scenario(
            name="rover",
            average_power_w=Interval.point(20),
            runtime_hours=Interval.point(1),
        )
    )
    b = json.loads(json.dumps(a))
    assert report_fingerprint(a) == report_fingerprint(b)
    b["scenario"]["physical_prototypes_avoided"] = 1
    assert report_fingerprint(a) != report_fingerprint(b)


def test_compare_reports_energy_change_without_calling_it_carbon_saving():
    baseline = Scenario(
        name="baseline",
        average_power_w=Interval.point(40),
        runtime_hours=Interval.point(2),
    )
    candidate = Scenario(
        name="candidate",
        average_power_w=Interval.point(20),
        runtime_hours=Interval.point(2),
    )
    result = compare(baseline, candidate)
    assert result["central_operating_energy_change_percent"] == pytest.approx(-50.0)
    assert result["claim_boundary"] == (
        "Energy comparison only; it is not a carbon or lifecycle-impact claim."
    )


def test_factor_without_source_is_flagged():
    report = evaluate(
        Scenario(
            name="sourced factor check",
            average_power_w=Interval.point(20),
            runtime_hours=Interval.point(1),
            grid_carbon_kgco2e_per_kwh=Interval.point(0.2),
        )
    )
    assert any("without a citation" in str(item) for item in report["limitations"])


def test_committed_example_reproduces_byte_for_byte(tmp_path: Path):
    root = Path(__file__).parents[2]
    output = tmp_path / "report.json"
    assert (
        main(
            [
                str(root / "docs/eval/earthproof-scenario.json"),
                "--out",
                str(output),
            ]
        )
        == 0
    )
    assert output.read_bytes() == (root / "docs/eval/earthproof-report.json").read_bytes()
