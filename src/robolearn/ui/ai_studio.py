"""AI Studio — generate lessons + explanations with a local Ollama model.

Optional. If no Ollama server is reachable on localhost, the window
shows an install prompt and every action is disabled. When a server is
present, the user types a plain-English brief, picks a model, and the
studio streams the generation on a worker thread (so the Tk loop never
freezes), validates the result through the lesson schema, and saves it
to ``~/.robolearn/custom_lessons/``.
"""

from __future__ import annotations

import threading
import tkinter as tk
from collections.abc import Callable
from pathlib import Path
from tkinter import ttk

import yaml

from robolearn.ai import is_available, list_models
from robolearn.ai.lesson_generator import GenerationError, generate_lesson
from robolearn.ai.ollama_client import DEFAULT_MODEL, OllamaClient
from robolearn.lessons.schema import Lesson
from robolearn.ui.lesson_editor import DEFAULT_CUSTOM_DIR


class AIStudio:
    """Modal AI lesson-generation studio."""

    def __init__(
        self,
        parent: tk.Misc,
        *,
        on_saved: Callable[[Lesson], None] | None = None,
        custom_dir: Path | None = None,
        client: OllamaClient | None = None,
    ) -> None:
        """Build the studio window."""
        self._on_saved = on_saved
        self._custom_dir = custom_dir or DEFAULT_CUSTOM_DIR
        self._client = client
        self._window = tk.Toplevel(parent)
        self._window.title("AI Studio — local lesson generator")
        self._window.transient(parent.winfo_toplevel())
        self._window.configure(bg="#0d1117")
        self._available = self._probe_available()
        self._build_widgets()
        from robolearn.ui._lift import bring_to_front

        bring_to_front(self._window)

    # --- public API ---------------------------------------------------------

    @property
    def available(self) -> bool:
        """Whether a local Ollama server was detected at construction time."""
        return self._available

    def destroy(self) -> None:
        """Close the studio window."""
        self._window.destroy()

    # --- private ------------------------------------------------------------

    def _probe_available(self) -> bool:
        if self._client is not None:
            return self._client.available()
        return is_available()

    def _build_widgets(self) -> None:
        outer = ttk.Frame(self._window, padding=12)
        outer.pack(fill=tk.BOTH, expand=True)
        ttk.Label(
            outer,
            text="✨ AI Studio",
            font=("TkDefaultFont", 16, "bold"),
        ).pack(anchor=tk.W)

        if not self._available:
            self._build_unavailable(outer)
            return

        ttk.Label(
            outer,
            text="Describe the lesson you want. The local model writes it for you.",
        ).pack(anchor=tk.W, pady=(2, 8))

        # Model picker.
        model_row = ttk.Frame(outer)
        model_row.pack(fill=tk.X, pady=2)
        ttk.Label(model_row, text="Model:").pack(side=tk.LEFT)
        models = (self._client.models() if self._client else list_models()) or [DEFAULT_MODEL]
        self._model_var = tk.StringVar(value=models[0])
        ttk.Combobox(
            model_row,
            textvariable=self._model_var,
            values=models,
            state="readonly",
            width=24,
        ).pack(side=tk.LEFT, padx=6)

        # Brief input.
        ttk.Label(outer, text="Brief:").pack(anchor=tk.W, pady=(8, 0))
        self._brief = tk.Text(outer, height=4, width=64, wrap=tk.WORD)
        self._brief.insert(
            "1.0",
            "A Mars lesson where pupils use a while loop to collect three samples "
            "while avoiding a rock.",
        )
        self._brief.pack(fill=tk.X, pady=2)

        # Action bar.
        bar = ttk.Frame(outer)
        bar.pack(fill=tk.X, pady=6)
        self._generate_btn = ttk.Button(bar, text="Generate lesson", command=self._on_generate)
        self._generate_btn.pack(side=tk.LEFT)
        self._status = tk.StringVar(value="Ready.")
        ttk.Label(bar, textvariable=self._status).pack(side=tk.LEFT, padx=10)

        # Output console.
        ttk.Label(outer, text="Result:").pack(anchor=tk.W)
        self._output = tk.Text(
            outer, height=12, width=64, wrap=tk.WORD, state=tk.DISABLED, bg="#161b22", fg="#c9d1d9"
        )
        self._output.pack(fill=tk.BOTH, expand=True, pady=2)

    def _build_unavailable(self, outer: ttk.Frame) -> None:
        msg = (
            "No local AI model detected.\n\n"
            "RoboLearn works fully without AI. To unlock AI lesson generation:\n"
            "  1. Install Ollama from https://ollama.com (free, runs offline).\n"
            "  2. In a terminal run:  ollama pull llama3.2:3b\n"
            "  3. Reopen AI Studio.\n\n"
            "Nothing leaves your computer — the model runs locally."
        )
        lbl = tk.Label(
            outer,
            text=msg,
            justify=tk.LEFT,
            anchor=tk.W,
            fg="#c9d1d9",
            bg="#0d1117",
            font=("TkDefaultFont", 10),
        )
        lbl.pack(anchor=tk.W, pady=8)
        ttk.Button(outer, text="Close", command=self.destroy).pack(anchor=tk.E)

    # --- generation ---------------------------------------------------------

    def _on_generate(self) -> None:
        brief = self._brief.get("1.0", "end-1c").strip()
        if not brief:
            self._status.set("Enter a brief first.")
            return
        self._generate_btn.configure(state=tk.DISABLED)
        self._status.set("Thinking… (local model, may take a few seconds)")
        self._set_output("")
        model = self._model_var.get()
        thread = threading.Thread(
            target=self._worker, args=(brief, model), name="ai-studio-gen", daemon=True
        )
        thread.start()

    def _worker(self, brief: str, model: str) -> None:
        try:
            result = generate_lesson(brief, client=self._client, model=model)
        except GenerationError as exc:
            message = str(exc)
            self._window.after(0, lambda: self._on_error(message))
            return
        self._window.after(0, lambda: self._on_success(result.lesson, result.raw_json))

    def _on_success(self, lesson: Lesson, raw_json: str) -> None:
        target = self._custom_dir / f"{lesson.id}.yaml"
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = lesson.model_dump(mode="json")
        target.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")
        self._set_output(
            f"Saved lesson '{lesson.id}' — {lesson.title}\n"
            f"Terrain: {lesson.terrain}  Key stage: {lesson.key_stage}\n"
            f"Concepts: {', '.join(lesson.ct_concepts)}\n\n"
            f"Starter code:\n{lesson.starter_code}\n\n"
            f"Written to: {target}"
        )
        self._status.set("Saved. Reload lessons to play it.")
        self._generate_btn.configure(state=tk.NORMAL)
        if self._on_saved is not None:
            self._on_saved(lesson)

    def _on_error(self, message: str) -> None:
        self._set_output(f"Generation failed:\n{message}\n\nTry rephrasing the brief.")
        self._status.set("Failed.")
        self._generate_btn.configure(state=tk.NORMAL)

    def _set_output(self, text: str) -> None:
        self._output.configure(state=tk.NORMAL)
        self._output.delete("1.0", tk.END)
        self._output.insert("1.0", text)
        self._output.configure(state=tk.DISABLED)
