"""AI Studio UI tests (faked Ollama client, no network)."""

from __future__ import annotations

import json
import tkinter as tk
from pathlib import Path

import pytest

from robolearn.ai.ollama_client import OllamaClient
from robolearn.ui.ai_studio import AIStudio


class _DownClient(OllamaClient):
    def available(self) -> bool:  # type: ignore[override]
        return False


class _UpClient(OllamaClient):
    def available(self) -> bool:  # type: ignore[override]
        return True

    def models(self) -> list[str]:  # type: ignore[override]
        return ["llama3.2:3b", "gemma3:4b"]

    def generate(self, prompt: str, **_: object) -> str:  # type: ignore[override]
        return json.dumps(
            {
                "id": "studio_demo",
                "title": "Studio demo",
                "key_stage": "KS3",
                "ct_concepts": ["sequence"],
                "curriculum_refs": ["AI"],
                "prereqs": [],
                "terrain": "earth",
                "intro": "Drive forward.",
                "starter_code": "move_forward(2)",
                "allowed_constructs": ["function_call"],
                "max_lines": 8,
                "world": {"base": [1.0, 1.0]},
                "success_criteria": [{"no_collisions": True}],
                "hints": {"on_failure": ["Try again."]},
            }
        )


@pytest.fixture
def root():  # type: ignore[no-untyped-def]
    try:
        r = tk.Tk()
        r.withdraw()
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        pytest.skip(f"Tk unavailable: {exc}")
    try:
        yield r
    finally:
        r.destroy()


def test_studio_shows_unavailable_when_no_server(root: tk.Tk) -> None:
    studio = AIStudio(root, client=_DownClient())
    try:
        assert studio.available is False
    finally:
        studio.destroy()


def test_studio_available_when_server_up(root: tk.Tk) -> None:
    studio = AIStudio(root, client=_UpClient())
    try:
        assert studio.available is True
    finally:
        studio.destroy()


def test_studio_generate_saves_lesson(root: tk.Tk, tmp_path: Path) -> None:
    saved: list[str] = []
    studio = AIStudio(
        root,
        client=_UpClient(),
        custom_dir=tmp_path,
        on_saved=lambda lsn: saved.append(lsn.id),
    )
    try:
        # Drive the worker synchronously rather than via the thread.
        studio._worker("a demo lesson", "llama3.2:3b")  # type: ignore[attr-defined]
        root.update()  # flush the after(0, ...) callback
        assert (tmp_path / "studio_demo.yaml").exists()
        assert saved == ["studio_demo"]
    finally:
        studio.destroy()
