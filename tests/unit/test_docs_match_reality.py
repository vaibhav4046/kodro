"""User-facing docs must not point at things that do not exist.

README.md and docs/teachers/getting-started.md both told users to download
``RoboLearn-windows.exe``. The release workflow has never produced that name:
``.github/workflows/release.yml`` packages ``Kodro-windows.exe``. A download
instruction naming a file that was never built is the first thing a teacher
hits and the first thing that fails.

This gate reads the workflow rather than hardcoding the asset names, so
renaming a release asset forces the docs to move with it.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE_WORKFLOW = ROOT / ".github" / "workflows" / "release.yml"
USER_FACING_DOCS = (
    ROOT / "README.md",
    ROOT / "docs" / "teachers" / "getting-started.md",
)


def _packaged_asset_names() -> set[str]:
    """Every asset name the release workflow writes into its out/ directory."""
    text = RELEASE_WORKFLOW.read_text(encoding="utf-8")
    return set(re.findall(r"out/([A-Za-z0-9._-]+\.(?:exe|zip))", text))


def test_release_workflow_declares_its_assets() -> None:
    """Guard the guard: if this stops finding names, the checks below are vacuous."""
    assets = _packaged_asset_names()
    assert assets, (
        "No release assets found in release.yml. The packaging step changed shape, "
        "so the docs checks below would silently pass without testing anything."
    )


def test_docs_do_not_name_a_release_asset_that_is_never_built() -> None:
    """Any .exe or .zip a doc tells the user to download must actually be built."""
    built = _packaged_asset_names()
    problems: list[str] = []
    for doc in USER_FACING_DOCS:
        if not doc.exists():
            continue
        text = doc.read_text(encoding="utf-8")
        for named in re.findall(r"`([A-Za-z0-9._-]+\.(?:exe|zip))`", text):
            if named not in built:
                problems.append(f"{doc.relative_to(ROOT)} tells users to download {named!r}")
    assert not problems, (
        "These docs name a release asset the workflow does not produce "
        f"(it builds {sorted(built)}): {problems}"
    )


def test_pupil_cheatsheet_documents_every_callable_command() -> None:
    """The cheatsheet is the pupil's only command reference; it must be complete.

    It listed 16 of the 24 names in ``rover_api.__all__``, omitting ``say``,
    ``led``, ``set_speed``, ``scan``, ``pen_down``, ``pen_up``, ``place`` and
    ``clear_props`` -- including two used in the project's own example
    programs. A pupil reading the reference would conclude those commands do
    not exist.
    """
    import robolearn.rover_api as rover_api

    page = (ROOT / "docs" / "pupils" / "api-cheatsheet.md").read_text(encoding="utf-8")
    missing = [name for name in sorted(rover_api.__all__) if f"`{name}(" not in page]
    assert not missing, (
        f"These commands are callable but absent from docs/pupils/api-cheatsheet.md: {missing}"
    )


def test_onboarding_advertises_the_number_of_lessons_that_ship() -> None:
    """The first-contact pitch must not advertise a library that shrank away.

    Onboarding step 3 is the only place the product names the learning pillar
    to a new user, and it said "18 graded missions" long after the library had
    grown to 24. The count was typed as a literal, so nothing moved it when
    lessons were added. Derive it from ``load_library`` instead: adding or
    removing a lesson now fails here until the pitch is updated.

    The compiled ``bundle.js`` carries the same sentence; ``test_bundle_is_fresh``
    covers that copy, so this only has to guard the source.
    """
    from robolearn.lessons import load_library

    page = (ROOT / "src" / "robolearn" / "assets" / "web" / "onboarding.jsx").read_text(
        encoding="utf-8"
    )
    claim = re.search(r"Lessons</b>: (\d+) graded missions", page)
    assert claim is not None, (
        "onboarding.jsx no longer names the Lessons pillar in the form this gate "
        "reads, so the count check below would silently pass without testing anything."
    )
    assert int(claim.group(1)) == len(list(load_library())), (
        f"onboarding.jsx advertises {claim.group(1)} graded missions, "
        f"but the library ships {len(list(load_library()))}."
    )


def test_pupil_cheatsheet_does_not_promise_unfinished_work() -> None:
    """No build-plan leftovers in a page pupils actually read."""
    page = (ROOT / "docs" / "pupils" / "api-cheatsheet.md").read_text(encoding="utf-8")
    for phrase in ("lands in Task", "build plan", "TODO", "coming soon"):
        assert phrase not in page, (
            f"api-cheatsheet.md still says {phrase!r}. The implementation exists; "
            "the page should describe it rather than promise it."
        )
