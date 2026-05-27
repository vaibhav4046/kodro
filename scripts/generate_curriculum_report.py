"""Generate a printable curriculum-coverage PDF (P6 polish task).

Output: one page per key stage. Each page lists every bundled lesson
with its DfE attainment-target citation, computational-thinking
concepts, and the success-criteria checks the grader applies.

Usage::

    python scripts/generate_curriculum_report.py [--output curriculum-coverage.pdf]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate the curriculum-coverage PDF.")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "docs" / "assets" / "curriculum-coverage.pdf",
    )
    args = parser.parse_args(argv)
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import (
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError:
        sys.stderr.write("reportlab is required; install with `pip install reportlab`\n")
        return 1

    from robolearn.lessons.schema import load_library

    args.output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(args.output), pagesize=A4, title="RoboLearn curriculum coverage")
    styles = getSampleStyleSheet()
    story: list[object] = [
        Paragraph("<b>RoboLearn — Curriculum coverage report</b>", styles["Title"]),
        Spacer(1, 12),
        Paragraph(
            "Each bundled lesson is mapped to a Department for Education attainment "
            "target. Generated automatically by "
            "<font face='Courier'>scripts/generate_curriculum_report.py</font>.",
            styles["Normal"],
        ),
        Spacer(1, 18),
    ]
    lessons = load_library()
    for key_stage in ("KS3", "KS4"):
        ks_lessons = [lsn for lsn in lessons if lsn.key_stage == key_stage]
        story.append(Paragraph(f"<b>{key_stage}</b>", styles["Heading2"]))
        table_data: list[list[str]] = [["Lesson", "Concepts", "Success criteria", "DfE reference"]]
        for lesson in ks_lessons:
            concepts = ", ".join(lesson.ct_concepts)
            criteria_summary = _format_criteria(lesson)
            refs = "; ".join(lesson.curriculum_refs) or "—"
            table_data.append([f"{lesson.id}\n{lesson.title}", concepts, criteria_summary, refs])
        tbl = Table(table_data, colWidths=[110, 80, 130, 200])
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
        story.append(Spacer(1, 18))
    doc.build(story)
    sys.stdout.write(f"Wrote {args.output}\n")
    return 0


def _format_criteria(lesson: object) -> str:
    crits: list[str] = []
    for crit in getattr(lesson, "success_criteria", []):
        for attr, value in vars(crit).items():
            if value is None:
                continue
            crits.append(f"{attr}={value}")
    return ", ".join(crits) or "—"


if __name__ == "__main__":
    raise SystemExit(main())
