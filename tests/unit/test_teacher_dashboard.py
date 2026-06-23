"""Teacher-dashboard tests (Task 17)."""

from __future__ import annotations

import tkinter as tk
from pathlib import Path

import pytest

from robolearn.lessons.schema import Lesson, WorldDef
from robolearn.memory.pupil_model import update_on_submission
from robolearn.memory.store import Store
from robolearn.ui.teacher_dashboard import TeacherDashboard


@pytest.fixture
def root():  # type: ignore[no-untyped-def]
    try:
        r = tk.Tk()
        r.withdraw()
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        pytest.skip(f"Tk unavailable: {exc}")
    try:
        yield r
    finally:
        r.destroy()


def _lesson(concepts: list[str]) -> Lesson:
    return Lesson(
        id="x",
        title="x",
        key_stage="KS3",  # type: ignore[arg-type]
        ct_concepts=concepts,  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",  # type: ignore[arg-type]
        intro="hi",
        starter_code="move_forward(1)",
        allowed_constructs=["function_call"],  # type: ignore[arg-type]
        max_lines=10,
        world=WorldDef(base=(1.0, 1.0)),
    )


def _populated_store(tmp_path: Path) -> Store:
    store = Store(tmp_path / "p.db")
    a = store.create_pupil("alice")
    b = store.create_pupil("bob")
    update_on_submission(store, pupil_id=a.id, lesson=_lesson(["sequence"]), passed=True)
    update_on_submission(
        store,
        pupil_id=b.id,
        lesson=_lesson(["selection"]),
        passed=False,
    )
    store.record_submission(
        pupil_id=a.id,
        lesson_id="01",
        code="move_forward(1)",
        passed=True,
        score=100,
        reasons=[],
    )
    store.record_submission(
        pupil_id=b.id,
        lesson_id="04",
        code="if x: pass",
        passed=False,
        score=20,
        reasons=["used wrong construct"],
    )
    return store


def test_dashboard_constructs_with_empty_store(root: tk.Tk, tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    dashboard = TeacherDashboard(root, store)
    try:
        assert "no pupil submissions" in dashboard.heatmap_text_dump()
    finally:
        dashboard.destroy()


def test_dashboard_heatmap_lists_pupils(root: tk.Tk, tmp_path: Path) -> None:
    dashboard = TeacherDashboard(root, _populated_store(tmp_path))
    try:
        text = dashboard.heatmap_text_dump()
        assert "alice" in text
        assert "bob" in text
    finally:
        dashboard.destroy()


def test_dashboard_drill_down_shows_pupil_data(root: tk.Tk, tmp_path: Path) -> None:
    dashboard = TeacherDashboard(root, _populated_store(tmp_path))
    try:
        dashboard.select_pupil(0)
        drill = dashboard.drill_text_dump()
        assert "Submissions: 1" in drill
        assert "PASS" in drill or "FAIL" in drill
    finally:
        dashboard.destroy()


def test_export_csv_writes_expected_header(root: tk.Tk, tmp_path: Path) -> None:
    store = _populated_store(tmp_path)
    dashboard = TeacherDashboard(root, store)
    try:
        out = dashboard.export_csv(tmp_path / "out.csv")
        text = out.read_text(encoding="utf-8")
        assert "pupil_id,display_name" in text
        assert "sequence" in text
        assert "selection" in text
    finally:
        dashboard.destroy()


def test_export_csv_handles_empty_store(root: tk.Tk, tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    dashboard = TeacherDashboard(root, store)
    try:
        out = dashboard.export_csv(tmp_path / "out.csv")
        text = out.read_text(encoding="utf-8")
        assert "pupil_id,display_name" in text
    finally:
        dashboard.destroy()


def test_export_button_uses_chooser_callable(root: tk.Tk, tmp_path: Path) -> None:
    store = _populated_store(tmp_path)
    target = tmp_path / "chosen.csv"
    dashboard = TeacherDashboard(root, store, export_path_chooser=lambda: target)
    try:
        dashboard._widgets.export_button.invoke()  # type: ignore[attr-defined]
        assert target.exists()
    finally:
        dashboard.destroy()


def test_export_button_no_chooser_path_is_silent(root: tk.Tk, tmp_path: Path) -> None:
    store = _populated_store(tmp_path)
    dashboard = TeacherDashboard(root, store, export_path_chooser=lambda: None)
    try:
        dashboard._widgets.export_button.invoke()  # type: ignore[attr-defined]
        # No error -- no file -- nothing happens. That is the contract.
    finally:
        dashboard.destroy()


def test_refresh_is_idempotent(root: tk.Tk, tmp_path: Path) -> None:
    dashboard = TeacherDashboard(root, _populated_store(tmp_path))
    try:
        text1 = dashboard.heatmap_text_dump()
        dashboard.refresh()
        text2 = dashboard.heatmap_text_dump()
        assert text1 == text2
    finally:
        dashboard.destroy()


def test_export_pdf_writes_expected_header(root: tk.Tk, tmp_path: Path) -> None:
    store = _populated_store(tmp_path)
    dashboard = TeacherDashboard(root, store)
    try:
        out = dashboard.export_pdf(tmp_path / "out.pdf")
        assert out.exists()
        assert out.stat().st_size > 0
    finally:
        dashboard.destroy()


def test_export_pdf_button_uses_chooser_callable(root: tk.Tk, tmp_path: Path) -> None:
    store = _populated_store(tmp_path)
    target = tmp_path / "chosen.pdf"
    dashboard = TeacherDashboard(root, store, pdf_path_chooser=lambda: target)
    try:
        dashboard._widgets.pdf_button.invoke()  # type: ignore[attr-defined]
        assert target.exists()
        assert target.stat().st_size > 0
    finally:
        dashboard.destroy()


def test_export_pdf_button_no_chooser_path_is_silent(root: tk.Tk, tmp_path: Path) -> None:
    store = _populated_store(tmp_path)
    dashboard = TeacherDashboard(root, store, pdf_path_chooser=lambda: None)
    try:
        dashboard._widgets.pdf_button.invoke()  # type: ignore[attr-defined]
        # No error -- no file -- nothing happens. That is the contract.
    finally:
        dashboard.destroy()
