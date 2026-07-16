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

import contextlib
import json
import sqlite3
import threading
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

CREATE TABLE IF NOT EXISTS hint_stats (
    rule_name TEXT PRIMARY KEY,
    shown INTEGER NOT NULL DEFAULT 0,
    helped INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS pending_hint (
    pupil_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    PRIMARY KEY (pupil_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS scenario_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id TEXT NOT NULL,
    name TEXT,
    environment TEXT,
    seeds INTEGER,
    success_rate REAL,
    mean_collisions REAL,
    mean_battery REAL,
    mean_time INTEGER,
    mean_score INTEGER,
    report_json TEXT,
    ts INTEGER NOT NULL
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


@dataclass(frozen=True, slots=True)
class HintStat:
    """One row of the ``hint_stats`` table: a hint rule's learned record."""

    rule_name: str
    shown: int
    helped: int
    updated_at: int | None


class Store:
    """SQLite-backed persistence layer.

    The packaged desktop app opens the Store on the main thread but the
    pywebview bridge services API calls on a *different* (pooled) thread.
    Sharing one SQLite connection across threads is fragile (it raised
    ``ProgrammingError`` and, with a lock, deadlocked on Windows/macOS), so
    each thread gets its **own** connection to the same file via
    :class:`threading.local`. SQLite handles file-level concurrency; an
    in-memory database (tests only) keeps a single shared connection.
    """

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
        self._path = path
        self._is_memory = str(path) == ":memory:"
        self._closed = False
        self._local = threading.local()
        # Keep ownership of every persistent connection, not only the one in
        # the calling thread.  pywebview can create connections on pooled
        # worker threads; closing only ``self._local.conn`` on the main thread
        # leaked those handles until interpreter shutdown.
        self._connections_lock = threading.Lock()
        self._connections: list[sqlite3.Connection] = []
        # An in-memory DB cannot be reopened per thread (each connection is a
        # separate database), so keep one shared connection for that case.
        if self._is_memory:
            self._memory_conn: sqlite3.Connection | None = self._new_connection()
            self._memory_conn.executescript(SCHEMA_SQL)
        else:
            self._memory_conn = None
            # Apply the schema on a THROWAWAY connection and close it, so no
            # connection lingers on the constructing thread holding a file
            # lock -- a lingering writer made a worker thread's connection hang
            # on Windows/macOS CI. Per-thread connections open lazily after.
            init = self._new_connection(register=False)
            try:
                init.executescript(SCHEMA_SQL)
            finally:
                init.close()

    def _new_connection(self, *, register: bool = True) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # Never block forever on a locked database: wait up to 5s, then error.
        conn.execute("PRAGMA busy_timeout = 5000")
        if register:
            with self._connections_lock:
                self._connections.append(conn)
        return conn

    @property
    def _conn(self) -> sqlite3.Connection:
        """Return this thread's connection (opening one on first use)."""
        if self._closed:
            raise sqlite3.ProgrammingError("Cannot operate on a closed Store.")
        if self._is_memory:
            assert self._memory_conn is not None
            return self._memory_conn
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = self._new_connection()
            self._local.conn = conn
        return conn

    # --- lifecycle ----------------------------------------------------------

    def close(self) -> None:
        """Close every connection owned by this store.

        Connections are thread-local while the store is active, but the store
        owns their lifetime.  Closing from the app's main thread must therefore
        also close handles opened by pywebview worker threads.
        """
        if self._closed:
            return
        self._closed = True
        with self._connections_lock:
            connections, self._connections = self._connections, []
        for conn in connections:
            # Closing is best effort and idempotent.  A worker may already have
            # closed its handle while the app is shutting down.
            with contextlib.suppress(sqlite3.Error):
                conn.close()
        self._memory_conn = None
        self._local.conn = None

    def __del__(self) -> None:
        """Best-effort fallback for callers that omit an explicit close."""
        # Destructors can run during partial construction or interpreter
        # shutdown, when module globals and attributes may already be gone.
        with contextlib.suppress(Exception):
            self.close()

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

    def set_display_name(self, pupil_id: str, display_name: str) -> None:
        """Rename an existing pupil (used by the first-run welcome wizard)."""
        self._conn.execute(
            "UPDATE pupils SET display_name = ? WHERE id = ?",
            (display_name, pupil_id),
        )

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

    # --- scenario validation runs -------------------------------------------

    def save_scenario_run(self, report: dict[str, Any]) -> int:
        """Persist one domain-randomised scenario validation report.

        ``report`` is the object the web validator produces: a scenario
        descriptor, the per-seed runs and an aggregate. The aggregate is
        denormalised into columns for cheap querying while the full report is
        kept as JSON so nothing is lost. Returns the new row id.
        """
        scn = report.get("scenario", {}) or {}
        agg = report.get("aggregate", {}) or {}
        now = int(report.get("ts") or _now_ms())
        cur = self._conn.execute(
            """
            INSERT INTO scenario_runs
              (scenario_id, name, environment, seeds, success_rate,
               mean_collisions, mean_battery, mean_time, mean_score,
               report_json, ts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(scn.get("scenarioId") or "scenario"),
                str(scn.get("name") or ""),
                str(scn.get("environmentPreset") or ""),
                int(agg.get("seeds") or 0),
                float(agg.get("successRate") or 0.0),
                float(agg.get("meanCollisions") or 0.0),
                float(agg.get("meanBattery") or 0.0),
                int(agg.get("meanTimeToGoal") or 0),
                int(agg.get("meanScore") or 0),
                json.dumps(report, separators=(",", ":")),
                now,
            ),
        )
        return int(cur.lastrowid or 0)

    def list_scenario_runs(self, *, limit: int = 50) -> list[dict[str, Any]]:
        """Return saved scenario runs, newest first, as plain dicts."""
        rows = self._conn.execute(
            "SELECT * FROM scenario_runs ORDER BY ts DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
        return [dict(r) for r in rows]

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
        d_success = 1 if passed else 0
        d_failure = 0 if passed else 1
        # Single atomic upsert. The old SELECT-then-INSERT/UPDATE raced two
        # concurrent callers into a UNIQUE-constraint failure. On the first write
        # the row takes the sample verbatim; on conflict it applies the EMA step
        # against the existing score, all in one statement.
        row = self._conn.execute(
            """
            INSERT INTO concept_strength
              (pupil_id, concept, score, successes, failures, last_seen)
            VALUES (:pupil_id, :concept, :sample, :d_success, :d_failure, :now)
            ON CONFLICT(pupil_id, concept) DO UPDATE SET
              score = :alpha * :sample + (1.0 - :alpha) * concept_strength.score,
              successes = concept_strength.successes + :d_success,
              failures = concept_strength.failures + :d_failure,
              last_seen = :now
            RETURNING score, successes, failures, last_seen
            """,
            {
                "pupil_id": pupil_id,
                "concept": concept,
                "sample": sample,
                "d_success": d_success,
                "d_failure": d_failure,
                "now": now,
                "alpha": alpha,
            },
        ).fetchone()
        return ConceptStrength(
            pupil_id=pupil_id,
            concept=concept,
            score=float(row["score"]),
            successes=int(row["successes"]),
            failures=int(row["failures"]),
            last_seen=row["last_seen"],
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

    # --- self-improving hints ----------------------------------------------
    #
    # The app shows a rule-based hint when a submission fails, then watches
    # the pupil's NEXT attempt on that lesson. If they pass, the hint
    # "helped"; if they fail again, it did not. Those outcomes accumulate
    # per rule in ``hint_stats`` so the ranker (memory.hint_learning) can
    # prefer hints that have actually unblocked pupils. ``pending_hint``
    # remembers, per pupil+lesson, which hint is currently awaiting its
    # verdict. Entirely local; no model, no network.

    def set_pending_hint(self, pupil_id: str, lesson_id: str, rule_name: str) -> None:
        """Record that ``rule_name`` was just shown for this pupil+lesson."""
        self._conn.execute(
            """
            INSERT INTO pending_hint (pupil_id, lesson_id, rule_name)
            VALUES (?, ?, ?)
            ON CONFLICT(pupil_id, lesson_id) DO UPDATE SET rule_name = excluded.rule_name
            """,
            (pupil_id, lesson_id, rule_name),
        )

    def resolve_pending_hint(self, pupil_id: str, lesson_id: str, *, passed: bool) -> str | None:
        """Score the hint awaiting a verdict for this pupil+lesson, if any.

        Increments the rule's ``shown`` counter and, when ``passed`` is
        True, its ``helped`` counter, then clears the pending row. Returns
        the resolved rule name, or ``None`` when nothing was pending.
        """
        row = self._conn.execute(
            "SELECT rule_name FROM pending_hint WHERE pupil_id = ? AND lesson_id = ?",
            (pupil_id, lesson_id),
        ).fetchone()
        if row is None:
            return None
        rule_name = str(row["rule_name"])
        now = _now_ms()
        self._conn.execute(
            """
            INSERT INTO hint_stats (rule_name, shown, helped, updated_at)
            VALUES (?, 1, ?, ?)
            ON CONFLICT(rule_name) DO UPDATE SET
                shown = shown + 1,
                helped = helped + ?,
                updated_at = ?
            """,
            (rule_name, 1 if passed else 0, now, 1 if passed else 0, now),
        )
        self._conn.execute(
            "DELETE FROM pending_hint WHERE pupil_id = ? AND lesson_id = ?",
            (pupil_id, lesson_id),
        )
        return rule_name

    def get_hint_stats(self) -> dict[str, HintStat]:
        """Return every learned hint stat keyed by rule name."""
        rows = self._conn.execute(
            "SELECT rule_name, shown, helped, updated_at FROM hint_stats"
        ).fetchall()
        return {
            r["rule_name"]: HintStat(
                rule_name=r["rule_name"],
                shown=int(r["shown"]),
                helped=int(r["helped"]),
                updated_at=r["updated_at"],
            )
            for r in rows
        }


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
