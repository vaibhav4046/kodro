"""Achievements + streak counter (P4 polish task).

Each :class:`AchievementDef` declares a predicate over a
:class:`PupilContext` (the per-pupil submission state). The engine
walks the catalogue after every submission and fires any newly-met
achievements. Unlocks persist in the SQLite store via a small
``unlocked_achievements`` table.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from typing import Literal

from robolearn.lessons.schema import Lesson
from robolearn.memory.store import Store, Submission


@dataclass(frozen=True, slots=True)
class PupilContext:
    """Inputs every achievement predicate receives."""

    pupil_id: str
    lesson: Lesson
    submission: Submission
    history: tuple[Submission, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class AchievementDef:
    """One achievement definition."""

    id: str
    title: str
    description: str
    icon: str
    predicate: Callable[[PupilContext], bool]


@dataclass(frozen=True, slots=True)
class Unlock:
    """A unique achievement-unlock event."""

    pupil_id: str
    achievement_id: str
    unlocked_at_ms: int


SCHEMA_SQL: str = """
CREATE TABLE IF NOT EXISTS unlocked_achievements (
    pupil_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (pupil_id, achievement_id)
);
"""


def _passed(c: PupilContext) -> bool:
    return c.submission.passed


def _used(c: PupilContext, kw: str) -> bool:
    return kw in (c.submission.code or "")


CATALOGUE: tuple[AchievementDef, ...] = (
    AchievementDef(
        "first_sample",
        "First contact",
        "Collect your first sample.",
        "🥇",
        lambda c: _passed(c) and c.submission.lesson_id == "01_hello_rover",
    ),
    AchievementDef(
        "three_in_a_row",
        "On a roll",
        "Pass three lessons in a row.",
        "🔥",
        lambda c: sum(1 for s in c.history[-3:] if s.passed) == 3 and _passed(c),
    ),
    AchievementDef(
        "no_collisions",
        "Smooth driver",
        "Pass a lesson with zero collisions.",
        "🛡️",
        lambda c: _passed(c) and c.submission.collisions == 0,
    ),
    AchievementDef(
        "low_battery_finish",
        "Energy saver",
        "Pass using less than 50% battery.",
        "🔋",
        lambda c: _passed(c) and c.submission.battery_used < 50.0,
    ),
    AchievementDef(
        "uses_while",
        "Loop master",
        "Pass a lesson using a `while` loop.",
        "🔄",
        lambda c: _passed(c) and _used(c, "while"),
    ),
    AchievementDef(
        "uses_for",
        "Iterator",
        "Pass a lesson using a `for` loop.",
        "🔁",
        lambda c: _passed(c) and _used(c, "for "),
    ),
    AchievementDef(
        "uses_if",
        "Decision maker",
        "Pass a lesson with an `if` statement.",
        "🤔",
        lambda c: _passed(c) and _used(c, "if "),
    ),
    AchievementDef(
        "uses_function",
        "Function fan",
        "Pass using a `def` block.",
        "🧩",
        lambda c: _passed(c) and _used(c, "def "),
    ),
    AchievementDef(
        "uses_recursion",
        "Inception",
        "Pass a lesson with recursion.",
        "🌀",
        lambda c: _passed(c) and c.submission.lesson_id == "09_recursion",
    ),
    AchievementDef(
        "ks4_milestone",
        "Stretch leveller",
        "Pass a KS4 stretch lesson.",
        "🎓",
        lambda c: _passed(c) and c.lesson.key_stage == "KS4",
    ),
    AchievementDef(
        "first_failure",
        "First wobble",
        "Submit a failing attempt (learning is OK).",
        "🌱",
        lambda c: not c.submission.passed,
    ),
    AchievementDef(
        "comeback",
        "Comeback kid",
        "Pass after a previous failure on the same lesson.",
        "💪",
        lambda c: (
            _passed(c)
            and any(not s.passed and s.lesson_id == c.submission.lesson_id for s in c.history)
        ),
    ),
    AchievementDef(
        "perfect_score",
        "Pitch perfect",
        "Score 100 on any lesson.",
        "💯",
        lambda c: c.submission.score >= 100,
    ),
    AchievementDef(
        "five_lessons",
        "Half marathon",
        "Pass at least five distinct lessons.",
        "🏅",
        lambda c: len({s.lesson_id for s in (*c.history, c.submission) if s.passed}) >= 5,
    ),
    AchievementDef(
        "all_terrains",
        "Globetrotter",
        "Pass lessons on all four terrains.",
        "🌍",
        lambda c: (
            _passed(c)
            and c.submission.lesson_id
            in ("01_hello_rover", "05_iteration", "07_sensors", "09_recursion")
        ),
    ),
    AchievementDef(
        "ten_lessons",
        "Curriculum complete",
        "Pass all ten bundled lessons.",
        "🏆",
        lambda c: len({s.lesson_id for s in (*c.history, c.submission) if s.passed}) >= 10,
    ),
)


def ensure_schema(store: Store) -> None:
    """Create the unlocked-achievements table if it doesn't exist."""
    store._conn.executescript(SCHEMA_SQL)  # type: ignore[attr-defined]


