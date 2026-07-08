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

Every task also carries a dev/heldout split (Task.split); dev_/heldout_ variants
of the above are reported for free from the same single-sample run. Passing
--samples > k additionally draws that many independent generations per task and
reports pass@k (Chen et al. 2021), the unbiased at-least-one-of-k-passes
estimator, overall and per split.

Adapters:
  - "deterministic": a fixed, grounded program per task. Needs no model, is
    byte-reproducible, and is the floor row a CI job can assert against.
  - "ollama": a local open-weight model via OllamaClient (temperature 0.2,
    retries 0). A failed generation is a recorded failure, never a silent skip.

Results are written as JSON (schema kodrobench.results/2); the leaderboard is
GENERATED from that JSON (generate_leaderboard), never typed by hand, so a
number in the docs always traces to a run.

    python -m robolearn.kodrobench --models deterministic,llama3.2:3b --seeds 10 --json results.json
    python -m robolearn.kodrobench --models llama3.2:3b --samples 5 --k 1 --json out.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from robolearn import rover_api
from robolearn.bench import run_batch
from robolearn.grounding import check_grounding

# v2 adds: per-task train/heldout split (dev_/heldout_ aggregates, free -- no
# extra generation) and an optional pass@k block (robolearn.kodrobench.pass_at_k,
# Chen et al. 2021) when --samples > 1 draws independent generations per task.
RESULTS_SCHEMA = "kodrobench.results/2"

_FULL = frozenset(rover_api.__all__)
_NO_DISTANCE = _FULL - {"read_distance", "obstacle_ahead", "sample_detected", "scan"}
_NO_ARM = _FULL - {"collect_sample", "drop_sample"}


@dataclass(frozen=True, slots=True)
class Task:
    """One grounded-control task: an instruction plus the build's command set.

    ``split`` marks whether the task is used during iteration ("dev") or kept
    aside as a held-out check ("heldout"). With only 5 tasks in v0.1 this is a
    MECHANISM, not yet a rigorous held-out claim: growing the suite toward 20 to
    50 tasks (research item 7) is what makes the split meaningful at scale.
    """

    id: str
    instruction: str
    fitted: frozenset[str]
    min_distance: float = 0.5
    split: Literal["dev", "heldout"] = "dev"


# v0.1 suite. The two ADVERSARIAL tasks (the instruction names a command the
# build does not expose, e.g. a distance sensor or a gripper) are held out: they
# were not looked at while iterating on the grounding metric itself, and they
# are the tasks most likely to catch a model or a metric that over-generalises.
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
        split="heldout",
    ),
    Task(
        "no_arm_collect",
        "The robot has NO gripper. Drive forward one metre.",
        _NO_ARM,
        0.5,
        split="heldout",
    ),
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


def pass_at_k(n: int, c: int, k: int) -> float:
    """Unbiased pass@k (Chen et al. 2021, HumanEval / Codex).

    The probability that at least one of ``k`` samples drawn without
    replacement from ``n`` total (of which ``c`` passed) is a pass.
    ``P(all k drawn are failures) = C(n-c, k) / C(n, k)``, so
    ``pass@k = 1 - C(n-c, k) / C(n, k)``. Exact (integer combinatorics), no
    floating-point approximation.
    """
    if k > n:
        raise ValueError(f"k ({k}) cannot exceed n ({n})")
    if n - c < k:  # fewer failures than k -> any k-subset must contain a pass
        return 1.0
    return 1.0 - math.comb(n - c, k) / math.comb(n, k)


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def _split_aggregate(per_task: list[dict[str, Any]], split: str) -> dict[str, float]:
    rows = [t for t in per_task if t["split"] == split]
    if not rows:
        return {"success_at_n": 0.0, "invention_rate": 0.0, "tasks": 0}
    return {
        "success_at_n": _mean([t["success_rate"] for t in rows]),
        "invention_rate": round(sum(1 for t in rows if t["invented"]) / len(rows), 4),
        "tasks": len(rows),
    }


