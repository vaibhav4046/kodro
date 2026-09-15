"""Contract tests for the NextStep EarthProof evidence engine.

EarthProof intentionally reports engineering quantities first. It must never
invent carbon savings or claim that a simulated prototype was actually avoided.
"""

import json

import pytest

from kodro.earthproof import DesignEvidence, RunEvidence, build_earthproof_report, compare_designs


def test_report_is_deterministic_and_uses_explicit_scenario_assumptions():
    design = DesignEvidence(
        name="classroom-rover",
        robot_mass_kg=1.8,
        battery_capacity_wh=48.0,
        replaceable_component_mass_kg=0.62,
    )
    run = RunEvidence(runtime_seconds=900, average_power_w=24.0, successful_runs=5, total_runs=5)

    first = build_earthproof_report(design, run, scenario_physical_iterations_avoided=2)
    second = build_earthproof_report(design, run, scenario_physical_iterations_avoided=2)

    assert first == second
    assert first["measured_or_derived"]["run_energy_wh"] == 6.0
    assert first["scenario_estimates"]["material_not_required_kg"] == 1.24
    assert first["scenario_estimates"]["physical_iterations_avoided"] == 2
    assert first["evidence_quality"]["proof_success_rate"] == 1.0
    assert first["claims_boundary"]["carbon_kg_co2e"] is None
    assert "scenario" in first["claims_boundary"]["material_statement"].lower()
    json.dumps(first, sort_keys=True)


def test_carbon_is_only_calculated_when_caller_supplies_a_factor():
    design = DesignEvidence("rover", 2.0, 60.0, 0.5)
    run = RunEvidence(3600, 30.0, 4, 5)

    without_factor = build_earthproof_report(design, run, scenario_physical_iterations_avoided=1)
    with_factor = build_earthproof_report(
        design,
        run,
        scenario_physical_iterations_avoided=1,
        electricity_factor_kg_co2e_per_kwh=0.20,
        electricity_factor_source="user supplied test factor",
    )

    assert without_factor["claims_boundary"]["carbon_kg_co2e"] is None
    assert with_factor["scenario_estimates"]["run_carbon_kg_co2e"] == 0.006
    assert with_factor["assumptions"]["electricity_factor_source"] == "user supplied test factor"


def test_compare_designs_prefers_lower_run_energy_without_collapsing_to_a_magic_score():
    run_a = build_earthproof_report(
        DesignEvidence("A", 2.0, 60.0, 0.5),
        RunEvidence(1800, 20.0, 5, 5),
        scenario_physical_iterations_avoided=1,
    )
    run_b = build_earthproof_report(
        DesignEvidence("B", 1.7, 50.0, 0.4),
        RunEvidence(1800, 12.0, 5, 5),
        scenario_physical_iterations_avoided=1,
    )

    comparison = compare_designs(run_a, run_b)

    assert comparison["lower_run_energy"] == "B"
    assert comparison["run_energy_difference_wh"] == 4.0
    assert "sustainability_score" not in comparison


@pytest.mark.parametrize(
    "design,run,iterations",
    [
        (DesignEvidence("x", 0, 10, 1), RunEvidence(10, 1, 1, 1), 1),
        (DesignEvidence("x", 1, -1, 1), RunEvidence(10, 1, 1, 1), 1),
        (DesignEvidence("x", 1, 10, 1), RunEvidence(0, 1, 1, 1), 1),
        (DesignEvidence("x", 1, 10, 1), RunEvidence(10, 1, 2, 1), 1),
        (DesignEvidence("x", 1, 10, 1), RunEvidence(10, 1, 1, 1), -1),
    ],
)
def test_invalid_evidence_is_rejected(design, run, iterations):
    with pytest.raises(ValueError):
        build_earthproof_report(design, run, scenario_physical_iterations_avoided=iterations)
