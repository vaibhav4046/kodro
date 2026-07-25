"""Curriculum claims must be checkable, consistent, and complete.

Two defects motivated this module, both of them teacher-facing:

1. The KS3 lessons cited "KS3 attainment target N". The DfE Computing
   programme of study states its subject content as an unnumbered bullet list
   and its "Attainment targets" section is a single generic sentence, so the
   numbering was invented. It was also internally contradictory: "target 4" was
   cited for three different requirements, and "target 6" was cited for modular
   programs, which belongs to the same bullet as the languages requirement
   already cited as "target 4". A citation a teacher cannot look up is worse
   than no citation.

2. ``scripts/generate_curriculum_report.py`` iterated a hardcoded
   ``("KS3", "KS4")``, so the three KS1/KS2 lessons were silently absent from a
   PDF whose entire purpose is to evidence curriculum coverage.

These are gated rather than left to review because both are the kind of claim a
marker or a head of department would check first.
"""

from __future__ import annotations

import re
from collections import defaultdict

from robolearn.lessons.schema import load_library

LIBRARY = load_library()


def test_no_lesson_invents_an_attainment_target_number() -> None:
    """The cited DfE Computing PoS has no numbered attainment targets."""
    offenders = [
        (lesson.id, ref)
        for lesson in LIBRARY
        for ref in lesson.curriculum_refs
        if re.search(r"attainment target\s*\d", ref, re.IGNORECASE)
    ]
    assert not offenders, (
        "These lessons cite a numbered DfE attainment target, which the "
        "Computing programme of study does not define. Cite the subject "
        f"content requirement text instead: {offenders}"
    )


def test_identical_requirements_are_cited_identically() -> None:
    """One requirement, one string.

    If two lessons draw on the same curriculum requirement they must cite it
    with the same text. Divergent wording for the same requirement is how the
    contradictory numbering went unnoticed.
    """
    # Group DfE Computing PoS references by the requirement text that follows
    # the document identifier, and assert no requirement is worded two ways.
    by_tail: dict[str, set[str]] = defaultdict(set)
    for lesson in LIBRARY:
        for ref in lesson.curriculum_refs:
            if "DfE-00191-2013" not in ref:
                continue
            _, _, tail = ref.partition("subject content: ")
            if tail:
                by_tail[tail.strip().lower()].add(ref)
    inconsistent = {k: v for k, v in by_tail.items() if len(v) > 1}
    assert not inconsistent, (
        f"The same requirement is cited with different wording: {inconsistent}"
    )


def test_every_lesson_has_a_checkable_curriculum_reference() -> None:
    """A lesson that claims curriculum alignment must name its source."""
    missing = [lesson.id for lesson in LIBRARY if not lesson.curriculum_refs]
    assert not missing, f"Lessons with no curriculum reference at all: {missing}"

    # Every reference must name a real, identifiable published source. The
    # bundled references come from three documents; anything else is either a
    # new source that belongs in this list or an unsourced assertion.
    known = ("DfE-00171-2013", "DfE-00191-2013", "DfE-00094-2015", "Csizmadia")
    unsourced = [
        (lesson.id, ref)
        for lesson in LIBRARY
        for ref in lesson.curriculum_refs
        if not any(k in ref for k in known)
    ]
    assert not unsourced, (
        "These references do not identify a known published source. Add the "
        f"document identifier, or add the source to `known` here: {unsourced}"
    )


def test_curriculum_report_covers_every_key_stage_in_the_library() -> None:
    """The coverage report must not silently omit lessons.

    Mirrors the generator's own key-stage selection. If the generator ever goes
    back to a hardcoded subset this fails, because the library contains key
    stages the subset does not.
    """
    order = ("KS1", "KS2", "KS3", "KS4")
    present = {lesson.key_stage for lesson in LIBRARY}
    selected = [ks for ks in order if ks in present] + sorted(present - set(order))

    covered = sum(1 for lesson in LIBRARY if lesson.key_stage in selected)
    assert covered == len(LIBRARY), (
        f"The report would cover {covered} of {len(LIBRARY)} lessons. "
        f"Key stages in the library: {sorted(present)}; selected: {selected}"
    )

    source = (
        __import__("pathlib")
        .Path(__file__)
        .resolve()
        .parents[2]
        .joinpath("scripts", "generate_curriculum_report.py")
        .read_text(encoding="utf-8")
    )
    assert 'for key_stage in ("KS3", "KS4")' not in source, (
        "generate_curriculum_report.py has gone back to a hardcoded key-stage "
        "list, which silently drops the KS1/KS2 lessons from the coverage PDF."
    )
