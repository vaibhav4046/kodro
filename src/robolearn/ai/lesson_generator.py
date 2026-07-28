"""Turn a natural-language brief into a validated RoboLearn lesson.

The generator asks a local Ollama model to emit JSON matching the
lesson schema, then validates it through the same Pydantic model the
bundled lessons use. If the model returns malformed JSON or a schema
violation, the generator retries up to :data:`MAX_ATTEMPTS` times,
feeding the validation error back into the prompt. Anything that still
fails surfaces as :class:`GenerationError` — never a crash.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from pydantic import ValidationError

from robolearn.lessons.schema import Lesson

from .ollama_client import DEFAULT_MODEL, OllamaClient, OllamaError

#: How many times to retry on malformed / invalid model output.
MAX_ATTEMPTS: int = 3

_SYSTEM_PROMPT: str = """\
You are a UK secondary-school Computing teacher authoring a lesson for a
rover-programming simulator called RoboLearn. Pupils write short Python
against this exact API (no other functions exist):
move_forward(distance), move_backward(distance), turn_left(angle_deg),
turn_right(angle_deg), wait(seconds), read_distance(), read_colour(),
read_heading(), read_battery(), obstacle_ahead(threshold_m),
sample_detected(radius_m), at_base(), collect_sample(), drop_sample(),
beep(times), log(message).

You MUST reply with a single JSON object and nothing else. The schema:

{
  "id": "snake_case_id",
  "title": "Human title",
  "key_stage": "KS3" or "KS4",
  "ct_concepts": ["sequence"|"selection"|"iteration"|"functions"|
                  "decomposition"|"abstraction"|"recursion"|
                  "algorithmic_efficiency"|"debugging"],  // at least one
  "curriculum_refs": ["free text reference"],
  "prereqs": [],
  "terrain": "earth"|"mars"|"underwater"|"space",
  "intro": "One short paragraph addressed to the pupil.",
  "starter_code": "valid python using only the API above",
  "allowed_constructs": ["assignment"|"arithmetic"|"comparison"|"for"|
                         "function_call"|"function_def"|"if"|"logical"|
                         "recursion"|"return"|"while"],  // at least one
  "max_lines": 12,
  "world": {
     "base": [x, y],
     "samples": [[x, y], ...],
     "obstacles": [{"x": x, "y": y, "r": radius}],
     "width": 10.0,
     "height": 10.0
  },
  "success_criteria": [
     {"samples_collected": 1},
     {"no_collisions": true}
  ],
  "hints": {"on_failure": ["..."], "on_success": ["..."]}
}

Coordinates are metres inside a width x height arena (default 10x10).
Keep starter_code runnable and short. Do not invent API functions.
"""


class GenerationError(RuntimeError):
    """Raised when a valid lesson could not be generated."""


@dataclass(slots=True)
class GenerationResult:
    """A successfully generated + validated lesson plus the raw JSON."""

    lesson: Lesson
    raw_json: str
    attempts: int


def generate_lesson(
    brief: str,
    *,
    client: OllamaClient | None = None,
    model: str = DEFAULT_MODEL,
    max_attempts: int = MAX_ATTEMPTS,
) -> GenerationResult:
    """Generate a validated :class:`Lesson` from a plain-language ``brief``.

    Args:
        brief: What the teacher wants, e.g. "a Mars lesson where pupils
            use a while loop to collect three samples".
        client: Optional pre-built :class:`OllamaClient` (tests inject a
            fake here). Defaults to a localhost client.
        model: Model name to use.
        max_attempts: Retry budget for malformed output.

    Returns:
        A :class:`GenerationResult`.

    Raises:
        GenerationError: If no valid lesson could be produced.
    """
    ollama = client or OllamaClient(model=model)
    prompt = f"Brief: {brief}\n\nReturn the lesson JSON now."
    last_error = ""
    for attempt in range(1, max_attempts + 1):
        try:
            raw = ollama.generate(
                prompt,
                system=_SYSTEM_PROMPT,
                model=model,
                json_mode=True,
                temperature=0.6,
            )
        except OllamaError as exc:
            raise GenerationError(f"Ollama unavailable: {exc}") from exc
        cleaned = _extract_json(raw)
        try:
            payload = _coerce_payload(json.loads(cleaned))
            lesson = Lesson.model_validate(payload)
            return GenerationResult(lesson=lesson, raw_json=json.dumps(payload), attempts=attempt)
        except (json.JSONDecodeError, ValidationError, TypeError) as exc:
            last_error = str(exc)
            prompt = (
                f"Brief: {brief}\n\nYour previous reply was invalid:\n{last_error}\n\n"
                "Return corrected lesson JSON only."
            )
    raise GenerationError(
        f"could not produce a valid lesson after {max_attempts} attempts: {last_error}"
    )


def _extract_json(text: str) -> str:
    """Best-effort pull of the first ``{...}`` block from a model reply."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return text.strip()
    return text[start : end + 1]


