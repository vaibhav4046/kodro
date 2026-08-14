"""A whole Mars mission, driven by pupil code, through every real layer.

The unit suites each hold one layer still and check the next. Nothing until
this module runs a complete mission the way a pupil actually causes one: a
program in the sandbox, calling the published ``rover_api``, driving a
:class:`~robolearn.engine.rover.Rover` bound to a Mars :class:`World`, with the
tracer recording it and the world mutating underneath.

That end-to-end path is where the interesting failures live. Every one of these
has a passing unit test either side of it and no unit test across it:

* the sandbox strips a builtin the ``rover_api`` layer needs, so the mission
  dies on a call the API test proves works;
* ``collect_sample`` returns True to the pupil but the world's ``Sample`` is
  never marked, so ``all_collected`` stays False after a perfect run;
* battery is charged against commanded distance while the odometer records
  travelled distance, so the two disagree the moment a wall clamps a move;
* the tracer's snapshots lag the rover by one call, so the trace a grader marks
  describes a rover that was somewhere else.

The mission is deliberately arithmetic-clean (whole-metre legs, right-angle
turns) so every assertion below is an exact expected value rather than a
tolerance wide enough to hide a real drift.
"""

from __future__ import annotations

import math

import pytest

from robolearn.engine.rover import (
    BATTERY_PER_COLLISION,
    BATTERY_PER_DEGREE,
    BATTERY_PER_METRE,
    Rover,
)
from robolearn.engine.terrain import Terrain, params_for
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World
from robolearn.runtime.binding import binding_lock, set_active_rover, set_active_world
from robolearn.runtime.executor import ExecutionResult
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider

# Base at (1, 1), two samples on a right-angled route, one obstacle parked well
# off it so the nominal mission is collision-free and a collision assertion
# below means something.
BASE: tuple[float, float] = (1.0, 1.0)
SAMPLE_A: tuple[float, float] = (3.0, 1.0)
SAMPLE_B: tuple[float, float] = (3.0, 4.0)
OBSTACLE: tuple[float, float, float] = (7.0, 7.0, 0.5)

# Drive east 2, collect, north 3, collect, then retrace: south 3, west 2, home.
MISSION_LEGS_M: float = 2.0 + 3.0 + 3.0 + 2.0
MISSION_TURN_DEG: float = 90.0 + 180.0 + 90.0

MISSION_CODE = """
move_forward(2)
collect_sample()
turn_left(90)
move_forward(3)
collect_sample()
turn_right(180)
move_forward(3)
turn_right(90)
move_forward(2)
"""


def _mars_world() -> World:
    """Build the mission arena. Fresh per test: ``Sample.collected`` is mutable."""
    return World(
        terrain=Terrain.MARS,
        base=BASE,
        samples=[Sample(*SAMPLE_A), Sample(*SAMPLE_B)],
        obstacles=[Obstacle(*OBSTACLE)],
        bounds=ArenaBounds(width=10.0, height=10.0),
    )


def _snapshot(rover: Rover) -> RoverSnapshot:
    """Report rover state into each tracer event, as the submit path does."""
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


def _fly(source: str, world: World) -> tuple[ExecutionResult, Rover, Tracer]:
    """Run pupil source against ``world`` through the real binding + sandbox.

    Same bind / run / detach shape as ``web.app.BridgeAPI.submit_attempt``, held
    under ``binding_lock`` for the whole window so a concurrent test cannot
    rebind the engine mid-mission.
    """
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
    return result, rover, tracer


@pytest.fixture
def mission() -> tuple[ExecutionResult, Rover, Tracer, World]:
    """One completed nominal mission, shared by the assertions that inspect it."""
    world = _mars_world()
    result, rover, tracer = _fly(MISSION_CODE, world)
    return result, rover, tracer, world


