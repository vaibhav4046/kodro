"""Reproducible descriptive analysis for the planned Kodro human pilot.

The script uses only the Python standard library. It refuses an empty template
and never invents participant observations.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

REQUIRED = (
    "participant_id",
    "sequence",
    "mission_id",
    "mission_order",
    "condition",
    "experience",
    "success",
    "duration_s",
    "wrong_edits",
    "collisions",
    "proof_runs",
    "confidence_1_5",
    "ease_1_7",
    "protocol_deviation",
    "exclusion_reason",
    "notes_code",
)
NUMERIC = (
    "success",
    "duration_s",
    "wrong_edits",
    "collisions",
    "proof_runs",
    "confidence_1_5",
    "ease_1_7",
    "protocol_deviation",
)


def load_rows(path: Path) -> list[dict[str, str]]:
    """Read and structurally validate the study CSV."""
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != REQUIRED:
            raise ValueError("CSV header does not match the frozen study schema")
        return list(reader)


def as_number(row: dict[str, str], key: str) -> float:
    """Parse one required numeric cell."""
    value = row[key].strip()
    if value == "":
        raise ValueError(f"missing {key} for participant {row['participant_id']}")
    return float(value)


def mean(values: list[float]) -> float | None:
    """Return a rounded mean or None for no observations."""
    return round(statistics.fmean(values), 6) if values else None


def median(values: list[float]) -> float | None:
    """Return a rounded median or None for no observations."""
    return round(statistics.median(values), 6) if values else None


def bootstrap_interval(values: list[float], seed: int = 4046) -> list[float] | None:
    """Deterministic percentile interval for a participant-level mean."""
    if len(values) < 2:
        return None
    rng = random.Random(seed)
    samples = []
    for _ in range(10000):
        draw = [values[rng.randrange(len(values))] for _ in values]
        samples.append(statistics.fmean(draw))
    samples.sort()
    return [round(samples[249], 6), round(samples[9749], 6)]


def sign_flip_p(values: list[float]) -> float | None:
    """Exact two-sided sign-flip value for up to 20 paired differences."""
    nonzero = [value for value in values if value != 0]
    if not nonzero or len(nonzero) > 20:
        return None
    observed = abs(statistics.fmean(nonzero))
    extreme = 0
    total = 1 << len(nonzero)
    for mask in range(total):
        permuted = [value if mask & (1 << index) else -value for index, value in enumerate(nonzero)]
        if abs(statistics.fmean(permuted)) >= observed - 1e-12:
            extreme += 1
    return round(extreme / total, 6)


def analyse(rows: list[dict[str, str]], source_hash: str) -> dict[str, Any]:
    """Build condition, mission and paired summaries from locked rows."""
    included = [row for row in rows if not row["exclusion_reason"].strip()]
    for row in included:
        if row["condition"] not in {"C", "E"}:
            raise ValueError(f"invalid condition for participant {row['participant_id']}")
        for key in NUMERIC:
            as_number(row, key)
        if row["condition"] == "C" and as_number(row, "proof_runs") != 0:
            raise ValueError(
                f"console condition used proof for participant {row['participant_id']}"
            )

    def summary(selected: list[dict[str, str]]) -> dict[str, Any]:
        success = [as_number(row, "success") for row in selected]
        successful_times = [
            as_number(row, "duration_s") for row in selected if as_number(row, "success") == 1
        ]
        return {
            "trials": len(selected),
            "successes": int(sum(success)),
            "success_rate": mean(success),
            "duration_success_mean_s": mean(successful_times),
            "duration_success_median_s": median(successful_times),
            "wrong_edits_mean": mean([as_number(row, "wrong_edits") for row in selected]),
            "collisions_mean": mean([as_number(row, "collisions") for row in selected]),
            "confidence_median": median([as_number(row, "confidence_1_5") for row in selected]),
            "ease_median": median([as_number(row, "ease_1_7") for row in selected]),
            "timeouts": sum(
                1
                for row in selected
                if as_number(row, "success") == 0 and as_number(row, "duration_s") >= 600
            ),
        }

    condition = {
        code: summary([row for row in included if row["condition"] == code]) for code in ("C", "E")
    }
    missions = {
        mission: {
            code: summary(
                [
                    row
                    for row in included
                    if row["mission_id"] == mission and row["condition"] == code
                ]
            )
            for code in ("C", "E")
        }
        for mission in sorted({row["mission_id"] for row in included})
    }
    participant_values: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for row in included:
        participant_values[row["participant_id"]][row["condition"]].append(
            as_number(row, "success")
        )
    paired = []
    for _participant_id, values in sorted(participant_values.items()):
        if values["C"] and values["E"]:
            paired.append(statistics.fmean(values["E"]) - statistics.fmean(values["C"]))
    return {
        "schema": "kodro.human-study-analysis/1",
        "source_csv_sha256": source_hash,
        "participants": len({row["participant_id"] for row in included}),
        "included_trials": len(included),
        "excluded_trials": len(rows) - len(included),
        "condition": condition,
        "mission_by_condition": missions,
        "primary_paired_success_difference_e_minus_c": {
            "paired_participants": len(paired),
            "mean": mean(paired),
            "median": median(paired),
            "range": [round(min(paired), 6), round(max(paired), 6)] if paired else None,
            "bootstrap_95_percent": bootstrap_interval(paired),
            "exploratory_exact_sign_flip_p": sign_flip_p(paired),
        },
        "interpretation_boundary": (
            "Exploratory pilot of interface diagnostics. No classroom-efficacy, learning, "
            "physical-validity or safety conclusion follows."
        ),
    }


def render_markdown(result: dict[str, Any]) -> str:
    """Render the machine-readable result as a concise Markdown report."""
    lines = [
        "# Kodro human pilot analysis",
        "",
        f"Participants: {result['participants']}",
        f"Included trials: {result['included_trials']}",
        f"Excluded trials: {result['excluded_trials']}",
        "",
        "| Condition | Successes | Trials | Success rate | Median successful time |",
        "|---|---:|---:|---:|---:|",
    ]
    for code in ("C", "E"):
        row = result["condition"][code]
        rate = "n/a" if row["success_rate"] is None else f"{row['success_rate']:.3f}"
        duration = (
            "n/a"
            if row["duration_success_median_s"] is None
            else f"{row['duration_success_median_s']:.1f} s"
        )
        lines.append(f"| {code} | {row['successes']} | {row['trials']} | {rate} | {duration} |")
    paired = result["primary_paired_success_difference_e_minus_c"]
    lines.extend(
        [
            "",
            "## Primary paired estimate",
            "",
            f"Paired participants: {paired['paired_participants']}",
            f"Mean success-proportion difference, E minus C: {paired['mean']}",
            f"Deterministic bootstrap 95 percent interval: {paired['bootstrap_95_percent']}",
            f"Exploratory exact sign-flip value: {paired['exploratory_exact_sign_flip_p']}",
            "",
            str(result["interpretation_boundary"]),
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    """CLI entry."""
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--check-template", action="store_true")
    parser.add_argument("--out-dir", type=Path, default=None)
    args = parser.parse_args()
    rows = load_rows(args.csv_path)
    if args.check_template:
        print(f"template valid: {len(rows)} data rows")
        return 0
    if not rows:
        print("No participant observations. No numerical results were produced.")
        return 2
    source_hash = hashlib.sha256(args.csv_path.read_bytes()).hexdigest()
    result = analyse(rows, source_hash)
    if args.out_dir is None:
        raise ValueError("--out-dir is required for a non-empty dataset")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "analysis.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    (args.out_dir / "analysis.md").write_text(
        render_markdown(result), encoding="utf-8", newline="\n"
    )
    print(f"analysis written to {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
