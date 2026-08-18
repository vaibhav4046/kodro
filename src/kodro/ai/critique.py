"""Propose-then-critique: a second reviewer role on the same local model.

The generator in :mod:`kodro.web.app` already does a self-repair round
that fixes code which *crashes*. This module adds the complementary,
semantic pass: a critic role that reads a finished program against the
lesson goal and asks the harder questions a teacher would. Does it
actually achieve the goal? Is it clear enough for a child to read? Does
it lean on anything beyond the functions the lesson teaches?

This is the honest, offline shape of a multi-agent system: two roles
(author and reviewer) realised as two prompts to one local model, with a
deterministic gate in between. The model's proposed rewrite is only
accepted when a caller-supplied ``validate`` callback confirms it still
runs in the same sandbox the Run button uses, so a hallucinated "fix"
can never reach the pupil. With no model reachable the caller gets a
clean :class:`~kodro.ai.ollama_client.OllamaError` and falls back to
the original code, exactly like the rest of the AI surface.

Grounded by the literature this dissertation cites: iterative self-
feedback (Madaan et al. 2023) and multi-agent review (Du et al. 2023)
both improve correctness over a single pass.
"""

from __future__ import annotations

import ast
import json
from collections.abc import Callable
from dataclasses import dataclass, field

from .ollama_client import DEFAULT_MODEL, OllamaClient

#: The full public rover interface, so the reviewer judges "taught functions
#: only" against what actually exists rather than a partial list (an earlier
#: hardcoded subset wrongly flagged place, beep, read_heading and others).
ROVER_API: str = (
    "move_forward, move_backward, turn_left, turn_right, set_speed, wait, "
    "read_distance, read_colour, read_heading, read_battery, obstacle_ahead, "
    "sample_detected, at_base, scan, collect_sample, drop_sample, say, led, "
    "beep, log, place, clear_props, pen_down, pen_up"
)

_REVIEW_SYSTEM: str = """\
You are a senior Computing teacher reviewing a child's rover program.
Reply with ONLY a JSON object of the form
{{"issues": ["...", "..."], "code": "<improved program or empty string>"}}.
List at most three short, concrete issues a 11-16 year old can act on:
whether the program meets the goal, whether it is clear, and whether it
uses only the rover functions that exist ({api}) plus standard Python
loops, ifs and functions. If the program is already good, return an empty
issues list. Only fill "code" when you can give a genuinely better,
complete program; otherwise leave it "". Never include prose outside the
JSON.
"""

#: Hard cap on the review prompt so a pasted essay cannot blow up the model.
_MAX_SOURCE_CHARS: int = 4000


@dataclass(slots=True)
class CritiqueResult:
    """Outcome of one review pass."""

    final_code: str
    issues: list[str] = field(default_factory=list)
    revised: bool = False
    model: str = ""


def review_program(
    source: str,
    *,
    goal: str = "",
    client: OllamaClient | None = None,
    model: str = DEFAULT_MODEL,
    validate: Callable[[str], str | None] | None = None,
) -> CritiqueResult:
    """Review ``source`` and, when safe, return an improved version.

    Args:
        source: The pupil's current program.
        goal: Optional lesson goal to judge the program against.
        client: Injectable Ollama client (tests pass a fake).
        model: Local model name.
        validate: Returns an error string for invalid code, or ``None``
            when the code runs cleanly. A proposed rewrite is accepted
            only when this returns ``None``. When omitted, any non-empty
            rewrite is accepted (used only in tests).

    Returns:
        A :class:`CritiqueResult`. On any parse problem or unsafe rewrite
        the ``final_code`` is the unchanged ``source`` and ``revised`` is
        ``False``.

    Raises:
        OllamaError: propagated from the client on transport failure, so
        the caller can fall back to the original code.
    """
    ollama = client or OllamaClient(model=model)
    code = (source or "")[:_MAX_SOURCE_CHARS]
    context = f"Goal: {goal.strip()[:400]}\n\n" if goal.strip() else ""
    prompt = f"{context}Program:\n```python\n{code}\n```\n\nReview it now."
    raw = ollama.generate(
        prompt,
        system=_REVIEW_SYSTEM.format(api=ROVER_API),
        model=model,
        json_mode=True,
        temperature=0.3,
    )
    issues, proposed = _parse_review(raw)
    result = CritiqueResult(final_code=source or "", issues=issues, model=model)
    changed = bool(proposed.strip()) and proposed.strip() != (source or "").strip()
    validation_ok = changed and (validate is None or validate(proposed) is None)
    same_structure = validation_ok and _same_executable_structure(source or "", proposed)
    if same_structure:
        result.final_code = proposed
        result.revised = True
    elif validation_ok:
        result.issues = [
            "Kodro kept your program because the proposed rewrite changed executable behaviour.",
            *result.issues,
        ][:3]
    return result


def _same_executable_structure(original: str, proposed: str) -> bool:
    """Return whether a review changes no executable Python semantics.

    Model-written formatting and comments are safe to offer. A different AST
    is not: a runnable rewrite can still add movement, invert a branch, or
    introduce recursion. The deterministic runtime remains the syntax/sandbox
    gate; this comparison enforces the review promise to keep behaviour.
    """
    try:
        before = ast.parse(original)
        after = ast.parse(proposed)
    except SyntaxError:
        return False
    return ast.dump(before, include_attributes=False) == ast.dump(after, include_attributes=False)


def _parse_review(raw: str) -> tuple[list[str], str]:
    """Extract ``(issues, code)`` from the model's JSON, tolerant of noise."""
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        return [], ""
    try:
        data = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return [], ""
    if not isinstance(data, dict):
        return [], ""
    raw_issues = data.get("issues", [])
    if isinstance(raw_issues, list):
        issues = [str(i).strip() for i in raw_issues if str(i).strip()]
    else:
        issues = []
    code = data.get("code", "")
    return issues[:3], str(code) if isinstance(code, str) else ""
