"""Tests for the Ollama client."""

from __future__ import annotations

import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from robolearn.ai.ollama_client import (
    OllamaClient,
    OllamaError,
    _require_local,
    is_available,
    list_models,
)


def test_require_local_allows_localhost() -> None:
    assert _require_local("http://localhost:11434/api/tags") == "http://localhost:11434/api/tags"


def test_require_local_rejects_remote() -> None:
    with pytest.raises(OllamaError, match="refusing non-local URL"):
        _require_local("http://example.com/api/tags")


@patch("urllib.request.urlopen")
def test_available_returns_true_on_success(mock_urlopen: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"models": []}'
    mock_urlopen.return_value.__enter__.return_value = mock_resp
    assert OllamaClient().available() is True
    assert is_available() is True


@patch("urllib.request.urlopen")
def test_available_returns_false_on_error(mock_urlopen: MagicMock) -> None:
    mock_urlopen.side_effect = urllib.error.URLError("conn refused")
    assert OllamaClient().available() is False
    assert is_available() is False


@patch("urllib.request.urlopen")
def test_models_returns_list_on_success(mock_urlopen: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"models": [{"name": "llama3.2:3b"}, {"name": "phi3"}]}'
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    models = OllamaClient().models()
    assert models == ["llama3.2:3b", "phi3"]

    models2 = list_models()
    assert models2 == ["llama3.2:3b", "phi3"]


@patch("urllib.request.urlopen")
def test_models_returns_empty_on_error(mock_urlopen: MagicMock) -> None:
    mock_urlopen.side_effect = urllib.error.URLError("conn refused")
    assert OllamaClient().models() == []
    assert list_models() == []


@patch("urllib.request.urlopen")
def test_models_handles_malformed_response(mock_urlopen: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"models": "not a list"}'
    mock_urlopen.return_value.__enter__.return_value = mock_resp
    assert OllamaClient().models() == []


@patch("urllib.request.urlopen")
def test_generate_success(mock_urlopen: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"response": "Hello world"}'
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    client = OllamaClient()
    result = client.generate(
        "Hi",
        system="You are an assistant.",
        model="custom-model",
        json_mode=True,
        num_predict=100,
        keep_alive="10m",
    )
    assert result == "Hello world"


@patch("urllib.request.urlopen")
def test_generate_raises_ollama_error_on_bad_response(mock_urlopen: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"response": 123}'  # Not a string
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    client = OllamaClient()
    with pytest.raises(OllamaError, match="malformed response"):
        client.generate("Hi")


@patch("urllib.request.urlopen")
def test_generate_stream_yields_chunks(mock_urlopen: MagicMock) -> None:
    mock_resp = MagicMock()
    # Mock iterating over lines
    mock_resp.__iter__.return_value = [
        b'{"response": "Hello "}\n',
        b'{"response": "world"}\n',
        b'{"response": "", "done": true}\n',
    ]
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    client = OllamaClient()
    chunks = list(
        client.generate_stream("Hi", system="System prompt", num_predict=50, keep_alive="5m")
    )
    assert chunks == ["Hello ", "world"]


@patch("urllib.request.urlopen")
def test_generate_stream_raises_on_error(mock_urlopen: MagicMock) -> None:
    mock_urlopen.side_effect = urllib.error.URLError("conn refused")

    client = OllamaClient()
    with pytest.raises(OllamaError, match="streaming generate failed"):
        list(client.generate_stream("Hi"))


@patch("urllib.request.urlopen")
def test_embed_success(mock_urlopen: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"embedding": [0.1, 0.2, 0.3]}'
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    client = OllamaClient()
    vector = client.embed("test text")
    assert vector == [0.1, 0.2, 0.3]


@patch("urllib.request.urlopen")
def test_embed_error_returns_empty(mock_urlopen: MagicMock) -> None:
    mock_urlopen.side_effect = urllib.error.URLError("conn refused")
    client = OllamaClient()
    assert client.embed("test text") == []


# --- ensure_server / auto-start ----------------------------------------------


def test_find_ollama_exe_env_override(tmp_path, monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    fake = tmp_path / "ollama.exe"
    fake.write_bytes(b"")
    monkeypatch.setenv("OLLAMA_EXE", str(fake))
    assert oc.find_ollama_exe() == str(fake)


def test_find_ollama_exe_absent(monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    monkeypatch.delenv("OLLAMA_EXE", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", "C:\nonexistent\nowhere")
    monkeypatch.setattr("shutil.which", lambda _name: None)
    assert oc.find_ollama_exe() is None


def test_ensure_server_already_up_warms_and_returns_true(monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    monkeypatch.setattr(oc.OllamaClient, "available", lambda self: True)
    warmed: list[str] = []
    monkeypatch.setattr(
        oc, "_warm_preferred_model", lambda client: warmed.append("yes") or "kodro-fast:latest"
    )
    spawned: list[str] = []
    monkeypatch.setattr(oc, "_spawn_server", lambda exe: spawned.append(exe) or True)
    assert oc.ensure_server() is True
    assert warmed == ["yes"]
    assert spawned == []  # never spawns when the server already answers


def test_ensure_server_not_installed_returns_false(monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    monkeypatch.setattr(oc.OllamaClient, "available", lambda self: False)
    monkeypatch.setattr(oc, "find_ollama_exe", lambda: None)
    assert oc.ensure_server() is False


def test_ensure_server_spawns_and_waits_for_probe(monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    # First probe (pre-spawn) fails; post-spawn polling succeeds on the 2nd try.
    calls = {"n": 0}

    def fake_available(self) -> bool:
        calls["n"] += 1
        return calls["n"] >= 3

    monkeypatch.setattr(oc.OllamaClient, "available", fake_available)
    monkeypatch.setattr(oc, "find_ollama_exe", lambda: "C:\fake\\ollama.exe")
    spawned: list[str] = []
    monkeypatch.setattr(oc, "_spawn_server", lambda exe: spawned.append(exe) or True)
    monkeypatch.setattr(oc.time, "sleep", lambda _s: None)
    monkeypatch.setattr(oc, "_warm_preferred_model", lambda client: None)
    assert oc.ensure_server() is True
    assert spawned == ["C:\fake\\ollama.exe"]


def test_ensure_server_spawn_fails_returns_false(monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    monkeypatch.setattr(oc.OllamaClient, "available", lambda self: False)
    monkeypatch.setattr(oc, "find_ollama_exe", lambda: "C:\fake\\ollama.exe")
    monkeypatch.setattr(oc, "_spawn_server", lambda exe: False)
    assert oc.ensure_server() is False


def test_warm_preferred_model_picks_first_installed(monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    client = OllamaClient()
    monkeypatch.setattr(oc.OllamaClient, "models", lambda self: ["gemma3:1b", "kodro-coder:latest"])
    seen: dict[str, object] = {}

    def fake_generate(self, prompt, *, model=None, num_predict=None, keep_alive=None, **kw):
        seen.update({"model": model, "num_predict": num_predict, "keep_alive": keep_alive})
        return "ok"

    monkeypatch.setattr(oc.OllamaClient, "generate", fake_generate)
    assert oc._warm_preferred_model(client) == "kodro-coder:latest"
    assert seen == {"model": "kodro-coder:latest", "num_predict": 1, "keep_alive": "60m"}


def test_warm_preferred_model_none_installed(monkeypatch) -> None:
    from robolearn.ai import ollama_client as oc

    monkeypatch.setattr(oc.OllamaClient, "models", lambda self: [])
    assert oc._warm_preferred_model(OllamaClient()) is None
