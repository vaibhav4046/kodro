"""An MCP argument that is only bounded below is not bounded.

``prove_contracts`` validated ``runs >= 1`` and stopped there. The author had
clearly thought about the lower edge, since there is a comment explaining why
``runs: 0`` must be distinguished from an absent value. Nothing considered the
other end, so ``runs: 1000000000`` was accepted and simply executed. At roughly
a millisecond per seed across the contract set that is about eleven days, with
the session unresponsive throughout and no way to cancel it.

That matters more here than in an ordinary API. This server exists to be driven
by a language model, which can emit a wrong number for any number of reasons,
and the caller is exactly the party that cannot be trusted to self-limit.

Found by sending the value rather than by reading the validation.
"""

from __future__ import annotations

import io
import json
import time

import pytest

from kodro.mcp.server import serve_stdio
from kodro.mcp.tools import DEFAULT_CONTRACT_RUNS, MAX_CONTRACT_RUNS

INIT = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'


def _prove(runs: object) -> dict:
    """Call prove_contracts with a raw runs value and return the reply."""
    call = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": "prove_contracts", "arguments": {"runs": runs}},
        }
    )
    sink = io.StringIO()
    serve_stdio(iter([INIT, call]), sink)
    for line in sink.getvalue().splitlines():
        if line.strip() and json.loads(line).get("id") == 2:
            return json.loads(line)
    raise AssertionError("the server never answered the tools/call")


def _text(reply: dict) -> str:
    result = reply.get("result", {})
    return " ".join(
        part.get("text", "") for part in result.get("content", []) if isinstance(part, dict)
    )


@pytest.mark.parametrize("runs", [MAX_CONTRACT_RUNS + 1, 10**6, 10**9])
def test_an_absurd_run_count_is_refused_immediately(runs: int) -> None:
    started = time.perf_counter()
    reply = _prove(runs)
    elapsed = time.perf_counter() - started
    assert "at most" in _text(reply) or "at most" in str(reply.get("error", "")), (
        f"runs={runs} was not refused; the server accepted it and started work"
    )
    assert elapsed < 5.0, (
        f"runs={runs} took {elapsed:.1f}s to refuse, so the bound is being checked "
        "after the work rather than before it"
    )


@pytest.mark.parametrize("runs", [0, -1, -1000])
def test_the_lower_bound_still_holds(runs: int) -> None:
    """The pre-existing guard must survive the new one."""
    assert "at least 1" in _text(_prove(runs))


@pytest.mark.parametrize("runs", [1, DEFAULT_CONTRACT_RUNS, MAX_CONTRACT_RUNS])
def test_legitimate_run_counts_still_work(runs: int) -> None:
    """The cap must not narrow what a real caller can ask for."""
    body = _text(_prove(runs))
    assert '"verdict"' in body, f"runs={runs} should have produced a manifest, got: {body[:120]}"


def test_the_maximum_is_reachable_in_reasonable_time() -> None:
    """A cap the server cannot actually serve would be a different bug."""
    started = time.perf_counter()
    body = _text(_prove(MAX_CONTRACT_RUNS))
    elapsed = time.perf_counter() - started
    assert '"verdict"' in body
    assert elapsed < 30.0, (
        f"the advertised maximum took {elapsed:.1f}s, so it is too high to be honest"
    )


def test_the_schema_advertises_the_bounds() -> None:
    """A client that reads the schema should never need to be refused."""
    sink = io.StringIO()
    serve_stdio(iter(['{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}']), sink)
    tools = json.loads(sink.getvalue().strip().splitlines()[-1])["result"]["tools"]
    runs = next(t for t in tools if t["name"] == "prove_contracts")["inputSchema"]["properties"][
        "runs"
    ]
    assert runs.get("minimum") == 1, "the schema does not state the lower bound"
    assert runs.get("maximum") == MAX_CONTRACT_RUNS, "the schema does not state the upper bound"


def test_a_refused_call_does_not_end_the_session() -> None:
    """One bad argument must cost one request, not the connection."""
    bad = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": "prove_contracts", "arguments": {"runs": 10**9}},
        }
    )
    good = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "list_lessons", "arguments": {}},
        }
    )
    sink = io.StringIO()
    serve_stdio(iter([INIT, bad, good]), sink)
    replies = [json.loads(line) for line in sink.getvalue().splitlines() if line.strip()]
    assert len(replies) == 3, "the server stopped reading after the refused call"
    assert "result" in replies[-1], "the call after the refusal did not succeed"
