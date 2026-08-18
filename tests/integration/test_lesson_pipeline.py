"""The whole lesson pipeline, over a pupil's journey, against a real database.

``tests/unit/test_web_bridge.py`` checks one call at a time. ``test_lesson_solutions``
checks one lesson at a time. Neither runs the thing the product actually is: the
same pupil failing a lesson, being hinted, passing it, and the record of that
surviving on disk.

The seams only a journey crosses:

* the hint feedback loop, which spans three calls -- a failing attempt sets a
  pending hint, the next attempt resolves it, and only then does the rule's
  learned ``shown`` / ``helped`` record move;
* durability, which no in-process test can prove: the pipeline writes through a
  connection that only ``close()`` flushes, so "it is in the database" and "it is
  in this connection's cache" look identical until the file is reopened;
* pupil isolation, which is a one-file classroom's whole safety story -- two
  pupils in one SQLite file must not see each other's work;
* the learner model's DIRECTION, which a single submission cannot show. A pass
  must raise concept strength above where a fail leaves it, and only two
  attempts either side of the same concept demonstrate that.

Every attempt below goes through ``BridgeAPI.submit_attempt``, which is the real
path the shipped web UI calls, so nothing here is testing a parallel arrangement
built for the test's convenience.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from kodro.lessons.schema import Lesson, load_library
from kodro.memory.pupil_model import get_strengths, passing_streak
from kodro.memory.store import Store
from kodro.web.app import BridgeAPI

# A program that is syntactically fine and runs clean but does not satisfy any
# lesson's criteria: it must FAIL grading rather than error, because an error
# takes the early-return branch that deliberately records nothing.
WRONG_BUT_RUNNABLE = "wait(0)\n"


def _first_solved_lesson() -> Lesson:
    """The earliest lesson shipping a worked solution -- the journey's subject."""
    for lesson in load_library():
        if lesson.solution_code:
            return lesson
    raise AssertionError("no lesson in the library ships a solution_code")


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "pupil.db"


@pytest.fixture
def api(db_path: Path) -> Iterator[BridgeAPI]:
    """A bridge over a real on-disk database and the real lesson library."""
    store = Store(db_path)
    try:
        yield BridgeAPI(store=store, lessons=list(load_library()))
    finally:
        store.close()


def test_a_failing_then_passing_journey_persists_both_attempts(api: BridgeAPI) -> None:
    """Two attempts, two rows, in the order they were made.

    The ordering matters beyond tidiness: ``passing_streak`` reads this list and
    the achievement predicates append the current submission to it, so a history
    that comes back out of order changes what a pupil is awarded.
    """
    lesson = _first_solved_lesson()
    store: Store = api._store
    pupil_id: str = api._pupil_id

    failed = api.submit_attempt(lesson.id, WRONG_BUT_RUNNABLE, None)
    assert failed["ok"] is True
    assert failed["graded"] is True
    assert failed["passed"] is False, f"expected a grading failure, got {failed['reasons']}"

    passed = api.submit_attempt(lesson.id, lesson.solution_code or "", None)
    assert passed["passed"] is True, f"worked solution failed: {passed['reasons']}"
    assert passed["score"] == 100

    history = store.list_submissions(pupil_id=pupil_id, lesson_id=lesson.id)
    assert [s.passed for s in history] == [False, True], (
        f"history must come back oldest-first; got {[(s.id, s.ts, s.passed) for s in history]}"
    )
    assert history[0].code == WRONG_BUT_RUNNABLE
    assert history[1].code == lesson.solution_code
    assert passing_streak(store, pupil_id) == 1