def test_mission_runs_to_completion_without_sandbox_or_runtime_error(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """The whole program survives the sandbox and finishes.

    Kept as its own test so a sandbox regression fails with the sandbox's own
    message instead of as a confusing "rover is at the wrong place".
    """
    result, _, _, _ = mission
    assert result.success, f"mission failed: {result.error_kind}: {result.error_message}"


def test_mission_collects_every_sample_and_the_world_agrees(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """Both halves of a collection must move: the rover's tally and the world.

    ``collect_sample`` returning True while the world still lists the sample as
    uncollected is the exact divergence that would let a mission "succeed" and
    leave the arena unchanged.
    """
    _, rover, _, world = mission
    assert rover.state.samples_collected == 2
    assert rover.state.samples_held == 2
    assert world.all_collected(), f"still uncollected: {world.uncollected_samples()}"


def test_mission_returns_the_rover_to_base(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """The retrace leg lands back on the base station."""
    _, rover, _, world = mission
    assert rover.at_base(), (
        f"ended at ({rover.state.x:.3f}, {rover.state.y:.3f}), "
        f"{world.distance_to_base(rover.state.x, rover.state.y):.3f} m from base"
    )
    assert rover.state.x == pytest.approx(BASE[0], abs=1e-9)
    assert rover.state.y == pytest.approx(BASE[1], abs=1e-9)


def test_mission_odometer_matches_the_commanded_legs(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """Nothing clipped the route: travelled distance equals the commanded legs.

    On a collision-free mission these must be equal. They diverge only when the
    rover was stopped short, which the next test asserts is not happening here.
    """
    _, rover, _, _ = mission
    assert rover.state.distance_travelled_m == pytest.approx(MISSION_LEGS_M, abs=1e-9)
    assert rover.state.degrees_turned == pytest.approx(MISSION_TURN_DEG, abs=1e-9)
    assert rover.state.collisions == 0


def test_mission_battery_is_charged_for_exactly_what_it_did(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """Battery reconciles against the published per-metre / per-degree rates.

    Asserted against the constants rather than a hardcoded percentage: the point
    is the accounting identity, which must survive a future re-fit of the motion
    model that legitimately changes the numbers.
    """
    _, rover, _, _ = mission
    expected_drain = MISSION_LEGS_M * BATTERY_PER_METRE + MISSION_TURN_DEG * BATTERY_PER_DEGREE
    assert rover.state.battery_pct == pytest.approx(100.0 - expected_drain, abs=1e-9)
    assert 0.0 <= rover.state.battery_pct <= 100.0


def test_mission_trace_ends_on_the_rover_the_mission_left_behind(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """The trace a grader marks must describe the rover that actually finished.

    A snapshot provider wired one call late leaves the final event holding the
    state from before the last move, which grades a returning rover as stranded.
    """
    _, rover, tracer, _ = mission
    events = tracer.events()
    assert events, "mission produced no tracer events"

    with_state = [e for e in events if e.rover_state is not None]
    assert len(with_state) == len(events), "some events recorded no rover state"

    final = with_state[-1].rover_state
    assert final is not None  # narrowed for mypy; asserted non-empty above
    assert final.x == pytest.approx(rover.state.x, abs=1e-9)
    assert final.y == pytest.approx(rover.state.y, abs=1e-9)
    assert final.samples_collected == rover.state.samples_collected
    assert final.battery_pct == pytest.approx(rover.state.battery_pct, abs=1e-9)
    assert final.distance_travelled_m == pytest.approx(rover.state.distance_travelled_m, abs=1e-9)


def test_mission_trace_never_leaves_the_arena(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """Every recorded position is inside the bounds, not just the last one.

    A clamp applied at the end would satisfy a final-position check while the
    rover spent the middle of the mission outside the world.
    """
    _, _, tracer, world = mission
    for event in tracer.events():
        state = event.rover_state
        assert state is not None
        assert world.bounds.contains(state.x, state.y), (
            f"frame {event.frame} ({event.name}) at ({state.x:.3f}, {state.y:.3f}) "
            f"is outside {world.bounds}"
        )


def test_mars_terrain_parameters_reach_the_bound_world(
    mission: tuple[ExecutionResult, Rover, Tracer, World],
) -> None:
    """The world the mission ran in really is Mars, not a defaulted Earth."""
    _, _, _, world = mission
    assert world.terrain is Terrain.MARS
    params = params_for(world.terrain)
    assert params.gravity_mps2 == pytest.approx(3.71)
    assert params.drag == 0.0


def test_driving_into_an_obstacle_stops_short_and_costs_battery() -> None:
    """A mission that crashes is charged for the crash and stops at contact.

    The counterpart to the nominal run: the collision path has to be exercised
    end-to-end too, or "collisions == 0" above proves only that the counter is
    never incremented by anything.
    """
    world = World(
        terrain=Terrain.MARS,
        base=BASE,
        samples=[],
        obstacles=[Obstacle(4.0, 1.0, 0.5)],
        bounds=ArenaBounds(width=10.0, height=10.0),
    )
    result, rover, _ = _fly("move_forward(6)\n", world)

    assert result.success, f"{result.error_kind}: {result.error_message}"
    assert rover.state.collisions == 1
    # Stopped at the swept-circle contact point, which is the obstacle radius
    # plus the rover radius short of the obstacle centre.
    assert rover.state.x < 4.0
    assert rover.state.distance_travelled_m < 6.0
    assert rover.state.distance_travelled_m > 0.0

    expected_drain = rover.state.distance_travelled_m * BATTERY_PER_METRE + BATTERY_PER_COLLISION
    assert rover.state.battery_pct == pytest.approx(100.0 - expected_drain, abs=1e-9)


def test_driving_into_a_wall_clamps_inside_the_arena() -> None:
    """The arena is a hard edge, and hitting it is a collision like any other."""
    world = World(
        terrain=Terrain.MARS,
        base=BASE,
        samples=[],
        obstacles=[],
        bounds=ArenaBounds(width=10.0, height=10.0),
    )
    result, rover, _ = _fly("move_forward(50)\n", world)

    assert result.success, f"{result.error_kind}: {result.error_message}"
    assert world.bounds.contains(rover.state.x, rover.state.y)
    assert rover.state.x == pytest.approx(world.bounds.width, abs=1e-9)
    assert rover.state.collisions == 1
    assert rover.state.distance_travelled_m == pytest.approx(world.bounds.width - BASE[0], abs=1e-9)


def test_a_mission_that_never_reaches_a_sample_collects_nothing() -> None:
    """The negative control for the collection assertions.

    Without it, a ``collect_sample`` that always returned True and marked the
    nearest sample regardless of range would pass every test above.
    """
    world = _mars_world()
    result, rover, _ = _fly("collect_sample()\n", world)

    assert result.success, f"{result.error_kind}: {result.error_message}"
    assert rover.state.samples_collected == 0
    assert not world.all_collected()
    assert len(world.uncollected_samples()) == 2
    # Base really is out of collection range of both samples, so the check above
    # is about range and not about an arena where everything is reachable.
    assert min(math.hypot(s.x - BASE[0], s.y - BASE[1]) for s in world.samples) > 0.3
