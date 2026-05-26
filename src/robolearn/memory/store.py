"""SQLite schema and CRUD helpers for pupils, submissions and concept-strength.

The store is the only durable state the application keeps. It lives in a
single SQLite file under ``~/.robolearn/`` so a teacher can back it up
with a plain file copy. Section 7.1 of the spec fixes the schema; this
module mirrors it verbatim and adds a single extra column
(``concept_strength.score``) so the EMA model in
:mod:`robolearn.memory.pupil_model` can persist the rolling score
alongside the raw success / failure counts.
"""

from __future__ import annotations

import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

#: Default path for the SQLite file. Overridable by callers (tests use
#: ``tmp_path``; the UI shell reads its preferred location from the
#: TOML config in Section 11 of the spec).
DEFAULT_DB_PATH: Path = Path.home() / ".robolearn" / "pupil.db"

#: Schema applied on every :class:`Store` initialisation. ``CREATE TABLE IF
#: NOT EXISTS`` keeps it idempotent.
SCHEMA_SQL: str = """
CREATE TABLE IF NOT EXISTS pupils (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pupil_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    code TEXT,
    trace_json TEXT,
    passed INTEGER NOT NULL,
    score INTEGER,
    reasons_json TEXT,
    duration_ms INTEGER,
    battery_used REAL,
    collisions INTEGER,
    ts INTEGER NOT NULL,
    FOREIGN KEY (pupil_id) REFERENCES pupils(id)
);

CREATE TABLE IF NOT EXISTS concept_strength (
    pupil_id TEXT NOT NULL,
    concept TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0.0,
    successes INTEGER NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER,
    PRIMARY KEY (pupil_id, concept)
);
"""


@dataclass(frozen=True, slots=True)
class Pupil:
    """One row of the ``pupils`` table."""

    id: str
    display_name: str
    created_at: int


@dataclass(frozen=True, slots=True)
class Submission:
    """One row of the ``submissions`` table."""

    id: int
    pupil_id: str
    lesson_id: str
    code: str
    passed: bool
    score: int
    reasons: list[str]
    duration_ms: int
    battery_used: float
    collisions: int
    ts: int


@dataclass(frozen=True, slots=True)
class ConceptStrength:
    """One row of the ``concept_strength`` table."""

    pupil_id: str
    concept: str
    score: float
    successes: int
    failures: int
    last_seen: int | None


