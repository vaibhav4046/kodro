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
