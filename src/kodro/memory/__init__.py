"""Pupil-progress memory: SQLite store, rolling skill model, hint engine."""

from __future__ import annotations

from .hint_engine import (
    RULES,
    Hint,
    HintContext,
    HintRule,
    find_all_hints,
    find_first_hint,
)
from .pupil_model import (
    STREAK_BEFORE_STRETCH,
    WEAK_SCORE_THRESHOLD,
    PupilStrength,
    attempted_lesson_ids,
    class_heatmap,
    get_strengths,
    passing_streak,
    suggest_next_lesson,
    update_on_submission,
    weakest_concepts,
)
from .store import (
    DEFAULT_DB_PATH,
    SCHEMA_SQL,
    ConceptStrength,
    Pupil,
    Store,
    Submission,
)

__all__ = (
    "DEFAULT_DB_PATH",
    "RULES",
    "SCHEMA_SQL",
    "STREAK_BEFORE_STRETCH",
    "WEAK_SCORE_THRESHOLD",
    "ConceptStrength",
    "Hint",
    "HintContext",
    "HintRule",
    "Pupil",
    "PupilStrength",
    "Store",
    "Submission",
    "attempted_lesson_ids",
    "class_heatmap",
    "find_all_hints",
    "find_first_hint",
    "get_strengths",
    "passing_streak",
    "suggest_next_lesson",
    "update_on_submission",
    "weakest_concepts",
)
