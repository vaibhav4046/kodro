"""Offline grounded retrieval: search scoring, refuse-and-cite, no-call guard."""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from kodro.ai.ollama_client import OllamaClient, OllamaError
from kodro.ai.retrieval import (
    Passage,
    build_corpus,
    grounded_answer,
    search,
)
from kodro.lessons.schema import Lesson, WorldDef


def _lesson(lid: str, intro: str, glossary: dict[str, str] | None = None) -> Lesson:
    return Lesson(
        id=lid,
        title=lid,
        key_stage="KS3",
        ct_concepts=["sequence"],  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",  # type: ignore[arg-type]
        intro=intro,
        starter_code="move_forward(1)",
        allowed_constructs=["function_call"],  # type: ignore[arg-type]
        max_lines=10,
        world=WorldDef(base=(1.0, 1.0)),
        success_criteria=[],
        glossary=glossary or {},
    )


class _FakeClient(OllamaClient):
    """Records whether generate() was called; returns a canned answer."""

    def __init__(self, reply: str = "Use obstacle_ahead(). [1]") -> None:
        super().__init__()
        self.reply = reply
        self.calls = 0

    def generate(self, prompt: str, **_: object) -> str:  # type: ignore[override]
        self.calls += 1
        return self.reply

    def generate_stream(self, prompt: str, **_: object) -> Iterator[str]:  # type: ignore[override]
        yield self.reply


# --- search -----------------------------------------------------------------


def test_search_finds_the_obstacle_function_for_a_wall_question() -> None:
    docs = build_corpus([])
    hits = search("how do I check for a wall ahead", docs)
    assert hits, "a wall question must retrieve something"
    assert "obstacle_ahead" in hits[0].text


def test_search_returns_nothing_for_an_unrelated_query() -> None:
    docs = build_corpus([_lesson("01", "drive the rover forward")])
    assert search("banana xylophone helicopter", docs) == []


def test_search_is_idf_weighted_so_a_rare_term_wins() -> None:
    docs = [
        Passage(source="a", text="move the rover forward and forward again"),
        Passage(source="b", text="collect_sample picks up a rare sample"),
    ]
    hits = search("collect_sample", docs)
    assert hits[0].source == "b"


def test_build_corpus_includes_api_docs_and_lesson_glossary() -> None:
    docs = build_corpus([_lesson("07", "read the sensors", {"sensor": "a device that measures"})])
    sources = [d.source for d in docs]
    assert any("Rover interface" in s for s in sources)
    assert any("07 glossary: sensor" in s for s in sources)


# --- grounded_answer --------------------------------------------------------


def test_grounded_answer_refuses_and_does_not_call_the_model_when_nothing_matches() -> None:
    client = _FakeClient()
    out = grounded_answer("banana xylophone", [_lesson("01", "drive forward")], client=client)
    assert out["grounded"] is False
    assert "could not find" in str(out["answer"]).lower()
    assert out["sources"] == []
    assert client.calls == 0, "the model must not be called when retrieval is empty"


def test_grounded_answer_uses_sources_and_calls_the_model_when_relevant() -> None:
    client = _FakeClient()
    out = grounded_answer("how do I avoid a wall", [], client=client)
    assert out["grounded"] is True
    assert client.calls == 1
    assert out["sources"], "a grounded answer must expose its sources"
    assert "obstacle_ahead" in str(out["answer"])


def test_grounded_answer_propagates_transport_error() -> None:
    class _Boom(_FakeClient):
        def generate(self, prompt: str, **_: object) -> str:  # type: ignore[override]
            raise OllamaError("down")

    with pytest.raises(OllamaError):
        grounded_answer("how do I avoid a wall", [], client=_Boom())
