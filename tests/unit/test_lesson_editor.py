"""Lesson editor + custom-lesson loader tests."""

from __future__ import annotations

import tkinter as tk
from pathlib import Path
from unittest.mock import patch

import pytest

from kodro.lessons.schema import Lesson
from kodro.ui.lesson_editor import LessonEditor, load_custom_lessons


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


def test_save_writes_yaml_to_custom_dir(root: tk.Tk, tmp_path: Path) -> None:
    saved: list[Lesson] = []
    editor = LessonEditor(root, on_saved=saved.append, custom_dir=tmp_path)
    try:
        with patch("kodro.ui.lesson_editor.messagebox.showinfo"):
            lesson = editor.save()
        assert isinstance(lesson, Lesson)
        assert lesson.id == "my_lesson"
        assert (tmp_path / "my_lesson.yaml").exists()
        assert saved and saved[0].id == "my_lesson"
    finally:
        editor.destroy()


def test_save_rejects_invalid_payload(root: tk.Tk, tmp_path: Path) -> None:
    editor = LessonEditor(root, custom_dir=tmp_path)
    try:
        editor._w.max_lines_var.set("-5")  # type: ignore[attr-defined]
        with patch("kodro.ui.lesson_editor.messagebox.showerror") as mock_err:
            assert editor.save() is None
            assert mock_err.called
        # Nothing was written when validation fails.
        assert list(tmp_path.glob("*.yaml")) == []
    finally:
        editor.destroy()


def test_load_custom_lessons_round_trip(root: tk.Tk, tmp_path: Path) -> None:
    editor = LessonEditor(root, custom_dir=tmp_path)
    try:
        editor._w.id_var.set("loop_demo")  # type: ignore[attr-defined]
        with patch("kodro.ui.lesson_editor.messagebox.showinfo"):
            editor.save()
    finally:
        editor.destroy()
    lessons = load_custom_lessons(tmp_path)
    assert len(lessons) == 1
    assert lessons[0].id == "loop_demo"


def test_load_custom_lessons_skips_invalid_files(tmp_path: Path) -> None:
    (tmp_path / "broken.yaml").write_text("not: a lesson", encoding="utf-8")
    lessons = load_custom_lessons(tmp_path)
    assert lessons == []


def test_load_custom_lessons_returns_empty_for_missing_dir(tmp_path: Path) -> None:
    assert load_custom_lessons(tmp_path / "nope") == []
