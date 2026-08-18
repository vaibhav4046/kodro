"""Headless batch runner for kodro-core (Phase 2).

Runs a pupil program across N randomised seeds through the SAME Python engine
the desktop app uses (executor -> rover_api -> engine.Rover), with per-seed
domain randomisation of the obstacle field (Tobin et al. 2017), and emits a
versioned per-run JSON report. This is the CI-friendly, no-UI surface a
researcher or a CI job drives:

    python -m robolearn.bench --code prog.py --seeds 20 --json out.json
    kodro-bench --code prog.py --seeds 20      # console script

Determinism is a contract: a given (code, seed) always produces the identical
run record, because the engine is deterministic and the randomisation is seeded.
The report schema is ``kodro.report/1``:

    {
      "schema": "kodro.report/1",
      "scenario": "obstacle_field",
      "seeds": 20,
      "success_criterion": "...",
      "runs": [ {seed, success, collisions, distance_m, samples_collected,
                 final_x, final_y, error}, ... ],
      "aggregate": {success_rate, successes, failures, errors,
                    mean_collisions, mean_distance_m}
    }

The success criterion here is deliberately task-agnostic and honest: a run
succeeds when the program drives WITHOUT colliding and actually moves at least
``min_distance`` metres. Per-task success criteria (the full KodroBench suite)
build on this runner and are a separate, later layer.
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Obstacle, World
from robolearn.grounding import check_grounding
from robolearn.runtime.binding import clear_active, set_active_rover, set_active_world
from robolearn.runtime.executor import execute

# v2 adds the grounding (invention) block: which fitted-command set the program
# was checked against and which symbols, if any, it invented.
REPORT_SCHEMA = "kodro.report/2"

#: Base obstacle field (metres). Each seed jitters these positions so a program
#: that only works for one exact layout is exposed across the batch.
_BASE_OBSTACLES: tuple[tuple[float, float, float], ...] = (
    (1.2, 0.4, 0.25),
    (2.0, -0.6, 0.3),
    (2.8, 0.5, 0.25),
    (3.6, -0.3, 0.3),
)
_JITTER_M = 0.2  # +/- obstacle position jitter per seed


@dataclass(frozen=True, slots=True)
class RunResult:
    """One seed's outcome."""

    seed: int
    success: bool
    collisions: int
    distance_m: float
    samples_collected: int
    final_x: float
    final_y: float
    error: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialise this run to a JSON-ready dict."""
        return {
            "seed": self.seed,
            "success": self.success,
            "collisions": self.collisions,
            "distance_m": round(self.distance_m, 6),
            "samples_collected": self.samples_collected,
            "final_x": round(self.final_x, 6),
            "final_y": round(self.final_y, 6),
            "error": self.error,
        }


def _world_for_seed(seed: int) -> World:
    rng = random.Random(seed)
    obstacles = [
        Obstacle(
            x + rng.uniform(-_JITTER_M, _JITTER_M),
            y + rng.uniform(-_JITTER_M, _JITTER_M),
            r,
        )
        for (x, y, r) in _BASE_OBSTACLES
    ]
    return World(
        terrain=Terrain("earth"),
        base=(0.0, 0.0),
        samples=[],
        obstacles=obstacles,
        bounds=ArenaBounds(width=8.0, height=8.0),
    )


def run_seed(
    code: str, seed: int, *, min_distance: float = 0.5, timeout_s: float = 5.0
) -> RunResult:
    """Run ``code`` once against the seed's randomised world and score it.

    A run succeeds when it neither errors nor collides and travels at least
    ``min_distance`` metres. The engine is reset per call, so results never
    leak between seeds.
    """
    world = _world_for_seed(seed)
    rover = Rover(world)
    set_active_rover(rover)
    set_active_world(world)
    try:
        result = execute(code, timeout_s=timeout_s)
    finally:
        clear_active()

    state = rover.state
    error = None if result.success else (result.error_message or result.error_kind or "run failed")
    moved_enough = state.distance_travelled_m >= min_distance
    success = result.success and state.collisions == 0 and moved_enough
    return RunResult(
        seed=seed,
        success=success,
        collisions=state.collisions,
        distance_m=state.distance_travelled_m,
        samples_collected=state.samples_collected,
        final_x=state.x,
        final_y=state.y,
        error=error,
    )


def run_batch(
    code: str, seeds: int, *, min_distance: float = 0.5, timeout_s: float = 5.0
) -> dict[str, Any]:
    """Run ``code`` across ``seeds`` seeds (0..seeds-1) and build the report."""
    if seeds < 1:
        raise ValueError(f"seeds must be >= 1, got {seeds}")
    # Grounding is a property of the PROGRAM, not the seed, so it is computed
    # once. It records whether the program invented any command outside the
    # build's fitted-command set (the invention metric).
    grounding = check_grounding(code)
    runs = [run_seed(code, s, min_distance=min_distance, timeout_s=timeout_s) for s in range(seeds)]
    successes = sum(1 for r in runs if r.success)
    errors = sum(1 for r in runs if r.error is not None)
    return {
        "schema": REPORT_SCHEMA,
        "scenario": "obstacle_field",
        "seeds": seeds,
        "success_criterion": f"no collisions and travelled >= {min_distance} m",
        "grounding": grounding.to_dict(),
        "runs": [r.to_dict() for r in runs],
        "aggregate": {
            "success_rate": round(successes / seeds, 6),
            "successes": successes,
            "failures": seeds - successes,
            "errors": errors,
            "mean_collisions": round(sum(r.collisions for r in runs) / seeds, 6),
            "mean_distance_m": round(sum(r.distance_m for r in runs) / seeds, 6),
        },
    }


def main(argv: list[str] | None = None) -> int:
    """CLI entry: run a program across seeds and print or write the report."""
    parser = argparse.ArgumentParser(
        prog="kodro",
        description="Run a robot program across randomised seeds and emit a JSON report.",
    )
    parser.add_argument("--code", required=True, help="path to the program (.py) to run")
    parser.add_argument("--seeds", type=int, default=20, help="randomised seed count")
    parser.add_argument("--min-distance", type=float, default=0.5, help="metres to travel to pass")
    parser.add_argument(
        "--json", dest="json_out", default=None, help="report path (default stdout)"
    )
    args = parser.parse_args(argv)

    code = Path(args.code).read_text(encoding="utf-8")
    report = run_batch(code, args.seeds, min_distance=args.min_distance)
    payload = json.dumps(report, indent=2)
    if args.json_out:
        Path(args.json_out).write_text(payload + "\n", encoding="utf-8")
        agg = report["aggregate"]
        print(
            f"kodro: {report['seeds']} seeds -> "
            f"success {agg['successes']}/{report['seeds']} ({agg['success_rate'] * 100:.0f}%), "
            f"mean collisions {agg['mean_collisions']}, report -> {args.json_out}"
        )
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
