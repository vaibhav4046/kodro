"""Rolling strength/weakness model used to recommend next lessons.

Section 7.2 of the spec describes the role of this module: given a
:class:`~kodro.memory.store.Store` plus the lesson library, compute
each pupil's per-concept strength, suggest the next lesson, and produce
a class-wide heatmap for the teacher dashboard.

The store already maintains the EMA score; this module just reads it
and makes decisions on top.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from kodro.lessons.schema import Lesson

from .store import ConceptStrength, Store

#: After this many consecutive passes the recommender introduces a
#: stretch lesson that exercises a brand-new concept (Section 7.2).
STREAK_BEFORE_STRETCH: int = 5

#: Score threshold under which a concept is treated as "weak" and prioritised
#: by :func:`suggest_next_lesson`.
WEAK_SCORE_THRESHOLD: float = 0.6


@dataclass(frozen=True, slots=True)
class PupilStrength:
    """Concept-level summary used by the UI heatmap."""

    concept: str
    score: float
    successes: int
    failures: int
    last_seen: int | None


def update_on_submission(
    store: Store,
    *,
    pupil_id: str,
    lesson: Lesson,
    passed: bool,
) -> list[PupilStrength]:
    """Apply one EMA step for every concept the lesson exercises.

    Returns the resulting strengths so a UI can refresh without a second
    database trip.
    """
    updated: list[PupilStrength] = []
    for concept in lesson.ct_concepts:
        row = store.update_concept_strength(pupil_id, concept, passed=passed)
        updated.append(_to_strength(row))
    return updated


def get_strengths(store: Store, pupil_id: str) -> list[PupilStrength]:
    """Return every concept strength the pupil has touched."""
    return [_to_strength(row) for row in store.get_concept_strength(pupil_id)]


def weakest_concepts(
    store: Store,
    pupil_id: str,
    *,
    threshold: float = WEAK_SCORE_THRESHOLD,
) -> list[PupilStrength]:
    """Return strengths below ``threshold``, sorted weakest first."""
    weak = [s for s in get_strengths(store, pupil_id) if s.score < threshold]
    return sorted(weak, key=lambda s: s.score)


def passing_streak(store: Store, pupil_id: str) -> int:
    """Return the number of consecutive most-recent passing submissions."""
    streak = 0
    for submission in reversed(store.list_submissions(pupil_id=pupil_id)):
        if submission.passed:
            streak += 1
        else:
            break
    return streak


def attempted_lesson_ids(store: Store, pupil_id: str) -> set[str]:
    """Lesson IDs the pupil has *successfully* completed at least once."""
    return {s.lesson_id for s in store.list_submissions(pupil_id=pupil_id) if s.passed}


def suggest_next_lesson(
    store: Store,
    pupil_id: str,
    lessons: Iterable[Lesson],
) -> Lesson | None:
    """Pick the next lesson for ``pupil_id``.

    Rule (Section 7.2):

    1. If the pupil has no history, recommend the first never-attempted
       lesson in declared order (typically ``01_hello_rover``).
    2. Otherwise, find the weakest concept and pick the earliest
       not-yet-completed lesson that exercises it.
    3. After :data:`STREAK_BEFORE_STRETCH` consecutive passes, prefer a
       lesson tagged with a concept the pupil has never seen.
    4. Fall back to the first not-yet-completed lesson.

    Returns ``None`` only when every lesson has been completed.
    """
    lesson_list = list(lessons)
    completed = attempted_lesson_ids(store, pupil_id)
    candidates = [lesson for lesson in lesson_list if lesson.id not in completed]
    if not candidates:
        return None
    # Only recommend lessons whose prerequisites have all been attempted, so a
    # pupil is never pushed into a lesson that assumes concepts they have not
    # reached yet. If prereq-gating leaves nothing (an unmet or cyclic chain),
    # fall back to the unfiltered candidates rather than dead-ending.
    ready = [
        lesson for lesson in candidates if all(prereq in completed for prereq in lesson.prereqs)
    ]
    if ready:
        candidates = ready

    strengths = get_strengths(store, pupil_id)
    if not strengths:
        return candidates[0]

    if passing_streak(store, pupil_id) >= STREAK_BEFORE_STRETCH:
        seen = {s.concept for s in strengths}
        new_concept_candidates = [
            lesson for lesson in candidates if any(c not in seen for c in lesson.ct_concepts)
        ]
        if new_concept_candidates:
            return new_concept_candidates[0]

    weak = weakest_concepts(store, pupil_id)
    for weakness in weak:
        for lesson in candidates:
            if weakness.concept in lesson.ct_concepts:
                return lesson

    return candidates[0]


def class_heatmap(store: Store) -> dict[str, dict[str, float]]:
    """Return a ``{pupil_id: {concept: score}}`` mapping for the dashboard."""
    heatmap: dict[str, dict[str, float]] = {}
    for pupil in store.list_pupils():
        heatmap[pupil.id] = {s.concept: s.score for s in get_strengths(store, pupil.id)}
    return heatmap


# --- helpers ---------------------------------------------------------------


def _to_strength(row: ConceptStrength) -> PupilStrength:
    return PupilStrength(
        concept=row.concept,
        score=row.score,
        successes=row.successes,
        failures=row.failures,
        last_seen=row.last_seen,
    )
