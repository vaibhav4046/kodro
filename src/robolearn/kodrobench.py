"""KodroBench: measure how well LLMs write GROUNDED robot control code.

For each (model, task) KodroBench generates a program from a natural-language
instruction while telling the model EXACTLY which commands the built robot
exposes, then measures three things that matter for a grounded assistant:

  - invention_rate: fraction of a model's programs that call a command outside
    the build's fitted-command set (the grounding metric, robolearn.grounding).
    This is the headline: it is the one axis the surveyed prior art does not
    occupy (invented SYMBOL vs invented ARGUMENT, over a per-build API surface).
  - success_at_n: mean task success across N domain-randomised seeds (bench).
  - collision_rate and syntax_error_rate.

Adapters:
  - "deterministic": a fixed, grounded program per task. Needs no model, is
    byte-reproducible, and is the floor row a CI job can assert against.
  - "ollama": a local open-weight model via OllamaClient (temperature 0.2,
    retries 0). A failed generation is a recorded failure, never a silent skip.

Results are written as JSON (schema kodrobench.results/1); the leaderboard is
GENERATED from that JSON (generate_leaderboard), never typed by hand, so a
number in the docs always traces to a run.

    python -m robolearn.kodrobench --models deterministic,llama3.2:3b --seeds 10 --json results.json
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from robolearn import rover_api
from robolearn.bench import run_batch
from robolearn.grounding import check_grounding

RESULTS_SCHEMA = "kodrobench.results/1"

_FULL = frozenset(rover_api.__all__)
_NO_DISTANCE = _FULL - {"read_distance", "obstacle_ahead", "sample_detected", "scan"}
_NO_ARM = _FULL - {"collect_sample", "drop_sample"}


@dataclass(frozen=True, slots=True)
class Task:
    """One grounded-control task: an instruction plus the build's command set."""

    id: str
    instruction: str
    fitted: frozenset[str]
    min_distance: float = 0.5


# v0.1 suite. The last two are ADVERSARIAL: the instruction names a command the
# build does not expose (a distance sensor / a gripper), so a model that obeys
# the stated command set stays grounded and one that hallucinates is caught.
TASKS: tuple[Task, ...] = (
    Task("drive_forward", "Drive the robot forward three metres in a straight line.", _FULL, 2.0),
    Task(
        "square",
        "Drive the robot in a square: forward one metre then turn 90 degrees, four times.",
        _FULL,
        3.0,
    ),
    Task("turn_and_go", "Turn right 90 degrees, then drive forward two metres.", _FULL, 1.5),
    Task(
        "no_sensor_scan",
        "The robot has NO distance sensor. Drive forward one metre.",
        _NO_DISTANCE,
        0.5,
    ),
    Task("no_arm_collect", "The robot has NO gripper. Drive forward one metre.", _NO_ARM, 0.5),
)

# Deterministic floor: a grounded program per task (uses only fitted commands).
_CANNED: dict[str, str] = {
    "drive_forward": "move_forward(3)\n",
    "square": "for i in range(4):\n    move_forward(1)\n    turn_left(90)\n",
    "turn_and_go": "turn_right(90)\nmove_forward(2)\n",
    "no_sensor_scan": "move_forward(1)\n",
    "no_arm_collect": "move_forward(1)\n",
}

_FENCE = re.compile(r"```(?:python|py)?\s*(.*?)```", re.DOTALL)


def extract_code(text: str) -> str:
    """Pull a Python program out of a model reply (fenced block or raw text)."""
    match = _FENCE.search(text)
    if match:
        return match.group(1).strip() + "\n"
    return text.strip() + "\n"


def _prompt_system(task: Task) -> str:
    commands = ", ".join(sorted(task.fitted))
    return (
        "You write short Python programs to control a small robot. The robot "
        "exposes EXACTLY these commands and no others: "
        f"{commands}. Use only these commands (plus range and simple loops). Do "
        "not import anything, do not define functions, do not call any other "
        "command. Output ONLY the Python program, with no explanation."
    )


def generate_ollama(client: Any, model: str, task: Task) -> str:
    """Generate a program for ``task`` from a local model (temperature 0.2)."""
    reply = client.generate(
        task.instruction,
        system=_prompt_system(task),
        model=model,
        temperature=0.2,
        num_predict=256,
        keep_alive="5m",
    )
    return extract_code(reply)


