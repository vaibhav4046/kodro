"""Teacher dashboard: class heatmap, drill-down, CSV export.

Reached via the ``Ctrl+Shift+T`` shortcut wired up in
:mod:`robolearn.ui.main_window`. The dashboard is a :class:`tk.Toplevel`
window with three areas:

* a class-wide concept-strength heatmap (text grid),
* a per-pupil drill-down (submissions list + score timeline), and
* an "Export CSV" button that dumps the heatmap as comma-separated
  values for the teacher's spreadsheet.

PDF export is deferred to a future release (see ``HUMAN_TODO.md``).

Implemented in Task 17 of the build plan.
"""

from __future__ import annotations

import csv
import io
import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, ttk

from robolearn.memory.pupil_model import class_heatmap, get_strengths
from robolearn.memory.store import Pupil, Store


@dataclass(slots=True)
class _Widgets:
    """References to the widgets created by :class:`TeacherDashboard`."""

    heatmap_text: tk.Text
    drill_text: tk.Text
    pupil_listbox: tk.Listbox
    export_button: ttk.Button


class TeacherDashboard:
    """Toplevel dashboard surfaced to the teacher.

    Construct with a Tk parent and a :class:`Store`. Refresh the heatmap
    and drill-down on demand via :meth:`refresh`.
    """

    def __init__(
        self,
        parent: tk.Misc,
        store: Store,
        *,
        export_path_chooser: Callable[[], Path | None] | None = None,
    ) -> None:
        """Build the dashboard."""
        self._store = store
        self._export_path_chooser = export_path_chooser or _default_export_chooser
        self._window = tk.Toplevel(parent)
        self._window.title("Teacher dashboard")
        self._window.transient(parent.winfo_toplevel())
        self._widgets = self._build_widgets()
        self.refresh()

    # --- public API ---------------------------------------------------------

    def refresh(self) -> None:
        """Reload pupils, heatmap and drill-down from the store."""
        self._refresh_heatmap()
        self._refresh_pupil_list()
        self._refresh_drill_down()

    def export_csv(self, path: Path | str) -> Path:
        """Write the class heatmap to ``path`` as CSV; return the path."""
        out = Path(path)
        heatmap = class_heatmap(self._store)
        pupils = {p.id: p for p in self._store.list_pupils()}
        concepts = sorted({c for scores in heatmap.values() for c in scores})
        rows = []
        rows.append(["pupil_id", "display_name", *concepts])
        for pupil_id, scores in heatmap.items():
            pupil = pupils.get(pupil_id)
            display = pupil.display_name if pupil else ""
            row = [pupil_id, display, *[f"{scores.get(c, 0.0):.3f}" for c in concepts]]
            rows.append(row)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh)
            writer.writerows(rows)
        return out

    def heatmap_text_dump(self) -> str:
        """Return the heatmap text widget contents (used by tests)."""
        return self._widgets.heatmap_text.get("1.0", "end-1c")

    def drill_text_dump(self) -> str:
        """Return the drill-down text widget contents (used by tests)."""
        return self._widgets.drill_text.get("1.0", "end-1c")

    def select_pupil(self, index: int) -> None:
        """Highlight the pupil at ``index`` and refresh the drill-down."""
        self._widgets.pupil_listbox.selection_clear(0, tk.END)
        self._widgets.pupil_listbox.selection_set(index)
        self._refresh_drill_down()

    def destroy(self) -> None:
        """Close the dashboard."""
        self._window.destroy()

    # --- private ------------------------------------------------------------

    def _build_widgets(self) -> _Widgets:
        outer = ttk.Frame(self._window, padding=8)
        outer.pack(fill=tk.BOTH, expand=True)

        ttk.Label(outer, text="Class heatmap (per concept)").pack(anchor=tk.W, pady=(0, 2))
        heatmap_text = tk.Text(outer, height=10, width=70, font=("TkFixedFont", 10))
        heatmap_text.pack(fill=tk.BOTH, padx=2, pady=2)

        ttk.Label(outer, text="Pupil drill-down").pack(anchor=tk.W, pady=(8, 2))
        drill_frame = ttk.Frame(outer)
        drill_frame.pack(fill=tk.BOTH, padx=2, pady=2, expand=True)
        pupil_listbox = tk.Listbox(drill_frame, width=20, exportselection=False)
        pupil_listbox.pack(side=tk.LEFT, fill=tk.Y)
        pupil_listbox.bind("<<ListboxSelect>>", lambda _e: self._refresh_drill_down())
        drill_text = tk.Text(drill_frame, height=10, width=50, font=("TkFixedFont", 10))
        drill_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(6, 0))

        export_button = ttk.Button(outer, text="Export CSV…", command=self._on_export_clicked)
        export_button.pack(anchor=tk.E, pady=(6, 0))
        return _Widgets(
            heatmap_text=heatmap_text,
            drill_text=drill_text,
            pupil_listbox=pupil_listbox,
            export_button=export_button,
        )

    def _refresh_heatmap(self) -> None:
        heatmap = class_heatmap(self._store)
        pupils = {p.id: p for p in self._store.list_pupils()}
        concepts = sorted({c for scores in heatmap.values() for c in scores})
        buf = io.StringIO()
        if not heatmap or not concepts:
            buf.write("(no pupil submissions yet)\n")
        else:
            buf.write(f"{'pupil':<18s}")
            for concept in concepts:
                buf.write(f"{concept:>14s}")
            buf.write("\n")
            for pupil_id, scores in heatmap.items():
                pupil = pupils.get(pupil_id)
                name = (pupil.display_name if pupil else "")[:16] or pupil_id[:8]
                buf.write(f"{name:<18s}")
                for concept in concepts:
                    buf.write(f"{scores.get(concept, 0.0) * 100:>13.1f}%")
                buf.write("\n")
        self._widgets.heatmap_text.configure(state=tk.NORMAL)
        self._widgets.heatmap_text.delete("1.0", tk.END)
        self._widgets.heatmap_text.insert("1.0", buf.getvalue())
        self._widgets.heatmap_text.configure(state=tk.DISABLED)

    def _refresh_pupil_list(self) -> None:
        self._widgets.pupil_listbox.delete(0, tk.END)
        for pupil in self._store.list_pupils():
            label = pupil.display_name or pupil.id[:8]
            self._widgets.pupil_listbox.insert(tk.END, label)

    def _refresh_drill_down(self) -> None:
        selected: tuple[int, ...] = self._widgets.pupil_listbox.curselection()  # type: ignore[no-untyped-call]
        pupils = self._store.list_pupils()
        if not selected or not pupils:
            text = "Select a pupil to see their submission history."
        else:
            pupil: Pupil = pupils[int(selected[0])]
            submissions = self._store.list_submissions(pupil_id=pupil.id)
            strengths = get_strengths(self._store, pupil.id)
            lines = [
                f"Pupil: {pupil.display_name or pupil.id}",
                f"Submissions: {len(submissions)}  "
                f"Passed: {sum(1 for s in submissions if s.passed)}",
                "Concept strengths:",
                *[
                    f"  {s.concept:<20s} {s.score * 100:5.1f}%  "
                    f"({s.successes} pass / {s.failures} fail)"
                    for s in sorted(strengths, key=lambda s: -s.score)
                ],
                "Recent submissions:",
                *[
                    f"  {s.lesson_id:<20s} {'PASS' if s.passed else 'FAIL'}  score={s.score}"
                    for s in submissions[-10:]
                ],
            ]
            text = "\n".join(lines)
        self._widgets.drill_text.configure(state=tk.NORMAL)
        self._widgets.drill_text.delete("1.0", tk.END)
        self._widgets.drill_text.insert("1.0", text)
        self._widgets.drill_text.configure(state=tk.DISABLED)

    def _on_export_clicked(self) -> None:
        path = self._export_path_chooser()
        if path is None:
            return
        self.export_csv(path)


def _default_export_chooser() -> Path | None:  # pragma: no cover -- GUI
    chosen = filedialog.asksaveasfilename(
        defaultextension=".csv",
        filetypes=[("CSV", "*.csv"), ("All files", "*.*")],
    )
    if not chosen:
        return None
    return Path(chosen)