def unlocked_ids(store: Store, pupil_id: str) -> set[str]:
    """Return the set of achievement IDs already unlocked for the pupil."""
    ensure_schema(store)
    rows = store._conn.execute(  # type: ignore[attr-defined]
        "SELECT achievement_id FROM unlocked_achievements WHERE pupil_id = ?",
        (pupil_id,),
    ).fetchall()
    return {row["achievement_id"] for row in rows}


def check_and_unlock(
    store: Store,
    ctx: PupilContext,
    catalogue: Iterable[AchievementDef] = CATALOGUE,
) -> list[AchievementDef]:
    """Run every predicate; persist + return the newly-unlocked achievements."""
    ensure_schema(store)
    already = unlocked_ids(store, ctx.pupil_id)
    fresh: list[AchievementDef] = []
    for ach in catalogue:
        if ach.id in already:
            continue
        try:
            if ach.predicate(ctx):
                fresh.append(ach)
        except Exception:
            continue
    now_ms = int(datetime.now(UTC).timestamp() * 1000)
    for ach in fresh:
        store._conn.execute(  # type: ignore[attr-defined,unused-ignore]
            "INSERT OR IGNORE INTO unlocked_achievements VALUES (?, ?, ?)",
            (ctx.pupil_id, ach.id, now_ms),
        )
    return fresh


# ---------------------------------------------------------------------------
# Streak counter
# ---------------------------------------------------------------------------


def daily_streak(store: Store, pupil_id: str, today: date | None = None) -> int:
    """Return the number of consecutive calendar days the pupil passed >=1 lesson.

    ``today`` is overridable for tests.
    """
    now = today or datetime.now(UTC).date()
    days: set[date] = set()
    for sub in store.list_submissions(pupil_id=pupil_id):
        if not sub.passed:
            continue
        d = datetime.fromtimestamp(sub.ts / 1000.0, tz=UTC).date()
        days.add(d)
    streak = 0
    cursor = now
    from datetime import timedelta

    while cursor in days:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


# ---------------------------------------------------------------------------
# Toast widget (lazy import so the module loads without Tk in headless tests)
# ---------------------------------------------------------------------------


ToastPlacement = Literal["top-right", "top-left", "bottom-right"]


def show_toast(
    parent_root: object, achievement: AchievementDef, *, duration_ms: int = 2200
) -> None:
    """Display a non-blocking toast for ``achievement`` in the top-right corner."""
    import tkinter as tk

    top = tk.Toplevel(parent_root)
    top.overrideredirect(True)
    top.configure(bg="#161b22")
    top.attributes("-topmost", True)
    width, height = 320, 70
    sw = top.winfo_screenwidth()
    top.geometry(f"{width}x{height}+{sw - width - 20}+20")
    tk.Label(
        top,
        text=f"{achievement.icon}  {achievement.title}",
        font=("TkDefaultFont", 12, "bold"),
        fg="#58a6ff",
        bg="#161b22",
    ).pack(pady=(8, 0), padx=12, anchor=tk.W)
    tk.Label(
        top,
        text=achievement.description,
        font=("TkDefaultFont", 9),
        fg="#c9d1d9",
        bg="#161b22",
        wraplength=300,
        justify=tk.LEFT,
    ).pack(padx=12, anchor=tk.W)
    top.after(duration_ms, top.destroy)
