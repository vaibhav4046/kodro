"""JSON-RPC 2.0 / MCP transport over stdio.

Hand-rolled on the standard library rather than pulled from PyPI. That is not
NIH: the whole product's claim is that it runs on a school laptop with no
account, no network and no install beyond the app itself, and an MCP server
that needed ``pip install mcp`` to start would put a hole in exactly that claim.
The protocol is a few hundred lines of newline-delimited JSON; the dependency
would cost more than it saves.

Wire format: one JSON object per line on stdin, one per line on stdout. Nothing
else may be written to stdout -- a stray ``print`` corrupts the stream -- so all
diagnostics go to stderr.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from typing import IO, Any, Final

from robolearn import __version__
from robolearn.mcp import tools as tool_registry
from robolearn.mcp.tools import ToolError

#: MCP revisions this server implements. The client's requested version is
#: echoed back when it is one of these; otherwise it gets our newest and the
#: spec leaves it free to disconnect.
SUPPORTED_PROTOCOL_VERSIONS: Final[tuple[str, ...]] = ("2025-06-18", "2024-11-05")

#: Default advertised version.
PROTOCOL_VERSION: Final[str] = SUPPORTED_PROTOCOL_VERSIONS[0]

SERVER_NAME: Final[str] = "kodro"

# JSON-RPC 2.0 error codes.
PARSE_ERROR: Final[int] = -32700
INVALID_REQUEST: Final[int] = -32600
METHOD_NOT_FOUND: Final[int] = -32601
INVALID_PARAMS: Final[int] = -32602
INTERNAL_ERROR: Final[int] = -32603


class Server:
    """Dispatches MCP methods. Transport-agnostic: feed it decoded messages.

    Keeping the dispatcher separate from the stdio loop is what makes the
    protocol testable -- a test hands it a dict and asserts on a dict, with no
    subprocess, no pipes and no timing.
    """

    def __init__(self) -> None:
        """Wire the method table."""
        self._methods: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
            "initialize": self._initialize,
            "ping": lambda _params: {},
            "tools/list": self._tools_list,
            "tools/call": self._tools_call,
            "resources/list": self._resources_list,
            "resources/read": self._resources_read,
        }
        self.initialised = False

    # --- method handlers ---------------------------------------------------

    def _initialize(self, params: dict[str, Any]) -> dict[str, Any]:
        requested = str(params.get("protocolVersion") or "")
        version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else PROTOCOL_VERSION
        self.initialised = True
        return {
            "protocolVersion": version,
            "capabilities": {"tools": {}, "resources": {}},
            "serverInfo": {"name": SERVER_NAME, "version": __version__},
            "instructions": (
                "Kodro is an offline robotics-education platform. Use list_lessons to find a "
                "lesson, get_lesson for its brief and success criteria, then grade_program to "
                "mark a pupil's attempt with the same grader the app itself uses. check_api "
                "before claiming a rover function exists. Everything runs locally; no tool "
                "here reaches the network."
            ),
        }

    def _tools_list(self, _params: dict[str, Any]) -> dict[str, Any]:
        return {"tools": list(tool_registry.TOOL_DESCRIPTORS)}

    def _tools_call(self, params: dict[str, Any]) -> dict[str, Any]:
        name = params.get("name")
        if not isinstance(name, str) or not name:
            raise _RpcError(INVALID_PARAMS, "'name' is required and must be a string.")
        arguments = params.get("arguments") or {}
        if not isinstance(arguments, dict):
            raise _RpcError(INVALID_PARAMS, "'arguments' must be an object.")
        # Tool-level failures are reported as content with isError, not as a
        # JSON-RPC error: the spec draws that line so the model can read the
        # message and correct itself instead of the client treating it as a
        # transport fault.
        try:
            payload = tool_registry.call_tool(name, arguments)
        except ToolError as exc:
            return _error_content(str(exc))
        except Exception as exc:
            _log(f"tool {name!r} raised {type(exc).__name__}: {exc}")
            return _error_content(f"{name} failed: {type(exc).__name__}: {exc}")
        return {
            "content": [
                {"type": "text", "text": json.dumps(payload, indent=2, ensure_ascii=False)}
            ],
            "structuredContent": payload,
            "isError": False,
        }

    def _resources_list(self, _params: dict[str, Any]) -> dict[str, Any]:
        return {"resources": tool_registry.list_resources()}

    def _resources_read(self, params: dict[str, Any]) -> dict[str, Any]:
        uri = params.get("uri")
        if not isinstance(uri, str) or not uri:
            raise _RpcError(INVALID_PARAMS, "'uri' is required and must be a string.")
        try:
            payload = tool_registry.read_resource(uri)
        except ToolError as exc:
            raise _RpcError(INVALID_PARAMS, str(exc)) from exc
        return {
            "contents": [
                {
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": json.dumps(payload, indent=2, ensure_ascii=False),
                }
            ]
        }

    # --- dispatch ----------------------------------------------------------

    def handle(self, message: dict[str, Any]) -> dict[str, Any] | None:
        """Handle one decoded message; return the reply, or ``None`` for notifications."""
        if message.get("jsonrpc") != "2.0":
            return _rpc_error(message.get("id"), INVALID_REQUEST, "Expected jsonrpc '2.0'.")
        method = message.get("method")
        if not isinstance(method, str):
            return _rpc_error(message.get("id"), INVALID_REQUEST, "Missing 'method'.")
        params = message.get("params") or {}
        if not isinstance(params, dict):
            return _rpc_error(message.get("id"), INVALID_PARAMS, "'params' must be an object.")

        # A message with no id is a notification: acknowledge nothing, ever,
        # including for methods we do not know. Replying to one is a protocol
        # violation that desynchronises strict clients.
        is_notification = "id" not in message
        if is_notification:
            if method == "notifications/initialized":
                self.initialised = True
            return None

        handler = self._methods.get(method)
        if handler is None:
            return _rpc_error(message["id"], METHOD_NOT_FOUND, f"Unknown method {method!r}.")
        try:
            result = handler(params)
        except _RpcError as exc:
            return _rpc_error(message["id"], exc.code, exc.message)
        except Exception as exc:
            _log(f"method {method!r} raised {type(exc).__name__}: {exc}")
            return _rpc_error(message["id"], INTERNAL_ERROR, f"{type(exc).__name__}: {exc}")
        return {"jsonrpc": "2.0", "id": message["id"], "result": result}


class _RpcError(Exception):
    """A protocol-level failure carrying a JSON-RPC error code."""

    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _rpc_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    """Build a JSON-RPC error reply."""
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _error_content(message: str) -> dict[str, Any]:
    """Build a tool-level error result (``isError`` content, not an RPC error)."""
    return {"content": [{"type": "text", "text": message}], "isError": True}


def _log(message: str) -> None:
    """Write a diagnostic to stderr. stdout carries the protocol and nothing else."""
    sys.stderr.write(f"[kodro-mcp] {message}\n")
    sys.stderr.flush()


def serve_stdio(
    stdin: IO[str] | None = None,
    stdout: IO[str] | None = None,
    *,
    server: Server | None = None,
) -> int:
    """Read newline-delimited JSON-RPC from ``stdin`` until EOF.

    Returns 0 on a clean end of stream. The loop never raises on bad input:
    a malformed line gets a parse error and the session continues, because one
    corrupt frame is not a reason to drop a client mid-lesson.
    """
    source = stdin if stdin is not None else sys.stdin
    sink = stdout if stdout is not None else sys.stdout
    srv = server if server is not None else Server()

    for line in source:
        stripped = line.strip()
        if not stripped:
            continue
        try:
            message = json.loads(stripped)
        except json.JSONDecodeError as exc:
            _write(sink, _rpc_error(None, PARSE_ERROR, f"Invalid JSON: {exc}"))
            continue
        if not isinstance(message, dict):
            _write(sink, _rpc_error(None, INVALID_REQUEST, "Expected a JSON object."))
            continue
        reply = srv.handle(message)
        if reply is not None:
            _write(sink, reply)
    return 0


def _write(sink: IO[str], payload: dict[str, Any]) -> None:
    """Emit one JSON object followed by a newline, flushed immediately."""
    sink.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sink.flush()


def main(argv: list[str] | None = None) -> int:
    """Console entry point for ``kodro-mcp``."""
    args = argv if argv is not None else sys.argv[1:]
    if args and args[0] in {"-h", "--help"}:
        sys.stderr.write(
            "kodro-mcp: Model Context Protocol server for Kodro.\n"
            "Speaks JSON-RPC 2.0 over stdio. Runs entirely offline.\n\n"
            "Register it with an MCP client, for example:\n"
            '  {"mcpServers": {"kodro": {"command": "kodro-mcp"}}}\n'
        )
        return 0
    if args and args[0] == "--list-tools":
        for tool in tool_registry.TOOL_DESCRIPTORS:
            sys.stderr.write(f"{tool['name']}: {tool['description']}\n")
        return 0
    return serve_stdio()


if __name__ == "__main__":
    raise SystemExit(main())
