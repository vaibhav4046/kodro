"""Headless lesson-run session shared by every Kodro front end.

Three surfaces need to answer the same question -- "what happens when this
pupil runs this program against this lesson?" -- and until this module existed
each one answered it with its own copy of the code:

* the Tk desktop app (:mod:`robolearn.app`),
* the pywebview bridge behind the React shell (:mod:`robolearn.web.app`),
* and now the MCP server (:mod:`robolearn.mcp.server`).

The desktop and web copies of ``_world_from_lesson`` / ``_snapshot`` had drifted
into byte-identical duplicates, which is exactly the shape of bug that bites
later: one surface gets a fix, the other silently keeps the old physics and the
two disagree about whether the same program passes. Everything here is the one
definition those surfaces now delegate to.

Nothing in this module touches the network, the filesystem, or any UI toolkit,
so it imports cleanly in a headless process (the MCP server relies on that).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World
from robolearn.lessons.grader import GradeResult, grade
from robolearn.runtime.binding import (
    binding_lock,
    set_active_rover,
    set_active_world,
)
from robolearn.runtime.executor import ExecutionResult
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import (
    Event,
    RoverSnapshot,
    Tracer,
    set_active,
    set_state_provider,
)

if TYPE_CHECKING:
    from robolearn.lessons.schema import Lesson

#: Wall-clock budget for one pupil program, in seconds. Matches the value the
#: web bridge and the desktop Run button have always used; a lesson-sized
#: program finishes in single-digit milliseconds, so this only ever fires on a
#: runaway loop.
DEFAULT_RUN_TIMEOUT_S: float = 5.0


def world_from_lesson(lesson: Lesson) -> World:
    """Build a fresh :class:`World` from the lesson's ``WorldDef``."""
    world_def = lesson.world
    return World(
        terrain=Terrain(lesson.terrain),
        base=tuple(world_def.base),  # type: ignore[arg-type]
        samples=[Sample(s[0], s[1]) for s in world_def.samples],
        obstacles=[Obstacle(o.x, o.y, o.r) for o in world_def.obstacles],
        bounds=ArenaBounds(width=world_def.width, height=world_def.height),
    )


def snapshot(rover: Rover) -> RoverSnapshot:
    """Capture the rover's current state for tracer events."""
    state = rover.state
    return RoverSnapshot(
        x=state.x,
        y=state.y,
        heading_deg=state.heading_deg,
        battery_pct=state.battery_pct,
        samples_held=state.samples_held,
        samples_collected=state.samples_collected,
        collisions=state.collisions,
        distance_travelled_m=state.distance_travelled_m,
    )


@dataclass(frozen=True, slots=True)
class RunOutcome:
    """Everything one headless lesson run produced.

    Attributes:
        execution: How the pupil's snippet terminated (sandbox / syntax /
            runtime / timeout / clean).
        verdict: The grade against the lesson's success criteria, when the
            program ran. When ``execution.success`` is ``False`` this is a
            fixed score of 0 carrying the error as its single reason, matching
            every other Kodro surface; see the note in
            :func:`run_against_lesson` for why grading the abandoned trace
            handed out partial credit for criteria the program never reached.
        events: The tracer events emitted during the run, in order.
        tracer: The tracer itself, for callers that need to re-grade or
            serialise the trace.
        final: The rover's state when the run ended.
        world: The world the run happened in.
        rover: The rover that was driven.
    """

    execution: ExecutionResult
    verdict: GradeResult
    events: tuple[Event, ...]
    tracer: Tracer
    final: RoverSnapshot
    world: World
    rover: Rover


def run_against_lesson(
    lesson: Lesson,
    source: str,
    *,
    timeout_s: float = DEFAULT_RUN_TIMEOUT_S,
) -> RunOutcome:
    """Run ``source`` against ``lesson`` on a fresh world and grade the result.

    The rover is the REFERENCE rover (drain scale 1.0), matching
    ``lesson-grader.jsx`` in the browser. Build mass belongs on the design
    bench, not in a lesson threshold -- see the long note on
    ``BridgeAPI.submit_attempt`` for why grading a heavy build against a
    fixed YAML battery limit marks the wrong thing.

    The engine bindings are global process state, so bind -> run -> detach
    happens under ``binding_lock`` as one atomic window. Without it a
    concurrent AI validation or swarm run on another thread can rebind the
    engine mid-run and hijack whose rover the program drives.
    """
    world = world_from_lesson(lesson)
    rover = Rover(world)
    tracer = Tracer()
    with binding_lock:
        set_active(tracer)
        set_active_rover(rover)
        set_active_world(world)
        set_state_provider(lambda: snapshot(rover))

        execution = run_pupil_code(source or "", timeout_s=timeout_s)
        events = tuple(tracer.events())

        # Detach now the run is captured, so a later read never sees this
        # run's stale rover / world / tracer.
        set_active(None)
        set_active_rover(None)
        set_active_world(None)
        set_state_provider(None)

    if execution.success:
        verdict = grade(lesson, tracer, source or "")
    else:
        # A program that never ran must not be marked on the trace it left
        # behind. `grade` is pure over the tracer, so a sandbox rejection at
        # line 1 was still scoring 60/100 on a three-criterion lesson: both
        # distance criteria failed and "no collisions" was vacuously satisfied.
        # Every other surface already refuses to do that -- the Tk app returns
        # before it grades (app.py, the `not result.success` branch of the Run
        # handler), the web bridge answers score 0 with the error as the single
        # reason (web/app.py, submit_attempt), and the browser grader mirrors it
        # (lesson-grader.jsx, gradeSync's run.error branch). Same wording and
        # same score here, because grade_program promises the pupil's score and
        # not a second opinion on it.
        verdict = GradeResult(
            passed=False,
            reasons=[
                f"{execution.error_kind}: {execution.error_message} (line {execution.error_line})"
            ],
            score=0,
        )
    return RunOutcome(
        execution=execution,
        verdict=verdict,
        events=events,
        tracer=tracer,
        final=snapshot(rover),
        world=world,
        rover=rover,
    )