# Small local models often emit near-miss enum values. Map the common ones
# back onto the schema's vocabulary so a single typo doesn't fail the whole
# generation.
_CONCEPT_SYNONYMS: dict[str, str] = {
    "algorithms": "algorithmic_efficiency",
    "algorithm": "algorithmic_efficiency",
    "efficiency": "algorithmic_efficiency",
    "optimisation": "algorithmic_efficiency",
    "optimization": "algorithmic_efficiency",
    "loop": "iteration",
    "loops": "iteration",
    "looping": "iteration",
    "repetition": "iteration",
    "condition": "selection",
    "conditional": "selection",
    "conditionals": "selection",
    "branching": "selection",
    "function": "functions",
    "procedures": "functions",
    "procedure": "functions",
    "sequencing": "sequence",
    "recursive": "recursion",
    "debug": "debugging",
    "error_correction": "debugging",
    "troubleshooting": "debugging",
}
_VALID_CONCEPTS: frozenset[str] = frozenset(
    {
        "sequence",
        "selection",
        "iteration",
        "functions",
        "decomposition",
        "abstraction",
        "recursion",
        "algorithmic_efficiency",
        "debugging",
    }
)

_CONSTRUCT_SYNONYMS: dict[str, str] = {
    "for_loop": "for",
    "while_loop": "while",
    "if_statement": "if",
    "if_else": "if",
    "conditional": "if",
    "function_definition": "function_def",
    "def": "function_def",
    "call": "function_call",
    "comparison_operator": "comparison",
}
_VALID_CONSTRUCTS: frozenset[str] = frozenset(
    {
        "assignment",
        "arithmetic",
        "comparison",
        "for",
        "function_call",
        "function_def",
        "if",
        "logical",
        "recursion",
        "return",
        "while",
    }
)


def _coerce_payload(payload: object) -> dict[str, object]:
    """Normalise a near-miss model payload toward the lesson schema."""
    if not isinstance(payload, dict):
        raise TypeError("model did not return a JSON object")
    out = dict(payload)
    out["ct_concepts"] = _coerce_enum_list(
        out.get("ct_concepts"), _CONCEPT_SYNONYMS, _VALID_CONCEPTS, fallback="sequence"
    )
    out["allowed_constructs"] = _coerce_enum_list(
        out.get("allowed_constructs"),
        _CONSTRUCT_SYNONYMS,
        _VALID_CONSTRUCTS,
        fallback="function_call",
    )
    # Terrain + key-stage casing.
    terrain = out.get("terrain")
    if isinstance(terrain, str):
        out["terrain"] = terrain.strip().lower()
    ks = out.get("key_stage")
    if isinstance(ks, str):
        out["key_stage"] = ks.strip().upper().replace(" ", "")
    return out


def _coerce_enum_list(
    value: object,
    synonyms: dict[str, str],
    valid: frozenset[str],
    *,
    fallback: str,
) -> list[str]:
    """Map a list of free-text tags onto a closed enum vocabulary."""
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return [fallback]
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        key = item.strip().lower().replace(" ", "_").replace("-", "_")
        mapped = synonyms.get(key, key)
        if mapped in valid and mapped not in out:
            out.append(mapped)
    return out or [fallback]
