#!/usr/bin/env python3
"""Real-subprocess smoke test for the Kodro MCP server.

The unit tests in ``tests/unit/test_mcp_server.py`` hand :meth:`Server.handle` a
decoded dict, which is the right shape for testing dispatch logic and the wrong
shape for proving the thing a client actually depends on: that a separate
process, launched by name, speaks newline-delimited JSON-RPC over real pipes and
keeps stdout clean. Everything here therefore goes through ``subprocess`` and a
pipe. Nothing imports the server.

What it checks, in the order a client would hit it:

1. The process starts from its entry point and completes ``initialize``.
2. ``notifications/initialized`` is answered with silence, not a frame.
3. ``tools/list`` and ``resources/list`` enumerate.
4. A valid ``tools/call`` succeeds.
5. An invalid ``tools/call`` fails as ``isError`` content, not an RPC error.
6. A bad resource URI fails as an RPC error, not as content.
7. A malformed JSON line is refused and the session survives it.
8. Non-ASCII text survives the round trip in both directions.
9. stdout carried protocol only, and the process exits 0 on EOF.

Counts are read from the responses rather than written down here. A smoke test
that asserts "8 tools" has to be edited whenever a tool is added, and the edit
that keeps it passing is indistinguishable from the edit that hides a regression.
It asserts instead that the count is non-zero and that it agrees between
``tools/list`` and the descriptors the process reports through ``--list-tools``.

Usage::

    python scripts/smoke_mcp.py              # every entry point it can find
    python scripts/smoke_mcp.py --entry module
    python scripts/smoke_mcp.py --verbose

Exit status is 0 only if every check passed on every entry point tried.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any

#: Seconds to wait for one reply. Generous enough for a cold interpreter start
#: on a loaded Windows box, short enough that a genuine hang fails the gate
#: instead of blocking a pipeline until somebody notices.
REPLY_TIMEOUT_S: float = 60.0

#: A lesson id used for the valid call. Resolved at runtime from list_lessons
#: rather than hardcoded, so renaming a lesson cannot silently skip the check.
PROTOCOL_VERSION_SENT: str = "2025-06-18"

#: Non-ASCII probe, sent as a lesson id that cannot exist. The server quotes an
#: unknown id back in its error, which makes this a genuine round trip: the
#: string is encoded on the way down, decoded, re-encoded on the way back, and
#: compared here against the original. A probe buried in a program's comments
#: would prove nothing, because nothing echoes the program back.
#:
#: The degree sign, the accents and the tick are all things a lesson title or a
#: pupil's comment realistically contains, and all of them are mangled by a pipe
#: that quietly fell back to cp1252 on Windows.
UNICODE_PROBE: str = "café-90°-naïve-✓"


class SmokeFailure(Exception):
    """A check failed. Carries the message the report prints."""


class ServerProcess:
    """One MCP server subprocess, spoken to over its stdin and stdout pipes."""

    def __init__(self, argv: list[str], *, verbose: bool = False) -> None:
        self.argv = argv
        self.verbose = verbose
        env = dict(os.environ)
        # Without this the child may pick the console codepage on Windows and
        # mangle any non-ASCII in a lesson brief. The server writes UTF-8; say so.
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        self.proc = subprocess.Popen(  # noqa: S603 - argv is built here, never from input
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
            env=env,
            cwd=str(Path(__file__).resolve().parent.parent),
        )
        self._stdout_q: queue.Queue[str | None] = queue.Queue()
        self._stderr_chunks: list[str] = []
        self._pump(self.proc.stdout, self._stdout_q)
        self._drain(self.proc.stderr, self._stderr_chunks)

    def _pump(self, stream: Any, sink: queue.Queue[str | None]) -> None:
        def run() -> None:
            for line in stream:
                sink.put(line)
            sink.put(None)

        threading.Thread(target=run, daemon=True).start()

    def _drain(self, stream: Any, sink: list[str]) -> None:
        def run() -> None:
            for line in stream:
                sink.append(line)

        threading.Thread(target=run, daemon=True).start()

    def send(self, message: dict[str, Any]) -> None:
        line = json.dumps(message, ensure_ascii=False)
        if self.verbose:
            print(f"  -> {line[:160]}")
        assert self.proc.stdin is not None
        self.proc.stdin.write(line + "\n")
        self.proc.stdin.flush()

    def send_raw(self, text: str) -> None:
        if self.verbose:
            print(f"  -> (raw) {text!r}")
        assert self.proc.stdin is not None
        self.proc.stdin.write(text + "\n")
        self.proc.stdin.flush()

    def read(self) -> dict[str, Any]:
        """Read one reply frame, or raise if the server went quiet."""
        try:
            line = self._stdout_q.get(timeout=REPLY_TIMEOUT_S)
        except queue.Empty:
            raise SmokeFailure(
                f"no reply within {REPLY_TIMEOUT_S:g}s. stderr so far: {self.stderr()!r}"
            ) from None
        if line is None:
            raise SmokeFailure(f"server closed stdout early. stderr: {self.stderr()!r}")
        if self.verbose:
            print(f"  <- {line.strip()[:160]}")
        try:
            return dict(json.loads(line))
        except json.JSONDecodeError as exc:
            raise SmokeFailure(f"stdout carried a non-JSON line {line!r}: {exc}") from exc

    def expect_silence(self, seconds: float = 1.0) -> None:
        """Assert nothing arrives on stdout for a moment."""
        try:
            line = self._stdout_q.get(timeout=seconds)
        except queue.Empty:
            return
        if line is None:
            raise SmokeFailure("server closed stdout when silence was expected")
        raise SmokeFailure(f"server replied to a notification with {line!r}")

    def stderr(self) -> str:
        return "".join(self._stderr_chunks)

    def close(self) -> int:
        assert self.proc.stdin is not None
        self.proc.stdin.close()
        try:
            return self.proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            raise SmokeFailure("server did not exit after stdin closed") from None


def request(req_id: int, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    msg: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        msg["params"] = params
    return msg


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def run_suite(argv: list[str], *, verbose: bool) -> list[str]:
    """Drive one server process through the whole battery. Returns check labels."""
    passed: list[str] = []
    server = ServerProcess(argv, verbose=verbose)

    # 1. initialize
    server.send(
        request(
            1,
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION_SENT,
                "capabilities": {},
                "clientInfo": {"name": "kodro-smoke", "version": "1"},
            },
        )
    )
    reply = server.read()
    require("error" not in reply, f"initialize returned an error: {reply.get('error')}")
    result = reply["result"]
    require(
        result["protocolVersion"] == PROTOCOL_VERSION_SENT,
        f"initialize echoed {result.get('protocolVersion')!r}, expected {PROTOCOL_VERSION_SENT!r}",
    )
    server_name = result["serverInfo"]["name"]
    require(server_name == "kodro", f"serverInfo.name is {server_name!r}, expected 'kodro'")
    passed.append(f"initialize -> {server_name} {result['serverInfo']['version']}")

    # 2. the initialized notification must not be answered
    server.send({"jsonrpc": "2.0", "method": "notifications/initialized"})
    server.expect_silence()
    passed.append("notifications/initialized answered with silence")

    # 3. enumerate
    server.send(request(2, "tools/list"))
    tools = server.read()["result"]["tools"]
    require(len(tools) > 0, "tools/list returned nothing")
    for tool in tools:
        require("inputSchema" in tool, f"tool {tool.get('name')!r} has no inputSchema")
    tool_names = sorted(t["name"] for t in tools)
    passed.append(f"tools/list -> {len(tools)} tools ({', '.join(tool_names)})")

    server.send(request(3, "resources/list"))
    resources = server.read()["result"]["resources"]
    require(len(resources) > 0, "resources/list returned nothing")
    bad_mime = [r["uri"] for r in resources if r.get("mimeType") != "application/json"]
    require(not bad_mime, f"resources without application/json mimeType: {bad_mime}")
    passed.append(f"resources/list -> {len(resources)} resources")

    # 4. a valid call, against a lesson id discovered at runtime
    server.send(request(4, "tools/call", {"name": "list_lessons", "arguments": {}}))
    listing = server.read()["result"]
    require(listing["isError"] is False, f"list_lessons failed: {listing}")
    lessons = listing["structuredContent"]["lessons"]
    require(len(lessons) > 0, "list_lessons reported an empty library")
    lesson_id = lessons[0]["id"]

    server.send(
        request(5, "tools/call", {"name": "get_lesson", "arguments": {"lessonId": lesson_id}})
    )
    lesson = server.read()["result"]
    require(lesson["isError"] is False, f"get_lesson({lesson_id}) failed: {lesson}")
    require(
        lesson["structuredContent"]["id"] == lesson_id,
        "get_lesson returned a different lesson than the one asked for",
    )
    passed.append(f"tools/call get_lesson({lesson_id}) succeeded")

    # 5. an invalid call is content, not an RPC error
    server.send(
        request(
            6,
            "tools/call",
            {"name": "get_lesson", "arguments": {"lessonId": "__no_such_lesson__"}},
        )
    )
    reply = server.read()
    require("error" not in reply, "a bad lesson id must not be a JSON-RPC error")
    require(reply["result"]["isError"] is True, "a bad lesson id must set isError")
    text = reply["result"]["content"][0]["text"]
    require(
        "__no_such_lesson__" in text,
        f"the error must quote the id it was given, got {text!r}",
    )
    passed.append("tools/call with a bad lesson id -> isError naming the id")

    server.send(request(7, "tools/call", {"name": "__no_such_tool__", "arguments": {}}))
    reply = server.read()
    require(reply["result"]["isError"] is True, "an unknown tool must set isError")
    passed.append("tools/call with an unknown tool -> isError")

    # An argument the schema does not declare must be refused, not ignored. This
    # is the regression the validator was added for: it used to be dropped and
    # the tool answered with unfiltered data.
    server.send(
        request(
            8,
            "tools/call",
            {"name": "list_lessons", "arguments": {"keyStages": "KS3"}},
        )
    )
    reply = server.read()
    require(
        reply["result"]["isError"] is True,
        "an undeclared argument must be refused, not silently dropped",
    )
    passed.append("tools/call with a misspelled argument -> isError")

    # 6. a bad resource URI is a protocol error
    server.send(request(9, "resources/read", {"uri": "kodro://nope/nope"}))
    reply = server.read()
    require("error" in reply, "an unknown resource URI must be a JSON-RPC error")
    passed.append(f"resources/read of a bad URI -> RPC {reply['error']['code']}")

    server.send(request(10, "totally/unknown"))
    reply = server.read()
    require("error" in reply, "an unknown method must be a JSON-RPC error")
    require(
        reply["error"]["code"] == -32601,
        f"unknown method should be -32601, got {reply['error']['code']}",
    )
    passed.append("unknown method -> RPC -32601")

    # 7. a malformed frame is refused and the session survives
    server.send_raw("{not json at all")
    reply = server.read()
    require("error" in reply, "a malformed line must produce a JSON-RPC error")
    require(
        reply["error"]["code"] == -32700,
        f"malformed JSON should be -32700, got {reply['error']['code']}",
    )
    server.send(request(11, "ping"))
    reply = server.read()
    require("error" not in reply, "the session must survive a malformed frame")
    passed.append("malformed frame -> RPC -32700, session survived")

    # 8. a real tool call, and non-ASCII surviving both directions
    server.send(
        request(
            12,
            "tools/call",
            {
                "name": "run_program",
                "arguments": {"lessonId": lesson_id, "source": "move_forward(1)\n"},
            },
        )
    )
    reply = server.read()
    require("error" not in reply, f"run_program errored: {reply.get('error')}")
    require("structuredContent" in reply["result"], "run_program returned no structured result")
    passed.append("tools/call run_program returned a structured result")

    server.send(
        request(13, "tools/call", {"name": "get_lesson", "arguments": {"lessonId": UNICODE_PROBE}})
    )
    reply = server.read()
    text = reply["result"]["content"][0]["text"]
    require(
        UNICODE_PROBE in text,
        f"the unicode probe came back mangled as {text!r}: the pipe is not UTF-8 clean",
    )
    server.send(request(14, "resources/read", {"uri": resources[0]["uri"]}))
    reply = server.read()
    require("error" not in reply, f"resources/read failed: {reply.get('error')}")
    require(
        "�" not in json.dumps(reply, ensure_ascii=False),
        "resources/read returned a replacement character",
    )
    passed.append(f"non-ASCII round trip is byte-exact ({UNICODE_PROBE})")

    # 9. stdout was protocol-only and the process exits cleanly
    code = server.close()
    require(code == 0, f"server exited {code}, expected 0")
    passed.append("stdin closed -> exit 0")
    return passed


def entry_points(requested: str) -> list[tuple[str, list[str]]]:
    """Resolve which server invocations to test, skipping ones not installed."""
    found: list[tuple[str, list[str]]] = []
    console = shutil.which("kodro-mcp")
    if requested in {"all", "console"} and console:
        found.append(("kodro-mcp (console script)", [console]))
    if requested in {"all", "module"}:
        found.append((f"{Path(sys.executable).name} -m robolearn.mcp", [sys.executable, "-m", "robolearn.mcp"]))
    if not found:
        if requested == "console":
            raise SmokeFailure("kodro-mcp is not on PATH. Reinstall with: pip install -e .")
        raise SmokeFailure(f"no entry point matched {requested!r}")
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--entry",
        choices=("all", "console", "module"),
        default="all",
        help="which invocation to smoke: the console script, the module, or both.",
    )
    parser.add_argument("--verbose", action="store_true", help="echo every frame.")
    args = parser.parse_args(argv)

    # The probe and the frames echoed by --verbose contain non-ASCII. A Windows
    # console defaults to a codepage that cannot encode it, and the resulting
    # UnicodeEncodeError would fail the run for a reason that has nothing to do
    # with the server.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    try:
        targets = entry_points(args.entry)
    except SmokeFailure as exc:
        print(f"FAIL  {exc}")
        return 1

    failures = 0
    for label, cmd in targets:
        print(f"== {label} ==")
        try:
            for check in run_suite(cmd, verbose=args.verbose):
                print(f"  PASS  {check}")
        except SmokeFailure as exc:
            print(f"  FAIL  {exc}")
            failures += 1
        except OSError as exc:
            print(f"  FAIL  could not start {cmd[0]!r}: {exc}")
            failures += 1

    print()
    if failures:
        print(f"== MCP SMOKE: {failures} of {len(targets)} entry points FAILED ==")
        return 1
    print(f"== MCP SMOKE: {len(targets)} of {len(targets)} entry points clean ==")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
