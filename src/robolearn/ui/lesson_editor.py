"""Pupil / teacher lesson editor.

Opens a modal :class:`tk.Toplevel` that captures the same fields the
bundled lesson YAMLs use, validates them through the
:class:`robolearn.lessons.schema.Lesson` pydantic model, and writes the
result to ``~/.robolearn/custom_lessons/<id>.yaml``. The app loads
those files on next start (and via the "Reload lessons" button) so the
new lesson appears in the LessonsPanel listbox alongside the built-in
ten.

The editor is deliberately compact -- four text inputs and three
dropdowns. Heavyweight lesson designers can edit the YAML by hand;
this dialog is for pupils who want to mock up an idea quickly.
"""

from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from tkinter import messagebox, ttk

import yaml
from pydantic import ValidationError

from robolearn.engine.terrain import Terrain
from robolearn.lessons.schema import Lesson

#: Default directory the editor writes to.
DEFAULT_CUSTOM_DIR: Path = Path.home() / ".robolearn" / "custom_lessons"

_KEY_STAGES: tuple[str, ...] = ("KS3", "KS4")


@dataclass(slots=True)
class _Widgets:
    """Tk variables / widgets the editor instantiates."""

    id_var: tk.StringVar
    title_var: tk.StringVar
    key_stage_var: tk.StringVar
    terrain_var: tk.StringVar
    concepts_var: tk.StringVar
    intro_text: tk.Text
    starter_text: tk.Text
    max_lines_var: tk.StringVar
    base_x_var: tk.StringVar
    base_y_var: tk.StringVar


