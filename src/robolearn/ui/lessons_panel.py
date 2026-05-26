"""Lesson list + pupil-memory drawer to the right of the simulator.

Implemented in Task 14 of the build plan.
"""

from __future__ import annotations

import tkinter as tk
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from tkinter import ttk

from robolearn.lessons.schema import Lesson
from robolearn.memory.pupil_model import PupilStrength


@dataclass(slots=True)
class LessonsCallbacks:
    """Optional callbacks fired by the lessons panel."""

    on_select: Callable[[Lesson], None] | None = None


class LessonsPanel(ttk.Frame):
    """A scrollable list of lesson titles plus a pupil-memory drawer."""

    def __init__(
        self,
        parent: tk.Misc,
        *,
        lessons: Iterable[Lesson] = (),
        callbacks: LessonsCallbacks | None = None,
    ) -> None:
        """Build the panel."""
        super().__init__(parent)
        self._callbacks = callbacks or LessonsCallbacks()
        self._lessons: list[Lesson] = list(lessons)
        self._build_widgets()
        self._populate_listbox()

    # --- public API ---------------------------------------------------------

    @property
    def lessons(self) -> tuple[Lesson, ...]:
        """Return the currently displayed lessons."""
        return tuple(self._lessons)

    def set_lessons(self, lessons: Iterable[Lesson]) -> None:
        """Replace the lesson list and refresh the listbox."""
        self._lessons = list(lessons)
        self._populate_listbox()

    def selected_lesson(self) -> Lesson | None:
        """Return the currently highlighted lesson, or ``None``."""
        idx: tuple[int, ...] = self._listbox.curselection()  # type: ignore[no-untyped-call]
        if not idx:
            return None
        return self._lessons[int(idx[0])]

    def select(self, index: int) -> None:
        """Programmatically highlight the lesson at ``index`` and fire on_select."""
        if not (0 <= index < len(self._lessons)):
            raise IndexError(index)
        self._listbox.selection_clear(0, tk.END)
        self._listbox.selection_set(index)
        self._listbox.activate(index)
        self._fire_on_select(self._lessons[index])

    def update_pupil_memory(self, strengths: Iterable[PupilStrength]) -> None:
        """Refresh the lower drawer with the pupil's concept scores."""
        self._memory_text.configure(state=tk.NORMAL)
        self._memory_text.delete("1.0", tk.END)
        for strength in sorted(strengths, key=lambda s: -s.score):
            line = f"{strength.concept:20s} {strength.score * 100:5.1f}%\n"
            self._memory_text.insert(tk.END, line)
        self._memory_text.configure(state=tk.DISABLED)

    # --- private ------------------------------------------------------------

    def _build_widgets(self) -> None:
        title = ttk.Label(self, text="Lessons", font=("TkDefaultFont", 10, "bold"))
        title.pack(side=tk.TOP, anchor=tk.W, padx=4, pady=2)
        list_frame = ttk.Frame(self)
        list_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=4)
        self._listbox = tk.Listbox(list_frame, activestyle="dotbox", exportselection=False)
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self._listbox.yview)
        self._listbox.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self._listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self._listbox.bind("<<ListboxSelect>>", self._on_listbox_select)

        memory_title = ttk.Label(self, text="Your progress", font=("TkDefaultFont", 10, "bold"))
        memory_title.pack(side=tk.TOP, anchor=tk.W, padx=4, pady=(8, 2))
        self._memory_text = tk.Text(self, height=6, width=28, state=tk.DISABLED)
        self._memory_text.pack(side=tk.TOP, fill=tk.X, padx=4, pady=2)

    def _populate_listbox(self) -> None:
        self._listbox.delete(0, tk.END)
        for lesson in self._lessons:
            self._listbox.insert(tk.END, f"{lesson.id}  {lesson.title}")

    def _on_listbox_select(self, _event: tk.Event[tk.Misc]) -> None:
        lesson = self.selected_lesson()
        if lesson is not None:
            self._fire_on_select(lesson)

    def _fire_on_select(self, lesson: Lesson) -> None:
        if self._callbacks.on_select is not None:
            self._callbacks.on_select(lesson)
