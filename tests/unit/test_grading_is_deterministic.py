"""The same submission must always receive the same mark.

A pupil's score is the product's most consequential output: it drives progress
records, the class heatmap and a teacher's judgement of what a child understood.
Repeating a run must therefore repeat the mark exactly. The existing suite
checks that grading is *correct* for a given submission; this checks that it is
*stable*, which is a different property and the one that erodes quietly when
shared state leaks between runs, a dict ordering shifts, or a float accumulates
differently.

Every shipped lesson's own worked solution is graded repeatedly and the full
result is compared, not just the score, so a change in reasons or in which
criteria passed also fails here.
"""

from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass

import pytest

from kodro.engine.rover import Rover
from kodro.engine.terrain import Terrain
from kodro.engine.world import ArenaBounds, Obstacle, Sample, World
from kodro.lessons.grader import grade
from kodro.lessons.schema import Lesson, load_library
from kodro.runtime.binding import set_active_rover, set_active_world
from kodro.runtime.executor import execute
from kodro.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider

#: Enough repeats to expose ordering and shared-state effects without making the
#: suite slow. Nondeterminism that needs more than this to appear would not be
#: reproducible enough to diagnose from a failure here anyway.
REPEATS = 25

LESSONS = load_library()


def _world_from(lesson: Lesson) -> World:
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


def _grade_once(lesson: Lesson, source: str) -> str:
    """Run and grade one submission, returned as a canonical JSON string."""
    world = _world_from(lesson)
    rover = Rover(world)
    tracer = Tracer()
    set_active(tracer)
    set_active_rover(rover)
    set_active_world(world)
    set_state_provider(lambda: _snapshot(rover))
    execute(source, timeout_s=10.0)
    result = grade(lesson, tracer, source)
    payload = asdict(result) if is_dataclass(result) else result.__dict__
    return json.dumps(payload, sort_keys=True, default=str)


@pytest.mark.parametrize("lesson", LESSONS, ids=lambda le: le.id)
def test_the_same_submission_always_gets_the_same_mark(lesson: Lesson) -> None:
    solution = getattr(lesson, "solution_code", None) or lesson.starter_code
    marks = {_grade_once(lesson, solution) for _ in range(REPEATS)}
    assert len(marks) == 1, (
        f"{lesson.id} graded its own solution {len(marks)} different ways across "
        f"{REPEATS} identical runs. A pupil resubmitting unchanged work would see "
        f"the mark move. Distinct results: {sorted(marks)[:2]}"
    )


def test_grading_does_not_depend_on_lesson_order() -> None:
    """Grading lesson B must not be affected by having graded lesson A first.

    Tracer, rover and world are module-level actives, so a leak between lessons
    would show up as a mark that depends on what was graded before it.
    """
    first, second = LESSONS[0], LESSONS[-1]
    solo = _grade_once(second, getattr(second, "solution_code", None) or second.starter_code)
    _grade_once(first, getattr(first, "solution_code", None) or first.starter_code)
    after = _grade_once(second, getattr(second, "solution_code", None) or second.starter_code)
    assert solo == after, (
        f"{second.id} graded differently after {first.id} ran first, so state is "
        "leaking between submissions through the module-level actives."
    )


def test_an_empty_program_is_stable_too() -> None:
    """The zero case is the one a stuck pupil submits most often."""
    lesson = LESSONS[0]
    marks = {_grade_once(lesson, "") for _ in range(REPEATS)}
    assert len(marks) == 1, f"an empty submission graded {len(marks)} different ways"
