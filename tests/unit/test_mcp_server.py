"""MCP server tests: the protocol layer and the eight tools behind it.

The dispatcher is deliberately transport-free, so every protocol test here
hands :meth:`Server.handle` a decoded dict and asserts on a decoded dict -- no
subprocess, no pipes, no sleeps. The stdio loop gets its own tests through
``io.StringIO``, which is the only place the wire format itself matters.

The tools are exercised against the real bundled lesson library and the real
physics rather than mocks, because the whole point of the server is that an
assistant marking a pupil's work gets the same verdict the pupil sees. A mock
would happily agree with a grader that had drifted.
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

import pytest

from kodro.mcp import tools as tool_registry
from kodro.mcp.server import (
    INVALID_PARAMS,
    INVALID_REQUEST,
    METHOD_NOT_FOUND,
    PARSE_ERROR,
    PROTOCOL_VERSION,
    SUPPORTED_PROTOCOL_VERSIONS,
    Server,
    main,
    serve_stdio,
)
from kodro.mcp.tools import ToolError
from kodro.memory.store import Store

# --- helpers ---------------------------------------------------------------


def request(method: str, params: dict[str, Any] | None = None, req_id: int = 1) -> dict[str, Any]:
    msg: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        msg["params"] = params
    return msg


def call(server: Server, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Invoke a tool through the protocol and return the reply's ``result``."""
    reply = server.handle(request("tools/call", {"name": name, "arguments": arguments}))
    assert reply is not None
    assert "error" not in reply, reply
    return dict(reply["result"])


def structured(result: dict[str, Any]) -> dict[str, Any]:
    assert result["isError"] is False, result
    return dict(result["structuredContent"])


@pytest.fixture
def server() -> Server:
    return Server()


# --- protocol --------------------------------------------------------------


def test_initialize_echoes_a_supported_protocol_version(server: Server) -> None:
    reply = server.handle(request("initialize", {"protocolVersion": "2024-11-05"}))
    assert reply is not None
    result = reply["result"]
    assert result["protocolVersion"] == "2024-11-05"
    assert result["serverInfo"]["name"] == "kodro"
    assert "tools" in result["capabilities"]
    assert server.initialised is True


def test_initialize_falls_back_to_our_newest_for_an_unknown_version(server: Server) -> None:
    reply = server.handle(request("initialize", {"protocolVersion": "1999-01-01"}))
    assert reply is not None
    assert reply["result"]["protocolVersion"] == PROTOCOL_VERSION
    assert PROTOCOL_VERSION in SUPPORTED_PROTOCOL_VERSIONS


def test_notification_never_gets_a_reply(server: Server) -> None:
    assert server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
    assert server.initialised is True


def test_unknown_notification_also_gets_no_reply(server: Server) -> None:
    """A notification is answered with silence even when the method is unknown.

    Replying to one is the protocol violation that desynchronises strict
    clients: they are not waiting for a frame, so the next response they read
    is the wrong one and every subsequent id is off by one.
    """
    assert server.handle({"jsonrpc": "2.0", "method": "nonsense/whatever"}) is None


def test_unknown_method_is_method_not_found(server: Server) -> None:
    reply = server.handle(request("bogus/method"))
    assert reply is not None
    assert reply["error"]["code"] == METHOD_NOT_FOUND


def test_wrong_jsonrpc_version_is_invalid_request(server: Server) -> None:
    reply = server.handle({"jsonrpc": "1.0", "id": 7, "method": "ping"})
    assert reply is not None
    assert reply["error"]["code"] == INVALID_REQUEST
    assert reply["id"] == 7


def test_missing_method_is_invalid_request(server: Server) -> None:
    reply = server.handle({"jsonrpc": "2.0", "id": 8})
    assert reply is not None
    assert reply["error"]["code"] == INVALID_REQUEST


def test_non_object_params_is_invalid_params(server: Server) -> None:
    reply = server.handle({"jsonrpc": "2.0", "id": 9, "method": "ping", "params": [1, 2]})
    assert reply is not None
    assert reply["error"]["code"] == INVALID_PARAMS


def test_ping_returns_an_empty_result(server: Server) -> None:
    reply = server.handle(request("ping"))
    assert reply is not None
    assert reply["result"] == {}