class LessonEditor:
    """Modal dialog that captures a new custom lesson.

    Construct with a Tk parent and an optional ``on_saved`` callback.
    The callback receives the freshly written :class:`Lesson` instance.
    """

    def __init__(
        self,
        parent: tk.Misc,
        *,
        on_saved: Callable[[Lesson], None] | None = None,
        custom_dir: Path | None = None,
    ) -> None:
        """Build the editor dialog."""
        self._on_saved = on_saved
        self._custom_dir = custom_dir or DEFAULT_CUSTOM_DIR
        self._window = tk.Toplevel(parent)
        self._window.title("New custom lesson")
        self._window.transient(parent.winfo_toplevel())
        self._w = self._build_widgets()
        self._saved_lesson: Lesson | None = None
        from robolearn.ui._lift import bring_to_front

        bring_to_front(self._window)

    # --- public API ---------------------------------------------------------

    @property
    def saved_lesson(self) -> Lesson | None:
        """The lesson written on the last :meth:`save` call, or ``None``."""
        return self._saved_lesson

    def save(self) -> Lesson | None:
        """Validate the form, write the YAML, return the new :class:`Lesson`.

        On validation error, an error message box is shown and ``None``
        is returned without overwriting any file.
        """
        try:
            payload = self._collect_payload()
            lesson = Lesson.model_validate(payload)
        except (ValidationError, ValueError) as exc:
            messagebox.showerror("Invalid lesson", str(exc), parent=self._window)
            return None
        target = self._custom_dir / f"{lesson.id}.yaml"
        target.parent.mkdir(parents=True, exist_ok=True)
        # Saving used to overwrite an existing lesson of the same id without a
        # word, so a teacher who reused an id lost the earlier lesson and had
        # no way to know until they went looking for it. Ask first; a decline
        # leaves the file on disk untouched.
        if target.exists() and not messagebox.askyesno(
            "Replace lesson?",
            f"A custom lesson with the id '{lesson.id}' already exists at\n{target}\n\n"
            "Saving will replace it. Replace?",
            parent=self._window,
        ):
            return None
        target.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")
        self._saved_lesson = lesson
        if self._on_saved is not None:
            self._on_saved(lesson)
        messagebox.showinfo(
            "Saved",
            f"Custom lesson written to:\n{target}",
            parent=self._window,
        )
        return lesson

    def destroy(self) -> None:
        """Close the dialog."""
        self._window.destroy()

    # --- private ------------------------------------------------------------

    def _build_widgets(self) -> _Widgets:
        outer = ttk.Frame(self._window, padding=8)
        outer.pack(fill=tk.BOTH, expand=True)
        id_var = tk.StringVar(master=self._window, value="my_lesson")
        title_var = tk.StringVar(master=self._window, value="My custom lesson")
        key_stage_var = tk.StringVar(master=self._window, value="KS3")
        terrain_var = tk.StringVar(master=self._window, value=Terrain.EARTH.value)
        concepts_var = tk.StringVar(master=self._window, value="sequence")
        max_lines_var = tk.StringVar(master=self._window, value="12")
        base_x_var = tk.StringVar(master=self._window, value="1.0")
        base_y_var = tk.StringVar(master=self._window, value="1.0")

        row = 0
        for label, var in (
            ("Lesson id (snake_case):", id_var),
            ("Title:", title_var),
            ("Computational-thinking concepts (comma-separated):", concepts_var),
            ("Max lines:", max_lines_var),
            ("Base x:", base_x_var),
            ("Base y:", base_y_var),
        ):
            ttk.Label(outer, text=label).grid(row=row, column=0, sticky=tk.W, pady=2)
            ttk.Entry(outer, textvariable=var, width=40).grid(
                row=row, column=1, sticky=tk.EW, pady=2
            )
            row += 1

        ttk.Label(outer, text="Key stage:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Combobox(
            outer, textvariable=key_stage_var, values=_KEY_STAGES, state="readonly", width=10
        ).grid(row=row, column=1, sticky=tk.W, pady=2)
        row += 1

        ttk.Label(outer, text="Terrain:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Combobox(
            outer,
            textvariable=terrain_var,
            values=tuple(t.value for t in Terrain),
            state="readonly",
            width=10,
        ).grid(row=row, column=1, sticky=tk.W, pady=2)
        row += 1

        ttk.Label(outer, text="Intro (one paragraph):").grid(
            row=row, column=0, sticky=tk.NW, pady=2
        )
        intro_text = tk.Text(outer, height=4, width=42, wrap=tk.WORD)
        intro_text.insert("1.0", "Drive forward and beep once.")
        intro_text.grid(row=row, column=1, sticky=tk.EW, pady=2)
        row += 1

        ttk.Label(outer, text="Starter code:").grid(row=row, column=0, sticky=tk.NW, pady=2)
        starter_text = tk.Text(outer, height=8, width=42, wrap=tk.NONE)
        starter_text.insert("1.0", "move_forward(2)\nbeep(1)\n")
        starter_text.grid(row=row, column=1, sticky=tk.EW, pady=2)
        row += 1

        button_bar = ttk.Frame(outer)
        button_bar.grid(row=row, column=0, columnspan=2, sticky=tk.E, pady=(8, 0))
        ttk.Button(button_bar, text="Cancel", command=self.destroy).pack(side=tk.RIGHT, padx=4)
        ttk.Button(button_bar, text="Save", command=self.save).pack(side=tk.RIGHT, padx=4)

        outer.grid_columnconfigure(1, weight=1)
        return _Widgets(
            id_var=id_var,
            title_var=title_var,
            key_stage_var=key_stage_var,
            terrain_var=terrain_var,
            concepts_var=concepts_var,
            intro_text=intro_text,
            starter_text=starter_text,
            max_lines_var=max_lines_var,
            base_x_var=base_x_var,
            base_y_var=base_y_var,
        )

    def _collect_payload(self) -> dict:  # type: ignore[type-arg]
        max_lines = int(self._w.max_lines_var.get().strip() or "0")
        base_x = float(self._w.base_x_var.get().strip() or "0")
        base_y = float(self._w.base_y_var.get().strip() or "0")
        concepts = [c.strip() for c in self._w.concepts_var.get().split(",") if c.strip()]
        return {
            "id": self._w.id_var.get().strip(),
            "title": self._w.title_var.get().strip(),
            "key_stage": self._w.key_stage_var.get(),
            "ct_concepts": concepts,
            "curriculum_refs": ["User-authored lesson"],
            "prereqs": [],
            "terrain": self._w.terrain_var.get(),
            "intro": self._w.intro_text.get("1.0", "end-1c").strip(),
            "starter_code": self._w.starter_text.get("1.0", "end-1c"),
            "allowed_constructs": ["function_call", "for", "while", "if"],
            "max_lines": max_lines,
            "world": {"base": [base_x, base_y]},
        }


def load_custom_lessons(custom_dir: Path | None = None) -> list[Lesson]:
    """Load every ``*.yaml`` in ``custom_dir`` (default: ``~/.robolearn/custom_lessons/``).

    Files that fail validation are silently skipped so a broken
    user-authored lesson never blocks startup. The bundled lesson
    library is unaffected.
    """
    target = custom_dir or DEFAULT_CUSTOM_DIR
    if not target.is_dir():
        return []
    out: list[Lesson] = []
    for path in sorted(target.glob("*.yaml")):
        try:
            payload = yaml.safe_load(path.read_text(encoding="utf-8"))
            out.append(Lesson.model_validate(payload))
        except (yaml.YAMLError, ValidationError, ValueError):
            continue
    return out
