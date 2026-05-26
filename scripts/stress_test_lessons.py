"""End-to-end stress test for every bundled lesson.

Loads each lesson, executes its ``starter_code`` through the sandboxed
runtime, grades the result, and prints a summary table. The intent is
to catch integration bugs that the unit tests miss -- a starter snippet
that the sandbox rejects, a lesson whose ``success_criteria`` is
impossible to satisfy with the supplied starter_code, and so on.

Usage::

    python scripts/stress_test_lessons.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Allow running before ``pip install -e .``
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from robolearn.engine.rover import Rover  # noqa: E402
from robolearn.engine.terrain import Terrain  # noqa: E402
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World  # noqa: E402
from robolearn.lessons.grader import grade  # noqa: E402
from robolearn.lessons.schema import Lesson, load_library  # noqa: E402
from robolearn.runtime.binding import set_active_rover, set_active_world  # noqa: E402
from robolearn.runtime.executor import execute  # noqa: E402
from robolearn.runtime.tracer import (  # noqa: E402
    RoverSnapshot,
    Tracer,
    set_active,
    set_state_provider,
)


def _world_from_lesson(lesson: Lesson) -> World:
    wd = lesson.world
    return World(
        terrain=Terrain(lesson.terrain),
        base=tuple(wd.base),  # type: ignore[arg-type]
        samples=[Sample(s[0], s[1]) for s in wd.samples],
        obstacles=[Obstacle(o.x, o.y, o.r) for o in wd.obstacles],
        bounds=ArenaBounds(width=wd.width, height=wd.height),
    )


def _snapshot(rover: Rover) -> RoverSnapshot:
    s = rover.state
    return RoverSnapshot(
        x=s.x,
        y=s.y,
        heading_deg=s.heading_deg,
        battery_pct=s.battery_pct,
        samples_held=s.samples_held,
        samples_collected=s.samples_collected,
        collisions=s.collisions,
    )


def stress_one(lesson: Lesson) -> dict:  # type: ignore[type-arg]
    """Run ``lesson.starter_code`` and return a row of metrics."""
    world = _world_from_lesson(lesson)
    rover = Rover(world)
    tracer = Tracer()
    set_active(tracer)
    set_active_rover(rover)
    set_active_world(world)
    set_state_provider(lambda: _snapshot(rover))
    started = time.monotonic()
    result = execute(lesson.starter_code, timeout_s=5.0)
    elapsed_ms = int((time.monotonic() - started) * 1000)
    grade_result = grade(lesson, tracer, lesson.starter_code)
    return {
        "id": lesson.id,
        "title": lesson.title,
        "key_stage": lesson.key_stage,
        "terrain": lesson.terrain.value,
        "exec_ok": result.success,
        "exec_kind": result.error_kind,
        "exec_ms": elapsed_ms,
        "graded_pass": grade_result.passed,
        "score": grade_result.score,
        "reasons": grade_result.reasons,
        "events": len(tracer.events()),
    }


def main() -> int:
    lessons = load_library()
    rows = [stress_one(lesson) for lesson in lessons]
    print(f"{'lesson':<22s}{'KS':>4s}{'terrain':>12s}{'exec':>8s}{'events':>8s}{'score':>7s}")
    failures = 0
    for row in rows:
        ok = "OK" if row["exec_ok"] else (row["exec_kind"] or "FAIL")
        print(
            f"{row['id']:<22s}{row['key_stage']:>4s}{row['terrain']:>12s}"
            f"{ok:>8s}{row['events']:>8d}{row['score']:>7d}"
        )
        if not row["exec_ok"]:
            failures += 1
            print(f"    reasons: {row['reasons']}")
    print()
    print(f"Total lessons: {len(rows)}.  Execution failures: {failures}.")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