def test_tools_list_advertises_every_registered_tool(server: Server) -> None:
    reply = server.handle(request("tools/list"))
    assert reply is not None
    names = [tool["name"] for tool in reply["result"]["tools"]]
    assert names == [tool["name"] for tool in tool_registry.TOOLS]
    assert len(names) == len(set(names)), "duplicate tool name on the wire"


def test_wire_descriptors_never_leak_the_python_handler() -> None:
    for descriptor in tool_registry.TOOL_DESCRIPTORS:
        assert "handler" not in descriptor
        assert set(descriptor) == {"name", "description", "inputSchema"}


def test_every_tool_schema_is_a_usable_json_schema() -> None:
    for tool in tool_registry.TOOLS:
        schema = tool["inputSchema"]
        assert schema["type"] == "object"
        assert isinstance(schema["properties"], dict)
        for prop in schema.get("required", []):
            assert prop in schema["properties"], f"{tool['name']}: required {prop} not declared"
        # Round-trips as JSON, or the client never sees it.
        json.loads(json.dumps(schema))


def test_tools_call_without_a_name_is_invalid_params(server: Server) -> None:
    reply = server.handle(request("tools/call", {"arguments": {}}))
    assert reply is not None
    assert reply["error"]["code"] == INVALID_PARAMS


def test_tools_call_with_non_object_arguments_is_invalid_params(server: Server) -> None:
    reply = server.handle(request("tools/call", {"name": "list_lessons", "arguments": "nope"}))
    assert reply is not None
    assert reply["error"]["code"] == INVALID_PARAMS


def test_tool_failure_is_content_not_an_rpc_error(server: Server) -> None:
    """A bad lesson id is the model's mistake to correct, not a transport fault.

    The spec draws that line so the assistant reads the message and retries;
    an RPC error would instead be handled by the client as a broken server.
    """
    result = call(server, "get_lesson", {"lessonId": "definitely_not_a_lesson"})
    assert result["isError"] is True
    assert "list_lessons" in result["content"][0]["text"]


