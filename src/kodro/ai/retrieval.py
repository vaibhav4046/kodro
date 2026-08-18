"""Fully offline grounded retrieval for the lesson tutor.

The single most repeated request in the persona evaluation was a way for
the tutor to answer a how-do-I question from the actual lesson material
rather than from the local model's memory, where a small model is most
likely to invent a function that does not exist. This module supplies the
retrieval half of that, with no embeddings, no service and no third party
dependency: it builds a small corpus from the lessons (their intros and
glossaries) plus a hand-written reference for the rover interface, and
scores passages against a query with inverse-document-frequency weighted
term overlap. It is deterministic and fast enough to run on every key
press if needed.

:func:`grounded_answer` then constrains the local model to answer only
from the retrieved passages and to say so plainly when nothing relevant
was found, which is the calibrated "I do not know" that general
assistants do not give a child (cf. Lewis et al. 2020 on retrieval
augmentation; Huang et al. 2023 on hallucination).
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

from kodro.ai.ollama_client import DEFAULT_MODEL, OllamaClient
from kodro.lessons.schema import Lesson

# Very small stop list; the corpus is tiny so precision matters more than
# recall and dropping these stops a query like "how do I" from matching
# everything.
_STOP: frozenset[str] = frozenset(
    [
        "the",
        "a",
        "an",
        "of",
        "to",
        "in",
        "on",
        "is",
        "are",
        "how",
        "do",
        "i",
        "my",
        "it",
        "this",
        "that",
        "and",
        "or",
        "for",
        "with",
        "you",
        "your",
        "what",
        "when",
        "where",
        "which",
        "can",
        "does",
        "will",
        "be",
        "as",
        "at",
        "then",
        "so",
    ]
)

# Underscore is a token separator, not part of a word, so a natural-language
# query like "move forward" matches an API doc that names "move_forward"
# (both tokenize to {move, forward}); otherwise the token sets never intersect
# and grounded_answer() wrongly refuses questions the lessons do cover.
_WORD = re.compile(r"[a-z0-9]+")

#: Hand-written reference passages for the rover interface, so a question
#: like "how do I check for a wall" retrieves the right function even
#: before any lesson mentions it.
ROVER_API_DOCS: tuple[tuple[str, str], ...] = (
    (
        "Rover interface: moving",
        "Use move_forward(metres) and move_backward(metres) to drive, and "
        "turn_left(degrees) and turn_right(degrees) to rotate. set_speed(percent) "
        "sets the speed from 0 to 100.",
    ),
    (
        "Rover interface: sensing distance",
        "read_distance() returns how far the nearest obstacle is ahead. "
        "obstacle_ahead() returns True when something is close, so you can write "
        "if obstacle_ahead(): to avoid a wall or a rock.",
    ),
    (
        "Rover interface: other sensors",
        "read_heading() returns the compass direction, read_battery() returns the "
        "charge left, and read_colour() returns the colour under the rover. scan() "
        "sweeps for obstacles.",
    ),
    (
        "Rover interface: samples",
        "collect_sample() picks up a sample when the rover is on one, drop_sample() "
        "puts it down, and sample_detected() returns True when a sample is near. "
        "at_base() returns True at the home base.",
    ),
    (
        "Rover interface: extras",
        "say(message) speaks aloud, led(colour) lights the rover, beep(times) makes "
        "a sound, and place(kind) drops a flag or marker. pen_down() and pen_up() "
        "draw a trail.",
    ),
    (
        "Loops and decisions",
        "Repeat actions with a for loop, for example for i in range(4):, and make "
        "decisions with if and else. A while loop repeats until a condition changes, "
        "but always give it a way to stop.",
    ),
)


@dataclass(frozen=True, slots=True)
class Passage:
    """One retrievable passage and, after a search, its relevance score."""

    source: str
    text: str
    score: float = 0.0


def _tokens(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in _STOP and len(w) > 1]


def build_corpus(lessons: list[Lesson]) -> list[Passage]:
    """Build the retrieval corpus from the lessons plus the API reference."""
    docs: list[Passage] = [Passage(source=s, text=t) for s, t in ROVER_API_DOCS]
    for lesson in lessons:
        docs.append(Passage(source=f"{lesson.id} {lesson.title}", text=lesson.intro))
        for term, definition in lesson.glossary.items():
            docs.append(
                Passage(source=f"{lesson.id} glossary: {term}", text=f"{term}. {definition}")
            )
    return docs


def search(
    query: str,
    docs: list[Passage],
    *,
    k: int = 3,
    preferred_source_prefix: str | None = None,
) -> list[Passage]:
    """Return the ``k`` passages most relevant to ``query``, best first.

    Scoring is inverse-document-frequency weighted term overlap, so a word
    that appears in only one passage counts far more than a common one.
    Passages that share no query term are dropped, which is what lets the
    caller refuse to answer when nothing relevant exists.
    """
    q = set(_tokens(query))
    if not q or not docs:
        return []
    doc_tokens = [set(_tokens(d.text + " " + d.source)) for d in docs]
    n = len(docs)
    df: dict[str, int] = {}
    for toks in doc_tokens:
        for t in toks:
            df[t] = df.get(t, 0) + 1
    scored: list[Passage] = []
    for doc, toks in zip(docs, doc_tokens, strict=True):
        hit = q & toks
        if not hit:
            continue
        score = sum(math.log((n + 1) / (df[t])) for t in hit)
        if preferred_source_prefix and doc.source.startswith(preferred_source_prefix):
            score += 100.0
        scored.append(Passage(source=doc.source, text=doc.text, score=round(score, 4)))
    scored.sort(key=lambda p: p.score, reverse=True)
    return scored[:k]


_ANSWER_SYSTEM: str = """\
You are a Computing teacher helping a child. Answer the question using ONLY
the numbered sources provided. Keep it to two or three short sentences in
plain English, name the rover functions exactly as written, and end by
citing the source you used like [1]. If the sources do not contain the
answer, reply with exactly: I could not find that in the lesson material.
Never invent a function that is not in the sources.
"""


def grounded_answer(
    query: str,
    lessons: list[Lesson],
    *,
    client: OllamaClient | None = None,
    model: str = DEFAULT_MODEL,
    min_score: float = 0.5,
    preferred_lesson_id: str | None = None,
) -> dict[str, object]:
    """Answer ``query`` strictly from retrieved lesson passages.

    Returns a dict with ``grounded`` (whether any passage cleared
    ``min_score``), the model's ``answer``, and the ``sources`` shown to
    it. When nothing relevant is retrieved the model is not called at all
    and a refuse-and-cite message is returned, so a child is never handed a
    confident answer with no basis.

    Raises:
        OllamaError: propagated from the client on transport failure.
    """
    passages = [
        p
        for p in search(
            query,
            build_corpus(lessons),
            k=3,
            preferred_source_prefix=(f"{preferred_lesson_id} " if preferred_lesson_id else None),
        )
        if p.score >= min_score
    ]
    sources = [{"source": p.source, "text": p.text} for p in passages]
    if not passages:
        return {
            "grounded": False,
            "answer": (
                "I could not find that in the lesson material. Try rewording, or ask your teacher."
            ),
            "sources": [],
        }
    ollama = client or OllamaClient(model=model)
    numbered = "\n".join(f"[{i + 1}] {p.text}" for i, p in enumerate(passages))
    prompt = f"Sources:\n{numbered}\n\nQuestion: {query.strip()}\n\nAnswer using only the sources."
    answer = ollama.generate(prompt, system=_ANSWER_SYSTEM, model=model, temperature=0.2).strip()
    return {"grounded": True, "answer": answer, "sources": sources}
