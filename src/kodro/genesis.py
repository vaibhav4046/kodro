"""Deterministic candidate-comparison experiments over the Prove engine.

Genesis is the closed experimental loop -- goal, generate, simulate, observe
failure, modify, re-simulate, prove -- with Kodro's existing deterministic
engine as the only execution authority. Each candidate controller runs through
:func:`kodro.prove.build_manifest` on the same contracts and seed root, so a
win means "this program met the declared criteria on the recorded seeds",
never "a model preferred this program".

What this module does not do, on purpose: no model call, no network, no
heuristic scoring, no physical-safety claim. Candidate reasoning (a pupil
editing code, Ollama drafting a fix locally, an agent calling the existing
``run_program``/``grade_program`` MCP tools) happens outside; this module only
measures and compares. The evidence boundary string is inherited from Prove
verbatim.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from kodro.prove import (
    Contract,
    build_manifest,
    compare_manifests,
    load_contracts,
)

EXPERIMENT_SCHEMA = "kodro.genesis-experiment/1"

#: Largest batch this module will run. Four candidates at ten runs over four
#: contracts is 160 seeded episodes at roughly a millisecond each: a bounded
#: batch that finishes interactively. Anything larger is a compute job, not an
#: experiment, and should be split rather than silently executed.
MAX_CANDIDATES: int = 4

#: Seeds per contract per candidate. Matches Prove's default envelope; the
#: upper bound keeps a full experiment to seconds, not minutes.
MIN_RUNS: int = 1
MAX_RUNS: int = 10

#: Largest candidate program accepted, in characters. Mirrors the MCP server's
#: ``MAX_SOURCE_CHARS`` so a program refused over MCP is refused here too.
MAX_CANDIDATE_CHARS: int = 20_000


def _check_budget(candidates: Mapping[str, str], runs: int) -> None:
    """Reject empty or absurd batches before any simulation runs."""
    if not candidates:
        raise ValueError("at least one candidate controller is required")
    if len(candidates) > MAX_CANDIDATES:
        raise ValueError(
            f"at most {MAX_CANDIDATES} candidates per experiment, got {len(candidates)}"
        )
    if runs < MIN_RUNS:
        raise ValueError(f"runs must be at least {MIN_RUNS}, got {runs}")
    if runs > MAX_RUNS:
        raise ValueError(f"runs must be at most {MAX_RUNS}, got {runs}")
    for name, source in candidates.items():
        if not isinstance(source, str) or not source.strip():
            raise ValueError(f"candidate {name!r} has no program text")
        if len(source) > MAX_CANDIDATE_CHARS:
            raise ValueError(
                f"candidate {name!r} is {len(source)} characters; "
                f"the limit is {MAX_CANDIDATE_CHARS}"
            )


def _totals(manifest: dict[str, Any]) -> tuple[int, float, float]:
    """Return (passed_runs, total_collisions, worst_goal_error) for ranking."""
    passed = 0
    collisions = 0.0
    worst_error = 0.0
    for row in manifest["contracts"]:
        agg = row["aggregate"]
        passed += int(agg["passed_runs"])
        collisions += float(agg["mean_collisions"]) * int(agg["runs"])
        worst_error = max(worst_error, float(agg["max_goal_error_m"]))
    return passed, collisions, worst_error


def _rank_key(item: tuple[str, dict[str, Any]]) -> tuple[bool, int, float, float, str]:
    """Deterministic ranking key: verdict, evidence, then name.

    A passing overall verdict always outranks a failing one; among equal
    verdicts the evidence decides (more passed runs, fewer collisions,
    smaller worst goal error); exact ties break alphabetically so the same
    inputs always name the same winner.
    """
    name, manifest = item
    passed, collisions, worst_error = _totals(manifest)
    return (manifest["verdict"] != "pass", -passed, collisions, worst_error, name)


def diagnose_candidate(manifest: dict[str, Any]) -> dict[str, Any]:
    """Point at the failing evidence for one candidate, deterministically.

    Returns the failed contract ids, the worst per-seed facts observed, and
    one concrete next action derived from the evidence alone: execution
    errors first (the program never ran), then collisions (drove through
    something), then goal error (drove the wrong route), then battery
    (ran out of charge). A passing candidate reports no failures and a
    hold-the-course action.
    """
    failed: list[str] = []
    worst: dict[str, Any] | None = None
    for row in manifest["contracts"]:
        if row["aggregate"]["verdict"] != "pass":
            failed.append(row["contract_id"])
        for run in row["runs"]:
            metrics = run["metrics"]
            if worst is None or (
                metrics["goal_error_m"],
                metrics["collisions"],
            ) > (worst["goal_error_m"], worst["collisions"]):
                worst = {
                    "contract_id": row["contract_id"],
                    "seed": run["seed"],
                    "execution_ok": metrics["execution_ok"],
                    "error": metrics["error"],
                    "collisions": metrics["collisions"],
                    "goal_error_m": metrics["goal_error_m"],
                    "distance_m": metrics["distance_m"],
                    "battery_pct": metrics["battery_pct"],
                }
    failed.sort()
    if not failed:
        return {
            "failed_contracts": [],
            "worst_seed": worst,
            "next_action": (
                "Hold this controller: it met every criterion. "
                "Vary it deliberately to test the margin."
            ),
        }
    assert worst is not None
    if not worst["execution_ok"]:
        action = f"Fix the program error first ({worst['error']}); the rover never got to drive."
    elif worst["collisions"]:
        action = (
            f"Route around the obstacle on {worst['contract_id']}: check obstacle_ahead() "
            "before driving through the blocked line."
        )
    elif worst["goal_error_m"] > 0.5:
        action = (
            f"Adjust the route on {worst['contract_id']}: the rover stopped "
            f"{worst['goal_error_m']} m from the marker, so change a distance or turn."
        )
    elif worst["battery_pct"] < 60.0:
        action = "Shorten the route or cut waiting: the battery reserve is the binding constraint."
    else:
        action = (
            f"Drive further on {worst['contract_id']}: only {worst['distance_m']} m covered "
            "before the run ended."
        )
    return {"failed_contracts": failed, "worst_seed": worst, "next_action": action}


def run_experiment(
    candidates: Mapping[str, str],
    contracts: tuple[Contract, ...],
    *,
    runs: int = 3,
    seed_root: int = 4046,
) -> dict[str, Any]:
    """Run every candidate through Prove and return the experiment record."""
    _check_budget(candidates, runs)
    manifests: dict[str, dict[str, Any]] = {}
    for name in sorted(candidates):
        manifests[name] = build_manifest(
            contracts, runs=runs, seed_root=seed_root, controller_override=candidates[name]
        )
    ranking = [name for name, _ in sorted(manifests.items(), key=_rank_key)]
    first = manifests[ranking[0]]
    return {
        "schema": EXPERIMENT_SCHEMA,
        "seed_root": seed_root,
        "runs_per_contract": runs,
        "engine": first["engine"],
        "candidates": [
            {
                "name": name,
                "controller_sha256": hashlib.sha256(candidates[name].encode()).hexdigest(),
                "manifest": manifests[name],
            }
            for name in ranking
        ],
        "ranking": ranking,
        "winner": ranking[0],
        "winner_verdict": first["verdict"],
        "diagnosis": {name: diagnose_candidate(manifests[name]) for name in ranking},
        "evidence_boundary": first["evidence_boundary"],
    }


def canonical_experiment(experiment: dict[str, Any]) -> str:
    """Serialise an experiment to the byte-stable canonical representation."""
    return json.dumps(experiment, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def human_report(experiment: dict[str, Any]) -> str:
    """Render the experiment as a concise, human-readable Markdown report."""
    lines = [
        "# Kodro Genesis experiment report",
        "",
        f"Winner: **{experiment['winner']}** "
        f"(deterministic verdict: **{str(experiment['winner_verdict']).upper()}**)",
        "",
        str(experiment["evidence_boundary"]),
        "",
        f"Seed root: `{experiment['seed_root']}` | "
        f"Runs per contract: `{experiment['runs_per_contract']}`",
        "",
        "| Candidate | Verdict | Passed runs | Mean collisions | Worst goal error |",
        "|---|--:|--:|--:|--:|",
    ]
    for entry in experiment["candidates"]:
        manifest = entry["manifest"]
        passed, collisions, worst_error = _totals(manifest)
        total = sum(int(row["aggregate"]["runs"]) for row in manifest["contracts"])
        lines.append(
            f"| {entry['name']} | {str(manifest['verdict']).upper()} | "
            f"{passed}/{total} | {collisions:.2f} | {worst_error:.3f} m |"
        )
    lines.extend(["", "## Failure evidence and next actions", ""])
    for name in experiment["ranking"]:
        diagnosis = experiment["diagnosis"][name]
        if not diagnosis["failed_contracts"]:
            lines.append(f"- **{name}**: met every criterion. {diagnosis['next_action']}")
        else:
            lines.append(
                f"- **{name}**: failed {', '.join(diagnosis['failed_contracts'])}. "
                f"{diagnosis['next_action']}"
            )
    lines.extend(
        [
            "",
            "## Interpretation boundary",
            "",
            "A win means the controller met the declared criteria for the recorded seeds "
            "and perturbations in this kinematic engine. It is not evidence of real-world "
            "equivalence, electrical safety, mechanical safety or fitness for deployment.",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    """Run a Genesis experiment from the command line (``kodro-genesis``)."""
    parser = argparse.ArgumentParser(
        prog="kodro-genesis",
        description=(
            "Compare candidate robot controllers through Kodro's deterministic "
            "Prove engine and emit reproducible experiment evidence."
        ),
    )
    parser.add_argument(
        "--candidate",
        action="append",
        default=[],
        metavar="NAME=PATH",
        help="candidate name and controller file, repeatable (max 4)",
    )
    parser.add_argument("--contracts", type=Path, default=None, help="contract catalogue JSON")
    parser.add_argument("--contract", action="append", default=[], help="contract id to run")
    parser.add_argument("--runs", type=int, default=3, help="seeded runs per contract (1-10)")
    parser.add_argument("--seed-root", type=int, default=4046, help="root deterministic seed")
    parser.add_argument(
        "--manifest", type=Path, default=None, help="write canonical JSON experiment"
    )
    parser.add_argument("--report", type=Path, default=None, help="write Markdown report")
    parser.add_argument(
        "--verify-reproducible",
        action="store_true",
        help="run twice and require byte-identical experiments",
    )
    args = parser.parse_args(argv)
    if not args.candidate:
        parser.error("at least one --candidate NAME=PATH is required")
    candidates: dict[str, str] = {}
    for item in args.candidate:
        name, sep, path_str = item.partition("=")
        if not sep or not name.strip() or not path_str.strip():
            parser.error(f"--candidate must be NAME=PATH, got {item!r}")
        path = Path(path_str.strip())
        if not path.is_file():
            parser.error(f"candidate {name.strip()!r}: no such file: {path}")
        try:
            candidates[name.strip()] = path.read_text(encoding="utf-8")
        except OSError as exc:
            parser.error(f"candidate {name.strip()!r}: could not read {path}: {exc}")
        except UnicodeDecodeError as exc:
            parser.error(f"candidate {name.strip()!r}: not UTF-8 text: {exc}")
    contracts = load_contracts(args.contracts)
    if args.contract:
        wanted = set(args.contract)
        contracts = tuple(c for c in contracts if c.contract_id in wanted)
        missing = wanted - {c.contract_id for c in contracts}
        if missing:
            parser.error(f"unknown contract ids: {', '.join(sorted(missing))}")
    try:
        experiment = run_experiment(candidates, contracts, runs=args.runs, seed_root=args.seed_root)
    except ValueError as exc:
        parser.error(str(exc))
    canonical = canonical_experiment(experiment)
    failed = experiment["winner_verdict"] != "pass"
    if args.verify_reproducible:
        repeated = run_experiment(candidates, contracts, runs=args.runs, seed_root=args.seed_root)
        if canonical_experiment(repeated) != canonical:
            print("kodro-genesis: reproducibility check failed")
            failed = True
        else:
            print("kodro-genesis: reproducibility check passed")
    if args.manifest:
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(canonical, encoding="utf-8", newline="\n")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(human_report(experiment), encoding="utf-8", newline="\n")
    print(human_report(experiment))
    if len(experiment["candidates"]) > 1:
        baseline = experiment["candidates"][-1]["manifest"]
        current = experiment["candidates"][0]["manifest"]
        for difference in compare_manifests(baseline, current):
            print(f"kodro-genesis: winner-vs-last: {difference}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
