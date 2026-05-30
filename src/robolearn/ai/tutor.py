"""AI tutor helpers: explain pupil code, generate comprehension quizzes.

All functions take an optional :class:`OllamaClient` so tests can inject
a fake, and all raise :class:`~robolearn.ai.ollama_client.OllamaError`
on transport failure so the UI can fall back to its rule-based hints.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from robolearn.lessons.schema import Lesson

from .ollama_client import DEFAULT_MODEL, OllamaClient

_EXPLAIN_SYSTEM: str = """\
You are a patient UK Computing teacher helping an 11-16 year old pupil.
Explain their rover-program in plain English, in at most four short
sentences. Point out one concrete improvement. Be encouraging. Never
include code unless quoting one short line.
"""

_QUIZ_SYSTEM: str = """\
You are a Computing teacher. Write {n} short multiple-choice comprehension
questions about the lesson below, each with 3 options and the index of the
correct option. Reply with ONLY a JSON array of objects:
[{{"question": "...", "options": ["a","b","c"], "answer": 0}}]
"""


@dataclass(slots=True)
class QuizQuestion:
    """One generated multiple-choice question."""

    question: str
    options: list[str]
    answer: int


def explain_code(
    source: str,
    *,
    lesson_title: str = "",
    client: OllamaClient | None = None,
    model: str = DEFAULT_MODEL,
) -> str:
    """Return a plain-English explanation of the pupil's ``source``."""
    ollama = client or OllamaClient(model=model)
    context = f"Lesson: {lesson_title}\n\n" if lesson_title else ""
    prompt = f"{context}Pupil program:\n```python\n{source}\n```\n\nExplain it."
    return ollama.generate(prompt, system=_EXPLAIN_SYSTEM, model=model, temperature=0.4).strip()


def generate_quiz(
    lesson: Lesson,
    *,
    n: int = 3,
    client: OllamaClient | None = None,
    model: str = DEFAULT_MODEL,
) -> list[QuizQuestion]:
    """Generate ``n`` comprehension questions about ``lesson``.

    Returns an empty list if the model output cannot be parsed (the UI
    treats that as "AI quiz unavailable, try again").
    """
    ollama = client or OllamaClient(model=model)
    system = _QUIZ_SYSTEM.format(n=n)
    prompt = (
        f"Lesson title: {lesson.title}\n"
        f"Concepts: {', '.join(lesson.ct_concepts)}\n"
        f"Intro: {lesson.intro}\n\nWrite the quiz JSON now."
    )
    raw = ollama.generate(prompt, system=system, model=model, json_mode=True, temperature=0.5)
    return _parse_quiz(raw)


def _parse_quiz(raw: str) -> list[QuizQuestion]:
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1 or end < start:
        return []
    try:
        items = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return []
    questions: list[QuizQuestion] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        q = item.get("question")
        opts = item.get("options")
        ans = item.get("answer")
        if isinstance(q, str) and isinstance(opts, list) and isinstance(ans, int):
            questions.append(QuizQuestion(question=q, options=[str(o) for o in opts], answer=ans))
    return questions
