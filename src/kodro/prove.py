"""Deterministic contract evidence for Kodro's Prove stage.

This runner executes declarative contracts through the existing Python rover
engine. AI is not part of measurement or verdict calculation. A fixed contract,
controller and seed root produce a canonical byte-identical manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path
from typing import Any

from kodro import __version__
from kodro.engine.rover import Rover, RoverState
from kodro.engine.terrain import Terrain
from kodro.engine.world import ArenaBounds, Obstacle, World
from kodro.runtime.binding import clear_active, set_active_rover, set_active_world
from kodro.runtime.executor import execute

MANIFEST_SCHEMA = "kodro.prove-manifest/1"
ENGINE_ID = "kodro-python-rover"
IDLE_DRAIN_PCT_PER_S = 0.02


@dataclass(frozen=True, slots=True)
class ObstacleSpec:
    """One contract obstacle in metres."""

    x_m: float
    y_m: float
    radius_m: float


@dataclass(frozen=True, slots=True)
class Contract:
    """Parsed declarative Prove contract."""

    contract_id: str
    title: str
    description: str
    terrain: Terrain
    bounds_m: tuple[float, float]
    base_m: tuple[float, float]
    start: tuple[float, float, float]
    goal_m: tuple[float, float]
    obstacles: tuple[ObstacleSpec, ...]
    controller: str
    criteria: dict[str, float]
    perturbations: dict[str, tuple[float, float]]


def _pair(value: Any, label: str) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{label} must contain exactly two numbers")
    return (float(value[0]), float(value[1]))


def load_contracts(path: Path | None = None) -> tuple[Contract, ...]:
    """Load and validate the shipped contract catalogue."""
    if path is None:
        raw = files("kodro").joinpath("prove_contracts.json").read_text(encoding="utf-8")
    else:
        raw = path.read_text(encoding="utf-8")
    document: dict[str, Any] = json.loads(raw)
    if document.get("schema") != "kodro.contracts/1":
        raise ValueError("unsupported Prove contract schema")
    parsed: list[Contract] = []
    for row in document.get("contracts", []):
        start = row["start"]
        goal = row["goal"]
        obstacles = tuple(
            ObstacleSpec(float(item["x_m"]), float(item["y_m"]), float(item["radius_m"]))
            for item in row.get("obstacles", [])
        )
        criteria = {str(key): float(value) for key, value in row["criteria"].items()}
        perturbations = {
            str(key): _pair(value, f"{row['id']}.{key}")
            for key, value in row["perturbations"].items()
        }
        required = {
            "obstacle_offset_m",
            "sensor_noise_m",
            "start_delay_s",
            "initial_battery_pct",
        }
        if set(perturbations) != required:
            raise ValueError(f"{row['id']} must declare exactly {sorted(required)}")
        parsed.append(
            Contract(
                contract_id=str(row["id"]),
                title=str(row["title"]),
                description=str(row["description"]),
                terrain=Terrain(str(row["terrain"])),
                bounds_m=_pair(row["bounds_m"], f"{row['id']}.bounds_m"),
                base_m=_pair(row["base_m"], f"{row['id']}.base_m"),
                start=(float(start["x_m"]), float(start["y_m"]), float(start["heading_deg"])),
                goal_m=(float(goal["x_m"]), float(goal["y_m"])),
                obstacles=obstacles,
                controller=str(row["controller"]),
                criteria=criteria,
                perturbations=perturbations,
            )
        )
    if not 3 <= len(parsed) <= 5:
        raise ValueError(f"expected 3 to 5 Prove contracts, found {len(parsed)}")
    return tuple(parsed)


def _unit(seed: int, label: str) -> float:
    digest = hashlib.sha256(f"{seed}:{label}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / float(2**64)


def _sample(seed: int, label: str, limits: tuple[float, float]) -> float:
    return limits[0] + (limits[1] - limits[0]) * _unit(seed, label)


def _round(value: float) -> float:
    return round(value, 6)


def _engine_hash() -> str:
    package = Path(__file__).resolve().parent
    names = (
        "engine/motion_model.py",
        "engine/rover.py",
        "engine/sensors.py",
        "engine/world.py",
        "prove.py",
        "prove_contracts.json",
        "rover_api.py",
        "runtime/executor.py",
    )
    digest = hashlib.sha256()
    for name in names:
        digest.update(name.encode())
        digest.update(b"\0")
        digest.update((package / name).read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _criterion_verdict(metrics: dict[str, Any], criteria: dict[str, float]) -> bool:
    return bool(
        metrics["execution_ok"]
        and metrics["distance_m"] >= criteria["min_distance_m"]
        and metrics["collisions"] <= criteria["max_collisions"]
        and metrics["battery_pct"] >= criteria["min_battery_pct"]
        and metrics["goal_error_m"] <= criteria["max_goal_error_m"]
    )


def run_contract_seed(contract: Contract, controller: str, seed: int) -> dict[str, Any]:
    """Execute one contract seed and return its evidence record."""
    p = contract.perturbations
    obstacle_offset = _sample(seed, "obstacle_offset", p["obstacle_offset_m"])
    sensor_noise = _sample(seed, "sensor_noise", p["sensor_noise_m"])
    start_delay = _sample(seed, "start_delay", p["start_delay_s"])
    initial_battery = _sample(seed, "initial_battery", p["initial_battery_pct"])
    battery_at_start = max(0.0, initial_battery - start_delay * IDLE_DRAIN_PCT_PER_S)
    obstacles = [
        Obstacle(
            spec.x_m + obstacle_offset * (1.0 if index % 2 == 0 else -1.0),
            spec.y_m + obstacle_offset * (1.0 if index % 3 == 0 else -1.0),
            spec.radius_m,
        )
        for index, spec in enumerate(contract.obstacles)
    ]
    world = World(
        terrain=contract.terrain,
        base=contract.base_m,
        obstacles=obstacles,
        bounds=ArenaBounds(*contract.bounds_m),
    )
    state = RoverState(
        x=contract.start[0],
        y=contract.start[1],
        heading_deg=contract.start[2],
        battery_pct=battery_at_start,
    )
    rover = Rover(world, state, sensor_noise_m=sensor_noise, sensor_seed=seed)
    set_active_rover(rover)
    set_active_world(world)
    try:
        execution = execute(controller, timeout_s=5.0)
    finally:
        clear_active()
    end = rover.state
    goal_error = math.hypot(end.x - contract.goal_m[0], end.y - contract.goal_m[1])
    error = (
        None
        if execution.success
        else (execution.error_message or execution.error_kind or "controller execution failed")
    )
    metrics: dict[str, Any] = {
        "execution_ok": execution.success,
        "distance_m": _round(end.distance_travelled_m),
        "collisions": end.collisions,
        "battery_pct": _round(end.battery_pct),
        "goal_error_m": _round(goal_error),
        "final_x_m": _round(end.x),
        "final_y_m": _round(end.y),
        "heading_deg": _round(end.heading_deg),
        "error": error,
    }
    return {
        "contract_id": contract.contract_id,
        "seed": seed,
        "conditions": {
            "obstacle_offset_m": _round(obstacle_offset),
            "sensor_noise_m": _round(sensor_noise),
            "start_delay_s": _round(start_delay),
            "initial_battery_pct": _round(initial_battery),
        },
        "metrics": metrics,
        "verdict": "pass" if _criterion_verdict(metrics, contract.criteria) else "fail",
    }


def build_manifest(
    contracts: tuple[Contract, ...],
    *,
    runs: int = 5,
    seed_root: int = 4046,
    controller_override: str | None = None,
) -> dict[str, Any]:
    """Run all selected contracts and return a canonical evidence manifest."""
    if runs < 1:
        raise ValueError("runs must be at least 1")
    rows: list[dict[str, Any]] = []
    for contract_index, contract in enumerate(contracts):
        controller = controller_override if controller_override is not None else contract.controller
        code_hash = hashlib.sha256(controller.encode()).hexdigest()
        run_rows = [
            run_contract_seed(contract, controller, seed_root + contract_index * 1000 + index)
            for index in range(runs)
        ]
        passed = sum(row["verdict"] == "pass" for row in run_rows)
        pass_rate = passed / runs
        metrics = [row["metrics"] for row in run_rows]
        aggregate = {
            "runs": runs,
            "passed_runs": passed,
            "pass_rate": _round(pass_rate),
            "mean_distance_m": _round(sum(row["distance_m"] for row in metrics) / runs),
            "mean_collisions": _round(sum(row["collisions"] for row in metrics) / runs),
            "mean_battery_pct": _round(sum(row["battery_pct"] for row in metrics) / runs),
            "max_goal_error_m": _round(max(row["goal_error_m"] for row in metrics)),
            "verdict": "pass" if pass_rate >= contract.criteria["required_pass_rate"] else "fail",
        }
        rows.append(
            {
                "contract_id": contract.contract_id,
                "title": contract.title,
                "description": contract.description,
                "controller_sha256": code_hash,
                "criteria": contract.criteria,
                "runs": run_rows,
                "aggregate": aggregate,
            }
        )
    return {
        "schema": MANIFEST_SCHEMA,
        "seed_root": seed_root,
        "engine": {
            "id": ENGINE_ID,
            "version": __version__,
            "source_sha256": _engine_hash(),
        },
        "contracts": rows,
        "verdict": "pass" if all(row["aggregate"]["verdict"] == "pass" for row in rows) else "fail",
        "evidence_boundary": (
            "Kinematic simulation evidence only. This does not validate or certify "
            "physical performance or safety."
        ),
    }


def canonical_manifest(manifest: dict[str, Any]) -> str:
    """Serialise a manifest to the byte-stable canonical representation."""
    return json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def human_report(manifest: dict[str, Any]) -> str:
    """Render the manifest as a concise, human-readable Markdown report."""
    lines = [
        "# Kodro Prove report",
        "",
        f"Overall deterministic verdict: **{str(manifest['verdict']).upper()}**",
        "",
        str(manifest["evidence_boundary"]),
        "",
        f"Engine: `{manifest['engine']['id']}` version `{manifest['engine']['version']}`",
        f"Engine source SHA-256: `{manifest['engine']['source_sha256']}`",
        f"Seed root: `{manifest['seed_root']}`",
        "",
        "| Contract | Runs passed | Mean distance | Mean collisions | Mean battery | Verdict |",
        "|---|---:|---:|---:|---:|---|",
    ]
    for row in manifest["contracts"]:
        agg = row["aggregate"]
        lines.append(
            f"| {row['title']} | {agg['passed_runs']}/{agg['runs']} | "
            f"{agg['mean_distance_m']:.3f} m | {agg['mean_collisions']:.3f} | "
            f"{agg['mean_battery_pct']:.2f}% | {str(agg['verdict']).upper()} |"
        )
    lines.extend(
        [
            "",
            "## Interpretation boundary",
            "",
            "A pass means the controller met the declared criteria for the recorded seeds and "
            "perturbations in this kinematic engine. It is not evidence of real-world equivalence, "
            "electrical safety, mechanical safety or fitness for deployment.",
            "",
        ]
    )
    return "\n".join(lines)


def compare_manifests(baseline: dict[str, Any], current: dict[str, Any]) -> list[str]:
    """Return deterministic outcome or metric changes relative to a baseline."""
    differences: list[str] = []
    before = {row["contract_id"]: row for row in baseline.get("contracts", [])}
    after = {row["contract_id"]: row for row in current.get("contracts", [])}
    if set(before) != set(after):
        differences.append("contract set changed")
        return differences
    for contract_id in sorted(before):
        old = before[contract_id]
        new = after[contract_id]
        if old["controller_sha256"] != new["controller_sha256"]:
            differences.append(f"{contract_id}: controller hash changed")
        if old["aggregate"] != new["aggregate"]:
            differences.append(f"{contract_id}: aggregate metrics or verdict changed")
        old_runs = [
            {"seed": row["seed"], "metrics": row["metrics"], "verdict": row["verdict"]}
            for row in old["runs"]
        ]
        new_runs = [
            {"seed": row["seed"], "metrics": row["metrics"], "verdict": row["verdict"]}
            for row in new["runs"]
        ]
        if old_runs != new_runs:
            differences.append(f"{contract_id}: per-seed evidence changed")
    return differences


def main(argv: list[str] | None = None) -> int:
    """Run the Prove contracts, write evidence, and fail on a failed verdict."""
    parser = argparse.ArgumentParser(
        prog="kodro-prove",
        description="Run deterministic robot contracts and emit reproducible evidence.",
    )
    parser.add_argument("--contracts", type=Path, default=None, help="contract catalogue JSON")
    parser.add_argument("--contract", action="append", default=[], help="contract id to run")
    parser.add_argument("--runs", type=int, default=5, help="seeded runs per contract")
    parser.add_argument("--seed-root", type=int, default=4046, help="root deterministic seed")
    parser.add_argument("--controller", type=Path, default=None, help="override controller file")
    parser.add_argument("--manifest", type=Path, default=None, help="write canonical JSON manifest")
    parser.add_argument("--report", type=Path, default=None, help="write Markdown report")
    parser.add_argument("--compare", type=Path, default=None, help="compare against baseline JSON")
    parser.add_argument(
        "--verify-reproducible",
        action="store_true",
        help="run twice and require byte-identical manifests",
    )
    args = parser.parse_args(argv)
    contracts = load_contracts(args.contracts)
    if args.contract:
        wanted = set(args.contract)
        contracts = tuple(contract for contract in contracts if contract.contract_id in wanted)
        missing = wanted - {contract.contract_id for contract in contracts}
        if missing:
            parser.error(f"unknown contract ids: {', '.join(sorted(missing))}")
    controller = args.controller.read_text(encoding="utf-8") if args.controller else None
    manifest = build_manifest(
        contracts,
        runs=args.runs,
        seed_root=args.seed_root,
        controller_override=controller,
    )
    canonical = canonical_manifest(manifest)
    failed = manifest["verdict"] != "pass"
    if args.verify_reproducible:
        repeated = build_manifest(
            contracts,
            runs=args.runs,
            seed_root=args.seed_root,
            controller_override=controller,
        )
        if canonical_manifest(repeated) != canonical:
            print("kodro-prove: reproducibility check failed")
            failed = True
        else:
            print("kodro-prove: reproducibility check passed")
    if args.compare:
        baseline = json.loads(args.compare.read_text(encoding="utf-8"))
        differences = compare_manifests(baseline, manifest)
        if differences:
            for difference in differences:
                print(f"kodro-prove: regression: {difference}")
            failed = True
        else:
            print("kodro-prove: baseline comparison passed")
    if args.manifest:
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(canonical, encoding="utf-8", newline="\n")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(human_report(manifest), encoding="utf-8", newline="\n")
    print(human_report(manifest))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
