"""Auditable sustainability evidence for Kodro design/prove/build workflows.

EarthProof is deliberately conservative. It separates quantities derived from
simulation inputs from scenario estimates supplied by a user. It does not claim
that virtual testing caused real-world material, energy, cost, or carbon savings.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from hashlib import sha256
from typing import Any


@dataclass(frozen=True)
class DesignEvidence:
    """Physical quantities known or assumed for a candidate robot design."""

    name: str
    robot_mass_kg: float
    battery_capacity_wh: float
    replaceable_component_mass_kg: float


@dataclass(frozen=True)
class RunEvidence:
    """Quantities measured or derived from one controlled proof workload."""

    runtime_seconds: float
    average_power_w: float
    successful_runs: int
    total_runs: int


def _finite_nonnegative(value: float, label: str, *, allow_zero: bool = True) -> float:
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")):
        raise ValueError(f"{label} must be finite")
    if number < 0 or (not allow_zero and number == 0):
        qualifier = "positive" if not allow_zero else "non-negative"
        raise ValueError(f"{label} must be {qualifier}")
    return number


def _validate(design: DesignEvidence, run: RunEvidence, iterations: int) -> None:
    if not design.name.strip():
        raise ValueError("design name must not be empty")
    _finite_nonnegative(design.robot_mass_kg, "robot_mass_kg", allow_zero=False)
    _finite_nonnegative(design.battery_capacity_wh, "battery_capacity_wh")
    _finite_nonnegative(design.replaceable_component_mass_kg, "replaceable_component_mass_kg")
    _finite_nonnegative(run.runtime_seconds, "runtime_seconds", allow_zero=False)
    _finite_nonnegative(run.average_power_w, "average_power_w")
    if run.total_runs <= 0:
        raise ValueError("total_runs must be positive")
    if run.successful_runs < 0 or run.successful_runs > run.total_runs:
        raise ValueError("successful_runs must be between zero and total_runs")
    if iterations < 0:
        raise ValueError("scenario_physical_iterations_avoided must be non-negative")


def build_earthproof_report(
    design: DesignEvidence,
    run: RunEvidence,
    *,
    scenario_physical_iterations_avoided: int = 0,
    electricity_factor_kg_co2e_per_kwh: float | None = None,
    electricity_factor_source: str | None = None,
) -> dict[str, Any]:
    """Build a deterministic, machine-readable evidence report.

    ``scenario_physical_iterations_avoided`` is explicitly a counterfactual
    supplied for comparison, not an observed outcome. A carbon quantity is
    emitted only when the caller supplies both a factor and its source.
    """
    _validate(design, run, scenario_physical_iterations_avoided)

    run_energy_wh = round(run.average_power_w * run.runtime_seconds / 3600.0, 6)
    material_not_required_kg = round(
        design.replaceable_component_mass_kg * scenario_physical_iterations_avoided,
        6,
    )
    proof_success_rate = round(run.successful_runs / run.total_runs, 6)

    carbon_value: float | None = None
    factor: float | None = None
    source: str | None = None
    if electricity_factor_kg_co2e_per_kwh is not None:
        factor = _finite_nonnegative(
            electricity_factor_kg_co2e_per_kwh,
            "electricity_factor_kg_co2e_per_kwh",
        )
        if not electricity_factor_source or not electricity_factor_source.strip():
            raise ValueError("a carbon factor requires electricity_factor_source")
        source = electricity_factor_source.strip()
        carbon_value = round((run_energy_wh / 1000.0) * factor, 9)
    elif electricity_factor_source is not None:
        raise ValueError("electricity_factor_source requires a carbon factor")

    payload: dict[str, Any] = {
        "schema": "kodro.earthproof.v1",
        "design": asdict(design),
        "measured_or_derived": {
            "runtime_seconds": float(run.runtime_seconds),
            "average_power_w": float(run.average_power_w),
            "run_energy_wh": run_energy_wh,
            "battery_capacity_wh": float(design.battery_capacity_wh),
        },
        "scenario_estimates": {
            "physical_iterations_avoided": int(scenario_physical_iterations_avoided),
            "material_not_required_kg": material_not_required_kg,
            "run_carbon_kg_co2e": carbon_value,
        },
        "evidence_quality": {
            "successful_runs": int(run.successful_runs),
            "total_runs": int(run.total_runs),
            "proof_success_rate": proof_success_rate,
        },
        "assumptions": {
            "material_basis": (
                "replaceable component mass multiplied by a caller supplied "
                "counterfactual iteration count"
            ),
            "electricity_factor_kg_co2e_per_kwh": factor,
            "electricity_factor_source": source,
        },
        "claims_boundary": {
            "material_statement": (
                "Material not required is a scenario estimate, not measured waste avoided. "
                "Kodro does not claim the virtual proof caused a physical build to be cancelled."
            ),
            "carbon_kg_co2e": carbon_value,
            "carbon_statement": (
                "No carbon claim is produced without an explicit sourced factor."
                if carbon_value is None
                else (
                    "Carbon describes only the modelled electricity for this run using the "
                    "supplied factor; it is not lifecycle carbon."
                )
            ),
            "certification_statement": (
                "EarthProof is engineering evidence, not lifecycle assessment, safety "
                "certification, or environmental certification."
            ),
        },
    }

    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)
    payload["evidence_sha256"] = sha256(canonical.encode("utf-8")).hexdigest()
    return payload


def compare_designs(left: Mapping[str, Any], right: Mapping[str, Any]) -> dict[str, Any]:
    """Compare transparent quantities without inventing a composite green score."""
    left_name = str(left["design"]["name"])
    right_name = str(right["design"]["name"])
    left_energy = float(left["measured_or_derived"]["run_energy_wh"])
    right_energy = float(right["measured_or_derived"]["run_energy_wh"])
    left_mass = float(left["design"]["robot_mass_kg"])
    right_mass = float(right["design"]["robot_mass_kg"])

    def lower_label(a: float, b: float) -> str:
        if a == b:
            return "tie"
        return left_name if a < b else right_name

    return {
        "schema": "kodro.earthproof.comparison.v1",
        "left": left_name,
        "right": right_name,
        "lower_run_energy": lower_label(left_energy, right_energy),
        "run_energy_difference_wh": round(abs(left_energy - right_energy), 6),
        "lower_robot_mass": lower_label(left_mass, right_mass),
        "robot_mass_difference_kg": round(abs(left_mass - right_mass), 6),
        "interpretation": (
            "Lower values describe this controlled comparison only; they are not a lifecycle "
            "sustainability ranking."
        ),
    }
