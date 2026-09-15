"""Auditable scenario evidence for lower-waste robotics prototyping.

EarthProof deliberately does not contain default carbon or embodied-impact factors.
It computes only from values supplied by the user and labels scenario-based
avoidance separately from measured facts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Interval:
    """A non-negative low/central/high estimate."""

    low: float
    central: float
    high: float

    def __post_init__(self) -> None:
        """Validate interval ordering and sign."""
        if self.low < 0:
            raise ValueError("interval values must be non-negative")
        if not self.low <= self.central <= self.high:
            raise ValueError("interval must satisfy low <= central <= high")

    @classmethod
    def point(cls, value: float) -> Interval:
        """Create an interval with no stated uncertainty."""
        return cls(value, value, value)

    def multiply(self, other: Interval) -> Interval:
        """Multiply two non-negative intervals."""
        return Interval(
            self.low * other.low,
            self.central * other.central,
            self.high * other.high,
        )

    def scale(self, factor: float) -> Interval:
        """Scale an interval by a non-negative factor."""
        if factor < 0:
            raise ValueError("scale factor must be non-negative")
        return Interval(self.low * factor, self.central * factor, self.high * factor)

    def as_dict(self) -> dict[str, float]:
        """Return a JSON-safe representation."""
        return {
            "low": round(self.low, 12),
            "central": round(self.central, 12),
            "high": round(self.high, 12),
        }

    @classmethod
    def from_mapping(cls, value: Mapping[str, object]) -> Interval:
        """Parse an interval from a mapping with low/central/high keys."""
        try:
            low = float(value["low"])  # type: ignore[arg-type]
            central = float(value["central"])  # type: ignore[arg-type]
            high = float(value["high"])  # type: ignore[arg-type]
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("interval requires numeric low, central and high") from exc
        return cls(low, central, high)


@dataclass(frozen=True, slots=True)
class Scenario:
    """Inputs for one transparent EarthProof scenario."""

    name: str
    average_power_w: Interval
    runtime_hours: Interval
    physical_prototypes_avoided: int = 0
    battery_voltage_v: Interval | None = None
    battery_capacity_ah: Interval | None = None
    prototype_material_mass_kg: Interval | None = None
    grid_carbon_kgco2e_per_kwh: Interval | None = None
    prototype_embodied_kgco2e: Interval | None = None
    notes: str = ""
    evidence_sources: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        """Validate scenario relationships that must hold together."""
        if not self.name.strip():
            raise ValueError("scenario name must not be empty")
        if self.physical_prototypes_avoided < 0:
            raise ValueError("physical_prototypes_avoided must be non-negative")
        if (self.battery_voltage_v is None) != (self.battery_capacity_ah is None):
            raise ValueError("battery voltage and capacity must be supplied together")

    @classmethod
    def from_mapping(cls, raw: Mapping[str, object]) -> Scenario:
        """Parse a JSON-compatible mapping."""

        def interval(key: str) -> Interval | None:
            value = raw.get(key)
            if value is None:
                return None
            if not isinstance(value, Mapping):
                raise ValueError(f"{key} must be an interval object")
            return Interval.from_mapping(value)

        power = interval("average_power_w")
        runtime = interval("runtime_hours")
        if power is None or runtime is None:
            raise ValueError("average_power_w and runtime_hours are required")

        avoided_raw = raw.get("physical_prototypes_avoided", 0)
        if isinstance(avoided_raw, bool) or not isinstance(avoided_raw, (int, float)):
            raise ValueError("physical_prototypes_avoided must be an integer")
        avoided = int(avoided_raw)
        if avoided != avoided_raw:
            raise ValueError("physical_prototypes_avoided must be an integer")

        sources_raw = raw.get("evidence_sources", ())
        if not isinstance(sources_raw, (list, tuple)):
            raise ValueError("evidence_sources must be a list")
        sources = tuple(
            item.strip() for item in sources_raw if isinstance(item, str) and item.strip()
        )

        return cls(
            name=str(raw.get("name", "")),
            average_power_w=power,
            runtime_hours=runtime,
            physical_prototypes_avoided=avoided,
            battery_voltage_v=interval("battery_voltage_v"),
            battery_capacity_ah=interval("battery_capacity_ah"),
            prototype_material_mass_kg=interval("prototype_material_mass_kg"),
            grid_carbon_kgco2e_per_kwh=interval("grid_carbon_kgco2e_per_kwh"),
            prototype_embodied_kgco2e=interval("prototype_embodied_kgco2e"),
            notes=str(raw.get("notes", "")),
            evidence_sources=sources,
        )


def _operating_energy_kwh(scenario: Scenario) -> Interval:
    return scenario.average_power_w.multiply(scenario.runtime_hours).scale(0.001)


def evaluate(scenario: Scenario) -> dict[str, object]:
    """Evaluate a scenario without inventing environmental coefficients."""
    energy = _operating_energy_kwh(scenario)

    battery_wh: Interval | None = None
    if scenario.battery_voltage_v is not None and scenario.battery_capacity_ah is not None:
        battery_wh = scenario.battery_voltage_v.multiply(scenario.battery_capacity_ah)

    operating_emissions: Interval | None = None
    if scenario.grid_carbon_kgco2e_per_kwh is not None:
        operating_emissions = energy.multiply(scenario.grid_carbon_kgco2e_per_kwh)

    material_avoided: Interval | None = None
    if scenario.physical_prototypes_avoided > 0 and scenario.prototype_material_mass_kg is not None:
        material_avoided = scenario.prototype_material_mass_kg.scale(
            scenario.physical_prototypes_avoided
        )

    embodied_avoided: Interval | None = None
    if scenario.physical_prototypes_avoided > 0 and scenario.prototype_embodied_kgco2e is not None:
        embodied_avoided = scenario.prototype_embodied_kgco2e.scale(
            scenario.physical_prototypes_avoided
        )

    limitations = [
        "Results are scenario estimates, not lifecycle-assessment certification.",
        "Virtual validation does not prove that a physical prototype would have been built or avoided.",
        "Real hardware safety, mechanical fit and electrical protection still require competent review.",
    ]
    if scenario.grid_carbon_kgco2e_per_kwh is None:
        limitations.append(
            "No grid-carbon factor supplied; no operational CO2e estimate was produced."
        )
    if scenario.prototype_embodied_kgco2e is None:
        limitations.append(
            "No prototype embodied-impact factor supplied; no embodied CO2e avoidance was claimed."
        )
    if (
        scenario.grid_carbon_kgco2e_per_kwh is not None
        or scenario.prototype_embodied_kgco2e is not None
    ) and not scenario.evidence_sources:
        limitations.append(
            "Environmental factors were supplied without a citation; add evidence_sources before presenting them as externally grounded."
        )

    metrics: dict[str, object] = {
        "operating_energy_kwh": energy.as_dict(),
        "battery_capacity_wh": battery_wh.as_dict() if battery_wh else None,
        "operational_emissions_kgco2e": operating_emissions.as_dict() if operating_emissions else None,
        "scenario_material_avoided_kg": material_avoided.as_dict() if material_avoided else None,
        "scenario_embodied_emissions_avoided_kgco2e": (
            embodied_avoided.as_dict() if embodied_avoided else None
        ),
    }
    claims: dict[str, object] = {
        "operating_energy": {
            "status": "calculated",
            "basis": "average_power_w * runtime_hours",
        },
        "avoided_hardware": {
            "status": "scenario estimate" if scenario.physical_prototypes_avoided else "not claimed",
            "basis": "user-supplied scenario assumption",
            "count": scenario.physical_prototypes_avoided,
        },
        "carbon": {
            "status": (
                "calculated from supplied factor"
                if scenario.grid_carbon_kgco2e_per_kwh
                else "not claimed"
            ),
            "basis": "user-supplied grid factor; EarthProof ships no default factor",
        },
    }
    return {
        "schema": "kodro-earthproof/v1",
        "method": "transparent-range-arithmetic/v1",
        "scenario": {
            "name": scenario.name,
            "physical_prototypes_avoided": scenario.physical_prototypes_avoided,
            "notes": scenario.notes,
            "evidence_sources": list(scenario.evidence_sources),
        },
        "metrics": metrics,
        "claims": claims,
        "limitations": limitations,
    }


def compare(baseline: Scenario, candidate: Scenario) -> dict[str, object]:
    """Compare operating energy without turning it into an unsupported impact claim."""
    baseline_energy = _operating_energy_kwh(baseline)
    candidate_energy = _operating_energy_kwh(candidate)
    central_change: float | None
    if baseline_energy.central == 0:
        central_change = None
    else:
        central_change = (
            (candidate_energy.central - baseline_energy.central) / baseline_energy.central * 100
        )
    return {
        "schema": "kodro-earthproof-comparison/v1",
        "baseline": baseline.name,
        "candidate": candidate.name,
        "baseline_operating_energy_kwh": baseline_energy.as_dict(),
        "candidate_operating_energy_kwh": candidate_energy.as_dict(),
        "central_operating_energy_change_percent": central_change,
        "claim_boundary": "Energy comparison only; it is not a carbon or lifecycle-impact claim.",
    }


def report_fingerprint(report: Mapping[str, object]) -> str:
    """Hash canonical evidence so reruns and edits can be detected."""
    canonical = json.dumps(report, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load(path: Path) -> Scenario:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, Mapping):
        raise ValueError("scenario JSON must contain an object")
    return Scenario.from_mapping(raw)


def main(argv: list[str] | None = None) -> int:
    """Run EarthProof from a scenario JSON file."""
    parser = argparse.ArgumentParser(
        description="Generate auditable sustainability scenario evidence for a Kodro robot."
    )
    parser.add_argument("scenario", type=Path, help="Candidate robot scenario JSON")
    parser.add_argument(
        "--baseline",
        type=Path,
        help="Optional baseline scenario to add an auditable operating-energy comparison",
    )
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)

    candidate = _load(args.scenario)
    report = evaluate(candidate)
    if args.baseline is not None:
        report["comparison"] = compare(_load(args.baseline), candidate)
    report["fingerprint_sha256"] = report_fingerprint(report)
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.out is None:
        print(rendered, end="")
    else:
        args.out.write_bytes(rendered.encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
