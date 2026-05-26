"""Tracer unit tests (Task 6)."""

from __future__ import annotations

import json

import pytest

from robolearn import rover_api
from robolearn.runtime import tracer as tracer_mod
from robolearn.runtime.tracer import (
    Event,
    RoverSnapshot,
    Tracer,
    clear_active,
    emit,
    get_active,
    get_state_provider,
    set_active,
    set_state_provider,
)

# --- Tracer core -----------------------------------------------------------


def test_new_tracer_is_empty_at_frame_zero() -> None:
    t = Tracer()
    assert t.frame == 0
    assert len(t) == 0
    assert t.events() == []


def test_advance_frame_increments_counter() -> None:
    t = Tracer()
    t.advance_frame()
    t.advance_frame()
    assert t.frame == 2


def test_now_ms_is_non_negative_and_monotonic() -> None:
    t = Tracer()
    a = t.now_ms()
    b = t.now_ms()
    assert a >= 0
    assert b >= a


def test_record_appends_events_in_order() -> None:
    t = Tracer()
    e1 = Event(0, 0, "call", "move_forward", (1.0,), None, None)
    e2 = Event(0, 1, "sensor_read", "read_distance", (), 5.0, None)
    t.record(e1)
    t.record(e2)
    assert t.events() == [e1, e2]


def test_events_returns_a_copy() -> None:
    t = Tracer()
    e = Event(0, 0, "call", "log", ("hi",), None, None)
    t.record(e)
    snapshot = t.events()
    snapshot.append(Event(99, 99, "call", "x", (), None, None))
    assert len(t) == 1  # mutation did not affect the tracer


def test_clear_drops_events_and_resets_frame() -> None:
    t = Tracer()
    t.advance_frame()
    t.record(Event(t.frame, 0, "call", "x", (), None, None))
    t.clear()
    assert t.frame == 0
    assert t.events() == []


# --- JSON round-trip -------------------------------------------------------


def _snapshot() -> RoverSnapshot:
    return RoverSnapshot(
        x=1.5,
        y=2.5,
        heading_deg=90.0,
        battery_pct=99.0,
        samples_held=1,
        samples_collected=2,
        collisions=0,
    )


def test_empty_tracer_round_trips_through_json() -> None:
    t = Tracer()
    text = t.to_json()
    restored = Tracer.from_json(text)
    assert restored.frame == t.frame
    assert restored.events() == t.events()


def test_full_tracer_round_trips_through_json() -> None:
    t = Tracer()
    t.advance_frame()
    e1 = Event(t.frame, 10, "call", "move_forward", (5.0,), None, _snapshot())
    e2 = Event(t.frame, 11, "sensor_read", "read_distance", (), 3.2, None)
    e3 = Event(t.frame, 12, "sample", "collect_sample", (), True, _snapshot())
    for e in (e1, e2, e3):
        t.record(e)
    restored = Tracer.from_json(t.to_json())
    assert restored.frame == t.frame
    assert restored.events() == [e1, e2, e3]


def test_to_json_is_valid_json() -> None:
    t = Tracer()
    t.record(Event(0, 0, "call", "x", (1,), None, None))
    parsed = json.loads(t.to_json())
    assert "events" in parsed
    assert parsed["events"][0]["args"] == [1]  # tuple encoded as list


# --- Module-level active tracer + emit -------------------------------------


def test_no_active_tracer_means_emit_is_a_no_op() -> None:
    assert get_active() is None
    emit("noop", (), None)  # must not raise


def test_set_active_and_get_active_round_trip() -> None:
    t = Tracer()
    set_active(t)
    assert get_active() is t
    clear_active()
    assert get_active() is None


def test_emit_appends_an_event_with_current_frame_and_kind() -> None:
    t = Tracer()
    set_active(t)
    t.advance_frame()  # frame == 1
    emit("turn_left", (90.0,), None, kind="call")
    events = t.events()
    assert len(events) == 1
    assert events[0].name == "turn_left"
    assert events[0].args == (90.0,)
    assert events[0].kind == "call"
    assert events[0].frame == 1


def test_state_provider_attaches_snapshot_to_event() -> None:
    t = Tracer()
    set_active(t)
    snap = _snapshot()
    set_state_provider(lambda: snap)
    assert get_state_provider() is not None
    emit("read_distance", (), 5.0, kind="sensor_read")
    assert t.events()[0].rover_state == snap


def test_state_provider_can_return_none() -> None:
    t = Tracer()
    set_active(t)
    set_state_provider(lambda: None)
    emit("read_battery", (), 50.0, kind="sensor_read")
    assert t.events()[0].rover_state is None


# --- rover_api integration -------------------------------------------------


def test_rover_api_call_records_a_call_event() -> None:
    t = Tracer()
    set_active(t)
    rover_api.move_forward(5.0)
    events = t.events()
    assert len(events) == 1
    assert events[0].kind == "call"
    assert events[0].name == "move_forward"
    assert events[0].args == (5.0,)


def test_rover_api_sensor_read_records_a_sensor_event() -> None:
    t = Tracer()
    set_active(t)
    distance = rover_api.read_distance()
    events = t.events()
    assert len(events) == 1
    assert events[0].kind == "sensor_read"
    assert events[0].name == "read_distance"
    assert events[0].result == distance


def test_rover_api_collect_sample_records_sample_event() -> None:
    t = Tracer()
    set_active(t)
    rover_api.collect_sample()
    assert t.events()[0].kind == "sample"
    assert t.events()[0].name == "collect_sample"


def test_rover_api_records_clamped_value_not_raw_input(
    caplog: pytest.LogCaptureFixture,
) -> None:
    import logging

    t = Tracer()
    set_active(t)
    with caplog.at_level(logging.WARNING, logger="robolearn.rover_api"):
        rover_api.move_forward(-10.0)  # clamps to 0.0
    assert t.events()[0].args == (0.0,)


def test_rover_api_sequence_produces_events_in_call_order() -> None:
    t = Tracer()
    set_active(t)
    rover_api.move_forward(1.0)
    rover_api.turn_left(45.0)
    rover_api.read_battery()
    rover_api.collect_sample()
    names = [e.name for e in t.events()]
    assert names == ["move_forward", "turn_left", "read_battery", "collect_sample"]
    kinds = [e.kind for e in t.events()]
    assert kinds == ["call", "call", "sensor_read", "sample"]


def test_emit_no_op_path_does_not_invoke_state_provider() -> None:
    called: list[int] = []

    def provider() -> RoverSnapshot | None:
        called.append(1)
        return None

    set_state_provider(provider)
    # No active tracer — provider must not be consulted.
    emit("foo", (), None)
    assert called == []


def test_tracer_module_singleton_emit_uses_module_state() -> None:
    """Smoke-test the runtime package re-exports work end-to-end."""
    from robolearn import runtime  # imported separately

    t = Tracer()
    runtime.set_active(t)
    rover_api.beep(2)
    runtime.clear_active()
    rover_api.beep(2)  # should not be recorded
    events = t.events()
    assert len(events) == 1
    assert events[0].name == "beep"
    assert events[0].args == (2,)


# --- Module-level reset behaviour ------------------------------------------


def test_tracer_module_state_resets_between_tests() -> None:
    # autouse fixture in conftest clears the active tracer between tests,
    # so this assertion confirms isolation regardless of test ordering.
    assert get_active() is None
    assert tracer_mod.get_state_provider() is None
