"""Pupil progress-report (HTML) tests -- Tk-free, runs on every OS."""

from __future__ import annotations

from pathlib import Path

from robolearn.lessons.schema import load_library
from robolearn.memory.report import build_progress_report_html, export_progress_report
from robolearn.memory.store import Pupil, Store


def _seed(store: Store) -> Pupil:
    pupil = store.create_pupil("Ada")
    store.record_submission(
        pupil_id=pupil.id,
        lesson_id="01_hello_rover",
        code="move_forward(1)",
        passed=True,
        score=100,
        reasons=[],
        battery_used=12.0,
        collisions=0,
    )
    store.record_submission(
        pupil_id=pupil.id,
        lesson_id="04_selection",
        code="x",
        passed=False,
        score=60,
        reasons=["needs an if"],
        battery_used=40.0,
        collisions=2,
    )
    store.update_concept_strength(pupil.id, "sequence", passed=True)
    return pupil


def test_report_html_contains_sections(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = _seed(store)
    doc = build_progress_report_html(store, pupil.id, lessons=list(load_library()))
    assert "RoboLearn progress report" in doc
    assert "Ada" in doc
    assert "Summary" in doc
    assert "Submissions" in doc
    assert "Concept strengths" in doc
    assert "Achievements" in doc
    assert "passed" in doc and "not yet" in doc
    assert doc.rstrip().endswith("</html>")


def test_report_escapes_pupil_name(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("<script>x</script>")
    doc = build_progress_report_html(store, pupil.id)
    assert "<script>" not in doc
    assert "&lt;script&gt;" in doc


def test_report_handles_pupil_with_no_history(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = store.create_pupil("New")
    doc = build_progress_report_html(store, pupil.id)
    assert "No submissions yet." in doc
    assert "No concepts practised yet." in doc


def test_export_writes_file_with_stamp(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    pupil = _seed(store)
    out = tmp_path / "nested" / "report.html"
    path = export_progress_report(store, pupil.id, out, lessons=list(load_library()))
    assert path == out
    assert out.exists()
    text = out.read_text(encoding="utf-8")
    assert "generated" in text  # export injects the timestamp
    assert text.startswith("<!DOCTYPE html>")
