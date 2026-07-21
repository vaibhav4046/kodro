"""Assessment validity: a lesson must not pass a program that achieves nothing.

Every lesson is graded against a set of success criteria. Some of those
criteria are *negative* -- ``no_collisions`` and ``max_battery_used`` are both
trivially satisfied by a rover that never moves -- and ``uses_construct`` is
satisfied by the mere presence of an AST node, which a dead ``if False:``
provides without ever executing.

A lesson built only from those criteria therefore awards full marks to a
program that does nothing at all. Four lessons were in exactly that state, and
``01_hello_rover`` returned a score of 100 for an empty program consisting of a
single ``pass``. Reporting a pass for a run that provably did nothing is both an
assessment defect and a truthfulness defect, so it is gated here rather than
left to review.

The guard is behavioural: it runs real do-nothing programs through the real
grader. A lesson author cannot satisfy it by adding a criterion that only looks
positive; the criterion has to actually reject an idle rover.
"""

from __future__ import annotations

import pytest

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World
from robolearn.lessons.grader import grade
from robolearn.lessons.schema import Lesson, load_library
from robolearn.runtime.binding import set_active_rover, set_active_world
from robolearn.runtime.executor import execute
from robolearn.runtime.tracer import (
    RoverSnapshot,
    Tracer,
    set_active,
    set_state_provider,
)

# Programs that accomplish nothing. Each is syntactically valid and several
# contain the exact construct a lesson may require, so they probe the
# "construct is present but never does any work" hole specifically.
IDLE_PROGRAMS = {
    "empty": "pass\n",
    "for-noop": "for _i in range(1):\n    pass\n",
    "if-noop": "if False:\n    pass\n",
    "while-noop": "while False:\n    pass\n",
    "recursion-noop": (
        "def f(n):\n    if n <= 0:\n        return 0\n    return f(n - 1)\n\nf(3)\n"
    ),
}


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


def _run_and_grade(lesson: Lesson, source: str):
    world = _world_from(lesson)
    rover = Rover(world)
    tracer = Tracer()
    set_active(tracer)
    set_active_rover(rover)
    set_active_world(world)
    set_state_provider(lambda: _snapshot(rover))
    result = execute(source, timeout_s=5.0)
    return result, grade(lesson, tracer, source)


@pytest.mark.parametrize("lesson", load_library(), ids=lambda le: le.id)
@pytest.mark.parametrize("name", sorted(IDLE_PROGRAMS))
def test_idle_program_never_passes(lesson: Lesson, name: str) -> None:
    """No lesson may award a pass to a program that does no work."""
    result, graded = _run_and_grade(lesson, IDLE_PROGRAMS[name])
    if not result.success:
        pytest.skip(f"idle program {name!r} did not execute in this lesson's world")
    assert not graded.passed, (
        f"{lesson.id} awards a PASS (score {graded.score}) to the do-nothing "
        f"program {name!r}. Its success_criteria are satisfiable without the "
        f"rover achieving anything. Add a positive criterion the idle rover "
        f"fails, such as min_distance_travelled or samples_collected."
    )


@pytest.mark.parametrize("lesson", load_library(), ids=lambda le: le.id)
def test_lesson_declares_a_positive_criterion(lesson: Lesson) -> None:
    """Structural companion to the behavioural guard above.

    ``no_collisions``, ``max_battery_used`` and ``uses_construct`` are all
    satisfiable by an idle rover, so a lesson assembled purely from them cannot
    distinguish success from inaction. At least one criterion must require the
    rover to actually do something.
    """
    idle_satisfiable = {"no_collisions", "max_battery_used", "uses_construct"}
    keys: set[str] = set()
    for entry in lesson.success_criteria:
        if isinstance(entry, dict):
            keys.update(entry.keys())
        else:  # pragma: no cover - schema keeps these as single-key mappings
            keys.add(str(entry))
    positive = keys - idle_satisfiable
    assert positive, (
        f"{lesson.id} declares only criteria an idle rover satisfies "
        f"({sorted(keys)}). Add one the rover must earn, e.g. "
        f"min_distance_travelled, samples_collected or returns_to_base."
    )
