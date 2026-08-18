"""Propose-then-critique reviewer: parsing, safety gate, fallbacks (offline)."""

from __future__ import annotations

import json
from collections.abc import Iterator

from kodro.ai.critique import CritiqueResult, review_program
from kodro.ai.ollama_client import OllamaClient


class _FakeClient(OllamaClient):
    """An OllamaClient whose transport is replaced by one canned reply."""

    def __init__(self, reply: str) -> None:
        super().__init__()
        self._reply = reply

    def generate(self, prompt: str, **_: object) -> str:  # type: ignore[override]
        return self._reply

    def generate_stream(self, prompt: str, **_: object) -> Iterator[str]:  # type: ignore[override]
        yield self._reply

    def available(self) -> bool:  # type: ignore[override]
        return True


def _reply(issues: list[str], code: str) -> str:
    return json.dumps({"issues": issues, "code": code})


def test_returns_issues_and_keeps_code_when_no_rewrite_offered() -> None:
    client = _FakeClient(_reply(["Loop never ends", "Unclear name"], ""))
    res = review_program("while True:\n    move_forward(1)", client=client)
    assert isinstance(res, CritiqueResult)
    assert res.issues == ["Loop never ends", "Unclear name"]
    assert res.revised is False
    assert res.final_code == "while True:\n    move_forward(1)"


def test_accepts_comment_only_rewrite_when_validate_passes() -> None:
    client = _FakeClient(_reply(["Add a comment"], "# Drive one step\nmove_forward(3)"))
    res = review_program("move_forward(3)", client=client, validate=lambda _c: None)
    assert res.revised is True
    assert res.final_code == "# Drive one step\nmove_forward(3)"


def test_rejects_rewrite_that_changes_robot_actions() -> None:
    client = _FakeClient(_reply(["Add a turn"], "move_forward(3)\nturn_right(90)"))
    res = review_program("move_forward(3)", client=client, validate=lambda _c: None)
    assert res.revised is False
    assert res.final_code == "move_forward(3)"
    assert "changed executable behaviour" in res.issues[0]


def test_rejects_rewrite_that_introduces_recursion() -> None:
    recursive = "def move_robot():\n    move_forward(3)\n    move_robot()\nmove_robot()"
    client = _FakeClient(_reply(["Use a helper"], recursive))
    res = review_program("move_forward(3)", client=client, validate=lambda _c: None)
    assert res.revised is False
    assert res.final_code == "move_forward(3)"


def test_rejects_rewrite_when_validate_reports_error() -> None:
    client = _FakeClient(_reply(["bug"], "this is not python !!"))
    res = review_program(
        "move_forward(3)", client=client, validate=lambda _c: "SyntaxError: bad (line 1)"
    )
    assert res.revised is False
    assert res.final_code == "move_forward(3)"  # unchanged, unsafe rewrite dropped


def test_identical_rewrite_is_not_counted_as_a_revision() -> None:
    client = _FakeClient(_reply([], "move_forward(3)"))
    res = review_program("move_forward(3)", client=client, validate=lambda _c: None)
    assert res.revised is False


def test_non_json_reply_yields_no_issues_and_original_code() -> None:
    client = _FakeClient("the program looks fine to me")
    res = review_program("move_forward(3)", client=client, validate=lambda _c: None)
    assert res.issues == []
    assert res.revised is False
    assert res.final_code == "move_forward(3)"


def test_issues_are_capped_at_three() -> None:
    client = _FakeClient(_reply(["a", "b", "c", "d", "e"], ""))
    res = review_program("move_forward(1)", client=client)
    assert res.issues == ["a", "b", "c"]


def test_blank_issue_strings_are_dropped() -> None:
    client = _FakeClient(_reply(["real issue", "  ", ""], ""))
    res = review_program("move_forward(1)", client=client)
    assert res.issues == ["real issue"]


def test_goal_is_included_without_crashing() -> None:
    client = _FakeClient(_reply(["meets goal? unclear"], ""))
    res = review_program("move_forward(1)", goal="Drive forward two metres", client=client)
    assert res.issues == ["meets goal? unclear"]
