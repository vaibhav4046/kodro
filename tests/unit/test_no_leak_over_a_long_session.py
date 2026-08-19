"""A classroom session is hundreds of runs, not one.

Every other test in this suite executes a program once or twice. A leak that
adds a little per run is invisible to all of them and shows up only after a
lesson's worth of use, on the machine of a teacher who cannot diagnose it.

The executor rebinds module-level actives (tracer, rover, world) on every run,
so anything that retains a previous tracer, rover or world keeps the whole
object graph behind it alive. This walks a realistic mix of programs and asserts
that live object count settles rather than climbs.

Object count is the assertion rather than bytes: allocator behaviour and GC
timing make byte totals noisy across platforms, while a genuine retention shows
up as a monotonically growing number of live objects.
"""

from __future__ import annotations

import gc

import pytest

from kodro.engine.rover import Rover
from kodro.engine.terrain import Terrain
from kodro.engine.world import ArenaBounds, Obstacle, Sample, World
from kodro.lessons.schema import Lesson, load_library
from kodro.runtime.binding import set_active_rover, set_active_world
from kodro.runtime.executor import execute
from kodro.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider

#: Batches of runs, sampling live objects after each. Enough to separate a real
#: leak from start-up noise without making the suite slow; a manual run at 1500
#: showed the same flat profile.
BATCHES = 4
RUNS_PER_BATCH = 60

#: Live objects may drift a little between batches (caches, interned strings).
#: A per-run retention would add thousands over this many runs, so the bar is
#: set well below that and well above the observed noise.
MAX_GROWTH = 750

PROGRAMS = (
    "for i in range(4):\n    move_forward(1)\n    turn_right(90)",
    "def spiral(n):\n"
    "    if n > 8:\n"
    "        return\n"
    "    move_forward(n * 0.2)\n"
    "    turn_right(60)\n"
    "    spiral(n + 1)\n"
    "spiral(1)",
    "i = 0\n"
    "while i < 6:\n"
    "    if read_distance() > 0.5:\n"
    "        move_forward(1)\n"
    "    else:\n"
    "        turn_left(45)\n"
    "    i = i + 1",
    "move_forward(2)\nprint('hello')\nturn_left(90)\nmove_forward(1)",
)


@pytest.fixture(scope="module")
def lesson() -> Lesson:
    return load_library()[0]


def _world(lesson: Lesson) -> World:
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


def _run_once(lesson: Lesson, source: str) -> bool:
    world = _world(lesson)
    rover = Rover(world)
    tracer = Tracer()
    set_active(tracer)
    set_active_rover(rover)
    set_active_world(world)
    set_state_provider(lambda r=rover: _snapshot(r))
    return execute(source, timeout_s=10.0).success


def test_a_long_session_does_not_accumulate_objects(lesson: Lesson) -> None:
    failures = 0
    counts: list[int] = []

    # One warm-up batch first: the first runs populate caches and import
    # machinery, which is growth that does not repeat.
    for i in range(RUNS_PER_BATCH):
        _run_once(lesson, PROGRAMS[i % len(PROGRAMS)])
    gc.collect()

    for _batch in range(BATCHES):
        for i in range(RUNS_PER_BATCH):
            if not _run_once(lesson, PROGRAMS[i % len(PROGRAMS)]):
                failures += 1
        gc.collect()
        counts.append(len(gc.get_objects()))

    assert failures == 0, f"{failures} of {BATCHES * RUNS_PER_BATCH} runs failed mid-session"
    growth = counts[-1] - counts[0]
    assert growth < MAX_GROWTH, (
        f"live objects grew by {growth} across {BATCHES * RUNS_PER_BATCH} runs "
        f"({counts}), which is the shape of a per-run retention. The executor "
        "rebinds the active tracer, rover and world every run, so check whether "
        "something is holding the previous ones."
    )


def test_every_program_in_the_mix_actually_runs(lesson: Lesson) -> None:
    """Guard the guard: a mix that silently fails would show a flat profile."""
    for source in PROGRAMS:
        assert _run_once(lesson, source), (
            f"this program never ran, so it proves nothing: {source!r}"
        )