class Store:
    """SQLite-backed persistence layer."""

    def __init__(self, db_path: Path | str | None = None) -> None:
        """Open (or create) the SQLite file at ``db_path``.

        Pass ``db_path=":memory:"`` (or a :class:`pathlib.Path` of that
        string) to get an ephemeral in-memory database for tests.
        """
        if db_path is None:
            path: Path | str = DEFAULT_DB_PATH
        else:
            path = db_path
        if isinstance(path, Path) and str(path) != ":memory:":
            path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA_SQL)

    # --- lifecycle ----------------------------------------------------------

    def close(self) -> None:
        """Close the underlying SQLite connection."""
        self._conn.close()

    def __enter__(self) -> Store:
        """Return ``self`` so the store can be used as a context manager."""
        return self

    def __exit__(self, *_: object) -> None:
        """Close the SQLite connection on context-manager exit."""
        self.close()

    # --- pupils -------------------------------------------------------------

    def create_pupil(self, display_name: str = "") -> Pupil:
        """Insert a new pupil and return the resulting :class:`Pupil`."""
        pid = str(uuid.uuid4())
        now = _now_ms()
        self._conn.execute(
            "INSERT INTO pupils (id, display_name, created_at) VALUES (?, ?, ?)",
            (pid, display_name, now),
        )
        return Pupil(id=pid, display_name=display_name, created_at=now)

    def get_pupil(self, pupil_id: str) -> Pupil | None:
        """Return the pupil with the given id, or ``None`` if not found."""
        row = self._conn.execute(
            "SELECT id, display_name, created_at FROM pupils WHERE id = ?",
            (pupil_id,),
        ).fetchone()
        if row is None:
            return None
        return Pupil(
            id=row["id"],
            display_name=row["display_name"] or "",
            created_at=row["created_at"],
        )

    def list_pupils(self) -> list[Pupil]:
        """Return every pupil ordered by creation time (oldest first)."""
        rows = self._conn.execute(
            "SELECT id, display_name, created_at FROM pupils ORDER BY created_at ASC"
        ).fetchall()
        return [
            Pupil(
                id=r["id"],
                display_name=r["display_name"] or "",
                created_at=r["created_at"],
            )
            for r in rows
        ]

    # --- submissions --------------------------------------------------------

    def record_submission(
        self,
        *,
        pupil_id: str,
        lesson_id: str,
        code: str,
        passed: bool,
        score: int,
        reasons: list[str],
        trace_json: str = "{}",
        duration_ms: int = 0,
        battery_used: float = 0.0,
        collisions: int = 0,
    ) -> Submission:
        """Insert a submission row and return the populated :class:`Submission`."""
        now = _now_ms()
        cur = self._conn.execute(
            """
            INSERT INTO submissions
              (pupil_id, lesson_id, code, trace_json, passed, score,
               reasons_json, duration_ms, battery_used, collisions, ts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pupil_id,
                lesson_id,
                code,
                trace_json,
                int(passed),
                score,
                json.dumps(reasons),
                duration_ms,
                battery_used,
                collisions,
                now,
            ),
        )
        sid = int(cur.lastrowid or 0)
        return Submission(
            id=sid,
            pupil_id=pupil_id,
            lesson_id=lesson_id,
            code=code,
            passed=passed,
            score=score,
            reasons=list(reasons),
            duration_ms=duration_ms,
            battery_used=battery_used,
            collisions=collisions,
            ts=now,
        )

    def list_submissions(
        self,
        *,
        pupil_id: str | None = None,
        lesson_id: str | None = None,
    ) -> list[Submission]:
        """Return submissions matching the given filters (oldest first)."""
        sql = "SELECT * FROM submissions WHERE 1=1"
        params: list[Any] = []
        if pupil_id is not None:
            sql += " AND pupil_id = ?"
            params.append(pupil_id)
        if lesson_id is not None:
            sql += " AND lesson_id = ?"
            params.append(lesson_id)
        sql += " ORDER BY ts ASC"
        rows = self._conn.execute(sql, params).fetchall()
        return [_row_to_submission(r) for r in rows]

    # --- concept strength ---------------------------------------------------

    def update_concept_strength(
        self,
        pupil_id: str,
        concept: str,
        *,
        passed: bool,
        alpha: float = 0.3,
    ) -> ConceptStrength:
        """Apply one EMA step (alpha defaults to 0.3) for one concept.

        The success/failure counters are incremented in lockstep so the
        teacher dashboard can show raw totals next to the rolling score.
        """
        sample = 1.0 if passed else 0.0
        now = _now_ms()
        row = self._conn.execute(
            "SELECT score, successes, failures FROM concept_strength "
            "WHERE pupil_id = ? AND concept = ?",
            (pupil_id, concept),
        ).fetchone()
        if row is None:
            score = sample
            successes = 1 if passed else 0
            failures = 0 if passed else 1
            self._conn.execute(
                """
                INSERT INTO concept_strength
                  (pupil_id, concept, score, successes, failures, last_seen)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (pupil_id, concept, score, successes, failures, now),
            )
        else:
            score = alpha * sample + (1.0 - alpha) * float(row["score"])
            successes = int(row["successes"]) + (1 if passed else 0)
            failures = int(row["failures"]) + (0 if passed else 1)
            self._conn.execute(
                """
                UPDATE concept_strength
                   SET score = ?, successes = ?, failures = ?, last_seen = ?
                 WHERE pupil_id = ? AND concept = ?
                """,
                (score, successes, failures, now, pupil_id, concept),
            )
        return ConceptStrength(
            pupil_id=pupil_id,
            concept=concept,
            score=score,
            successes=successes,
            failures=failures,
            last_seen=now,
        )

    def get_concept_strength(self, pupil_id: str) -> list[ConceptStrength]:
        """Return every concept-strength row for the given pupil."""
        rows = self._conn.execute(
            "SELECT * FROM concept_strength WHERE pupil_id = ? ORDER BY concept ASC",
            (pupil_id,),
        ).fetchall()
        return [
            ConceptStrength(
                pupil_id=r["pupil_id"],
                concept=r["concept"],
                score=float(r["score"]),
                successes=int(r["successes"]),
                failures=int(r["failures"]),
                last_seen=r["last_seen"],
            )
            for r in rows
        ]


# --- module-level helpers --------------------------------------------------


def _now_ms() -> int:
    return int(time.time() * 1000)


def _row_to_submission(row: sqlite3.Row) -> Submission:
    return Submission(
        id=int(row["id"]),
        pupil_id=row["pupil_id"],
        lesson_id=row["lesson_id"],
        code=row["code"] or "",
        passed=bool(row["passed"]),
        score=int(row["score"]) if row["score"] is not None else 0,
        reasons=json.loads(row["reasons_json"]) if row["reasons_json"] else [],
        duration_ms=int(row["duration_ms"]) if row["duration_ms"] is not None else 0,
        battery_used=float(row["battery_used"]) if row["battery_used"] is not None else 0.0,
        collisions=int(row["collisions"]) if row["collisions"] is not None else 0,
        ts=int(row["ts"]),
    )
