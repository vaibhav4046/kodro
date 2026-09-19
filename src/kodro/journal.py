"""Decision journal: turn build decisions into data instead of anecdotes.

EarthProof's honest gap is measured outcomes: no study yet shows how
often virtual-first design changes physical builds. This module is the
instrument for that study. Every Prove -> Build decision is appended
as one canonical JSON line (JSONL): what was decided, on what evidence,
and what happened next. Summaries are computed from the log, never
asserted from memory.

A log entry is a record, not a proof. It does not claim a prototype
was avoided; it records that a decision was made and which evidence
was cited. Avoidance stays a scenario assumption in earthproof.py.

Schema: kodro-decision/v1. Timestamps are UTC ISO-8601 wall clock.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path

SCHEMA = "kodro-decision/v1"
DECISIONS = ("built", "deferred", "rejected")


def _utcnow() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def make_event(
    decision: str,
    design: str,
    proof_verdict: str = "",
    earthproof_fingerprint: str = "",
    note: str = "",
    timestamp: str | None = None,
) -> dict[str, object]:
    """Build a validated decision record (not yet stored)."""
    if decision not in DECISIONS:
        raise ValueError(f"decision must be one of {DECISIONS}")
    if not design.strip():
        raise ValueError("design must not be empty")
    if earthproof_fingerprint and (
        len(earthproof_fingerprint) != 64
        or any(c not in "0123456789abcdef" for c in earthproof_fingerprint)
    ):
        raise ValueError("earthproof_fingerprint must be 64 lowercase hex")
    return {
        "schema": SCHEMA,
        "timestamp": timestamp or _utcnow(),
        "decision": decision,
        "design": design,
        "proof_verdict": proof_verdict,
        "earthproof_fingerprint": earthproof_fingerprint,
        "note": note,
    }


def log_event(log_path: Path, event: Mapping[str, object]) -> dict[str, object]:
    """Validate and append one decision record to a JSONL log."""
    record = make_event(
        decision=str(event.get("decision", "")),
        design=str(event.get("design", "")),
        proof_verdict=str(event.get("proof_verdict", "")),
        earthproof_fingerprint=str(event.get("earthproof_fingerprint", "")),
        note=str(event.get("note", "")),
        timestamp=str(event.get("timestamp", "") or _utcnow()),
    )
    line = json.dumps(record, sort_keys=True, ensure_ascii=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    return record


def read_all(log_path: Path) -> list[dict[str, object]]:
    """Read every record; a corrupt line fails loudly, never silently."""
    records: list[dict[str, object]] = []
    if not log_path.exists():
        return records
    for lineno, line in enumerate(log_path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        raw = json.loads(line)
        if not isinstance(raw, dict) or raw.get("schema") != SCHEMA:
            raise ValueError(f"{log_path}:{lineno}: not a {SCHEMA} record")
        records.append(raw)
    return records


def summarize(log_path: Path) -> dict[str, object]:
    """Count decisions from the log. Deterministic over file content."""
    records = read_all(log_path)
    by_decision = dict.fromkeys(DECISIONS, 0)
    designs: dict[str, int] = {}
    with_evidence = 0
    for record in records:
        decision = str(record.get("decision", ""))
        if decision in by_decision:
            by_decision[decision] += 1
        design = str(record.get("design", ""))
        designs[design] = designs.get(design, 0) + 1
        if record.get("earthproof_fingerprint"):
            with_evidence += 1
    return {
        "schema": "kodro-decision-summary/v1",
        "events": len(records),
        "by_decision": by_decision,
        "designs_seen": len(designs),
        "events_citing_earthproof": with_evidence,
        "limitation": (
            "Counts of recorded decisions, not measured environmental "
            "savings. A deferred build is a decision, not proof a "
            "prototype was avoided."
        ),
    }


def main(argv: list[str] | None = None) -> int:
    """Log or summarize build decisions from the command line."""
    parser = argparse.ArgumentParser(description="Record Prove -> Build decisions as data.")
    sub = parser.add_subparsers(dest="command", required=True)
    log_cmd = sub.add_parser("log", help="Append one decision record")
    log_cmd.add_argument("--log", type=Path, required=True)
    log_cmd.add_argument("--decision", choices=DECISIONS, required=True)
    log_cmd.add_argument("--design", required=True)
    log_cmd.add_argument("--verdict", default="")
    log_cmd.add_argument("--fingerprint", default="")
    log_cmd.add_argument("--note", default="")
    sum_cmd = sub.add_parser("summary", help="Summarize a decision log")
    sum_cmd.add_argument("--log", type=Path, required=True)
    args = parser.parse_args(argv)

    if args.command == "log":
        record = log_event(
            args.log,
            {
                "decision": args.decision,
                "design": args.design,
                "proof_verdict": args.verdict,
                "earthproof_fingerprint": args.fingerprint,
                "note": args.note,
            },
        )
        print(json.dumps(record, indent=2, sort_keys=True))
    else:
        print(json.dumps(summarize(args.log), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
