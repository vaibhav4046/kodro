"""The run announcement must speak each measurement once.

The post-run sr-only live region (app.jsx runAnnouncement) joins the coaching
verdict from diagnostics.jsx with separately worded distance, battery and
proximity phrases. The verdict already ends with its own measured clause
("Covered 8.0 m, closest approach 31 cm."), so before this was de-duplicated a
screen reader heard distance and closest approach twice each:

    Test completed. Mission complete and the design held up. Covered 8.0 m,
    closest approach 31 cm. travelled 8.0 metres. 7.5 percent battery used.
    closest obstacle 31 centimetres. My Rover in Riverside City.

Verified on the deployed build before the fix. The fixture extracts the real
expression out of app.jsx rather than copying it, so removing the de-dup or
changing the verdict wording in diagnostics.jsx fails here instead of silently
regressing the announcement. Skips where Node is absent.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "src" / "kodro" / "assets" / "web"
FIXTURE = ROOT / "tests" / "fixtures" / "announce_dedup.cjs"
DIAGNOSTICS = WEB / "diagnostics.jsx"
_NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(_NODE is None, reason="Node.js not available")


@pytest.fixture(scope="module")
def dedup() -> dict:
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(WEB)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout.strip().splitlines()[-1])
    assert "error" not in result, result.get("error")
    return result


def test_verdict_clause_is_actually_stripped(dedup: dict) -> None:
    """Guard the guard: a no-op stripper would pass every check below."""
    assert dedup["stripsSomething"], (
        "The de-dup returned the verdict unchanged, so the assertions below prove nothing."
    )


def test_no_measurement_is_spoken_twice(dedup: dict) -> None:
    problems = [
        f"{name}: covered={r['covered']} approach={r['approach']} -> {r['spoken']!r}"
        for name, r in dedup["results"].items()
        if r["covered"] or r["approach"]
    ]
    assert not problems, (
        "The verdict's measured clause survived into the announcement, so a screen "
        f"reader hears these numbers twice: {problems}"
    )


def test_announcement_has_no_doubled_full_stop(dedup: dict) -> None:
    doubled = [name for name, r in dedup["results"].items() if r["doubleDot"]]
    assert not doubled, f"Stripping left '..' in the spoken text for: {doubled}"


def test_lesson_prose_mentioning_a_distance_survives(dedup: dict) -> None:
    """The stripper must not eat ordinary prose that happens to name metres."""
    assert dedup["prosePreserved"], "The de-dup damaged prose that merely mentions a distance."


def test_diagnostics_still_builds_the_clause_the_stripper_targets() -> None:
    """Couple the two files: reword the clause and this fails, not the users."""
    text = DIAGNOSTICS.read_text(encoding="utf-8")
    assert "' Covered '" in text, (
        "diagnostics.jsx no longer builds a ' Covered ' clause. Update the "
        "de-dup in app.jsx (const said) to match its new wording."
    )
    assert "', closest approach '" in text, (
        "diagnostics.jsx no longer builds a ', closest approach ' clause. Update "
        "the de-dup in app.jsx (const said) to match its new wording."
    )
