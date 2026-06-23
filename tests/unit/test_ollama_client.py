"""Tests for the Ollama client."""

from __future__ import annotations

import json
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
    chunks = list(client.generate_stream(
        "Hi",
        system="System prompt",
        num_predict=50,
        keep_alive="5m"
    ))
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