def _evaluate_program(code: str, task: Task, seeds: int) -> dict[str, Any]:
    grounding = check_grounding(code, task.fitted)
    report = run_batch(code, seeds, min_distance=task.min_distance)
    agg = report["aggregate"]
    return {
        "task": task.id,
        "grounded": grounding.grounded,
        "invented": list(grounding.invented),
        "syntax_error": grounding.syntax_error is not None,
        "success_rate": agg["success_rate"],
        "mean_collisions": agg["mean_collisions"],
        "code": code,
    }


def evaluate_model(model: str, seeds: int, tasks: tuple[Task, ...] = TASKS) -> dict[str, Any]:
    """Run every task for one model (or the deterministic floor) and aggregate."""
    client = None
    if model != "deterministic":
        from robolearn.ai.ollama_client import OllamaClient

        client = OllamaClient()

    per_task: list[dict[str, Any]] = []
    gen_errors = 0
    for task in tasks:
        if model == "deterministic":
            code = _CANNED[task.id]
        else:
            try:
                code = generate_ollama(client, model, task)
            except Exception as exc:
                gen_errors += 1
                per_task.append(
                    {
                        "task": task.id,
                        "grounded": False,
                        "invented": [],
                        "syntax_error": False,
                        "success_rate": 0.0,
                        "mean_collisions": 0.0,
                        "code": "",
                        "gen_error": str(exc)[:200],
                    }
                )
                continue
        per_task.append(_evaluate_program(code, task, seeds))

    n = len(tasks)
    invented = sum(1 for t in per_task if t["invented"])
    syntax = sum(1 for t in per_task if t["syntax_error"])
    return {
        "model": model,
        "tasks": n,
        "success_at_n": round(sum(t["success_rate"] for t in per_task) / n, 4),
        "invention_rate": round(invented / n, 4),
        "syntax_error_rate": round(syntax / n, 4),
        "collision_rate": round(sum(t["mean_collisions"] for t in per_task) / n, 4),
        "gen_errors": gen_errors,
        "per_task": per_task,
    }


def run_bench(models: list[str], seeds: int) -> dict[str, Any]:
    """Evaluate every model and build the results document."""
    rows = [evaluate_model(m, seeds) for m in models]
    return {
        "schema": RESULTS_SCHEMA,
        "seeds": seeds,
        "tasks": [t.id for t in TASKS],
        "models": rows,
    }


def generate_leaderboard(results: dict[str, Any]) -> str:
    """Render a markdown leaderboard FROM the results JSON (never hand-typed)."""
    rows = sorted(results["models"], key=lambda r: (r["invention_rate"], -r["success_at_n"]))
    lines = [
        f"# KodroBench v0.1 leaderboard ({len(results['tasks'])} tasks, {results['seeds']} seeds)",
        "",
        "Lower invention_rate is better (program stays within the build's command "
        "set); higher success@N is better. Generated from results JSON.",
        "",
        "| Model | success@N | invention_rate | collision_rate | syntax_err | gen_err |",
        "|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r['model']} | {r['success_at_n']:.2f} | {r['invention_rate']:.2f} | "
            f"{r['collision_rate']:.2f} | {r['syntax_error_rate']:.2f} | {r['gen_errors']} |"
        )
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    """CLI: evaluate models, write results JSON, print the leaderboard."""
    parser = argparse.ArgumentParser(
        prog="kodrobench",
        description="Measure invention_rate and success@N for LLMs writing grounded robot code.",
    )
    parser.add_argument(
        "--models",
        default="deterministic",
        help="comma-separated model names (Ollama tags), plus 'deterministic' for the floor",
    )
    parser.add_argument("--seeds", type=int, default=10, help="domain-randomised seeds per task")
    parser.add_argument("--json", dest="json_out", default=None, help="write results JSON here")
    parser.add_argument(
        "--leaderboard", default=None, help="write the generated leaderboard.md here"
    )
    args = parser.parse_args(argv)

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    results = run_bench(models, args.seeds)
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    board = generate_leaderboard(results)
    if args.leaderboard:
        Path(args.leaderboard).write_text(board, encoding="utf-8")
    print(board)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
