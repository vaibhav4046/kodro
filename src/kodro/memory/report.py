"""Offline pupil progress report (self-contained HTML).

Produces a single, dependency-free HTML document summarising a pupil's
journey -- submissions, scores, per-concept strengths, achievements and
streak -- for the teacher evaluation study (see ``HUMAN_TODO.md``). The
builder is **Tk-free and deterministic** so it unit-tests without a
display; only :func:`export_progress_report` touches the filesystem.

No external assets, no network: the CSS is inlined, so the file opens in
any browser on an air-gapped classroom machine.
"""

from __future__ import annotations

import html
from datetime import UTC, datetime
from pathlib import Path

from kodro.lessons.schema import Lesson
from kodro.memory.achievements import achievement_status, daily_streak
from kodro.memory.pupil_model import get_strengths
from kodro.memory.store import Store

_CSS = """
body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:2rem;color:#1b1f27;background:#fff}
h1{margin:0 0 .2rem}h2{margin-top:1.6rem;border-bottom:2px solid #eaecef;padding-bottom:.2rem}
.muted{color:#6a737d}table{border-collapse:collapse;width:100%;margin-top:.4rem}
th,td{border:1px solid #e1e4e8;padding:.35rem .6rem;text-align:left;font-size:.92rem}
th{background:#f6f8fa}.pass{color:#1a7f37;font-weight:600}.fail{color:#b35900}
.pill{display:inline-block;background:#f6f8fa;border:1px solid #e1e4e8;
border-radius:999px;padding:.1rem .6rem;margin:.1rem}
.locked{color:#9aa0a6}.bar{height:.6rem;background:#3fb950;border-radius:3px;display:inline-block;vertical-align:middle}
"""


def _esc(text: str) -> str:
    return html.escape(text, quote=True)


def build_progress_report_html(
    store: Store,
    pupil_id: str,
    *,
    lessons: list[Lesson] | None = None,
    generated_at: str = "",
) -> str:
    """Return a self-contained HTML progress report for ``pupil_id``.

    ``generated_at`` is injected (not read from the clock) so the output is
    deterministic and testable; :func:`export_progress_report` fills it in.
    """
    pupil = store.get_pupil(pupil_id)
    name = _esc(pupil.display_name) if pupil and pupil.display_name else "Pupil"
    titles = {lsn.id: lsn.title for lsn in (lessons or [])}
    submissions = store.list_submissions(pupil_id=pupil_id)
    passed_ids = {s.lesson_id for s in submissions if s.passed}
    best_score = max((s.score for s in submissions), default=0)
    streak = daily_streak(store, pupil_id)
    strengths = get_strengths(store, pupil_id)
    achievements = achievement_status(store, pupil_id)
    unlocked = [a for a, got in achievements if got]

    parts: list[str] = [
        "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>",
        f"<title>RoboLearn progress — {name}</title><style>{_CSS}</style></head><body>",
        f"<h1>RoboLearn progress report</h1><p class='muted'>Pupil: <strong>{name}</strong>",
    ]
    if generated_at:
        parts.append(f" &middot; generated {_esc(generated_at)}")
    parts.append("</p>")

    # Summary.
    parts.append("<h2>Summary</h2><p>")
    parts.append(f"<span class='pill'>🔥 Streak: {streak} day(s)</span>")
    parts.append(f"<span class='pill'>✓ Lessons passed: {len(passed_ids)}</span>")
    parts.append(f"<span class='pill'>📨 Submissions: {len(submissions)}</span>")
    parts.append(f"<span class='pill'>★ Best score: {best_score}</span>")
    parts.append(f"<span class='pill'>🏆 Achievements: {len(unlocked)}/{len(achievements)}</span>")
    parts.append("</p>")

    # Submissions table.
    parts.append("<h2>Submissions</h2>")
    if submissions:
        parts.append("<table><tr><th>Lesson</th><th>Result</th><th>Score</th>")
        parts.append("<th>Battery used</th><th>Collisions</th></tr>")
        for sub in submissions:
            title = _esc(titles.get(sub.lesson_id, sub.lesson_id))
            verdict = (
                "<span class='pass'>passed</span>"
                if sub.passed
                else "<span class='fail'>not yet</span>"
            )
            parts.append(
                f"<tr><td>{title}</td><td>{verdict}</td><td>{sub.score}</td>"
                f"<td>{sub.battery_used:.1f}%</td><td>{sub.collisions}</td></tr>"
            )
        parts.append("</table>")
    else:
        parts.append("<p class='muted'>No submissions yet.</p>")

    # Concept strengths.
    parts.append("<h2>Concept strengths</h2>")
    if strengths:
        parts.append("<table><tr><th>Concept</th><th>Strength</th><th>✓</th><th>✗</th></tr>")
        for strength in strengths:
            width = max(2, round(strength.score * 120))
            bar = f"<span class='bar' style='width:{width}px'></span> {strength.score:.2f}"
            parts.append(
                f"<tr><td>{_esc(strength.concept)}</td><td>{bar}</td>"
                f"<td>{strength.successes}</td><td>{strength.failures}</td></tr>"
            )
        parts.append("</table>")
    else:
        parts.append("<p class='muted'>No concepts practised yet.</p>")

    # Achievements.
    parts.append("<h2>Achievements</h2><p>")
    for ach, got in achievements:
        cls = "" if got else " class='locked'"
        icon = ach.icon if got else "🔒"
        parts.append(f"<span class='pill'{cls}>{icon} {_esc(ach.title)}</span>")
    parts.append("</p>")

    parts.append("</body></html>")
    return "".join(parts)


def export_progress_report(
    store: Store,
    pupil_id: str,
    path: Path,
    *,
    lessons: list[Lesson] | None = None,
) -> Path:
    """Write the HTML report to ``path`` and return it (creates parents)."""
    stamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    html_text = build_progress_report_html(store, pupil_id, lessons=lessons, generated_at=stamp)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html_text, encoding="utf-8")
    return path
