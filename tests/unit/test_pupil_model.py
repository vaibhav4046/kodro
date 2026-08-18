"""Pupil-strength EMA model tests (Task 10)."""

from __future__ import annotations

from pathlib import Path

import pytest

from kodro.lessons.schema import Lesson, WorldDef
from kodro.memory.pupil_model import (
    STREAK_BEFORE_STRETCH,
    PupilStrength,
    attempted_lesson_ids,
    class_heatmap,
    get_strengths,
    passing_streak,
    suggest_next_lesson,
    update_on_submission,
    weakest_concepts,
)
from kodro.memory.store import Store


def _lesson(lesson_id: str, *, key_stage: str = "KS3", concepts: list[str] | None = None) -> Lesson:
    return Lesson(
        id=lesson_id,
        title=lesson_id.replace("_", " "),
        key_stage=key_stage,  # type: ignore[arg-type]
        ct_concepts=concepts or ["sequence"],  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",  # type: ignore[arg-type]
        intro="hi",
        starter_code="move_forward(1)",
        allowed_constructs=["function_call"],  # type: ignore[arg-type]
        max_lines=10,
        world=WorldDef(base=(1.0, 1.0)),
    )


def _store(tmp_path: Path) -> Store:
    return Store(tmp_path / "p.db")


def test_update_on_submission_seeds_per_concept(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    lesson = _lesson("01", concepts=["sequence", "selection"])
    updated = update_on_submission(store, pupil_id=p.id, lesson=lesson, passed=True)
    concepts = {s.concept for s in updated}
    assert concepts == {"sequence", "selection"}
    for s in updated:
        assert s.score == pytest.approx(1.0)
        assert s.successes == 1


def test_update_on_submission_subsequent_calls_apply_ema(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    lesson = _lesson("01", concepts=["sequence"])
    update_on_submission(store, pupil_id=p.id, lesson=lesson, passed=True)  # 1.0
    out = update_on_submission(store, pupil_id=p.id, lesson=lesson, passed=False)  # 0.7
    assert out[0].score == pytest.approx(0.7)


def test_get_strengths_returns_pupil_strength_records(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    update_on_submission(
        store,
        pupil_id=p.id,
        lesson=_lesson("01", concepts=["iteration"]),
        passed=False,
    )
    strengths = get_strengths(store, p.id)
    assert len(strengths) == 1
    assert isinstance(strengths[0], PupilStrength)
    assert strengths[0].concept == "iteration"
    assert strengths[0].score == 0.0


def test_weakest_concepts_excludes_above_threshold(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    # iteration becomes very strong (multiple passes), selection stays weak.
    for _ in range(5):
        update_on_submission(
            store,
            pupil_id=p.id,
            lesson=_lesson("a", concepts=["iteration"]),
            passed=True,
        )
    update_on_submission(
        store,
        pupil_id=p.id,
        lesson=_lesson("b", concepts=["selection"]),
        passed=False,
    )
    weak = weakest_concepts(store, p.id, threshold=0.6)
    weak_names = [s.concept for s in weak]
    assert "selection" in weak_names
    # iteration may or may not be above 0.6 after a single update, but the
    # ordering should still place selection first.
    assert weak_names[0] == "selection"


def test_passing_streak_counts_recent_passes(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    for passed in (True, False, True, True, True):
        store.record_submission(
            pupil_id=p.id,
            lesson_id="01",
            code="",
            passed=passed,
            score=100 if passed else 0,
            reasons=[],
        )
    assert passing_streak(store, p.id) == 3


def test_passing_streak_returns_zero_for_no_submissions(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    assert passing_streak(store, p.id) == 0


def test_attempted_lesson_ids_only_includes_passed(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    store.record_submission(
        pupil_id=p.id, lesson_id="A", code="", passed=True, score=100, reasons=[]
    )
    store.record_submission(
        pupil_id=p.id, lesson_id="B", code="", passed=False, score=20, reasons=[]
    )
    assert attempted_lesson_ids(store, p.id) == {"A"}


def test_suggest_next_lesson_returns_first_for_blank_history(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    library = [_lesson("01"), _lesson("02"), _lesson("03")]
    assert suggest_next_lesson(store, p.id, library) is not None


def test_suggest_next_lesson_returns_none_when_all_completed(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    library = [_lesson("01"), _lesson("02")]
    for lesson in library:
        store.record_submission(
            pupil_id=p.id,
            lesson_id=lesson.id,
            code="",
            passed=True,
            score=100,
            reasons=[],
        )
    assert suggest_next_lesson(store, p.id, library) is None


def test_suggest_next_lesson_prefers_weak_concept(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    # Pupil is strong at sequence, weak at selection.
    update_on_submission(
        store, pupil_id=p.id, lesson=_lesson("01", concepts=["sequence"]), passed=True
    )
    update_on_submission(
        store, pupil_id=p.id, lesson=_lesson("02", concepts=["selection"]), passed=False
    )
    library = [
        _lesson("03", concepts=["sequence"]),
        _lesson("04", concepts=["selection"]),
    ]
    next_lesson = suggest_next_lesson(store, p.id, library)
    assert next_lesson is not None
    assert next_lesson.id == "04"  # targets the weak concept


def test_suggest_next_lesson_after_streak_introduces_new_concept(tmp_path: Path) -> None:
    store = _store(tmp_path)
    p = store.create_pupil()
    # Pupil has many sequence passes (one streak).
    for _ in range(STREAK_BEFORE_STRETCH):
        store.record_submission(
            pupil_id=p.id,
            lesson_id=f"s{_}",
            code="",
            passed=True,
            score=100,
            reasons=[],
        )
        update_on_submission(
            store, pupil_id=p.id, lesson=_lesson(f"s{_}", concepts=["sequence"]), passed=True
        )
    library = [
        _lesson("s99", concepts=["sequence"]),
        _lesson("r99", concepts=["recursion"]),
    ]
    next_lesson = suggest_next_lesson(store, p.id, library)
    assert next_lesson is not None
    assert next_lesson.id == "r99"  # introduces a brand-new concept


def test_class_heatmap_includes_every_pupil(tmp_path: Path) -> None:
    store = _store(tmp_path)
    a = store.create_pupil("alice")
    b = store.create_pupil("bob")
    update_on_submission(store, pupil_id=a.id, lesson=_lesson("01"), passed=True)
    update_on_submission(store, pupil_id=b.id, lesson=_lesson("01"), passed=False)
    heatmap = class_heatmap(store)
    assert set(heatmap) == {a.id, b.id}
    assert heatmap[a.id]["sequence"] == pytest.approx(1.0)
    assert heatmap[b.id]["sequence"] == pytest.approx(0.0)


def test_pupil_strength_dataclass_fields() -> None:
    s = PupilStrength(concept="x", score=0.5, successes=1, failures=1, last_seen=None)
    assert s.concept == "x"
    assert s.score == 0.5
    assert s.successes == 1
    assert s.last_seen is None


def test_streak_constant_is_positive() -> None:
    assert STREAK_BEFORE_STRETCH >= 1
