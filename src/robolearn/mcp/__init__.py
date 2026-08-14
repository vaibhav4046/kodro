"""Model Context Protocol server exposing Kodro's engine to AI assistants.

Kodro already has an offline AI tutor. This package solves the mirror-image
problem: letting an assistant the *teacher* already uses -- one running in their
editor, on their own machine -- read the curriculum, run a pupil's program
against a lesson and see exactly what the grader saw, without a screenshot and
without anybody retyping a marksheet.

Two properties are non-negotiable and the implementation is shaped around them.

*No network.* The transport is JSON-RPC 2.0 over stdio, hand-rolled on the
standard library. There is no dependency to install, no port to open, no
account to create. The server speaks only to the process that spawned it.

*No UI import.* Every handler goes through :mod:`robolearn.runtime.session`,
which is why that module exists: the desktop app imports Tk and the web bridge
imports ``webview``, and an MCP server that pulled in either would not start
in a headless process.
"""

from __future__ import annotations

from robolearn.mcp.server import PROTOCOL_VERSION, Server, serve_stdio

__all__ = ["PROTOCOL_VERSION", "Server", "serve_stdio"]
