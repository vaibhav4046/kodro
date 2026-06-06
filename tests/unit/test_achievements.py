"""Achievement engine + streak counter tests (P4 polish task)."""

from __future__ import annotations

import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from robolearn.lessons.schema import Lesson, WorldDef
from robolearn.memory.achievements import (
    BUNDLED_LESSON_COUNT,
    CATALOGUE,
    AchievementDef,
    PupilContext,
    achievement_status,
    check_and_unlock,
    daily_streak,
    ensure_schema,
    unlocked_ids,
)
from robolearn.memory.store import Store, Submission


def _lesson(lid: str = "01_hello_rover", *, key_stage: str = "KS3") -> Lesson:
    return Lesson(
        id=lid,
        title=lid,
        key_stage=key_stage,  # type: ignore[arg-type]
        ct_concepts=["sequence"],  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",  # type: ignore[arg-type]
        intro="t",
        starter_code="move_forward(1)",
        allowed_constructs=["function_call"],  # type: ignore[arg-type]
        max_lines=10,
        world=WorldDef(base=(1.0, 1.0)),
    )


def _sub(
    pupil_id: str,
    lesson_id: str = "01_hello_rover",
    *,
    passed: bool = True,
    code: str = "",
    score: int = 100,
    collisions: int = 0,
    battery: float = 10.0,
    ts: int | None = None,
) -> Submission:
    return Submission(
        id=0,
        pupil_id=pupil_id,
        lesson_id=lesson_id,
        code=code,
        passed=passed,
        score=score,
        reasons=[],
        duration_ms=0,
        battery_used=battery,
        collisions=collisions,
        ts=ts if ts is not None else int(time.time() * 1000),
    )


def test_catalogue_has_at_least_15_entries() -> None:
    assert len(CATALOGUE) >= 15


def test_catalogue_ids_are_unique() -> None:
    ids = [a.id for a in CATALOGUE]
    assert len(ids) == len(set(ids))


def test_three_in_a_row_unlocks_on_third_consecutive_pass(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    history = (
        _sub(pupil.id, "01_hello_rover", passed=True),
        _sub(pupil.id, "02_move_turn", passed=True),
    )
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson("03_sequence"),
        submission=_sub(pupil.id, "03_sequence", passed=True),
        history=history,
    )
    fresh = {a.id for a in check_and_unlock(store, ctx)}
    assert "three_in_a_row" in fresh


def test_three_in_a_row_not_unlocked_on_second_pass(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson("02_move_turn"),
        submission=_sub(pupil.id, "02_move_turn", passed=True),
        history=(_sub(pupil.id, "01_hello_rover", passed=True),),
    )
    fresh = {a.id for a in check_and_unlock(store, ctx)}
    assert "three_in_a_row" not in fresh


def test_three_in_a_row_breaks_on_intervening_fail(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    history = (
        _sub(pupil.id, "01_hello_rover", passed=True),
        _sub(pupil.id, "02_move_turn", passed=False),
    )
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson("03_sequence"),
        submission=_sub(pupil.id, "03_sequence", passed=True),
        history=history,
    )
    fresh = {a.id for a in check_and_unlock(store, ctx)}
    assert "three_in_a_row" not in fresh


def test_bundled_lesson_count_matches_library() -> None:
    # Self-policing: if lessons are added without bumping the constant, the
    # "Curriculum complete" achievement would be wrong -- fail loudly here.
    from robolearn.lessons.schema import load_library

    assert len(load_library()) == BUNDLED_LESSON_COUNT


def test_curriculum_complete_unlocks_at_full_count(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    prior = tuple(
        _sub(pupil.id, f"lesson_{i}", passed=True) for i in range(BUNDLED_LESSON_COUNT - 1)
    )
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson("lesson_final"),
        submission=_sub(pupil.id, "lesson_final", passed=True),
        history=prior,
    )
    assert "ten_lessons" in {a.id for a in check_and_unlock(store, ctx)}


