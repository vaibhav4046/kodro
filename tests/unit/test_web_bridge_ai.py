"""BridgeAPI AI + file-dialog tests: the Ollama-backed and host-dialog surface.

The AI methods on :class:`~robolearn.web.app.BridgeAPI` each build an
``OllamaClient`` inline. These tests inject a *fake* client (monkeypatching
``robolearn.ai.ollama_client.OllamaClient``) so the server-up success paths,
the validate/repair paths and the error paths all run without a live Ollama
server -- deterministically and fast.

The file-dialog methods (``pick_photo``, ``import_robot_spec``,
``export_robot_spec``, ``save_verification_report``) reach through
``webview.windows[0].create_file_dialog(...)``. These tests install a fake
window so the "picked a file" and "cancelled" branches both run against a
real temp file, never a live pywebview host.

Style mirrors ``test_web_bridge.py``: AAA structure, the shared ``api``
fixture, descriptive names, and JSON round-trips where the value crosses the
pywebview wire.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import ClassVar

import pytest

from robolearn.lessons.schema import load_library
from robolearn.memory.store import Store
from robolearn.web.app import BridgeAPI


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


# --- fake Ollama client ----------------------------------------------------


#: A valid build-plan JSON the real ``_parse_build_plan`` accepts.
_VALID_BUILD_JSON = json.dumps(
    {
        "tier": "ESP32 rover",
        "summary": "A small two-wheeled ESP32 rover.",
        "parts": [
            {"name": "ESP32 dev board", "role": "Brain", "cost": 8.0},
            {"name": "TT motors", "role": "Movement", "cost": 10.0},
        ],
        "steps": ["Mount the motors.", "Wire the driver.", "Flash MicroPython."],
        "maps": [{"robolearn": "move_forward(1)", "hardware": "Drive both motors."}],
        "total": 18.0,
    }
)


class FakeOllamaClient:
    """Stand-in for :class:`OllamaClient` with scriptable behaviour.

    Class-level knobs let a test decide, before instantiation, whether the
    server is "up", which models are installed, what ``generate`` returns
    (a string, or a list cycled through per call), whether ``generate``
    raises :class:`OllamaError`, and what ``generate_stream`` yields.
    """

    #: Overridden per-test via ``monkeypatch.setattr`` on these attributes.
    up: ClassVar[bool] = True
    installed: ClassVar[list[str]] = ["qwen2.5-coder:3b"]
    responses: ClassVar[object] = "move_forward(2)\n"  # str, or list[str] per call
    raise_on_generate: ClassVar[bool] = False
    stream_chunks: ClassVar[list[str]] = ["move_forward", "(2)\n"]

    def __init__(self, *args: object, **kwargs: object) -> None:
        self.calls: list[str] = []
        self._response_idx = 0

    # availability ---------------------------------------------------------
    def available(self) -> bool:
        return type(self).up

    def models(self) -> list[str]:
        return list(type(self).installed)

    # generation -----------------------------------------------------------
    def generate(self, prompt: str, **kwargs: object) -> str:
        from robolearn.ai.ollama_client import OllamaError

        self.calls.append(prompt)
        if type(self).raise_on_generate:
            raise OllamaError("boom")
        resp = type(self).responses
        if isinstance(resp, list):
            out = resp[min(self._response_idx, len(resp) - 1)]
            self._response_idx += 1
            return out
        return str(resp)

    def generate_stream(self, prompt: str, **kwargs: object):  # type: ignore[no-untyped-def]
        from robolearn.ai.ollama_client import OllamaError

        if type(self).raise_on_generate:
            raise OllamaError("stream boom")
        yield from type(self).stream_chunks


@pytest.fixture
def fake_ollama(monkeypatch: pytest.MonkeyPatch) -> type[FakeOllamaClient]:
    """Patch OllamaClient everywhere app.py imports it, reset to sane defaults."""
    # Reset class knobs so tests don't leak state into each other.
    FakeOllamaClient.up = True
    FakeOllamaClient.installed = ["qwen2.5-coder:3b"]
    FakeOllamaClient.responses = "move_forward(2)\n"
    FakeOllamaClient.raise_on_generate = False
    FakeOllamaClient.stream_chunks = ["move_forward", "(2)\n"]
    monkeypatch.setattr("robolearn.ai.ollama_client.OllamaClient", FakeOllamaClient, raising=True)
    return FakeOllamaClient


# --- fake pywebview window -------------------------------------------------


class FakeWindow:
    """A pywebview window whose file dialog returns a scripted path (or None)."""

    def __init__(self, result: object) -> None:
        self._result = result
        self.calls: list[dict[str, object]] = []

    def create_file_dialog(self, dialog_type: object, **kwargs: object) -> object:
        self.calls.append({"type": dialog_type, **kwargs})
        return self._result


def _install_window(monkeypatch: pytest.MonkeyPatch, result: object) -> FakeWindow:
    """Make ``webview.windows[0]`` a FakeWindow returning ``result``."""
    import robolearn.web.app as appmod

    window = FakeWindow(result)
    monkeypatch.setattr(appmod.webview, "windows", [window], raising=False)
    return window


# --- ai_status (server-up branch) ------------------------------------------


def test_ai_status_reports_models_when_server_up(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.installed = ["gemma3:4b", "qwen2.5-coder:3b"]
    status = api.ai_status()
    assert status["available"] is True
    assert status["models"] == ["gemma3:4b", "qwen2.5-coder:3b"]
    assert status["model"] == "qwen2.5-coder:3b"  # family preference wins
    assert "override" in status
    json.dumps(status)  # crosses the wire


# --- set_ai_model (persist + clear override) -------------------------------


def test_set_ai_model_persists_and_clears_override(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Redirect ~/.robolearn so the test never writes to the real home dir.
    fake_home = tmp_path / "home"
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: fake_home))

    set_result = api.set_ai_model("deepseek-coder:6.7b")
    assert set_result == {"ok": True, "model": "deepseek-coder:6.7b"}
    assert api._ai_model_override == "deepseek-coder:6.7b"  # type: ignore[attr-defined]
    written = json.loads((fake_home / ".robolearn" / "ai_models.json").read_text())
    assert written == {"model": "deepseek-coder:6.7b"}

    # The override short-circuits selection when that model IS installed...
    assert (  # type: ignore[attr-defined]
        api._pick_ai_model(["gemma3:4b", "deepseek-coder:6.7b"]) == "deepseek-coder:6.7b"
    )
    # ...and also when the installed list is empty (can't disprove it's there).
    assert api._pick_ai_model([]) == "deepseek-coder:6.7b"  # type: ignore[attr-defined]

    # Empty name clears the override (back to automatic).
    cleared = api.set_ai_model("   ")
    assert cleared == {"ok": True, "model": None}
    assert api._ai_model_override is None  # type: ignore[attr-defined]


# --- ai_generate (success / repair / offline / no-model / error) -----------


def test_ai_generate_returns_validated_code_on_success(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "move_forward(2)\nbeep(1)\n"
    result = api.ai_generate("drive forward and beep")
    assert result["ok"] is True
    assert "move_forward" in result["code"]
    assert result["validated"] is True
    assert result["model"] == "qwen2.5-coder:3b"
    json.dumps(result)


def test_ai_generate_self_repairs_invalid_first_draft(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    # First draft references an undefined name (fails the sandbox); the repair
    # round returns clean code, so the repaired flag comes back True.
    fake_ollama.responses = ["undefined_name_here()\n", "move_forward(1)\n"]
    result = api.ai_generate("go forward")
    assert result["ok"] is True
    assert result["repaired"] is True
    assert "move_forward" in result["code"]


def test_ai_generate_discards_trailing_fence_and_model_explanation(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "move_forward(2)\nturn_right(90)\n```\nThis program drives and turns."
    result = api.ai_generate("drive and turn")
    assert result["ok"] is True
    assert result["validated"] is True
    assert "```" not in result["code"]
    assert "This program" not in result["code"]


def test_ai_generate_discards_explanation_after_wrapped_code_fence(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = (
        "```python\nmove_forward(2)\nturn_right(90)\n```\nThis program drives and turns."
    )
    result = api.ai_generate("drive and turn")
    assert result["ok"] is True
    assert result["validated"] is True
    assert result["code"].strip().endswith("turn_right(90)")


def test_ai_generate_fails_closed_when_repair_is_still_invalid(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = ["invented_command()\n", "still_invented()\n"]
    result = api.ai_generate("do something impossible")
    assert result["ok"] is False
    assert "safety check" in result["reason"]
    assert "validationError" in result
    assert "rejectedCode" in result


def test_ai_generate_rejects_sensor_missing_from_active_build(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "read_distance()\n"
    result = api.ai_generate(
        "stop near a wall",
        allowed_commands=["move_forward", "turn_right", "set_speed"],
    )
    assert result["ok"] is False
    assert "missing capability: distance" in result["validationError"]


def test_ai_generate_accepts_browser_distance_alias_when_sensor_is_fitted(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "if distance() < 100:\n    turn_right(90)\n"

    result = api.ai_generate(
        "turn when the wall is within one metre",
        allowed_commands=["distance", "turn_right"],
    )

    assert result["ok"] is True
    assert "distance()" in result["code"]
    assert result["validated"] is True


def test_ai_generate_rejects_browser_distance_alias_when_sensor_is_missing(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "distance()\n"

    result = api.ai_generate(
        "read the wall distance",
        allowed_commands=["move_forward", "turn_right"],
    )

    assert result["ok"] is False
    assert "missing capability: distance" in result["validationError"]


def test_ai_generate_offline_returns_guidance(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.up = False
    result = api.ai_generate("drive in a square")
    assert result["ok"] is False
    assert "Ollama" in result["reason"]


def test_ai_generate_no_models_returns_pull_hint(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.installed = []
    result = api.ai_generate("drive in a square")
    assert result["ok"] is False
    assert "no models" in result["reason"].lower()


def test_ai_generate_transport_error_is_reported(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.raise_on_generate = True
    result = api.ai_generate("drive forward")
    assert result["ok"] is False
    assert "failed" in result["reason"].lower()


def test_ai_generate_uses_lesson_context_when_given(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    lessons = api.list_lessons()
    lid = lessons[0]["id"]
    result = api.ai_generate("drive forward", lesson_id=lid)
    # The lesson-context branch runs (user_prompt is enriched with the goal)
    # and the generated code still validates and comes back runnable.
    assert result["ok"] is True
    assert "move_forward" in result["code"]


# --- ai_review_code (server-up review, offline, no-model, error) -----------


def test_ai_review_code_returns_issues_and_code(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    # The critic returns JSON: two issues and a better program that validates.
    review_json = json.dumps(
        {"issues": ["Add a comment.", "Name the distance."], "code": "move_forward(3)\n"}
    )
    fake_ollama.responses = review_json
    result = api.ai_review_code("move_forward(3)")
    assert result["ok"] is True
    assert result["issues"] == ["Add a comment.", "Name the distance."]
    assert "code" in result
    assert isinstance(result["revised"], bool)
    json.dumps(result)


def test_ai_review_filters_unsupported_missing_sensor_complaints(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = json.dumps(
        {
            "issues": ["No heading sensor", "No range sensor", "Add a useful comment."],
            "code": "",
        }
    )
    result = api.ai_review_code("move_forward(2)\nturn_right(90)\n")
    assert result["ok"] is True
    assert result["issues"] == ["Add a useful comment."]


def test_ai_review_code_rejects_empty_source(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    result = api.ai_review_code("   ")
    assert result["ok"] is False


def test_ai_review_code_offline_degrades(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.up = False
    result = api.ai_review_code("move_forward(1)")
    assert result["ok"] is False
    assert "offline" in result["reason"].lower()


def test_ai_review_code_no_models_degrades(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.installed = []
    result = api.ai_review_code("move_forward(1)")
    assert result["ok"] is False
    assert "models" in result["reason"].lower()


def test_ai_review_code_transport_error_is_reported(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.raise_on_generate = True
    result = api.ai_review_code("move_forward(1)")
    assert result["ok"] is False
    assert "review failed" in result["reason"].lower()


# --- ai_ask (model-present path, no-model, error) --------------------------


def test_ai_ask_with_model_returns_grounded_answer(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "Use move_forward(metres) to drive. [1]"
    result = api.ai_ask("how do I move the rover forward")
    assert result["ok"] is True
    assert result["grounded"] is True
    assert result["answer"]
    assert result["model"] == "qwen2.5-coder:3b"


def test_ai_ask_normalises_object_method_and_checks_current_build(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "Call rover.turn_right(90) to turn. [1]"
    result = api.ai_ask("how do I turn right", allowed_commands=["turn_right"])
    assert result["ok"] is True
    assert "rover.turn_right" not in result["answer"]
    assert "turn_right(90)" in result["answer"]
    assert result["answerChecked"] is True


def test_ai_ask_refuses_command_missing_from_current_build(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "Use move_forward(2). [1]"
    result = api.ai_ask("how do I drive", allowed_commands=["set_speed", "say"])
    assert result["ok"] is True
    assert result["answerChecked"] is False
    assert "not available" in result["answer"]


def test_ai_ask_no_models_returns_pull_hint(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.installed = []
    result = api.ai_ask("how do I move forward")
    assert result["ok"] is False
    assert "models" in result["reason"].lower()


def test_ai_ask_transport_error_is_reported(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.raise_on_generate = True
    result = api.ai_ask("how do I move the rover forward")
    assert result["ok"] is False
    assert "ask failed" in result["reason"].lower()


# --- budget_build (success / fallback / offline / no-model / error) --------


def test_budget_build_returns_structured_plan(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = _VALID_BUILD_JSON
    result = api.budget_build(30.0, "explore the garden")
    assert result["ok"] is True
    assert result["budget"] == 30
    assert result["tier"] == "ESP32 rover"
    assert result["parts"] and all("cost" in p for p in result["parts"])
    assert result["steps"]
    assert result["model"] == "qwen2.5-coder:3b"
    json.dumps(result)


def test_budget_build_falls_back_when_model_output_unusable(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    # No JSON object in the reply -> _parse_build_plan returns None both
    # attempts, so the deterministic fallback floor is returned instead.
    fake_ollama.responses = "sorry, I cannot help with that"
    result = api.budget_build(15.0)
    assert result["ok"] is True
    assert result.get("fallback") is True
    assert result["tier"] == "Cardboard micro-rover"  # budget < 20 branch


def test_budget_build_fallback_uses_esp32_floor_for_larger_budget(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "no json here"
    result = api.budget_build(50.0)
    assert result["ok"] is True
    assert result.get("fallback") is True
    assert result["tier"] == "ESP32 starter rover"  # budget >= 20 branch


def test_budget_build_offline_degrades(api: BridgeAPI, fake_ollama: type[FakeOllamaClient]) -> None:
    fake_ollama.up = False
    result = api.budget_build(30.0)
    assert result["ok"] is False
    assert "offline" in result["reason"].lower()


def test_budget_build_no_models_degrades(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.installed = []
    result = api.budget_build(30.0)
    assert result["ok"] is False
    assert "models" in result["reason"].lower()


def test_budget_build_transport_error_is_reported(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.raise_on_generate = True
    result = api.budget_build(30.0)
    assert result["ok"] is False
    assert "ai failed" in result["reason"].lower()


def test_budget_build_clamps_bad_budget_to_default(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = _VALID_BUILD_JSON
    result = api.budget_build("not-a-number")  # type: ignore[arg-type]
    assert result["ok"] is True
    assert result["budget"] == 30  # fell back to the 30.0 default


# --- _parse_build_plan / _fallback_build (static helpers) ------------------


def test_parse_build_plan_rejects_non_json() -> None:
    assert BridgeAPI._parse_build_plan("no braces here", 30.0) is None  # type: ignore[attr-defined]


def test_parse_build_plan_rejects_plan_without_parts() -> None:
    empty = json.dumps({"tier": "x", "parts": []})
    assert BridgeAPI._parse_build_plan(empty, 30.0) is None  # type: ignore[attr-defined]


def test_parse_build_plan_normalises_and_caps_fields() -> None:
    plan = BridgeAPI._parse_build_plan(_VALID_BUILD_JSON, 30.0)  # type: ignore[attr-defined]
    assert plan is not None
    assert plan["tier"] == "ESP32 rover"
    assert len(plan["parts"]) == 2
    assert plan["total"] == 18.0


def test_fallback_build_scales_with_budget() -> None:
    tiny = BridgeAPI._fallback_build(10.0)  # type: ignore[attr-defined]
    big = BridgeAPI._fallback_build(40.0)  # type: ignore[attr-defined]
    assert tiny["tier"] == "Cardboard micro-rover"
    assert big["tier"] == "ESP32 starter rover"


# --- ai_chat (question branch, code branch, error, offline, no-model) ------


def test_ai_chat_asks_a_clarifying_question(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "QUESTION: How far should the rover drive, in metres?"
    result = api.ai_chat([{"role": "user", "text": "go forward"}])
    assert result["ok"] is True
    assert result["type"] == "question"
    assert "metres" in result["text"]


def test_ai_chat_returns_validated_code(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.responses = "CODE:\nmove_forward(2)\nturn_right(90)\n"
    result = api.ai_chat([{"role": "user", "text": "drive forward then turn"}])
    assert result["ok"] is True
    assert result["type"] == "code"
    assert "move_forward" in result["code"]


def test_ai_chat_offline_degrades(api: BridgeAPI, fake_ollama: type[FakeOllamaClient]) -> None:
    fake_ollama.up = False
    result = api.ai_chat([{"role": "user", "text": "go forward"}])
    assert result["ok"] is False
    assert "offline" in result["reason"].lower()


def test_ai_chat_no_models_degrades(api: BridgeAPI, fake_ollama: type[FakeOllamaClient]) -> None:
    fake_ollama.installed = []
    result = api.ai_chat([{"role": "user", "text": "go forward"}])
    assert result["ok"] is False
    assert "models" in result["reason"].lower()


def test_ai_chat_transport_error_is_reported(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.raise_on_generate = True
    result = api.ai_chat([{"role": "user", "text": "go forward"}])
    assert result["ok"] is False
    assert "ai failed" in result["reason"].lower()


def test_ai_chat_prompt_includes_lesson_context(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    lessons = api.list_lessons()
    fake_ollama.responses = "CODE:\nmove_forward(1)\n"
    result = api.ai_chat([{"role": "user", "text": "drive forward"}], lesson_id=lessons[0]["id"])
    assert result["ok"] is True
    assert result["type"] == "code"


# --- _finalize_chat_reply (repair + re-roll + escalation branches) ---------


def test_finalize_chat_reply_repairs_invalid_draft(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    client = FakeOllamaClient(api)
    # raw is invalid; the single repair round (client.generate) returns clean.
    fake_ollama.responses = "move_forward(1)\n"
    result = api._finalize_chat_reply(  # type: ignore[attr-defined]
        client, "qwen2.5-coder:3b", "undefined_here()\n", prompt="drive"
    )
    assert result["ok"] is True
    assert result["type"] == "code"
    assert "move_forward" in result["code"]


def test_finalize_chat_reply_escalates_to_quality_model(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    client = FakeOllamaClient(api)
    # Repair fails, re-roll fails, escalation (quality model) finally lands.
    fake_ollama.responses = [
        "still_broken()\n",  # repair round
        "also_broken()\n",  # temperature re-roll
        "move_forward(3)\n",  # escalation with quality model
    ]
    result = api._finalize_chat_reply(  # type: ignore[attr-defined]
        client,
        "kodro-fast:1b",
        "first_broken()\n",
        escalate_model="qwen2.5-coder:3b",
        prompt="drive forward",
    )
    assert result["ok"] is True
    assert result["type"] == "code"
    assert result["model"] == "qwen2.5-coder:3b"


def test_finalize_chat_reply_returns_original_when_all_repairs_fail(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    client = FakeOllamaClient(api)
    fake_ollama.responses = "still_broken()\n"  # every attempt is invalid
    # A syntactically VALID but semantically-original code path: the method
    # returns the (unrepaired) code with type "code" as the final fallback.
    result = api._finalize_chat_reply(  # type: ignore[attr-defined]
        client, "qwen2.5-coder:3b", "move_forward(2)\n", prompt="drive"
    )
    assert result["ok"] is True
    assert result["type"] == "code"


def test_finalize_chat_reply_fails_closed_when_all_code_is_invalid(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    client = FakeOllamaClient(api)
    fake_ollama.responses = "still_broken()\n"
    result = api._finalize_chat_reply(  # type: ignore[attr-defined]
        client, "qwen2.5-coder:3b", "first_broken()\n", prompt="drive"
    )
    assert result["ok"] is False
    assert "validationError" in result
    assert result["rejectedCode"].strip() == "first_broken()"


def test_finalize_chat_reply_rejects_unfitted_drive_command(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    client = FakeOllamaClient(api)
    fake_ollama.responses = "move_forward(1)\n"
    result = api._finalize_chat_reply(  # type: ignore[attr-defined]
        client,
        "qwen2.5-coder:3b",
        "move_forward(2)\n",
        allowed_commands=frozenset({"set_speed", "say"}),
    )
    assert result["ok"] is False
    assert "current robot build" in result["validationError"]


def test_finalize_chat_reply_rejects_empty_reply(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    client = FakeOllamaClient(api)
    result = api._finalize_chat_reply(client, "qwen2.5-coder:3b", "   ")  # type: ignore[attr-defined]
    assert result["ok"] is False


# --- ai_chat_start / ai_chat_poll (streaming job lifecycle) ----------------


def _poll_until_done(api: BridgeAPI, job_id: str, tries: int = 200) -> dict[str, object]:
    """Poll a streaming job to completion (the worker thread is near-instant)."""
    import time

    for _ in range(tries):
        out = api.ai_chat_poll(job_id)
        if out.get("done"):
            return out
        time.sleep(0.01)
    raise AssertionError("streaming job never completed")


def test_ai_chat_start_streams_code_to_completion(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.stream_chunks = ["move_forward", "(2)\n", "beep(1)\n"]
    started = api.ai_chat_start([{"role": "user", "text": "drive and beep"}])
    assert started["ok"] is True
    job_id = started["jobId"]
    result = _poll_until_done(api, job_id)
    assert result["ok"] is True
    assert result["type"] == "code"
    assert "move_forward" in result["code"]
    # The job is popped once claimed: a second poll is an unknown job.
    assert api.ai_chat_poll(job_id)["ok"] is False


def test_ai_chat_start_rejects_empty_history(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    assert api.ai_chat_start([])["ok"] is False


def test_ai_chat_start_offline_degrades(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.up = False
    result = api.ai_chat_start([{"role": "user", "text": "go"}])
    assert result["ok"] is False
    assert "offline" in result["reason"].lower()


def test_ai_chat_start_no_models_degrades(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.installed = []
    result = api.ai_chat_start([{"role": "user", "text": "go"}])
    assert result["ok"] is False
    assert "models" in result["reason"].lower()


def test_ai_chat_start_serves_cached_result_instantly(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.stream_chunks = ["move_forward(2)\n"]
    messages = [{"role": "user", "text": "drive forward two metres"}]
    first = api.ai_chat_start(messages)
    _poll_until_done(api, first["jobId"])  # populates the answer cache
    # An identical request is served straight from cache (marked cached).
    second = api.ai_chat_start(messages)
    assert second["ok"] is True
    assert second.get("cached") is True
    cached_result = api.ai_chat_poll(second["jobId"])
    assert cached_result["ok"] is True
    assert cached_result["type"] == "code"


def test_ai_chat_poll_unknown_job(api: BridgeAPI) -> None:
    result = api.ai_chat_poll("no-such-job")
    assert result["ok"] is False
    assert "unknown" in result["reason"].lower()


def test_ai_chat_start_streaming_error_is_reported(
    api: BridgeAPI, fake_ollama: type[FakeOllamaClient]
) -> None:
    fake_ollama.raise_on_generate = True
    started = api.ai_chat_start([{"role": "user", "text": "drive"}])
    assert started["ok"] is True  # job starts; the failure surfaces on poll
    result = _poll_until_done(api, started["jobId"])
    assert result["ok"] is False
    assert "failed" in result["reason"].lower()


# --- pick_photo (no window, cancelled, picked, oversize) -------------------


def test_pick_photo_without_window_degrades(api: BridgeAPI) -> None:
    result = api.pick_photo()
    assert result["ok"] is False
    assert result["reason"] == "no window"


def test_pick_photo_cancelled_returns_reason(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install_window(monkeypatch, result=None)  # user cancelled the dialog
    result = api.pick_photo()
    assert result["ok"] is False
    assert result["reason"] == "cancelled"


def test_pick_photo_returns_data_url_for_picked_image(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # A tiny valid PNG on disk; the method reads it and hands back a data URL.
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00"
        b"\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    img = tmp_path / "me.png"
    img.write_bytes(png_bytes)
    _install_window(monkeypatch, result=[str(img)])
    result = api.pick_photo()
    assert result["ok"] is True
    assert result["name"] == "me.png"
    assert result["dataUrl"].startswith("data:image/png;base64,")


def test_pick_photo_rejects_oversize_image(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    big = tmp_path / "huge.png"
    big.write_bytes(b"\x00" * 4_000_001)  # over the 4 MB guard
    _install_window(monkeypatch, result=[str(big)])
    result = api.pick_photo()
    assert result["ok"] is False
    assert "too large" in result["reason"].lower()


# --- import_robot_spec (cancelled, picked, oversize) -----------------------


def test_import_robot_spec_cancelled_returns_reason(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install_window(monkeypatch, result=None)
    result = api.import_robot_spec()
    assert result["ok"] is False
    assert result["reason"] == "cancelled"


def test_import_robot_spec_reads_picked_file(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    spec = tmp_path / "robot.kodro.json"
    spec.write_text('{"kodroSpec": 1}', encoding="utf-8")
    _install_window(monkeypatch, result=[str(spec)])
    result = api.import_robot_spec()
    assert result["ok"] is True
    assert result["name"] == "robot.kodro.json"
    assert json.loads(result["text"]) == {"kodroSpec": 1}


def test_import_robot_spec_rejects_oversize_file(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    spec = tmp_path / "big.json"
    spec.write_bytes(b"x" * 300_000)  # over the 256 KB cap
    _install_window(monkeypatch, result=[str(spec)])
    result = api.import_robot_spec()
    assert result["ok"] is False
    assert "256 KB" in result["reason"]


# --- export_robot_spec / save_verification_report (cancelled, saved) -------


def test_export_robot_spec_cancelled_returns_reason(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install_window(monkeypatch, result=None)
    result = api.export_robot_spec('{"kodroSpec": 1}')
    assert result["ok"] is False
    assert result["reason"] == "cancelled"


def test_export_robot_spec_writes_the_chosen_path(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    out = tmp_path / "saved.kodro.json"
    _install_window(monkeypatch, result=str(out))  # SAVE_DIALOG returns a str
    payload = '{"kodroSpec": 1, "name": "rover"}'
    result = api.export_robot_spec(payload)
    assert result["ok"] is True
    assert Path(result["path"]) == out
    assert out.read_text(encoding="utf-8") == payload


def test_save_verification_report_writes_html(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    out = tmp_path / "report.html"
    _install_window(monkeypatch, result=[str(out)])
    html = "<html><body>Your robot as simulated</body></html>"
    result = api.save_verification_report(html)
    assert result["ok"] is True
    assert out.read_text(encoding="utf-8") == html


def test_save_verification_report_cancelled_returns_reason(
    api: BridgeAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install_window(monkeypatch, result=None)
    result = api.save_verification_report("<html>report</html>")
    assert result["ok"] is False
    assert result["reason"] == "cancelled"


def test_save_verification_report_rejects_empty_text(api: BridgeAPI) -> None:
    result = api.save_verification_report("   ")
    assert result == {"ok": False, "reason": "nothing to save"}
