"""No development scratch may ride along in the shipped asset directory.

``pyproject.toml`` globs the whole of ``src/kodro/assets/web/**/*`` into the
wheel, so anything left in that directory is downloaded by every person who
installs Kodro. Eight files had accumulated there: four accessibility probes,
a performance probe, and three screenshots from a persona run. Together they
were 808 KB, nothing in ``src/``, ``scripts/`` or ``tests/`` opened any of
them, and the probes pointed at ``http://localhost:8099`` -- an address that
exists only while a QA harness happens to be running on the author's machine.

They were invisible to review for the ordinary reason: a directory that is
included by a glob has no per-file decision to review, so a file added during
debugging is shipped by default rather than by choice.

The convention this pins: **scratch is named with a leading underscore, and
scratch does not ship.** Name a throwaway probe ``_probe.html`` and this test
removes the possibility of forgetting it. Anything the product genuinely uses
is named without the prefix, so the rule costs nothing to follow.

Note this is a naming convention, not a reachability proof. It fences the way
these files actually arrived; it cannot catch scratch that was named as though
it were a real asset.
"""

from __future__ import annotations

from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "src" / "kodro" / "assets" / "web"


def test_no_underscore_prefixed_scratch_ships_in_the_asset_dir() -> None:
    scratch = sorted(p.relative_to(WEB).as_posix() for p in WEB.rglob("_*") if p.is_file())
    assert scratch == [], (
        "development scratch is being packaged into the wheel: "
        f"{scratch}. Delete it, or rename it without the leading underscore "
        "if the product actually uses it."
    )


def test_the_guard_is_looking_at_the_real_directory() -> None:
    """Guard the guard: an empty or wrong path would make the above vacuous."""
    assert (WEB / "index.html").is_file(), f"{WEB} is not the shipped asset directory"
