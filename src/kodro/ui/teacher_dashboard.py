"""Teacher dashboard: class heatmap, drill-down, CSV export.

Reached via the ``Ctrl+Shift+T`` shortcut wired up in
:mod:`kodro.ui.main_window`. The dashboard is a :class:`tk.Toplevel`
window with three areas:

* a class-wide concept-strength heatmap (text grid),
* a per-pupil drill-down (submissions list + score timeline), and
* "Export CSV" / "Export PDF" buttons that dump the heatmap for the
  teacher's spreadsheet or reporting (PDF export needs the optional
  ``reportlab`` dependency and shows an error dialog without it).

Implemented in Task 17 of the build plan.
"""

from __future__ import annotations

import csv
import io
import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from kodro.memory.pupil_model import class_heatmap, get_strengths
from kodro.memory.store import Pupil, Store


@dataclass(slots=True)
class _Widgets:
    """References to the widgets created by :class:`TeacherDashboard`."""

    heatmap_text: tk.Text
    drill_text: tk.Text
    pupil_listbox: tk.Listbox
    export_button: ttk.Button
    pdf_button: ttk.Button


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
        pdf_path_chooser: Callable[[], Path | None] | None = None,
    ) -> None:
        """Build the dashboard."""
        self._store = store
        self._export_path_chooser = export_path_chooser or _default_export_chooser
        self._pdf_path_chooser = pdf_path_chooser or _default_pdf_chooser
        self._window = tk.Toplevel(parent)
        self._window.title("Teacher dashboard")
        self._window.transient(parent.winfo_toplevel())
        self._widgets = self._build_widgets()
        self.refresh()
        from kodro.ui._lift import bring_to_front

        bring_to_front(self._window)

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

    def export_pdf(self, path: Path | str) -> Path | None:
        """Write the class heatmap to ``path`` as PDF.

        Return the path, or None if reportlab is missing.
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except ImportError:
            messagebox.showerror(
                "Missing dependency",
                "reportlab is required to export PDF. Install it with `pip install reportlab`",
                parent=self._window,
            )
            return None

        out = Path(path)
        heatmap = class_heatmap(self._store)
        pupils = {p.id: p for p in self._store.list_pupils()}
        concepts = sorted({c for scores in heatmap.values() for c in scores})

        doc = SimpleDocTemplate(str(out), pagesize=A4, title="Kodro Teacher Dashboard")
        styles = getSampleStyleSheet()
        story = [
            Paragraph("<b>Kodro — Class Heatmap</b>", styles["Title"]),
            Spacer(1, 12),
        ]

        table_data = [["Pupil", *concepts]]
        for pupil_id, scores in heatmap.items():
            pupil = pupils.get(pupil_id)
            display = pupil.display_name if pupil else pupil_id[:8]
            row = [display, *[f"{scores.get(c, 0.0) * 100:.1f}%" for c in concepts]]
            table_data.append(row)

        if not concepts:
            story.append(Paragraph("No pupil submissions yet.", styles["Normal"]))
        else:
            tbl = Table(table_data)
            tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#161b22")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
                        ("FONT", (0, 1), (-1, -1), "Helvetica", 8),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                    ]
                )
            )
            story.append(tbl)

        out.parent.mkdir(parents=True, exist_ok=True)
        doc.build(story)
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

        button_frame = ttk.Frame(outer)
        button_frame.pack(anchor=tk.E, pady=(6, 0))

        export_button = ttk.Button(
            button_frame, text="Export CSV…", command=self._on_export_clicked
        )
        export_button.pack(side=tk.LEFT, padx=(0, 4))

        pdf_button = ttk.Button(
            button_frame, text="Export PDF…", command=self._on_export_pdf_clicked
        )
        pdf_button.pack(side=tk.LEFT)

        return _Widgets(
            heatmap_text=heatmap_text,
            drill_text=drill_text,
            pupil_listbox=pupil_listbox,
            export_button=export_button,
            pdf_button=pdf_button,
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

    # Both handlers used to call straight through, so a write that could not
    # land (the file open in Excel, a read-only stick, a full disk) raised into
    # the Tk callback and vanished: the teacher saw no error, no confirmation,
    # and no file. Report both outcomes.
    def _on_export_clicked(self) -> None:
        path = self._export_path_chooser()
        if path is None:
            return
        try:
            out = self.export_csv(path)
        except OSError as exc:
            messagebox.showerror(
                "Could not save the CSV",
                f"{path}\n\n{exc}\n\nIf the file is open in another program, "
                "close it and try again.",
                parent=self._window,
            )
            return
        messagebox.showinfo("Exported", f"Class heatmap written to:\n{out}", parent=self._window)

    def _on_export_pdf_clicked(self) -> None:
        path = self._pdf_path_chooser()
        if path is None:
            return
        try:
            out = self.export_pdf(path)
        except OSError as exc:
            messagebox.showerror(
                "Could not save the PDF",
                f"{path}\n\n{exc}\n\nIf the file is open in another program, "
                "close it and try again.",
                parent=self._window,
            )
            return
        # export_pdf returns None when reportlab is absent, and has already
        # explained that itself, so there is nothing to confirm.
        if out is not None:
            messagebox.showinfo("Exported", f"Class report written to:\n{out}", parent=self._window)


def _default_export_chooser() -> Path | None:  # pragma: no cover -- GUI
    chosen = filedialog.asksaveasfilename(
        defaultextension=".csv",
        filetypes=[("CSV", "*.csv"), ("All files", "*.*")],
    )
    if not chosen:
        return None
    return Path(chosen)


def _default_pdf_chooser() -> Path | None:  # pragma: no cover -- GUI
    chosen = filedialog.asksaveasfilename(
        defaultextension=".pdf",
        filetypes=[("PDF", "*.pdf"), ("All files", "*.*")],
    )
    if not chosen:
        return None
    return Path(chosen)