def test_unexpected_tool_exception_is_contained(server: Server, monkeypatch: Any) -> None:
    def explode(_params: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("kaboom")

    monkeypatch.setitem(tool_registry._HANDLERS, "list_lessons", explode)
    result = call(server, "list_lessons", {})
    assert result["isError"] is True
    assert "kaboom" in result["content"][0]["text"]


def test_unknown_tool_name_is_reported_with_the_available_set(server: Server) -> None:
    result = call(server, "no_such_tool", {})
    assert result["isError"] is True
    assert "list_lessons" in result["content"][0]["text"]


def test_successful_call_carries_both_text_and_structured_content(server: Server) -> None:
    result = call(server, "list_lessons", {})
    assert result["isError"] is False
    text = result["content"][0]["text"]
    assert json.loads(text) == result["structuredContent"]


# --- stdio transport -------------------------------------------------------


def test_serve_stdio_round_trips_and_skips_notifications() -> None:
    lines = [
        json.dumps(request("initialize", {"protocolVersion": PROTOCOL_VERSION}, req_id=1)),
        json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
        "",  # blank lines are ignored, not answered
        json.dumps(request("ping", req_id=2)),
    ]
    out = io.StringIO()
    assert serve_stdio(io.StringIO("\n".join(lines) + "\n"), out) == 0
    replies = [json.loads(line) for line in out.getvalue().splitlines()]
    assert [r["id"] for r in replies] == [1, 2]


def test_serve_stdio_survives_a_corrupt_frame() -> None:
    """One bad line must not end the session mid-lesson."""
    payload = "not json at all\n" + json.dumps(request("ping", req_id=5)) + "\n"
    out = io.StringIO()
    serve_stdio(io.StringIO(payload), out)
    replies = [json.loads(line) for line in out.getvalue().splitlines()]
    assert replies[0]["error"]["code"] == PARSE_ERROR
    assert replies[1]["id"] == 5


def test_serve_stdio_rejects_a_bare_json_array() -> None:
    out = io.StringIO()
    serve_stdio(io.StringIO("[1, 2, 3]\n"), out)
    reply = json.loads(out.getvalue())
    assert reply["error"]["code"] == INVALID_REQUEST


def test_every_reply_is_exactly_one_line() -> None:
    """The frame delimiter is the newline, so an embedded one desynchronises."""
    out = io.StringIO()
    serve_stdio(io.StringIO(json.dumps(request("tools/list")) + "\n"), out)
    assert len(out.getvalue().splitlines()) == 1


def test_main_help_writes_to_stderr_only(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--help"]) == 0
    captured = capsys.readouterr()
    assert captured.out == "", "stdout carries the protocol and nothing else"
    assert "kodro-mcp" in captured.err


def test_main_list_tools_names_every_tool(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--list-tools"]) == 0
    captured = capsys.readouterr()
    assert captured.out == ""
    for tool in tool_registry.TOOLS:
        assert tool["name"] in captured.err


# --- tools: curriculum -----------------------------------------------------


def test_list_lessons_returns_the_whole_library(server: Server) -> None:
    payload = structured(call(server, "list_lessons", {}))
    assert payload["count"] == len(payload["lessons"]) > 0
    assert payload["count"] == len(tool_registry._library())


def test_list_lessons_filters_by_key_stage(server: Server) -> None:
    everything = structured(call(server, "list_lessons", {}))
    stage = everything["lessons"][0]["keyStage"]
    filtered = structured(call(server, "list_lessons", {"keyStage": stage}))
    assert 0 < filtered["count"] <= everything["count"]
    assert all(row["keyStage"] == stage for row in filtered["lessons"])


def test_list_lessons_concept_filter_is_case_insensitive(server: Server) -> None:
    everything = structured(call(server, "list_lessons", {}))
    concept = next(c for row in everything["lessons"] for c in row["concepts"])
    lower = structured(call(server, "list_lessons", {"concept": concept.lower()}))
    upper = structured(call(server, "list_lessons", {"concept": concept.upper()}))
    assert lower["count"] == upper["count"] > 0


def test_get_lesson_withholds_the_worked_solution_by_default(server: Server) -> None:
    """The pedagogy is the point: handing over the answer replaces the learning."""
    payload = structured(call(server, "get_lesson", {"lessonId": "00_first_drive"}))
    assert "solutionCode" not in payload
    assert "includeSolution=true" in payload["solutionNote"]


def test_get_lesson_releases_the_solution_when_asked_explicitly(server: Server) -> None:
    payload = structured(
        call(server, "get_lesson", {"lessonId": "00_first_drive", "includeSolution": True})
    )
    assert payload["hasSolution"] is True
    assert payload["solutionCode"]


def test_unknown_lesson_id_suggests_near_misses(server: Server) -> None:
    result = call(server, "get_lesson", {"lessonId": "first_drive"})
    assert result["isError"] is True
    assert "Did you mean" in result["content"][0]["text"]


# --- tools: running and grading --------------------------------------------


def test_run_program_reports_what_the_rover_did(server: Server) -> None:
    payload = structured(
        call(server, "run_program", {"lessonId": "00_first_drive", "source": "move_forward(3)"})
    )
    assert payload["execution"]["success"] is True
    assert payload["events"], "a move must emit at least one tracer event"
    assert payload["finalState"]["distanceTravelledM"] > 0


def test_run_program_refuses_a_non_string_source(server: Server) -> None:
    result = call(server, "run_program", {"lessonId": "00_first_drive", "source": 42})
    assert result["isError"] is True
    assert "must be a string" in result["content"][0]["text"]


def test_run_program_refuses_an_oversized_program(server: Server) -> None:
    huge = "move_forward(1)\n" * 4000
    assert len(huge) > tool_registry.MAX_SOURCE_CHARS
    result = call(server, "run_program", {"lessonId": "00_first_drive", "source": huge})
    assert result["isError"] is True
    assert str(tool_registry.MAX_SOURCE_CHARS) in result["content"][0]["text"]


def test_sandbox_violations_come_back_as_a_graded_run_not_a_crash(server: Server) -> None:
    payload = structured(
        call(server, "run_program", {"lessonId": "00_first_drive", "source": "import os"})
    )
    assert payload["execution"]["errorKind"] == "sandbox"
    assert "import" in payload["execution"]["errorMessage"]
    assert payload["verdict"]["passed"] is False


def test_a_program_that_never_ran_scores_zero_not_partial_credit(server: Server) -> None:
    """The score for a crash is 0 everywhere, and it used to be 60 here.

    ``grade`` is pure over the tracer, so a program rejected at line 1 left an
    empty trace that a "no collisions" criterion satisfies for free: three
    criteria, two failed, 100 - 20*2 = 60. The Tk app never grades a failed run
    at all, and both the web bridge (``submit_attempt``) and the browser grader
    (``lesson-grader.jsx``, ``gradeSync``) return score 0 with the error as the
    single reason. An assistant reading 60 off this tool would be telling a
    pupil their sandbox violation earned most of the marks.
    """
    payload = structured(
        call(
            server,
            "grade_program",
            {"lessonId": "00d_fix_the_turn", "source": "import os\nos.system('echo pwned')\n"},
        )
    )
    execution = payload["execution"]
    assert execution["success"] is False
    verdict = payload["verdict"]
    assert verdict["passed"] is False
    assert verdict["score"] == 0
    # Byte-for-byte the string web/app.py and lesson-grader.jsx both produce.
    assert verdict["reasons"] == [
        f"{execution['errorKind']}: {execution['errorMessage']} (line {execution['errorLine']})"
    ]


def test_a_program_that_ran_and_did_nothing_is_still_marked_on_its_criteria(
    server: Server,
) -> None:
    """The zero above is for a crash, not for any failure.

    An empty program executes cleanly and simply misses the mission, so it must
    still be scored criterion by criterion -- the same 60/100 the browser gives
    it. Without this the fix above would flatten every failure to 0 and the
    pupil would lose the partial credit that tells them how close they were.
    """
    payload = structured(
        call(server, "grade_program", {"lessonId": "00d_fix_the_turn", "source": ""})
    )
    assert payload["execution"]["success"] is True
    assert payload["verdict"]["passed"] is False
    assert payload["verdict"]["score"] == 60
    assert len(payload["verdict"]["reasons"]) == 2


def test_syntax_errors_report_the_pupil_line(server: Server) -> None:
    payload = structured(
        call(
            server,
            "run_program",
            {"lessonId": "00_first_drive", "source": "move_forward(3)\nturn_left(\n"},
        )
    )
    assert payload["execution"]["errorKind"] == "syntax"
    assert payload["execution"]["errorLine"] is not None


def test_every_run_payload_is_strictly_json_serialisable(server: Server) -> None:
    """``read_distance`` yields a non-finite sentinel; ``Infinity`` is not JSON.

    ``json.dumps`` emits it happily by default, so the assertion has to turn
    that off -- otherwise the test would pass on output no strict parser at the
    far end could read.
    """
    payload = structured(
        call(
            server,
            "run_program",
            {"lessonId": "00_first_drive", "source": "read_distance()\nmove_forward(1)"},
        )
    )
    json.dumps(payload, allow_nan=False)


def test_grade_program_agrees_with_the_graders_own_verdict(server: Server) -> None:
    """The tool must not be a second opinion; it must be the same opinion.

    Marking through MCP and marking in the app run the same reference rover and
    the same criteria, so a divergence here would mean an assistant telling a
    pupil they passed something the app fails them on.
    """
    from kodro.runtime.session import run_against_lesson

    lesson = next(le for le in tool_registry._library() if le.id == "00_first_drive")
    assert lesson.solution_code
    expected = run_against_lesson(lesson, lesson.solution_code)

    payload = structured(
        call(
            server,
            "grade_program",
            {"lessonId": "00_first_drive", "source": lesson.solution_code},
        )
    )
    assert payload["verdict"]["passed"] is expected.verdict.passed is True
    assert payload["verdict"]["score"] == expected.verdict.score
    assert payload["criteria"], "the pupil must be able to see what they were marked against"


def test_grade_program_omits_the_event_trace(server: Server) -> None:
    payload = structured(
        call(server, "grade_program", {"lessonId": "00_first_drive", "source": "move_forward(3)"})
    )
    assert "events" not in payload


def test_event_trace_is_capped_and_says_so(server: Server, monkeypatch: Any) -> None:
    monkeypatch.setattr(tool_registry, "MAX_EVENTS_RETURNED", 2)
    payload = structured(
        call(
            server,
            "run_program",
            {"lessonId": "00_first_drive", "source": "move_forward(1)\n" * 6},
        )
    )
    assert len(payload["events"]) == 2
    assert payload["eventsTruncated"] > 0


# --- tools: API surface ----------------------------------------------------


def test_check_api_is_derived_from_the_sandbox_not_transcribed(server: Server) -> None:
    from kodro import rover_api

    payload = structured(call(server, "check_api", {}))
    assert {fn["name"] for fn in payload["functions"]} <= set(rover_api.__all__)
    assert all(fn["signature"].startswith(fn["name"] + "(") for fn in payload["functions"])


def test_check_api_name_filter_narrows_the_list(server: Server) -> None:
    everything = structured(call(server, "check_api", {}))
    filtered = structured(call(server, "check_api", {"nameContains": "read"}))
    assert 0 < len(filtered["functions"]) < len(everything["functions"])
    assert all("read" in fn["name"] for fn in filtered["functions"])


# --- tools: argument validation --------------------------------------------
#
# The tools published an ``inputSchema`` from the start and nothing enforced it.
# Both resulting failures were silent, which is what makes them worth pinning:
# a wrong answer that announces itself is a bug, a wrong answer that looks
# right is a liability.


def test_a_misspelled_filter_is_refused_not_silently_dropped(server: Server) -> None:
    """The regression that motivated the validator.

    ``keyStages`` is not an argument. Before the check, it was dropped and the
    tool answered with the whole unfiltered library, so an assistant that asked
    for the KS3 lessons received all 24 and had no way to notice.
    """
    unfiltered = structured(call(server, "list_lessons", {}))
    real = structured(call(server, "list_lessons", {"keyStage": "KS3"}))
    assert 0 < real["count"] < unfiltered["count"]

    result = call(server, "list_lessons", {"keyStages": "KS3"})
    assert result["isError"] is True
    text = result["content"][0]["text"]
    assert "keyStages" in text
    assert "keyStage" in text, "the message must point at the argument that does exist"


def test_an_unknown_argument_names_the_accepted_ones(server: Server) -> None:
    result = call(server, "check_api", {"names": ["read"]})
    assert result["isError"] is True
    assert "nameContains" in result["content"][0]["text"]


def test_a_missing_required_argument_says_so(server: Server) -> None:
    """Previously this reached the lesson lookup and returned ``No lesson with id ''``."""
    result = call(server, "grade_program", {"source": "move_forward(3)"})
    assert result["isError"] is True
    text = result["content"][0]["text"]
    assert "lessonId" in text
    assert "No lesson with id ''" not in text


def test_a_required_argument_explicitly_null_counts_as_missing(server: Server) -> None:
    result = call(server, "get_lesson", {"lessonId": None})
    assert result["isError"] is True
    assert "lessonId" in result["content"][0]["text"]


def test_a_declared_type_is_enforced(server: Server) -> None:
    result = call(server, "prove_contracts", {"runs": "5"})
    assert result["isError"] is True
    assert "whole number" in result["content"][0]["text"]


def test_a_boolean_is_not_accepted_as_a_number(server: Server) -> None:
    """``isinstance(True, int)`` is true in Python, so this needs its own guard.

    Without it ``runs: true`` would quietly mean one run and the manifest would
    report a verdict drawn from a single seed as though it were the CI default.
    """
    result = call(server, "prove_contracts", {"runs": True})
    assert result["isError"] is True
    assert "true/false" in result["content"][0]["text"]


def test_validation_leaves_every_documented_call_working(server: Server) -> None:
    """The guard must not narrow the advertised surface it is protecting."""
    assert structured(call(server, "list_lessons", {}))["count"] > 0
    assert structured(call(server, "list_lessons", {"concept": "iteration"}))["count"] > 0
    assert structured(call(server, "check_api", {"nameContains": "read"}))["count"] > 0
    assert structured(call(server, "get_lesson", {"lessonId": "00_first_drive"}))["id"]
    assert structured(
        call(server, "get_lesson", {"lessonId": "00_first_drive", "includeSolution": True})
    )["id"]


def test_every_tool_schema_is_enforceable(server: Server) -> None:
    """Guards the validator against a tool added later with an unsupported type.

    A ``type`` the checker does not recognise is skipped rather than rejected,
    which is the safe direction but would make the schema decorative. This fails
    the moment somebody adds one, so the choice stays deliberate.
    """
    for descriptor in tool_registry.TOOL_DESCRIPTORS:
        schema = descriptor["inputSchema"]
        properties = schema.get("properties") or {}
        for arg, spec in properties.items():
            declared = spec.get("type")
            names = (declared,) if isinstance(declared, str) else tuple(declared or ())
            assert names, f"{descriptor['name']}.{arg} declares no type"
            for name in names:
                assert name in tool_registry._JSON_TYPES, (
                    f"{descriptor['name']}.{arg} declares unsupported type {name!r}"
                )
        for required in schema.get("required") or ():
            assert required in properties, (
                f"{descriptor['name']} requires {required!r} but does not declare it"
            )


# --- tools: robot specs ----------------------------------------------------


def test_validate_robot_spec_reads_a_real_studio_export(server: Server) -> None:
    """The payload is shaped like the Robot Lab's exportKrs() output, not invented.

    A tidier made-up schema would pass through the reader untouched and every
    number would quietly fall back to a default, so the test would assert the
    defaults and prove nothing about the import path.
    """
    payload = structured(
        call(
            server,
            "validate_robot_spec",
            {
                "spec": json.dumps(
                    {
                        "kodroSpec": 1,
                        "name": "Probe",
                        "type": "rover",
                        "board": "esp32",
                        "sensors": [{"kind": "ultrasonic"}],
                        "actuators": ["motors2"],
                        "massKg": 2.4,
                        "bodyCm": {"lengthCm": 30, "widthCm": 20, "heightCm": 10},
                        "drive": {
                            "kind": "differential",
                            "motorCount": 2,
                            "wheelRadiusCm": 5,
                            "wheelbaseCm": 20,
                        },
                        "derived": {"massG": 2400},
                    }
                )
            },
        )
    )
    assert payload["name"] == "Probe"
    assert payload["massKg"] == pytest.approx(2.4)
    assert payload["wheelCount"] == 2
    assert payload["wheelRadiusM"] == pytest.approx(0.05)
    assert payload["linkCount"] == 3, "one base link plus a link per wheel"
    assert payload["degreesOfFreedom"] == 2
    assert payload["looksLikeRover"] is True
    assert payload["warnings"] == []


def test_validate_robot_spec_falls_back_to_the_derived_mass_in_grams(server: Server) -> None:
    """Older exports carry only derived.massG. Dropping to 0.9 kg would be a lie."""
    payload = structured(
        call(
            server,
            "validate_robot_spec",
            {
                "spec": json.dumps(
                    {
                        "kodroSpec": 1,
                        "name": "Legacy",
                        "drive": {"motorCount": 4, "wheelRadiusCm": 3.5},
                        "derived": {"massG": 1250},
                    }
                )
            },
        )
    )
    assert payload["massKg"] == pytest.approx(1.25)
    assert payload["wheelCount"] == 4
    assert payload["wheelRadiusM"] == pytest.approx(0.035)


def test_validate_robot_spec_keeps_a_zero_motor_arm_at_zero_wheels(server: Server) -> None:
    """``motorCount: 0`` is an arm, not a missing field, so it must not default to 2."""
    payload = structured(
        call(
            server,
            "validate_robot_spec",
            {
                "spec": json.dumps(
                    {
                        "kodroSpec": 1,
                        "name": "Arm",
                        "massKg": 1.1,
                        "drive": {"kind": "none", "motorCount": 0},
                    }
                )
            },
        )
    )
    assert payload["wheelCount"] == 0
    assert payload["linkCount"] == 1
    assert payload["wheelRadiusM"] is None
    assert payload["looksLikeRover"] is False


def test_validate_robot_spec_rejects_malformed_json(server: Server) -> None:
    result = call(server, "validate_robot_spec", {"spec": "{not json"})
    assert result["isError"] is True


# --- tools: contracts and progress -----------------------------------------


def test_prove_contracts_runs_the_real_engine_evidence(server: Server) -> None:
    payload = structured(call(server, "prove_contracts", {"runs": 1}))
    assert payload["verdict"] in {"pass", "fail"}
    assert payload["contractCount"] == len(payload["contracts"]) > 0
    assert payload["engine"], "a verdict with no engine fingerprint proves nothing"


def test_prove_contracts_rejects_a_zero_run_request(server: Server) -> None:
    result = call(server, "prove_contracts", {"runs": 0})
    assert result["isError"] is True


def test_prove_contracts_rejects_an_unknown_contract_id(server: Server) -> None:
    result = call(server, "prove_contracts", {"contractId": "not_a_contract"})
    assert result["isError"] is True


def test_pupil_progress_on_a_missing_database_is_not_an_error(
    server: Server, tmp_path: Path
) -> None:
    """A fresh install has no database. That is a fact to report, not a failure."""
    payload = structured(call(server, "pupil_progress", {"dbPath": str(tmp_path / "absent.db")}))
    assert payload["exists"] is False
    assert payload["pupils"] == []


def test_pupil_progress_summarises_real_submissions(server: Server, tmp_path: Path) -> None:
    db_path = tmp_path / "pupil.db"
    store = Store(db_path)
    try:
        pupil = store.create_pupil("Ada")
        store.record_submission(
            pupil_id=pupil.id,
            lesson_id="00_first_drive",
            code="move_forward(3)",
            passed=True,
            score=100,
            reasons=["drove the full distance"],
        )
    finally:
        store.close()

    payload = structured(call(server, "pupil_progress", {"dbPath": str(db_path)}))
    assert payload["exists"] is True
    row = next(p for p in payload["pupils"] if p["displayName"] == "Ada")
    assert row["attempts"] == 1
    assert row["lessonsPassed"] == 1
    assert row["bestScore"] == 100


def test_pupil_progress_rejects_an_unknown_pupil_id(server: Server, tmp_path: Path) -> None:
    db_path = tmp_path / "pupil.db"
    Store(db_path).close()
    result = call(server, "pupil_progress", {"dbPath": str(db_path), "pupilId": "nobody"})
    assert result["isError"] is True


# --- resources -------------------------------------------------------------


def test_resources_list_covers_the_api_plus_every_lesson(server: Server) -> None:
    reply = server.handle(request("resources/list"))
    assert reply is not None
    resources = reply["result"]["resources"]
    assert len(resources) == len(tool_registry._library()) + 1
    assert any(r["uri"] == "kodro://api/reference" for r in resources)


def test_every_advertised_resource_is_actually_readable(server: Server) -> None:
    """An advertised URI that 404s is worse than one that was never offered."""
    for resource in tool_registry.list_resources():
        payload = tool_registry.read_resource(resource["uri"])
        assert payload, resource["uri"]


def test_resources_read_returns_json_text(server: Server) -> None:
    reply = server.handle(request("resources/read", {"uri": "kodro://lessons/00_first_drive"}))
    assert reply is not None
    content = reply["result"]["contents"][0]
    assert content["mimeType"] == "application/json"
    assert json.loads(content["text"])["id"] == "00_first_drive"


def test_resources_read_without_a_uri_is_invalid_params(server: Server) -> None:
    reply = server.handle(request("resources/read", {}))
    assert reply is not None
    assert reply["error"]["code"] == INVALID_PARAMS


def test_unknown_resource_uri_is_invalid_params(server: Server) -> None:
    reply = server.handle(request("resources/read", {"uri": "kodro://nope"}))
    assert reply is not None
    assert reply["error"]["code"] == INVALID_PARAMS


def test_read_resource_raises_tool_error_for_an_unknown_scheme() -> None:
    with pytest.raises(ToolError):
        tool_registry.read_resource("https://example.com/robots.txt")


# --- the offline guarantee -------------------------------------------------


def test_the_server_never_reaches_the_network(monkeypatch: Any) -> None:
    """The product's claim is a school laptop with no account and no network.

    Patching the socket constructor is the cheapest way to hold the whole tool
    surface to that claim: if any handler grew an HTTP call, every test below
    this line would fail rather than quietly working on the author's machine.
    """
    import socket

    def forbidden(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("the MCP server opened a socket")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)

    srv = Server()
    srv.handle(request("initialize", {"protocolVersion": PROTOCOL_VERSION}))
    structured(call(srv, "list_lessons", {}))
    structured(call(srv, "check_api", {}))
    structured(
        call(srv, "grade_program", {"lessonId": "00_first_drive", "source": "move_forward(3)"})
    )