def test_the_hint_loop_only_scores_a_rule_on_the_following_attempt(api: BridgeAPI) -> None:
    """A shown hint is judged by what the pupil does NEXT, not immediately.

    This is the one piece of product behaviour that cannot be observed inside a
    single call: attempt one arms the pending hint, attempt two is its verdict.
    """
    lesson = _first_solved_lesson()
    store: Store = api._store

    assert store.get_hint_stats() == {}, "fixture leaked a previous run's hint stats"

    first = api.submit_attempt(lesson.id, WRONG_BUT_RUNNABLE, None)
    assert first["passed"] is False
    if first.get("hint") is None:
        pytest.skip(f"{lesson.id} surfaced no hint for this failure; nothing to score")

    # Nothing is scored yet -- the hint has been shown, not judged.
    assert store.get_hint_stats() == {}

    api.submit_attempt(lesson.id, lesson.solution_code or "", None)

    stats = store.get_hint_stats()
    assert stats, "the pass after a hint must score that hint"
    scored = next(iter(stats.values()))
    assert scored.shown == 1
    assert scored.helped == 1, "a hint followed by a pass counts as having helped"


def test_a_hint_followed_by_another_failure_is_not_credited(api: BridgeAPI) -> None:
    """The negative half of the loop, without which ``helped`` is just ``shown``."""
    lesson = _first_solved_lesson()
    store: Store = api._store

    first = api.submit_attempt(lesson.id, WRONG_BUT_RUNNABLE, None)
    if first.get("hint") is None:
        pytest.skip(f"{lesson.id} surfaced no hint for this failure; nothing to score")
    api.submit_attempt(lesson.id, WRONG_BUT_RUNNABLE, None)

    stats = store.get_hint_stats()
    assert stats
    scored = next(iter(stats.values()))
    assert scored.shown == 1
    assert scored.helped == 0


def test_passing_raises_concept_strength_above_where_failing_left_it(api: BridgeAPI) -> None:
    """The learner model must move in the right direction, not merely move.

    A single submission proves only that a row appeared. The EMA's sign is what
    the recommender and the teacher heatmap are built on.
    """
    lesson = _first_solved_lesson()
    store: Store = api._store
    pupil_id: str = api._pupil_id

    api.submit_attempt(lesson.id, WRONG_BUT_RUNNABLE, None)
    after_failure = {s.concept: s.score for s in get_strengths(store, pupil_id)}
    assert after_failure, "a graded failure must still register the concepts attempted"

    api.submit_attempt(lesson.id, lesson.solution_code or "", None)
    after_pass = {s.concept: s.score for s in get_strengths(store, pupil_id)}

    shared = set(after_failure) & set(after_pass)
    assert shared, "the pass touched none of the concepts the failure did"
    for concept in sorted(shared):
        assert after_pass[concept] > after_failure[concept], (
            f"{concept} did not improve after a pass: "
            f"{after_failure[concept]} -> {after_pass[concept]}"
        )


def test_the_journey_survives_closing_and_reopening_the_database(db_path: Path) -> None:
    """Durability, which every in-process assertion above takes on trust.

    ``Store`` holds a connection per thread. Until the file is reopened, "the
    submission is saved" and "the submission is in this connection" are
    indistinguishable, and only one of them is what a pupil returning tomorrow
    depends on.
    """
    lesson = _first_solved_lesson()

    store = Store(db_path)
    try:
        api = BridgeAPI(store=store, lessons=list(load_library()))
        pupil_id: str = api._pupil_id
        api.submit_attempt(lesson.id, WRONG_BUT_RUNNABLE, None)
        result = api.submit_attempt(lesson.id, lesson.solution_code or "", None)
        assert result["passed"] is True
    finally:
        store.close()

    reopened = Store(db_path)
    try:
        history = reopened.list_submissions(pupil_id=pupil_id, lesson_id=lesson.id)
        assert [s.passed for s in history] == [False, True]
        assert history[1].score == 100
        assert get_strengths(reopened, pupil_id), "the learner model did not reach the file"
        assert reopened.get_pupil(pupil_id) is not None
    finally:
        reopened.close()


