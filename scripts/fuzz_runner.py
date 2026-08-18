"""Python half of the cross-engine grading fuzz (scripts/qa_fuzz.mjs).

Reads a JSON file of {lesson_id, source} cases, runs each through the real
desktop pipeline (sandboxed executor, tracer, grader) exactly as
``BridgeAPI.submit_attempt`` does, and writes the graded verdicts back as
JSON. The Node harness generates the programs, grades the same cases through
the shipped browser grader, and asserts the two engines agree.

This is a dev harness, not product code. It exists because unit tests pin the
behaviours someone thought of; the fuzz compares the two engines on programs
nobody wrote deliberately, which is where silent divergence hides.

Usage: python scripts/fuzz_runner.py <cases.json> <out.json>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from kodro.engine.rover import Rover  # noqa: E402
from kodro.engine.terrain import Terrain  # noqa: E402
from kodro.engine.world import ArenaBounds, Obstacle, Sample, World  # noqa: E402
from kodro.lessons.grader import grade  # noqa: E402
from kodro.lessons.schema import load_library  # noqa: E402
from kodro.runtime.binding import set_active_rover, set_active_world  # noqa: E402
from kodro.runtime.executor import execute  # noqa: E402
from kodro.runtime.tracer import (  # noqa: E402
    RoverSnapshot,
    Tracer,
    set_active,
    set_state_provider,
)


def _world_from(lesson) -> World:  # type: ignore[no-untyped-def]
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
        distance_travelled_m=s.distance_travelled_m,
    )


def main() -> int:
    cases_path, out_path = sys.argv[1], sys.argv[2]
    cases = json.loads(Path(cases_path).read_text(encoding="utf-8"))["cases"]
    lessons = {lesson.id: lesson for lesson in load_library()}

    results = []
    for case in cases:
        lesson = lessons[case["lesson_id"]]
        world = _world_from(lesson)
        rover = Rover(world)
        tracer = Tracer()
        set_active(tracer)
        set_active_rover(rover)
        set_active_world(world)
        set_state_provider(lambda r=rover: _snapshot(r))
        exec_result = execute(case["source"], timeout_s=5.0)
        if not exec_result.success:
            # Mirror BridgeAPI.submit_attempt's error path: graded, score 0,
            # "<kind>: <message>" as the single reason. The JS grader does the
            # same, so error programs are compared on kind, not full text
            # (messages legitimately differ in wording between engines).
            results.append(
                {
                    "passed": False,
                    "score": 0,
                    "reasons": [f"{exec_result.error_kind}: {exec_result.error_message}"],
                    "errorKind": exec_result.error_kind,
                }
            )
            continue
        graded = grade(lesson, tracer, case["source"])
        results.append(
            {
                "passed": graded.passed,
                "score": graded.score,
                "reasons": sorted(graded.reasons),
                "errorKind": None,
            }
        )

    Path(out_path).write_text(json.dumps({"results": results}), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
