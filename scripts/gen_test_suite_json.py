"""Regenerate docs/eval/test_suite.json from a real pytest run's own artefacts.

The artefact's top note claims its counts and coverage are read from the run's
JUnit XML and coverage JSON rather than transcribed. Until this script existed
that claim was enforced by nothing: the file was assembled by hand, and one
regeneration carried a skip's test name and reason across from a different run,
which is how the UNVERIFIED PAIR disclosure ended up in it.

Prose fields (note, provenanceNote, measures, coverageFloorDisclosure) are left
exactly as they are in the existing file. This script only overwrites the
measured ones, so editing the prose stays a human job and editing a number stops
being one.

The commit and the clean-tree flag are captured BEFORE the run and read back
here, never re-measured at generation time. Measuring them afterwards is the
same defect in a smaller box: the run happened on one tree and the artefact
would describe another, and a regeneration that touches any file would silently
record itself as the state the counts came from.

    python scripts/gen_test_suite_json.py --capture pre.json
    python -m pytest --cov-report=json:cov.json --junitxml=junit.xml
    python scripts/gen_test_suite_json.py --pre pre.json --junit junit.xml --cov cov.json

Add --check to compare without writing (exit 1 on any difference), which is what
a CI job would call.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TARGET = REPO / "docs" / "eval" / "test_suite.json"


def git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(REPO), *args],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def read_junit(path: Path) -> tuple[dict, list[dict], list[dict]]:
    """Counts, skip details and failure details, all straight out of the XML."""
    root = ET.parse(path).getroot()
    suite = root.find("testsuite") if root.tag == "testsuites" else root
    if suite is None:
        raise SystemExit(f"no <testsuite> element in {path}")

    a = suite.attrib
    collected = int(a["tests"])
    failed, errors, skipped = int(a["failures"]), int(a["errors"]), int(a["skipped"])
    counts = {
        "collected": collected,
        "passed": collected - failed - errors - skipped,
        "failed": failed,
        "errors": errors,
        "skipped": skipped,
        "durationSeconds": round(float(a["time"]), 2),
    }

    def name_of(case: ET.Element) -> str:
        return f"{case.get('classname', '')}::{case.get('name', '')}"

    skips, failures = [], []
    for case in suite.iter("testcase"):
        for tag, sink in (("skipped", skips), ("failure", failures), ("error", failures)):
            node = case.find(tag)
            if node is not None:
                sink.append({"test": name_of(case), "reason": (node.get("message") or "").strip()})
    return counts, skips, failures


def read_coverage(path: Path) -> dict:
    totals = json.loads(path.read_text(encoding="utf-8"))["totals"]
    return {
        "percentCovered": round(totals["percent_covered"], 2),
        "gate": 85,
        "statements": totals["num_statements"],
        "missingLines": totals["missing_lines"],
        "coveredLines": totals["covered_lines"],
        "branches": totals["num_branches"],
        "partialBranches": totals["num_partial_branches"],
        "branchMode": totals["num_branches"] > 0,
    }


def capture(path: Path) -> int:
    """Record the tree the run is about to happen on, before it happens."""
    state = {
        "commit": git("rev-parse", "HEAD"),
        "describe": git("describe", "--always"),
        "workingTreeClean": git("status", "--porcelain") == "",
        "capturedAt": datetime.now(UTC).replace(microsecond=0).isoformat(),
    }
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    print(f"captured {state['describe']} clean={state['workingTreeClean']} -> {path}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--capture", type=Path, help="write pre-run state and exit")
    p.add_argument("--pre", type=Path, help="pre-run state written by --capture")
    p.add_argument("--junit", type=Path)
    p.add_argument("--cov", type=Path)
    p.add_argument("--check", action="store_true", help="compare only, do not write")
    args = p.parse_args()

    if args.capture:
        return capture(args.capture)
    missing = [f for f in ("pre", "junit", "cov") if getattr(args, f) is None]
    if missing:
        p.error("--" + ", --".join(missing) + " required (or use --capture)")

    pre = json.loads(args.pre.read_text(encoding="utf-8"))
    counts, skips, failures = read_junit(args.junit)
    coverage = read_coverage(args.cov)

    doc = json.loads(TARGET.read_text(encoding="utf-8"))
    # --check compares the measured fields, so it must not restamp the clock:
    # a fresh timestamp would make every check differ and the gate would mean
    # nothing.
    if not args.check:
        doc["generatedAt"] = datetime.now(UTC).replace(microsecond=0).isoformat()
    doc["source"]["commit"] = pre["commit"]
    doc["source"]["describe"] = pre["describe"]
    doc["source"]["workingTreeClean"] = pre["workingTreeClean"]
    doc["tests"] = counts
    doc["skipDetail"] = skips
    doc["failureDetail"] = failures
    doc["coverage"] = coverage
    doc["verdict"] = (
        "PASS" if not failures and coverage["percentCovered"] >= coverage["gate"] else "FAIL"
    )

    rendered = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        same = rendered == TARGET.read_text(encoding="utf-8")
        print(("MATCH  " if same else "DIFFER ") + str(TARGET.relative_to(REPO)))
        return 0 if same else 1

    TARGET.write_text(rendered, encoding="utf-8")
    print(
        f"wrote {TARGET.relative_to(REPO)}: {counts['collected']} collected, "
        f"{counts['passed']} passed, {counts['skipped']} skipped, "
        f"{coverage['percentCovered']}% covered, verdict {doc['verdict']}"
    )
    if doc["source"]["workingTreeClean"] is False:
        print(
            "WARNING: the tree was dirty when the run started; the recorded "
            "commit does not reproduce these counts",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
