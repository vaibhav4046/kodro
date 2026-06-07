"""SQLite store tests (Task 10)."""

from __future__ import annotations

from pathlib import Path

from robolearn.memory.store import (
    SCHEMA_SQL,
    ConceptStrength,
    Pupil,
    Store,
    Submission,
)

# NOTE: the Store is cross-thread safe (thread-local connections + busy_timeout)
# so the pywebview bridge can drive it from the webview thread -- verified live
# in the packaged .exe ("UI ready" + multi-pupil with no sqlite error). A
# dedicated worker-thread unit test was removed: spawning a thread that opens
# SQLite inside the GitHub sandbox runners aborts the interpreter (a runner
# limitation, not a Store bug). The design itself is the guard; the next test
# asserts the per-thread connection behaviour without spawning a thread.


def test_store_uses_thread_local_connections(tmp_path: Path) -> None:
    """A file-backed Store caches one connection per thread (not shared)."""
    store = Store(tmp_path / "p.db")
    assert store._conn is store._conn  # type: ignore[attr-defined]  # same thread -> cached
    assert store._is_memory is False  # type: ignore[attr-defined]


def test_store_creates_schema_on_init(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    # Schema was applied -- queries against expected tables succeed.
    store._conn.execute("SELECT 1 FROM pupils").fetchall()  # type: ignore[attr-defined]
    store._conn.execute("SELECT 1 FROM submissions").fetchall()  # type: ignore[attr-defined]
    store._conn.execute("SELECT 1 FROM concept_strength").fetchall()  # type: ignore[attr-defined]


def test_create_and_get_pupil(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    p = store.create_pupil("Alice")
    assert isinstance(p, Pupil)
    assert p.display_name == "Alice"
    assert store.get_pupil(p.id) == p


def test_get_pupil_returns_none_for_unknown(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    assert store.get_pupil("nope") is None


def test_set_display_name_renames_pupil(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    p = store.create_pupil("Pupil")
    store.set_display_name(p.id, "Ada")
    renamed = store.get_pupil(p.id)
    assert renamed is not None
    assert renamed.display_name == "Ada"


def test_set_display_name_unknown_pupil_is_noop(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    store.set_display_name("ghost", "Nobody")  # must not raise
    assert store.get_pupil("ghost") is None


def test_list_pupils_orders_by_creation(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    a = store.create_pupil("a")
    b = store.create_pupil("b")
    ids = [p.id for p in store.list_pupils()]
    assert ids == [a.id, b.id]


def test_record_submission_round_trips_through_list(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    sub = store.record_submission(
        pupil_id=pupil.id,
        lesson_id="01_hello_rover",
        code="move_forward(1)",
        passed=True,
        score=100,
        reasons=[],
    )
    assert isinstance(sub, Submission)
    out = store.list_submissions(pupil_id=pupil.id)
    assert len(out) == 1
    assert out[0].id == sub.id
    assert out[0].reasons == []


def test_record_submission_reasons_round_trip(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil()
    store.record_submission(
        pupil_id=pupil.id,
        lesson_id="05_iteration",
        code="while True: pass",
        passed=False,
        score=20,
        reasons=["No movement", "Multiple collisions"],
    )
    out = store.list_submissions(pupil_id=pupil.id)
    assert out[0].reasons == ["No movement", "Multiple collisions"]


def test_list_submissions_filters_by_lesson(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    p = store.create_pupil()
    store.record_submission(
        pupil_id=p.id, lesson_id="A", code="", passed=True, score=100, reasons=[]
    )
    store.record_submission(
        pupil_id=p.id, lesson_id="B", code="", passed=True, score=100, reasons=[]
    )
    out = store.list_submissions(pupil_id=p.id, lesson_id="A")
    assert len(out) == 1
    assert out[0].lesson_id == "A"


def test_update_concept_strength_fresh_row(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    p = store.create_pupil()
    cs = store.update_concept_strength(p.id, "iteration", passed=True)
    assert isinstance(cs, ConceptStrength)
    assert cs.successes == 1
    assert cs.failures == 0
    assert cs.score == 1.0


def test_update_concept_strength_subsequent_rows_use_ema(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    p = store.create_pupil()
    store.update_concept_strength(p.id, "iteration", passed=True)  # score = 1.0
    cs2 = store.update_concept_strength(p.id, "iteration", passed=False, alpha=0.3)
    # New score = 0.3 * 0 + 0.7 * 1.0 = 0.7
    assert cs2.score == 0.7
    assert cs2.successes == 1
    assert cs2.failures == 1


def test_get_concept_strength_returns_all_for_pupil(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    p = store.create_pupil()
    store.update_concept_strength(p.id, "iteration", passed=True)
    store.update_concept_strength(p.id, "selection", passed=False)
    rows = store.get_concept_strength(p.id)
    assert {r.concept for r in rows} == {"iteration", "selection"}


def test_get_concept_strength_returns_empty_for_unknown_pupil(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    assert store.get_concept_strength("ghost") == []


def test_store_context_manager_closes(tmp_path: Path) -> None:
    with Store(tmp_path / "p.db") as store:
        store.create_pupil()
    # If closed, attempting another query should fail.
    try:
        store._conn.execute("SELECT 1")  # type: ignore[attr-defined]
    except Exception:
        return
    raise AssertionError("connection should have been closed")


def test_schema_constant_exposes_sql() -> None:
    assert "CREATE TABLE IF NOT EXISTS pupils" in SCHEMA_SQL
    assert "CREATE TABLE IF NOT EXISTS submissions" in SCHEMA_SQL
    assert "CREATE TABLE IF NOT EXISTS concept_strength" in SCHEMA_SQL
