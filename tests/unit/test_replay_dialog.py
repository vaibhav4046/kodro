"""Replay-dialog tests (Task 16)."""

from __future__ import annotations

import tkinter as tk

import pytest

from robolearn.runtime.tracer import Event, RoverSnapshot, Tracer
from robolearn.ui.replay_dialog import ReplayDialog


@pytest.fixture
def root():  # type: ignore[no-untyped-def]
    try:
        r = tk.Tk()
        r.withdraw()
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        pytest.skip(f"Tk unavailable: {exc}")
    try:
        yield r
    finally:
        r.destroy()


def _tracer_with_events(snapshot: bool = False) -> Tracer:
    tracer = Tracer()
    snap = RoverSnapshot(1.0, 2.0, 90.0, 99.0, 1, 1, 0) if snapshot else None
    for i, kind in enumerate(("call", "sensor_read", "sample")):
        tracer.record(
            Event(
                frame=i,
                ts_ms=i * 10,
                kind=kind,  # type: ignore[arg-type]
                name=f"action_{i}",
                args=(float(i),),
                result=None,
                rover_state=snap,
            )
        )
    return tracer


def test_replay_dialog_constructs(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, _tracer_with_events())
    try:
        assert dialog.current_frame() == 0
    finally:
        dialog.destroy()


def test_replay_dialog_with_empty_tracer(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, Tracer())
    try:
        assert "no events" in dialog._widgets.info_label.cget("text")  # type: ignore[attr-defined]
    finally:
        dialog.destroy()


def test_scrub_to_clamps_negative_to_zero(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, _tracer_with_events())
    try:
        dialog.scrub_to(-5)
        assert dialog.current_frame() == 0
    finally:
        dialog.destroy()


def test_scrub_to_clamps_high_value(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, _tracer_with_events())
    try:
        dialog.scrub_to(99)
        assert dialog.current_frame() == 2  # 3 events -> max index 2
    finally:
        dialog.destroy()


def test_scrub_to_renders_event_name_in_info_label(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, _tracer_with_events())
    try:
        dialog.scrub_to(1)
        text = dialog._widgets.info_label.cget("text")  # type: ignore[attr-defined]
        assert "action_1" in text
        assert "sensor_read" in text
    finally:
        dialog.destroy()


def test_snapshot_label_when_no_snapshot(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, _tracer_with_events(snapshot=False))
    try:
        dialog.scrub_to(0)
        text = dialog._widgets.snapshot_label.cget("text")  # type: ignore[attr-defined]
        assert "no snapshot" in text
    finally:
        dialog.destroy()


def test_snapshot_label_when_snapshot_present(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, _tracer_with_events(snapshot=True))
    try:
        dialog.scrub_to(0)
        text = dialog._widgets.snapshot_label.cget("text")  # type: ignore[attr-defined]
        assert "pos" in text
        assert "99.0%" in text
    finally:
        dialog.destroy()


def test_on_scrub_callback_fires(root: tk.Tk) -> None:
    events: list[Event] = []
    dialog = ReplayDialog(root, _tracer_with_events(), on_scrub=events.append)
    try:
        dialog.scrub_to(2)
        assert events and events[-1].name == "action_2"
    finally:
        dialog.destroy()


def test_set_tracer_swaps_event_source(root: tk.Tk) -> None:
    dialog = ReplayDialog(root, _tracer_with_events())
    try:
        new_tracer = Tracer()
        new_tracer.record(Event(0, 0, "call", "new_event", (1.0,), None, None))
        dialog.set_tracer(new_tracer)
        dialog.scrub_to(0)
        text = dialog._widgets.info_label.cget("text")  # type: ignore[attr-defined]
        assert "new_event" in text
    finally:
        dialog.destroy()