def _evaluate_program(code: str, task: Task, seeds: int) -> dict[str, Any]:
    grounding = check_grounding(code, task.fitted)
    report = run_batch(code, seeds, min_distance=task.min_distance)
    agg = report["aggregate"]
    return {
        "task": task.id,
        "split": task.split,
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
                        "split": task.split,
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
    dev = _split_aggregate(per_task, "dev")
    heldout = _split_aggregate(per_task, "heldout")
    return {
        "model": model,
        "tasks": n,
        "dev_success_at_n": dev["success_at_n"],
        "dev_invention_rate": dev["invention_rate"],
        "heldout_success_at_n": heldout["success_at_n"],
        "heldout_invention_rate": heldout["invention_rate"],
        "success_at_n": round(sum(t["success_rate"] for t in per_task) / n, 4),
        "invention_rate": round(invented / n, 4),
        "syntax_error_rate": round(syntax / n, 4),
        "collision_rate": round(sum(t["mean_collisions"] for t in per_task) / n, 4),
        "gen_errors": gen_errors,
        "per_task": per_task,
    }


def _generate_one(model: str, task: Task) -> str:
    """One code sample for ``task``: the canned floor, or one Ollama draw."""
    if model == "deterministic":
        return _CANNED[task.id]
    from robolearn.ai.ollama_client import OllamaClient

    return generate_ollama(OllamaClient(), model, task)


def evaluate_model_pass_at_k(
    model: str, k: int, n_samples: int, seeds_per_sample: int = 5, tasks: tuple[Task, ...] = TASKS
) -> dict[str, Any]:
    """Draw ``n_samples`` independent generations per task and compute pass@k.

    A sample "passes" when it is grounded (no invented symbols) AND succeeds on
    at least one of ``seeds_per_sample`` domain-randomised seeds. ``n_samples``
    independent draws give the ``(n, c)`` the unbiased :func:`pass_at_k`
    estimator needs; a deterministic model's canned program is identical every
    draw, so it degenerates to a plain pass/fail as expected.
    """
    per_task: list[dict[str, Any]] = []
    for task in tasks:
        passes = 0
        for _ in range(n_samples):
            try:
                code = _generate_one(model, task)
            except Exception:
                continue
            grounding = check_grounding(code, task.fitted)
            report = run_batch(code, seeds_per_sample, min_distance=task.min_distance)
            if grounding.grounded and report["aggregate"]["success_rate"] > 0.0:
                passes += 1
        per_task.append(
            {
                "task": task.id,
                "split": task.split,
                "n": n_samples,
                "c": passes,
                "pass_at_k": round(pass_at_k(n_samples, passes, k), 4),
            }
        )

    def _mean_pass(rows: list[dict[str, Any]]) -> float:
        return _mean([r["pass_at_k"] for r in rows])

    dev_rows = [t for t in per_task if t["split"] == "dev"]
    heldout_rows = [t for t in per_task if t["split"] == "heldout"]
    return {
        "model": model,
        "k": k,
        "n_samples": n_samples,
        "pass_at_k": _mean_pass(per_task),
        "dev_pass_at_k": _mean_pass(dev_rows),
        "heldout_pass_at_k": _mean_pass(heldout_rows),
        "per_task": per_task,
    }


def run_bench(models: list[str], seeds: int, *, samples: int = 1, k: int = 1) -> dict[str, Any]:
    """Evaluate every model and build the results document.

    When ``samples > 1``, also draws that many independent generations per task
    per model and attaches a ``pass_at_k`` block (see
    :func:`evaluate_model_pass_at_k`); omitted when ``samples == 1`` so the
    default run stays exactly as fast as before.
    """
    rows = [evaluate_model(m, seeds) for m in models]
    if samples > 1:
        for row, model in zip(rows, models, strict=True):
            row["pass_at_k"] = evaluate_model_pass_at_k(model, k, samples)
    return {
        "schema": RESULTS_SCHEMA,
        "seeds": seeds,
        "tasks": [t.id for t in TASKS],
        "models": rows,
    }


def generate_leaderboard(results: dict[str, Any]) -> str:
    """Render a markdown leaderboard FROM the results JSON (never hand-typed)."""
    rows = sorted(results["models"], key=lambda r: (r["invention_rate"], -r["success_at_n"]))
    has_pass_at_k = any("pass_at_k" in r for r in rows)
    lines = [
        f"# KodroBench v0.1 leaderboard ({len(results['tasks'])} tasks, {results['seeds']} seeds)",
        "",
        "Lower invention_rate is better (program stays within the build's command "
        "set); higher success@N is better. dev/heldout split the same task set by "
        "whether it was visible while iterating (see robolearn.kodrobench.Task). "
        "Generated from results JSON.",
        "",
        "| Model | success@N | invention_rate | dev succ | heldout succ | dev inv | "
        "heldout inv | collision | syntax_err | gen_err |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r['model']} | {r['success_at_n']:.2f} | {r['invention_rate']:.2f} | "
            f"{r['dev_success_at_n']:.2f} | {r['heldout_success_at_n']:.2f} | "
            f"{r['dev_invention_rate']:.2f} | {r['heldout_invention_rate']:.2f} | "
            f"{r['collision_rate']:.2f} | {r['syntax_error_rate']:.2f} | {r['gen_errors']} |"
        )
    if has_pass_at_k:
        pk = rows[0]["pass_at_k"]["k"] if "pass_at_k" in rows[0] else None
        ns = rows[0]["pass_at_k"]["n_samples"] if "pass_at_k" in rows[0] else None
        lines += [
            "",
            f"## pass@{pk} ({ns} independent generations per task per model)",
            "",
            "| Model | pass@k | dev pass@k | heldout pass@k |",
            "|---|---|---|---|",
        ]
        for r in rows:
            if "pass_at_k" not in r:
                continue
            p = r["pass_at_k"]
            lines.append(
                f"| {r['model']} | {p['pass_at_k']:.2f} | {p['dev_pass_at_k']:.2f} | "
                f"{p['heldout_pass_at_k']:.2f} |"
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
    parser.add_argument(
        "--samples",
        type=int,
        default=1,
        help="independent generations per task; >1 also computes pass@k",
    )
    parser.add_argument("--k", type=int, default=1, help="k in pass@k (requires --samples >= k)")
    parser.add_argument("--json", dest="json_out", default=None, help="write results JSON here")
    parser.add_argument(
        "--leaderboard", default=None, help="write the generated leaderboard.md here"
    )
    args = parser.parse_args(argv)

    # pass@k is only defined for 1 <= k <= samples (you cannot draw k passes
    # from fewer than k independent samples); reject the combination up front
    # with a clear message rather than letting pass_at_k raise deep in the run.
    if args.samples < 1:
        parser.error(f"--samples must be at least 1 (got {args.samples})")
    if not 1 <= args.k <= args.samples:
        parser.error(f"--k must be between 1 and --samples ({args.samples}); got {args.k}")

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    results = run_bench(models, args.seeds, samples=args.samples, k=args.k)
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    board = generate_leaderboard(results)
    if args.leaderboard:
        Path(args.leaderboard).write_text(board, encoding="utf-8")
    print(board)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