def test_curriculum_complete_not_before_full_count(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    prior = tuple(
        _sub(pupil.id, f"lesson_{i}", passed=True) for i in range(BUNDLED_LESSON_COUNT - 2)
    )
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson("lesson_final"),
        submission=_sub(pupil.id, "lesson_final", passed=True),
        history=prior,
    )
    assert "ten_lessons" not in {a.id for a in check_and_unlock(store, ctx)}


def test_achievement_status_tracks_unlocks(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    status = achievement_status(store, pupil.id)
    assert len(status) == len(CATALOGUE)
    assert all(not unlocked for _, unlocked in status)
    # A failing submission unlocks 'first_failure'.
    ctx = PupilContext(
        pupil_id=pupil.id, lesson=_lesson(), submission=_sub(pupil.id, passed=False, score=0)
    )
    check_and_unlock(store, ctx)
    by_id = {ach.id: unlocked for ach, unlocked in achievement_status(store, pupil.id)}
    assert by_id["first_failure"] is True


def test_ensure_schema_creates_table(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    ensure_schema(store)
    store._conn.execute("SELECT 1 FROM unlocked_achievements").fetchall()  # type: ignore[attr-defined]


def test_check_and_unlock_returns_first_sample_for_lesson_01(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    sub = _sub(pupil.id, "01_hello_rover", passed=True)
    ctx = PupilContext(pupil_id=pupil.id, lesson=_lesson("01_hello_rover"), submission=sub)
    fresh = check_and_unlock(store, ctx)
    fresh_ids = {a.id for a in fresh}
    assert "first_sample" in fresh_ids


def test_check_and_unlock_does_not_refire(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson("01_hello_rover"),
        submission=_sub(pupil.id, "01_hello_rover", passed=True),
    )
    first = check_and_unlock(store, ctx)
    second = check_and_unlock(store, ctx)
    assert first
    assert second == []


def test_unlocked_ids_returns_persisted(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson("01_hello_rover"),
        submission=_sub(pupil.id, "01_hello_rover", passed=True),
    )
    check_and_unlock(store, ctx)
    assert "first_sample" in unlocked_ids(store, pupil.id)


def test_uses_while_predicate(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson(),
        submission=_sub(pupil.id, code="while True: break", passed=True),
    )
    fresh_ids = {a.id for a in check_and_unlock(store, ctx)}
    assert "uses_while" in fresh_ids


def test_no_collisions_requires_zero_collisions(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson(),
        submission=_sub(pupil.id, collisions=3, passed=True),
    )
    fresh_ids = {a.id for a in check_and_unlock(store, ctx)}
    assert "no_collisions" not in fresh_ids


def test_predicate_exceptions_are_swallowed(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    bad = AchievementDef("bad", "b", "b", "x", lambda c: 1 / 0)  # type: ignore[arg-type]
    ctx = PupilContext(
        pupil_id=pupil.id,
        lesson=_lesson(),
        submission=_sub(pupil.id, passed=True),
    )
    # Must not raise.
    check_and_unlock(store, ctx, catalogue=(bad,))


def test_daily_streak_increments_on_consecutive_days(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    today = date(2026, 5, 27)

    def _ts(d: date) -> int:
        return int(datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp() * 1000)

    for i in range(3):
        store.record_submission(
            pupil_id=pupil.id,
            lesson_id="X",
            code="",
            passed=True,
            score=100,
            reasons=[],
        )
        # Backfill ts to test specific dates.
        store._conn.execute(  # type: ignore[attr-defined]
            "UPDATE submissions SET ts=? WHERE pupil_id=? AND ROWID=?",
            (_ts(today - timedelta(days=i)), pupil.id, i + 1),
        )
    assert daily_streak(store, pupil.id, today=today) == 3


def test_daily_streak_zero_for_no_submissions(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("a")
    assert daily_streak(store, pupil.id) == 0
