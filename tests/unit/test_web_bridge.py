"""BridgeAPI tests: the JS-facing surface of the new web UI.

These tests don't touch pywebview -- the API class is a plain Python object
whose methods return JSON-serialisable dicts. We exercise it against a real
:class:`Store` (in a temp file) and the real bundled lesson library so the
contract the React app depends on is locked down.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest

from kodro.lessons.schema import load_library
from kodro.memory.store import Store
from kodro.web.app import BridgeAPI


@pytest.fixture
def api(tmp_path: Path) -> Iterator[BridgeAPI]:
    # Own the store's lifetime: ``Store`` opens a connection per thread and only
    # ``close()`` releases the ones opened off the constructing thread.  Without
    # this the handles survive until ``__del__`` runs, which on Windows keeps a
    # file lock on the temp DB for an arbitrary stretch of the session.
    store = Store(tmp_path / "pupil.db")
    try:
        yield BridgeAPI(store=store, lessons=list(load_library()))
    finally:
        store.close()


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


def test_multi_pupil_create_select_rename(api: BridgeAPI) -> None:
    """A shared machine can hold several pupils; the active one is switchable."""
    first = api.get_pupil_summary()["id"]
    # Create a second pupil -> becomes active.
    made = api.create_pupil("Ada")
    assert made["ok"] is True and made["displayName"] == "Ada"
    assert api.get_pupil_summary()["id"] == made["id"] != first

    pupils = api.list_pupils()
    assert {p["displayName"] for p in pupils} >= {"Ada"}
    assert sum(1 for p in pupils if p["active"]) == 1  # exactly one active

    # Switch back to the first pupil.
    sel = api.select_pupil(first)
    assert sel["ok"] is True
    assert api.get_pupil_summary()["id"] == first

    # Unknown pupil is rejected.
    assert api.select_pupil("nope")["ok"] is False

    # Rename.
    assert api.rename_pupil(made["id"], "Ada L.")["displayName"] == "Ada L."


def test_submission_recorded_against_active_pupil(api: BridgeAPI) -> None:
    """Switching pupil routes submissions to that pupil's history."""
    lessons = api.list_lessons()
    lid, starter = lessons[0]["id"], lessons[0]["starterCode"]
    p2 = api.create_pupil("Grace")["id"]  # active = Grace
    api.submit_attempt(lid, starter, None)
    subs_grace = api._store.list_submissions(pupil_id=p2)  # type: ignore[attr-defined]
    assert len(subs_grace) >= 1
    assert all(s.pupil_id == p2 for s in subs_grace)


def test_submit_attempt_grades_and_persists(api: BridgeAPI) -> None:
    """A real Run hits the Python engine: executes, grades, returns verdict + hint."""
    lessons = api.list_lessons()
    target_id = lessons[0]["id"]  # 01_hello_rover -- simplest path
    starter = lessons[0]["starterCode"]
    result = api.submit_attempt(target_id, starter, None)
    assert result["ok"] is True
    assert result["lessonId"] == target_id
    # Real grading -- not a stub.
    assert result["graded"] is True
    assert isinstance(result["passed"], bool)
    assert isinstance(result["score"], int) and 0 <= result["score"] <= 100
    assert isinstance(result["reasons"], list)
    # Tracer events serialise as flat dicts.
    assert isinstance(result["events"], list)
    # JSON round-trip (this is what crosses the wire).
    assert json.loads(json.dumps(result))["lessonId"] == target_id


def test_model_picker_prefers_measured_stock_model_over_legacy_tutor(api: BridgeAPI) -> None:
    """Measured stock quality wins; the custom tutor remains a fallback."""
    installed = ["gemma3:4b", "kodro-tutor:latest", "llama3.2:3b"]
    assert api._pick_ai_model(installed) == "gemma3:4b"  # type: ignore[attr-defined]
    assert api._pick_ai_model(["kodro-tutor:latest"]) == "kodro-tutor:latest"  # type: ignore[attr-defined]
    assert api._pick_ai_model(["llama3.2:3b", "gemma3:4b"]) is not None  # type: ignore[attr-defined]


def test_swarm_run_returns_a_path_per_rover(api: BridgeAPI) -> None:
    """The swarm runs one program on a fleet and returns each rover's trail."""
    out = api.swarm_run("move_forward(2)", None, 4)
    assert out["ok"] is True
    assert out["n"] == 4
    assert len(out["paths"]) == 4
    # Each path is a list of [x, y] points, JSON-serialisable for the wire.
    assert all(len(p) >= 2 for p in out["paths"])
    json.dumps(out)


def test_swarm_run_rejects_empty_code(api: BridgeAPI) -> None:
    out = api.swarm_run("   ", None, 4)
    assert out["ok"] is False


