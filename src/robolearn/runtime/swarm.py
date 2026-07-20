"""Run one program on a fleet of rovers: an offline agent swarm.

This is the honest, offline shape of the multi-agent missions the persona
rounds kept asking for, and of the swarm idea the project set out with. The
pupil writes a single program, and it is run on several rovers at once, each
starting from a slightly different pose around the base. Because every rover
runs the same decentralised code, the fleet spreads into a coordinated
pattern, which is the simplest honest illustration of a swarm: identical
agents, no central controller, behaviour that emerges from the shared
program and the different starting points.

Each rover is executed in the same sandbox the single rover uses, one after
another, so there is no new execution path to trust and nothing runs in
parallel that could race. The function returns each rover's path as a list
of points, which the interface draws as overlaid trails. No model, no
network, fully deterministic.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from functools import partial

from robolearn.engine.rover import Rover, RoverState
from robolearn.engine.world import World
from robolearn.runtime.binding import binding_lock, set_active_rover, set_active_world
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider

#: A swarm is kept small: large enough to read as a fleet, small enough that
#: running the program once per rover stays fast and safe.
MIN_ROVERS: int = 2
MAX_ROVERS: int = 8


class SwarmProgramError(RuntimeError):
    """The pupil's program failed to run, so there is no swarm to show.

    ``run_pupil_code`` folds syntax errors, NameErrors, sandbox rejections and
    timeouts into its ExecutionResult rather than raising. Discarding that
    result let a program that never executed be presented as a successful
    swarm: N stationary dots under a caption asserting that a pattern formed.
    Every rover runs the SAME source, so a failure on the first is a failure
    for all, and stopping there reports the real error instead of a fiction.
    """


def _snap(rover: Rover) -> RoverSnapshot:
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


def run_swarm(
    source: str,
    *,
    world_factory: Callable[[], World],
    n: int = 5,
    radius_m: float = 0.6,
    timeout_s: float = 5.0,
) -> list[list[tuple[float, float]]]:
    """Run ``source`` on ``n`` rovers and return each rover's path.

    Args:
        source: The pupil's program, run unchanged on every rover.
        world_factory: Builds a fresh world per rover, so one rover's
            collisions or collected samples never leak into another's run.
        n: Fleet size, clamped to ``[MIN_ROVERS, MAX_ROVERS]``.
        radius_m: How far each rover starts from the base, spread evenly
            around a ring so the fleet fans out.
        timeout_s: Per-rover sandbox timeout.

    Returns:
        One path per rover, each a list of ``(x, y)`` points beginning at the
        rover's start and ending at its final position.
    """
    count = max(MIN_ROVERS, min(MAX_ROVERS, int(n)))
    paths: list[list[tuple[float, float]]] = []
    for i in range(count):
        world = world_factory()
        bx, by = world.base
        ang = (2.0 * math.pi * i) / count
        start_x = bx + math.cos(ang) * radius_m
        start_y = by + math.sin(ang) * radius_m
        heading = (360.0 * i / count) % 360.0
        rover = Rover(world, state=RoverState(x=start_x, y=start_y, heading_deg=heading))
        tracer = Tracer()
        # Hold the shared binding lock per fleet member so a concurrent
        # AI-validation run cannot rebind the engine mid-run (same process
        # global the web submission path guards).
        with binding_lock:
            try:
                set_active(tracer)
                set_active_rover(rover)
                set_active_world(world)
                # partial binds this iteration's rover immediately, so the provider
                # always snapshots the right vehicle (and avoids a late-binding closure).
                set_state_provider(partial(_snap, rover))
                result = run_pupil_code(source or "", timeout_s=timeout_s)
            finally:
                # Detach before releasing the lock, exactly as the graded submit
                # path does. Without this the engine globals stayed bound to the
                # last fleet member after run_swarm returned, so a later reader
                # could snapshot a rover from a finished swarm; the error path
                # added below would otherwise leave them bound on the way out.
                set_active(None)
                set_active_rover(None)
                set_active_world(None)
                set_state_provider(None)
        if not result.success:
            where = f" (line {result.error_line})" if result.error_line else ""
            raise SwarmProgramError(
                f"{result.error_message or result.error_kind or 'the program failed to run'}{where}"
            )
        path: list[tuple[float, float]] = [(start_x, start_y)]
        for event in tracer.events():
            rs = event.rover_state
            if rs is not None:
                path.append((rs.x, rs.y))
        path.append((rover.state.x, rover.state.y))
        paths.append(path)
    return paths
