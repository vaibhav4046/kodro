"""Every lesson must be solvable, by the method it teaches, in both engines.

A lesson can be wrong in a way no amount of reading it reveals. Its criteria can
contradict its world, its arena can make the taught route impossible, or a fix to
the grader can quietly make yesterday's answer fail. Nothing catches that except
running a real answer through the real marker.

So every lesson ships one worked solution (``solution_code``), and this module is
the gate on it:

* every lesson HAS one, so no lesson can be added without someone proving it can
  be finished;
* the solution passes at 100 out of 100 in the PYTHON engine, which is what the
  desktop app marks with;
* it uses only the constructs the lesson declares, so the answer shown to a stuck
  pupil cannot be one they were never taught.

The browser half of the same guarantee lives in ``scripts/qa_grader.mjs``, which
runs each solution through ``lesson-grader.jsx``. Both must agree, because a
solution that passes in one engine and fails in the other is the divergence this
project spent a release removing.

The solutions are also the product's honesty backstop. They are what a pupil sees
after every hint is exhausted, and a lesson whose own answer does not pass is a
lesson that would leave that pupil staring at a program the app told them was
right and the app then marked wrong.
"""

from __future__ import annotations

import ast

import pytest

from kodro.engine.rover import Rover
from kodro.engine.terrain import Terrain
from kodro.engine.world import ArenaBounds, Obstacle, Sample, World
from kodro.lessons.grader import grade
from kodro.lessons.schema import Lesson, load_library
from kodro.runtime.binding import binding_lock, set_active_rover, set_active_world
from kodro.runtime.executor import execute as run_pupil_code
from kodro.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider

LESSONS: list[Lesson] = list(load_library())
IDS = [lesson.id for lesson in LESSONS]


def _world_for(lesson: Lesson) -> World:
    """Build the lesson's arena exactly as the desktop submit path does.

    Deliberately the same construction as ``web.app._world_from_lesson``: a gate
    that built a subtly different world would prove nothing about the world the
    pupil is actually marked in.
    """
    wd = lesson.world
    return World(
        terrain=Terrain(lesson.terrain),
        base=tuple(wd.base),  # type: ignore[arg-type]
        samples=[Sample(s[0], s[1]) for s in wd.samples],
        obstacles=[Obstacle(o.x, o.y, o.r) for o in wd.obstacles],
        bounds=ArenaBounds(width=wd.width, height=wd.height),
    )


def _snapshot(rover: Rover) -> RoverSnapshot:
    """Capture rover state for tracer events, as ``web.app._snapshot`` does.

    Without a state provider the tracer records events with no ``rover_state``,
    and grader._compute_aggregates derives distance, final position, battery and
    collisions from exactly that field. Every one of them silently reads zero, so
    a perfectly good solution fails on "Travelled 0.0 m". The desktop submit path
    installs this provider; a gate that did not would be testing a rover that
    never reports where it is.
    """
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


@pytest.mark.parametrize("lesson", LESSONS, ids=IDS)
def test_every_lesson_ships_a_worked_solution(lesson: Lesson) -> None:
    """No lesson may ship without a proven answer.

    This is the cheap half of the gate and it is deliberately separate: a lesson
    added with no solution should fail with "there is no solution" rather than
    with a confusing grading error.
    """
    assert lesson.solution_code, (
        f"{lesson.id} has no solution_code. Write one, verify it with "
        f"`node scripts/try_solution.mjs {lesson.id} <file>`, then add it to the YAML."
    )


@pytest.mark.parametrize("lesson", LESSONS, ids=IDS)
def test_worked_solution_passes_the_python_grader(lesson: Lesson) -> None:
    """The shipped answer scores 100 in the engine the desktop app marks with."""
    source = lesson.solution_code or ""
    world = _world_for(lesson)
    rover = Rover(world)
    tracer = Tracer()
    with binding_lock:
        set_active(tracer)
        set_active_rover(rover)
        set_active_world(world)
        set_state_provider(lambda: _snapshot(rover))
        try:
            result = run_pupil_code(source, timeout_s=10.0)
        finally:
            set_active(None)
            set_active_rover(None)
            set_active_world(None)
            set_state_provider(None)

    assert result.success, (
        f"{lesson.id} solution raised {result.error_kind}: {result.error_message} "
        f"(line {result.error_line})"
    )
    verdict = grade(lesson, tracer, source)
    assert verdict.passed, f"{lesson.id} solution failed: {list(verdict.reasons)}"
    assert verdict.score == 100, f"{lesson.id} solution scored {verdict.score}, not 100"


@pytest.mark.parametrize("lesson", LESSONS, ids=IDS)
def test_worked_solution_stays_inside_the_taught_vocabulary(lesson: Lesson) -> None:
    """The answer may not use a construct the lesson never taught.

    Showing a stuck KS1 pupil a solution built from a while loop is not help, it
    is a second thing they do not understand. ``allowed_constructs`` is the
    lesson's own declaration of what it has taught by this point, so the answer
    is held to it.
    """
    source = lesson.solution_code or ""
    tree = ast.parse(source)
    allowed = {c.value if hasattr(c, "value") else str(c) for c in lesson.allowed_constructs}

    used: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.If):
            used.add("if")
        elif isinstance(node, ast.While):
            used.add("while")
        elif isinstance(node, ast.For):
            used.add("for")
        elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            used.add("function_def")
        elif isinstance(node, ast.Call):
            used.add("function_call")
        elif isinstance(node, ast.Compare):
            used.add("comparison")

    extra = used - allowed
    assert not extra, (
        f"{lesson.id} solution uses {sorted(extra)}, which allowed_constructs "
        f"({sorted(allowed)}) does not permit"
    )


@pytest.mark.parametrize("lesson", LESSONS, ids=IDS)
def test_worked_solution_respects_the_line_budget(lesson: Lesson) -> None:
    """The answer fits in the same budget the pupil is given.

    ``max_lines`` is presented to the pupil as a constraint. An answer that
    exceeds it would be one the app itself would not accept.
    """
    source = lesson.solution_code or ""
    lines = [ln for ln in source.splitlines() if ln.strip()]
    assert len(lines) <= lesson.max_lines, (
        f"{lesson.id} solution is {len(lines)} lines, over its own max_lines of {lesson.max_lines}"
    )


def test_the_starter_is_never_already_the_answer() -> None:
    """A starter identical to the solution would make the lesson a button press."""
    same = [
        lesson.id
        for lesson in LESSONS
        if (lesson.solution_code or "").strip() == lesson.starter_code.strip()
    ]
    assert not same, f"these lessons ship the answer as the starter: {same}"