def test_ai_ask_rejects_an_empty_question(api: BridgeAPI) -> None:
    out = api.ai_ask("   ")
    assert out["ok"] is False
    assert "question" in out["reason"].lower()


def test_ai_ask_returns_grounded_lesson_sources_without_a_model(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With no local model reachable, Ask still returns grounded lesson
    passages from offline retrieval rather than nothing."""
    import kodro.ai.ollama_client as oc

    monkeypatch.setattr(oc.OllamaClient, "available", lambda self: False)
    out = api.ai_ask("how do I check for a wall ahead")
    assert out["ok"] is True
    assert out["grounded"] is True
    assert out.get("noModel") is True
    assert out["sources"], "retrieval must return lesson material offline"


def test_get_class_heatmap_reflects_graded_submissions(api: BridgeAPI) -> None:
    """The teacher heatmap is now reachable from the web app and updates as
    pupils submit (previously Tk-only)."""
    empty = api.get_class_heatmap()
    assert empty["ok"] is True
    assert isinstance(empty["concepts"], list)
    assert isinstance(empty["pupils"], list)
    # Grade one lesson, then the active pupil should have at least one concept.
    lessons = api.list_lessons()
    api.submit_attempt(lessons[0]["id"], lessons[0]["starterCode"], None)
    heat = api.get_class_heatmap()
    me = next((p for p in heat["pupils"] if p["id"] == api._pupil_id), None)  # type: ignore[attr-defined]
    assert me is not None
    assert me["scores"], "a graded submission must populate the class heatmap"
    assert heat["concepts"], "the heatmap must list the concepts touched"


def _battery_gated_lesson_ids() -> list[str]:
    """Lesson ids that put a ceiling on battery -- the ones a build can break."""
    return [
        lesson.id
        for lesson in load_library()
        if any(c.max_battery_used is not None for c in lesson.success_criteria)
    ]


@pytest.mark.parametrize("lesson_id", _battery_gated_lesson_ids())
def test_grading_is_invariant_to_the_pupils_build(api: BridgeAPI, lesson_id: str) -> None:
    """The same program must earn the same mark whatever robot the pupil built.

    Lesson thresholds are fixed numbers in YAML, authored against the reference
    rover; nothing recalibrates ``max_battery_used`` per build. The browser
    grader strips build scaling out before grading, so if the desktop kept it
    in, the same correct program passed in one place and failed in the other --
    and the failure named the battery, blaming the program for a choice the
    pupil made on the design bench. 01_hello_rover's own shipped solution
    travels 2.00 m, which at 1.1 %/m is 2.20% against a 5% ceiling, so any mass
    factor above ~2.3 used to fail lesson one; at 10 it scored 80 and said
    "Battery used 22.0% (limit 5.0%)". That is what the 10.0 below reproduces.

    Every lesson here declares a battery ceiling, so these are exactly the
    lessons a heavy build could break.
    """
    lesson = next(les for les in load_library() if les.id == lesson_id)
    source = lesson.solution_code or ""
    assert source, f"{lesson_id} has no solution_code to submit"

    reference = api.submit_attempt(lesson_id, source, None)
    assert reference["passed"] is True, (
        f"{lesson_id}'s own solution must pass on the reference rover before "
        f"this test can say anything about builds: {reference['reasons']}"
    )

    # A build heavy enough that the old drain-scaled grader failed lesson one.
    heavy = api.submit_attempt(lesson_id, source, None, 10.0, None)
    # And an imported measured build, which takes the other branch of
    # _drain_scale_for (energy-true %/m, preferred over the mass proxy).
    measured = api.submit_attempt(lesson_id, source, None, None, 11.0)

    for label, result in (("heavy", heavy), ("measured", measured)):
        assert result["passed"] == reference["passed"], f"{label} build changed the verdict"
        assert result["score"] == reference["score"], f"{label} build changed the score"
        assert result["reasons"] == reference["reasons"], f"{label} build changed the reasons"


def test_energy_true_battery_still_reflects_the_build(api: BridgeAPI) -> None:
    """Grading ignores the build; the reported energy figure must not.

    Removing build scaling from the verdict is not the same as throwing the
    number away. The pupil still needs to see what their rover would actually
    have spent, so it is reported alongside the mark instead of inside it.

    Both halves of that pair are pinned here, because either one alone is
    unreadable: ``batteryUsedPct`` is what the mark was made against and must
    stay put whatever the pupil built, while ``energyTrueBatteryPct`` is what
    their own build would have cost and must move when the build does. The
    lesson card prints the two together and only when they differ, so the
    difference the UI keys off is asserted too.
    """
    lesson = next(les for les in load_library() if les.id == "01_hello_rover")
    source = lesson.solution_code or ""

    reference = api.submit_attempt(lesson.id, source, None)
    heavy = api.submit_attempt(lesson.id, source, None, 10.0, None)
    measured = api.submit_attempt(lesson.id, source, None, None, 11.0)

    assert "energyTrueBatteryPct" in reference
    assert "batteryUsedPct" in reference
    # Graded on the reference rover, so the graded figure is the unscaled one
    # and no build may shift it. Without this the UI's "marked on the reference
    # rover at X%" sentence could quietly quote a build-scaled number.
    assert reference["energyTrueBatteryPct"] == pytest.approx(reference["batteryUsedPct"])
    for label, result in (("heavy", heavy), ("measured", measured)):
        assert result["batteryUsedPct"] == pytest.approx(reference["batteryUsedPct"]), (
            f"{label} build moved the graded battery figure"
        )

    assert heavy["energyTrueBatteryPct"] > reference["energyTrueBatteryPct"], (
        "a ten-times-heavier build must report a bigger energy cost, otherwise "
        "the figure is decorative"
    )
    # The lesson card shows the build note only when the two round differently
    # at one decimal place (>= 0.05 apart). A heavy build that failed this would
    # leave the pupil with no explanation of why their design changed nothing.
    assert abs(heavy["energyTrueBatteryPct"] - heavy["batteryUsedPct"]) >= 0.05
    # Reported as a battery percentage, so it cannot exceed a full battery.
    assert 0.0 <= heavy["energyTrueBatteryPct"] <= 100.0


def test_submit_attempt_drives_the_learner_model(api: BridgeAPI) -> None:
    """The web path (not only the Tk app) updates concept strength, unlocks
    achievements, and returns the adaptive next-lesson pick."""
    from kodro.memory.pupil_model import get_strengths

    lessons = api.list_lessons()
    target_id = lessons[0]["id"]
    starter = lessons[0]["starterCode"]
    result = api.submit_attempt(target_id, starter, None)
    # New payload keys cross the wire.
    assert "achievements" in result and isinstance(result["achievements"], list)
    assert "recommended" in result  # may be None, but the key is present
    assert json.loads(json.dumps(result)) is not None
    # The concept model actually moved for this pupil (it was inert before).
    strengths = get_strengths(api._store, api._pupil_id)  # type: ignore[attr-defined]
    assert strengths, "submitting a lesson must update concept strength in the web app"


def test_submit_attempt_with_runtime_error_returns_reason_without_recording(
    api: BridgeAPI,
) -> None:
    """A pupil typo returns graded:False-pass but does NOT persist a 0-score row."""
    lessons = api.list_lessons()
    target_id = lessons[0]["id"]
    before = len(api._store.list_submissions(pupil_id=api._pupil_id))  # type: ignore[attr-defined]
    result = api.submit_attempt(target_id, "nonexistent_thing()", None)
    assert result["ok"] is True
    assert result["graded"] is True
    assert result["passed"] is False
    assert any("runtime" in r or "syntax" in r or "sandbox" in r for r in result["reasons"])
    after = len(api._store.list_submissions(pupil_id=api._pupil_id))  # type: ignore[attr-defined]
    assert after == before, "execution errors must not pollute submission history"


def test_export_report_writes_html(api: BridgeAPI, tmp_path: Path) -> None:
    import kodro.web.app as webapp

    # Redirect the report next to a temp DB dir so the test doesn't touch ~/.
    original = webapp.DEFAULT_DB_PATH
    webapp.DEFAULT_DB_PATH = tmp_path / "pupil.db"
    try:
        result = api.export_report()
    finally:
        webapp.DEFAULT_DB_PATH = original
    assert result["ok"] is True
    out = Path(result["path"])
    assert out.exists()
    assert out.suffix == ".html"
    assert "<html" in out.read_text(encoding="utf-8").lower()


def test_submit_attempt_unknown_lesson_returns_reason(api: BridgeAPI) -> None:
    result = api.submit_attempt("does-not-exist", "move_forward(1)", None)
    assert result["ok"] is False
    assert "unknown lesson" in result["reason"]


def test_get_hint_returns_dict_or_none(api: BridgeAPI) -> None:
    lessons = api.list_lessons()
    # Empty source against any lesson should match the "no events" hint or None.
    result = api.get_hint(lessons[0]["id"], "")
    assert result is None or set(result.keys()) == {"ruleName", "message"}


def test_log_accepts_known_levels(api: BridgeAPI) -> None:
    for level in ("info", "warning", "error", "debug", "unknown"):
        assert api.log(level, f"test {level}") == {"ok": True}


def test_startup_failure_message_guides_to_webview2() -> None:
    """A pywebview start failure yields actionable guidance, not a raw crash."""
    from kodro.web.app import _startup_failure_message

    msg = _startup_failure_message(RuntimeError("WebView2Runtime not found"))
    assert "WebView2" in msg
    assert "developer.microsoft.com" in msg
    assert "python -m kodro" in msg  # offers the Tk fallback


def test_report_startup_failure_is_safe_off_windows(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Off Windows the handler writes to stderr and never raises."""
    import kodro.web.app as appmod

    monkeypatch.setattr(appmod.sys, "platform", "linux")
    appmod._report_startup_failure(RuntimeError("boom"))  # must not raise


def test_ai_status_degrades_gracefully_without_ollama(api: BridgeAPI) -> None:
    """No local Ollama server -> available False, never an exception."""
    s = api.ai_status()
    assert isinstance(s, dict)
    assert s["available"] in (True, False)
    if not s["available"]:
        assert s["model"] is None and s["models"] == []


def test_ai_generate_without_server_returns_guidance(api: BridgeAPI) -> None:
    r = api.ai_generate("drive in a square")
    assert isinstance(r, dict)
    if not r.get("ok"):
        # Offline guidance must tell the pupil how to enable it.
        assert "Ollama" in r["reason"] or "model" in r["reason"].lower()


def test_ai_generate_rejects_empty_prompt(api: BridgeAPI) -> None:
    r = api.ai_generate("   ")
    assert r["ok"] is False


def test_strip_code_fences() -> None:
    from kodro.web.app import _strip_code_fences

    fenced = "```python\nmove_forward(2)\nbeep(1)\n```"
    assert _strip_code_fences(fenced) == "move_forward(2)\nbeep(1)\n"
    bare = "turn_left(90)"
    assert _strip_code_fences(bare) == "turn_left(90)\n"


def test_ai_model_preference_prefers_qwen_then_gemma(api: BridgeAPI) -> None:
    pick = api._pick_ai_model(["llama3.2:3b", "gemma3:4b", "qwen2.5-coder:3b"])
    assert pick == "qwen2.5-coder:3b"
    pick2 = api._pick_ai_model(["llama3.2:3b", "gemma3:4b"])
    assert pick2 == "gemma3:4b"
    assert api._pick_ai_model([]) is None


def test_ai_chat_rejects_empty_history(api: BridgeAPI) -> None:
    assert api.ai_chat([])["ok"] is False


# --- KRS spec import/export bridge (PERFECTION_PLAN SI1) -------------------


def test_import_robot_spec_without_window_degrades(api: BridgeAPI) -> None:
    """Headless (no pywebview window): a clean refusal, never a crash."""
    result = api.import_robot_spec()
    assert result["ok"] is False
    assert result["reason"]


def test_export_robot_spec_rejects_empty_payload(api: BridgeAPI) -> None:
    result = api.export_robot_spec("")
    assert result == {"ok": False, "reason": "nothing to save"}


def test_export_robot_spec_without_window_degrades(api: BridgeAPI) -> None:
    result = api.export_robot_spec('{"kodroSpec": 1}')
    assert result["ok"] is False
    assert result["reason"] == "no window"


def test_export_robot_spec_rejects_oversize_payload(api: BridgeAPI) -> None:
    result = api.export_robot_spec("x" * 300_000)
    assert result == {"ok": False, "reason": "content too large"}


def test_save_verification_report_without_window_degrades(api: BridgeAPI) -> None:
    result = api.save_verification_report("<html>report</html>")
    assert result["ok"] is False
    assert result["reason"] == "no window"


def test_drain_scale_for_prefers_energy_true_over_mass_proxy() -> None:
    """Grading a build spec-aware: energy-true per-metre drain wins; else mass."""
    from kodro.web.app import _BASELINE_DRAIN_PCT_PER_M, _drain_scale_for

    # No build info -> unchanged (the pre-existing fixed drain).
    assert _drain_scale_for(None, None) == pytest.approx(1.0)
    # Mass factor alone scales drain.
    assert _drain_scale_for(1.5, None) == pytest.approx(1.5)
    # An energy-true per-metre drain OVERRIDES the mass proxy.
    true_pct = 2.0 * _BASELINE_DRAIN_PCT_PER_M  # twice the baseline endurance cost
    assert _drain_scale_for(1.5, true_pct) == pytest.approx(2.0)
    # Nonsensical values fall back to 1.0, never zero/negative/NaN drain.
    assert _drain_scale_for(0.0, -1.0) == pytest.approx(1.0)
    assert _drain_scale_for(float("nan"), float("inf")) == pytest.approx(1.0)
