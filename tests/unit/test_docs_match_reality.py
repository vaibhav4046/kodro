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
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from kodro.lessons.schema import load_library

ROOT = Path(__file__).resolve().parents[2]
RELEASE_WORKFLOW = ROOT / ".github" / "workflows" / "release.yml"
USER_FACING_DOCS = (
    ROOT / "README.md",
    ROOT / "docs" / "teachers" / "getting-started.md",
    ROOT / "docs" / "teachers" / "classroom-setup.md",
)

LESSON_SURFACES = (
    ROOT / "README.md",
    ROOT / "docs" / "index.md",
    ROOT / "docs" / "teachers" / "scheme-of-work.md",
    ROOT / "docs" / "teachers" / "answer-key.md",
    ROOT / "docs" / "teachers" / "curriculum-mapping.md",
    ROOT / "src" / "kodro" / "assets" / "web" / "home.jsx",
    ROOT / "src" / "kodro" / "assets" / "web" / "onboarding.jsx",
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
    import kodro.rover_api as rover_api

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
    from kodro.lessons import load_library

    page = (ROOT / "src" / "kodro" / "assets" / "web" / "onboarding.jsx").read_text(
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


def test_lesson_count_claims_match_the_shipped_library() -> None:
    """Public lesson counts must move when the source library moves."""
    count = len(load_library())
    assert count == 24, "Update the product and documentation baseline for the new corpus"
    stale_patterns = (
        r"\b18\s+(?:guided|graded|bundled|built-in|shipped)\s+lessons?",
        r"\beighteen\s+(?:guided|graded|bundled|built-in|shipped)\s+lessons?",
    )
    problems: list[str] = []
    for surface in LESSON_SURFACES:
        text = surface.read_text(encoding="utf-8")
        for pattern in stale_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                problems.append(f"{surface.relative_to(ROOT)} contains stale pattern {pattern!r}")
    assert not problems, problems


def test_teacher_materials_cover_every_shipped_lesson() -> None:
    """The scheme, answer key and mapping must not omit newly added lessons."""
    lessons = load_library()
    materials = (
        ROOT / "docs" / "teachers" / "scheme-of-work.md",
        ROOT / "docs" / "teachers" / "answer-key.md",
        ROOT / "docs" / "teachers" / "curriculum-mapping.md",
    )
    missing: list[str] = []
    for material in materials:
        text = material.read_text(encoding="utf-8")
        for lesson in lessons:
            if f"`{lesson.id}`" not in text:
                missing.append(f"{material.relative_to(ROOT)}: {lesson.id}")
    assert not missing, f"Teacher materials omit shipped lessons: {missing}"


def test_teacher_answer_key_copies_every_verified_solution() -> None:
    """A documented answer must stay identical to the solution the gates run."""
    answer_key = (ROOT / "docs" / "teachers" / "answer-key.md").read_text(encoding="utf-8")
    mismatches: list[str] = []
    for lesson in load_library():
        pattern = rf"### `{re.escape(lesson.id)}`:[^\n]*\n\n```python\n(.*?)```"
        match = re.search(pattern, answer_key, re.DOTALL)
        if match is None or match.group(1).strip() != lesson.solution_code.strip():
            mismatches.append(lesson.id)
    assert not mismatches, f"Answer key differs from verified solution_code: {mismatches}"


def test_no_doc_link_escapes_the_published_site() -> None:
    """A relative link that climbs out of docs/ is a 404 for every reader.

    ``docs/mkdocs.yml`` sets ``docs_dir: .``, so a target reached through
    ``../`` is never copied into the build. CI does catch it, but only on the
    Linux leg and only at step ten: ``ca2-demo-script.md`` linked
    ``../.kodro/ca2-evidence/2026-08-18-release-run-and-artefact-divergence.md``
    and cost a full red run to find. Repository records live outside the site
    on purpose. Name the path in a code span, the way CLAIM_LEDGER.md,
    FINAL_CHECKLIST.md and SCRIPT.md already do, rather than linking it.

    Containment is the whole check. Whether an in-tree target exists is
    mkdocs' job and it already fails the build in strict mode.
    """
    inline_link = re.compile(r"\]\(([^)]+)\)")
    has_scheme = re.compile(r"^[a-z][a-z0-9+.\-]*:", re.IGNORECASE)
    docs = (ROOT / "docs").resolve()

    escapes: list[str] = []
    for page in sorted(docs.rglob("*.md")):
        for raw in inline_link.findall(page.read_text(encoding="utf-8")):
            target = raw.split("#", 1)[0].split(" ", 1)[0].strip()
            if not target or target.startswith(("/", "#")) or has_scheme.match(target):
                continue
            resolved = (page.parent / target).resolve()
            if docs not in resolved.parents:
                escapes.append(f"{page.relative_to(ROOT)} links {target}")

    assert not escapes, "links escape the documentation site: " + "; ".join(escapes)


def test_spoken_test_figures_match_the_record_they_cite() -> None:
    """The demo script's talking point five is spoken over the running product.

    It has drifted twice. It once said 851 tests, 86 percent and 47 of 47, all
    true at some point and badly stale by August. It then said 1,642 collected
    at ``66e8632`` and stayed there while twelve commits and seven tests landed
    on top, so the presenter would have said 1,642 while the screen said 1,649.

    Nothing here re-runs the suite; a test cannot measure its own run without
    lying about it. What it checks is the link that actually breaks: the spoken
    sentence, the source note directly under it, and the evidence record that
    note names must all carry the same figures, and that record must exist.
    Re-measure, write the record, and these three move together or fail.
    """
    script = (ROOT / "docs" / "ca2-demo-script.md").read_text(encoding="utf-8")

    spoken = re.search(
        r"All ([\d,]+) tests pass with nothing skipped\..*?"
        r"Coverage is ([\d.]+) percent",
        script,
        re.DOTALL,
    )
    assert spoken, "talking point five no longer states a test count and a coverage figure"

    note = re.search(
        r"logged in\s*>\s*`(\.kodro/ca2-evidence/[^`]+\.md)`.*?"
        r"([\d,]+) collected, ([\d,]+) passed, (\d+) skipped, ([\d.]+) percent",
        script,
        re.DOTALL,
    )
    assert note, "the source note under talking point five no longer names a record and its figures"

    record_path, collected, passed, skipped, note_coverage = note.groups()
    spoken_count, spoken_coverage = spoken.groups()

    assert collected == passed, (
        f"the note reports {collected} collected but {passed} passed; "
        "a spoken 'all tests pass' needs those equal"
    )
    assert skipped == "0", f"the note reports {skipped} skipped, so 'with nothing skipped' is wrong"
    assert spoken_count == passed, (
        f"the spoken line says {spoken_count} tests, the note says {passed} passed"
    )
    assert spoken_coverage == note_coverage, (
        f"the spoken line says {spoken_coverage} percent, the note says {note_coverage}"
    )

    record = ROOT / record_path
    assert record.is_file(), f"the note cites {record_path}, which does not exist"

    body = record.read_text(encoding="utf-8")
    bare = passed.replace(",", "")
    assert f"{passed} passed" in body or f"{bare} passed" in body, (
        f"{record_path} does not report {passed} passed"
    )
    assert f"{note_coverage} percent" in body or f"{note_coverage}%" in body, (
        f"{record_path} does not report {note_coverage} percent"
    )


_UNITS = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]


def _spoken(n: int) -> str:
    """Render 100..199 the way the narration says it: "a hundred and twenty-two"."""
    assert 100 <= n <= 199, (
        f"the honesty gate now reports {n}, outside the range this helper spells; "
        "extend it and re-read the narration"
    )
    rest = n - 100
    if rest < 20:
        tail = _UNITS[rest]
    else:
        tens, unit = divmod(rest, 10)
        tail = _TENS[tens] + (f"-{_UNITS[unit]}" if unit else "")
    return f"a hundred and {tail}"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js not available")
def test_spoken_honesty_count_matches_the_gate() -> None:
    """The narration says the honesty count out loud, so it has to be the real one.

    ``SCRIPT.md`` said "a hundred and twenty-one checks" while the gate had
    already grown to 122, and nothing caught it: the number is spelled out in
    words inside a quotation, so no search for ``121`` in the obvious form finds
    it. The ledger row carrying the same figure had drifted too.

    This runs the gate and holds both surfaces to what it actually prints.
    """
    proc = subprocess.run(
        [str(shutil.which("node")), str(ROOT / "scripts" / "qa_honesty.mjs")],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr

    measured = re.search(r"honesty:\s*(\d+)\s+passed", proc.stdout)
    assert measured, f"could not read a count out of the gate output: {proc.stdout!r}"
    count = int(measured.group(1))

    script = (ROOT / "docs" / "ca2" / "SCRIPT.md").read_text(encoding="utf-8")
    spoken = re.search(
        r"The honesty gate is the one worth naming\. (A hundred and [a-z-]+) checks",
        script,
    )
    assert spoken, "SCRIPT.md no longer speaks a check count for the honesty gate"
    phrase = _spoken(count)
    assert spoken.group(1).lower() == phrase, (
        f"the gate passes {count} checks, so the narration should say "
        f"'{phrase} checks', not '{spoken.group(1).lower()} checks'"
    )

    ledger = (ROOT / "docs" / "ca2" / "CLAIM_LEDGER.md").read_text(encoding="utf-8")
    row = re.search(r"\|\s*The honesty gate passes (\d+) checks\s*\|([^|]*)\|", ledger)
    assert row, "CLAIM_LEDGER.md no longer carries a claim row for the honesty gate"
    claimed, evidence = int(row.group(1)), row.group(2)
    assert claimed == count, f"the ledger claims {claimed} checks, the gate passes {count}"
    assert f"{count} passed, 0 failed" in evidence, (
        f"the ledger's evidence string does not quote '{count} passed, 0 failed'"
    )


def test_mcp_finale_doc_quotes_the_gates_real_row_count() -> None:
    """MCP_DEMO_PROMPT.md claims a pass count for its own verifier. Hold it to one.

    The file says of itself that "nothing else in the repository can catch a
    stale number here", and then carried one: it claimed the finale gate passed
    "30 of 30" when the gate has had 29 assertions since it was added. The 30
    was never real, so no re-run would have surfaced it.

    This runs the gate and holds the sentence to what it prints. The count only
    moves when someone edits the gate deliberately, which is exactly when this
    document has to move with it.
    """
    gate = ROOT / "scripts" / "qa_mcp_finale.py"
    assert gate.is_file(), f"the finale gate is gone from {gate}"

    proc = subprocess.run(
        [sys.executable, str(gate)],
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
        cwd=str(ROOT),
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr

    passed = len(re.findall(r"^PASS\b", proc.stdout, flags=re.MULTILINE))
    assert passed, f"the gate printed no PASS rows: {proc.stdout!r}"

    doc = (ROOT / "docs" / "ca2" / "MCP_DEMO_PROMPT.md").read_text(encoding="utf-8")
    claimed = re.search(r"It passed clean on 17 August, (\d+) of (\d+)", doc)
    assert claimed, "MCP_DEMO_PROMPT.md no longer states a pass count for the gate"
    assert claimed.group(1) == claimed.group(2), (
        f"the document claims {claimed.group(1)} of {claimed.group(2)}, which is not a clean run"
    )
    assert int(claimed.group(1)) == passed, (
        f"the gate passes {passed} rows, the document claims {claimed.group(1)}"
    )
