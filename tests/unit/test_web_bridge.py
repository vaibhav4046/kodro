"""BridgeAPI tests: the JS-facing surface of the new web UI.

These tests don't touch pywebview -- the API class is a plain Python object
whose methods return JSON-serialisable dicts. We exercise it against a real
:class:`Store` (in a temp file) and the real bundled lesson library so the
contract the React app depends on is locked down.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from robolearn.lessons.schema import load_library
from robolearn.memory.store import Store
from robolearn.web.app import BridgeAPI


@pytest.fixture
def api(tmp_path: Path) -> BridgeAPI:
    store = Store(tmp_path / "pupil.db")
    return BridgeAPI(store=store, lessons=list(load_library()))


def test_on_ui_ready_reports_lesson_count_and_pupil(api: BridgeAPI) -> None:
    result = api.on_ui_ready()
    assert result["ok"] is True
    assert result["lessonCount"] >= 10
    assert isinstance(result["pupilId"], str) and result["pupilId"]


def test_list_lessons_returns_serialisable_dicts(api: BridgeAPI) -> None:
    lessons = api.list_lessons()
    assert lessons and isinstance(lessons, list)
    # Every entry must round-trip through JSON (this is what crosses the wire).
    payload = json.dumps(lessons)
    again = json.loads(payload)
    assert again[0]["id"] == lessons[0]["id"]
    expected = {
        "id",
        "title",
        "keyStage",
        "concepts",
        "intro",
        "starterCode",
        "terrain",
        "maxLines",
    }
    assert expected <= set(lessons[0].keys())


def test_get_lesson_known_and_unknown_ids(api: BridgeAPI) -> None:
    lessons = api.list_lessons()
    first_id = lessons[0]["id"]
    found = api.get_lesson(first_id)
    assert found is not None
    assert found["id"] == first_id
    assert api.get_lesson("does-not-exist") is None


def test_get_pupil_summary_carries_display_name(api: BridgeAPI) -> None:
    summary = api.get_pupil_summary()
    assert summary["id"]
    assert isinstance(summary["displayName"], str)


def test_submit_attempt_returns_jsonable_ack(api: BridgeAPI) -> None:
    result = api.submit_attempt("01_hello_rover", "move_forward(1)", None)
    assert result["ok"] is True
    assert result["lessonId"] == "01_hello_rover"
    assert json.dumps(result)


def test_log_accepts_known_levels(api: BridgeAPI) -> None:
    for level in ("info", "warning", "error", "debug", "unknown"):
        assert api.log(level, f"test {level}") == {"ok": True}
