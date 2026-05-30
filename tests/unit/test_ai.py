"""AI subsystem tests — every network call is faked, so CI stays offline."""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest

from robolearn.ai.lesson_generator import GenerationError, generate_lesson
from robolearn.ai.ollama_client import OllamaClient, OllamaError, is_available, list_models
from robolearn.ai.tutor import explain_code, generate_quiz
from robolearn.lessons.schema import Lesson, WorldDef


class _FakeClient(OllamaClient):
    """An OllamaClient whose transport is replaced by canned replies."""

    def __init__(self, *, reply: str = "", replies: list[str] | None = None) -> None:
        super().__init__()
        self._reply = reply
        self._replies = replies or []
        self._call = 0

    def generate(self, prompt: str, **_: object) -> str:  # type: ignore[override]
        if self._replies:
            out = self._replies[min(self._call, len(self._replies) - 1)]
            self._call += 1
            return out
        return self._reply

    def generate_stream(self, prompt: str, **_: object) -> Iterator[str]:  # type: ignore[override]
        yield self._reply

    def available(self) -> bool:  # type: ignore[override]
        return True

    def models(self) -> list[str]:  # type: ignore[override]
        return ["llama3.2:3b"]


_VALID_LESSON_JSON = json.dumps(
    {
        "id": "ai_demo",
        "title": "AI demo lesson",
        "key_stage": "KS3",
        "ct_concepts": ["sequence"],
        "curriculum_refs": ["AI-authored"],
        "prereqs": [],
        "terrain": "mars",
        "intro": "Drive forward and collect the sample.",
        "starter_code": "move_forward(3)\ncollect_sample()",
        "allowed_constructs": ["function_call"],
        "max_lines": 10,
        "world": {"base": [1.0, 1.0], "samples": [[3.0, 1.0]]},
        "success_criteria": [{"samples_collected": 1}],
        "hints": {"on_failure": ["Drive further."]},
    }
)


# --- ollama_client soft helpers --------------------------------------------


def test_is_available_false_when_server_down() -> None:
    # Port 1 is never an Ollama server -> connection refused -> False.
    assert is_available("http://localhost:1") is False


def test_list_models_empty_when_server_down() -> None:
    assert list_models("http://localhost:1") == []


def test_client_available_false_on_bad_host() -> None:
    assert OllamaClient(base_url="http://localhost:1").available() is False


def test_client_models_empty_on_bad_host() -> None:
    assert OllamaClient(base_url="http://localhost:1").models() == []


def test_embed_returns_empty_on_failure() -> None:
    assert OllamaClient(base_url="http://localhost:1").embed("hello") == []


def test_generate_raises_ollama_error_on_bad_host() -> None:
    with pytest.raises(OllamaError):
        OllamaClient(base_url="http://localhost:1", timeout_s=1.0).generate("hi")


# --- lesson generator ------------------------------------------------------


def test_generate_lesson_returns_validated_lesson() -> None:
    client = _FakeClient(reply=_VALID_LESSON_JSON)
    result = generate_lesson("a mars lesson", client=client)
    assert isinstance(result.lesson, Lesson)
    assert result.lesson.id == "ai_demo"
    assert result.attempts == 1


def test_generate_lesson_extracts_json_from_chatty_reply() -> None:
    chatty = f"Sure! Here is your lesson:\n{_VALID_LESSON_JSON}\nHope that helps!"
    client = _FakeClient(reply=chatty)
    result = generate_lesson("x", client=client)
    assert result.lesson.id == "ai_demo"


def test_generate_lesson_retries_then_succeeds() -> None:
    client = _FakeClient(replies=["not json", _VALID_LESSON_JSON])
    result = generate_lesson("x", client=client)
    assert result.attempts == 2


def test_generate_lesson_raises_after_max_attempts() -> None:
    client = _FakeClient(reply="still not json")
    with pytest.raises(GenerationError):
        generate_lesson("x", client=client, max_attempts=2)


def test_generate_lesson_raises_on_schema_violation() -> None:
    bad = json.dumps({"id": "x"})  # missing required fields
    client = _FakeClient(reply=bad)
    with pytest.raises(GenerationError):
        generate_lesson("x", client=client, max_attempts=1)


def test_generate_lesson_coerces_concept_synonyms() -> None:
    # A model emitting "algorithms"/"loops" should be coerced, not rejected.
    payload = json.loads(_VALID_LESSON_JSON)
    payload["ct_concepts"] = ["algorithms", "loops"]
    payload["allowed_constructs"] = ["for_loop", "if_statement"]
    payload["terrain"] = "MARS"
    payload["key_stage"] = "ks3"
    client = _FakeClient(reply=json.dumps(payload))
    result = generate_lesson("x", client=client)
    concepts = result.lesson.ct_concepts
    assert "algorithmic_efficiency" in concepts
    assert "iteration" in concepts
    assert "for" in result.lesson.allowed_constructs
    assert result.lesson.terrain.value == "mars"
    assert result.lesson.key_stage == "KS3"


# --- tutor -----------------------------------------------------------------


def test_explain_code_returns_text() -> None:
    client = _FakeClient(reply="Your rover drives forward then beeps. Try a loop next.")
    out = explain_code("move_forward(3)", client=client)
    assert "rover" in out.lower()


def _lesson() -> Lesson:
    return Lesson(
        id="q",
        title="Q lesson",
        key_stage="KS3",  # type: ignore[arg-type]
        ct_concepts=["iteration"],  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="mars",  # type: ignore[arg-type]
        intro="Loop to collect samples.",
        starter_code="move_forward(1)",
        allowed_constructs=["while"],  # type: ignore[arg-type]
        max_lines=10,
        world=WorldDef(base=(1.0, 1.0)),
    )


def test_generate_quiz_parses_json_array() -> None:
    quiz_json = json.dumps(
        [
            {"question": "What loop repeats?", "options": ["while", "if", "def"], "answer": 0},
            {
                "question": "What collects?",
                "options": ["beep", "collect_sample", "log"],
                "answer": 1,
            },
        ]
    )
    client = _FakeClient(reply=quiz_json)
    quiz = generate_quiz(_lesson(), client=client)
    assert len(quiz) == 2
    assert quiz[0].answer == 0
    assert quiz[1].options[1] == "collect_sample"


def test_generate_quiz_returns_empty_on_garbage() -> None:
    client = _FakeClient(reply="no json here")
    assert generate_quiz(_lesson(), client=client) == []


def test_generate_quiz_skips_malformed_items() -> None:
    quiz_json = json.dumps(
        [
            {"question": "ok", "options": ["a", "b"], "answer": 1},
            {"bad": "item"},
            "string-not-object",
        ]
    )
    client = _FakeClient(reply=quiz_json)
    quiz = generate_quiz(_lesson(), client=client)
    assert len(quiz) == 1