def test_two_pupils_in_one_database_stay_separated(api: BridgeAPI) -> None:
    """One classroom, one file: neither pupil may see the other's work.

    The bridge fixes attribution at submit ENTRY, so this also covers the rule
    that switching pupil does not re-file work already in flight for the old one.
    """
    lesson = _first_solved_lesson()
    store: Store = api._store

    first_id: str = api._pupil_id
    api.submit_attempt(lesson.id, lesson.solution_code or "", None)

    created = api.create_pupil("Second Pupil")
    assert created["ok"] is True
    second_id = created["id"]
    assert second_id != first_id
    assert api.select_pupil(second_id)["ok"] is True

    api.submit_attempt(lesson.id, WRONG_BUT_RUNNABLE, None)

    first_history = store.list_submissions(pupil_id=first_id)
    second_history = store.list_submissions(pupil_id=second_id)
    assert [s.passed for s in first_history] == [True]
    assert [s.passed for s in second_history] == [False]
    assert {s.pupil_id for s in first_history} == {first_id}
    assert {s.pupil_id for s in second_history} == {second_id}

    # The teacher view is per-pupil too, not a merged classroom average.
    heatmap = api.get_class_heatmap()
    assert heatmap["ok"] is True
    by_id = {row["id"]: row for row in heatmap["pupils"]}
    assert {first_id, second_id} <= set(by_id), f"heatmap lost a pupil: {heatmap}"
    assert by_id[second_id]["active"] is True
    assert by_id[first_id]["active"] is False


def test_an_execution_error_leaves_the_whole_pipeline_untouched(api: BridgeAPI) -> None:
    """A typo is not a verdict, and must not move any persisted state.

    The unit suite checks the submissions table. The rest of the pipeline hangs
    off the same early return: concept strength, the hint loop and the streak all
    have to stay where they were, or a pupil is punished for a missing bracket.
    """
    lesson = _first_solved_lesson()
    store: Store = api._store
    pupil_id: str = api._pupil_id

    api.submit_attempt(lesson.id, lesson.solution_code or "", None)
    strengths_before = {s.concept: s.score for s in get_strengths(store, pupil_id)}
    streak_before = passing_streak(store, pupil_id)
    hints_before = store.get_hint_stats()

    broken = api.submit_attempt(lesson.id, "move_forward(", None)
    assert broken["passed"] is False
    assert broken["score"] == 0

    assert len(store.list_submissions(pupil_id=pupil_id)) == 1
    assert {s.concept: s.score for s in get_strengths(store, pupil_id)} == strengths_before
    assert passing_streak(store, pupil_id) == streak_before
    assert store.get_hint_stats() == hints_before


@pytest.mark.parametrize(
    "lesson",
    list(load_library()),
    ids=[lesson.id for lesson in load_library()],
)
def test_every_lesson_completes_the_pipeline_end_to_end(api: BridgeAPI, lesson: Lesson) -> None:
    """Every shipped lesson survives YAML -> sandbox -> grade -> persisted row.

    ``test_lesson_solutions`` proves each solution grades 100 against the Python
    grader in isolation. This proves the same solution also survives the world
    construction, tracer binding, hint ranking, learner-model update, achievement
    check and recommender that the real submit path runs afterwards -- any of
    which can raise on a lesson the grader was perfectly happy with.
    """
    assert lesson.solution_code, f"{lesson.id} ships no solution_code"
    store: Store = api._store
    pupil_id: str = api._pupil_id

    result = api.submit_attempt(lesson.id, lesson.solution_code, None)

    assert result["ok"] is True
    assert result["passed"] is True, f"{lesson.id}: {result['reasons']}"
    assert result["score"] == 100
    assert isinstance(result["achievements"], list)
    assert "recommended" in result

    rows = store.list_submissions(pupil_id=pupil_id, lesson_id=lesson.id)
    assert len(rows) == 1, f"{lesson.id} persisted {len(rows)} rows for one attempt"
    assert rows[0].passed is True
    assert rows[0].score == 100
    assert rows[0].collisions == 0, f"{lesson.id} solution collides {rows[0].collisions} times"
