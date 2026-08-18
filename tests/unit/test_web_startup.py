"""What the packaged app does when it cannot start at all.

``launch()`` is the entry point of the windowed ``.exe``, and a windowed process
on Windows has no console: if pywebview raises because the WebView2 runtime is
absent, a traceback goes nowhere the user will ever see and Kodro simply fails
to open. The native message box in ``_report_startup_failure`` is therefore the
only error channel that exists in the shipped build, which makes it worth a test
even though it is four lines of ctypes.

Both tests run identically on Linux CI and on Windows: ``sys.platform`` is forced
and ``ctypes.windll`` is injected, so neither depends on the host actually being
Windows, and neither can pop a real dialog that would wedge the suite.
"""

from __future__ import annotations

import ctypes
import sys
from typing import Any

import pytest
import webview

import robolearn.web.app as appmod


class _RecordingUser32:
    """Stands in for ``ctypes.windll.user32`` and records the dialog call."""

    def __init__(self) -> None:
        self.calls: list[tuple[Any, ...]] = []

    # Named for the Win32 symbol it stands in for, not for PEP 8.
    def MessageBoxW(self, *args: Any) -> int:
        self.calls.append(args)
        return 1


class _RecordingWindll:
    def __init__(self) -> None:
        self.user32 = _RecordingUser32()


def test_windows_startup_failure_opens_a_native_dialog(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """On Windows the guidance goes to a message box, not to a dead stderr."""
    monkeypatch.setattr(sys, "platform", "win32")
    windll = _RecordingWindll()
    monkeypatch.setattr(ctypes, "windll", windll, raising=False)

    appmod._report_startup_failure(RuntimeError("WebView2Runtime not found"))

    assert len(windll.user32.calls) == 1, "the failure must reach exactly one dialog"
    _hwnd, message, title, flags = windll.user32.calls[0]
    assert title == "Kodro"
    assert "WebView2" in message, "the dialog must carry the actionable guidance"
    assert flags == 0x10 | 0x10000, "MB_ICONERROR | MB_SETFOREGROUND"
    assert capsys.readouterr().err == "", (
        "stderr is invisible in a windowed exe; writing there as well as showing "
        "the dialog would be duplicate output for the console case only"
    )


def test_windows_startup_failure_falls_back_when_the_dialog_is_unavailable(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A ctypes without ``windll`` must degrade to stderr rather than vanish.

    This is the case that makes the ``getattr`` in the handler load-bearing: on a
    Windows build where ``windll`` is missing (or under a runtime that stubs
    ctypes out), an ``AttributeError`` inside the suppressed block would swallow
    the message entirely and the user would see nothing at all.
    """
    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.delattr(ctypes, "windll", raising=False)

    appmod._report_startup_failure(RuntimeError("boom"))

    assert "boom" in capsys.readouterr().err


def test_launch_reports_a_bad_bundle_instead_of_crashing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A corrupt bundled asset must exit 1 through the friendly handler.

    ``build_app`` raises before ``webview.start`` is ever reached, which is the
    whole reason it sits inside the try: a missing lesson library or index.html
    in a PyInstaller build is exactly as invisible to the user as a missing
    WebView2 runtime, and deserves the same dialog.

    The Ollama autostart thread is neutered first. It is a daemon thread that
    calls ``ensure_server()``, and a test that leaves it in place would try to
    start a real Ollama server on the machine running the suite.
    """
    from robolearn.ai import ollama_client

    monkeypatch.setattr(ollama_client, "ensure_server", lambda *a, **k: None)

    def _explode(**_kwargs: Any) -> None:
        raise RuntimeError("bundled asset missing: index.html")

    reported: list[BaseException] = []
    monkeypatch.setattr(appmod, "build_app", _explode)
    monkeypatch.setattr(appmod, "_report_startup_failure", reported.append)

    with pytest.raises(SystemExit) as exit_info:
        appmod.launch()

    assert exit_info.value.code == 1
    assert len(reported) == 1
    assert "index.html" in str(reported[0])


def test_launch_reports_a_webview_start_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """The original case: the app builds fine, then pywebview will not start."""
    from robolearn.ai import ollama_client

    monkeypatch.setattr(ollama_client, "ensure_server", lambda *a, **k: None)

    reported: list[BaseException] = []
    monkeypatch.setattr(appmod, "build_app", lambda **_k: None)
    monkeypatch.setattr(appmod, "_report_startup_failure", reported.append)

    def _no_webview(**_kwargs: Any) -> None:
        raise RuntimeError("WebView2Runtime not found")

    monkeypatch.setattr(webview, "start", _no_webview)

    with pytest.raises(SystemExit):
        appmod.launch()

    assert "WebView2Runtime" in str(reported[0])
