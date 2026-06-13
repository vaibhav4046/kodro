"""Self-improving hint selection: store persistence + ranker (offline)."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pytest

from robolearn.lessons.grader import GradeResult
from robolearn.lessons.schema import Lesson, WorldDef
from robolearn.memory.hint_engine import Hint, HintContext, find_all_hints
from robolearn.memory.hint_learning import (
    PRIOR_RATE,
    best_hint,
    effectiveness,
    rank_hints,
)
from robolearn.memory.store import HintStat, Store
from robolearn.runtime.tracer import Event

# --- local fixtures (mirror tests/unit/test_hint_engine.py) -----------------


def _lesson(*, max_lines: int = 10, allowed_constructs: list[str] | None = None) -> Lesson:
    return Lesson(
        id="L",
        title="L",
        key_stage="KS3",
        ct_concepts=["sequence"],  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",  # type: ignore[arg-type]
        intro="hi",
        starter_code="move_forward(1)",
        allowed_constructs=allowed_constructs or ["function_call"],  # type: ignore[arg-type]
        max_lines=max_lines,
        world=WorldDef(base=(1.0, 1.0)),
        success_criteria=[],
    )


def _ctx(
    *,
    lesson: Lesson | None = None,
    source: str = "",
    events: Iterable[Event] = (),
    passed: bool = False,
) -> HintContext:
    return HintContext(
        lesson=lesson or _lesson(),
        source=source,
        events=tuple(events),
        grade_result=GradeResult(passed=passed, reasons=[], score=100 if passed else 50),
    )


def _seed(store: Store, rule_name: str, *, shown: int, helped: int) -> None:
    """Drive the public pending/resolve API to record ``shown``/``helped``."""
    for i in range(shown):
        store.set_pending_hint("seed", "L", rule_name)
        store.resolve_pending_hint("seed", "L", passed=i < helped)


# --- store: pending + resolve + stats ---------------------------------------


def test_resolve_with_no_pending_returns_none(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    assert store.resolve_pending_hint("pupil", "01", passed=True) is None
    assert store.get_hint_stats() == {}


def test_pending_hint_resolved_as_helped_when_next_attempt_passes(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    store.set_pending_hint("pupil", "01", "overshoot")
    resolved = store.resolve_pending_hint("pupil", "01", passed=True)
    assert resolved == "overshoot"
    stats = store.get_hint_stats()
    assert stats["overshoot"].shown == 1
    assert stats["overshoot"].helped == 1
    # pending row is cleared, so a second resolve finds nothing
    assert store.resolve_pending_hint("pupil", "01", passed=True) is None


def test_pending_hint_resolved_as_not_helped_when_next_attempt_fails(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    store.set_pending_hint("pupil", "01", "overshoot")
    store.resolve_pending_hint("pupil", "01", passed=False)
    stats = store.get_hint_stats()
    assert stats["overshoot"].shown == 1
    assert stats["overshoot"].helped == 0


def test_set_pending_overwrites_previous_for_same_pupil_lesson(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    store.set_pending_hint("pupil", "01", "first_rule")
    store.set_pending_hint("pupil", "01", "second_rule")
    assert store.resolve_pending_hint("pupil", "01", passed=True) == "second_rule"


def test_pending_hints_are_isolated_per_pupil_and_lesson(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    store.set_pending_hint("ann", "01", "rule_a")
    store.set_pending_hint("ben", "01", "rule_b")
    store.set_pending_hint("ann", "02", "rule_c")
    assert store.resolve_pending_hint("ann", "01", passed=True) == "rule_a"
    assert store.resolve_pending_hint("ben", "01", passed=False) == "rule_b"
    assert store.resolve_pending_hint("ann", "02", passed=True) == "rule_c"


def test_stats_accumulate_across_multiple_resolutions(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    for passed in (True, True, False):
        store.set_pending_hint("pupil", "01", "overshoot")
        store.resolve_pending_hint("pupil", "01", passed=passed)
    stats = store.get_hint_stats()
    assert stats["overshoot"].shown == 3
    assert stats["overshoot"].helped == 2


# --- ranker: smoothing + ordering -------------------------------------------


def test_effectiveness_of_unseen_rule_is_prior() -> None:
    assert effectiveness(None) == PRIOR_RATE
    assert effectiveness(HintStat("r", shown=0, helped=0, updated_at=None)) == PRIOR_RATE


def test_effectiveness_is_laplace_smoothed() -> None:
    # 8 helped of 10 shown -> (8+1)/(10+2) = 0.75, not 0.8
    stat = HintStat("r", shown=10, helped=8, updated_at=None)
    assert effectiveness(stat) == pytest.approx(0.75)


def test_rank_orders_by_effectiveness_best_first() -> None:
    hints = [Hint("weak", "w"), Hint("strong", "s")]
    stats = {
        "weak": HintStat("weak", shown=10, helped=1, updated_at=None),
        "strong": HintStat("strong", shown=10, helped=9, updated_at=None),
    }
    ranked = rank_hints(hints, stats)
    assert [h.rule_name for h in ranked] == ["strong", "weak"]


def test_rank_is_stable_when_no_data_so_author_order_is_kept() -> None:
    hints = [Hint("first", "f"), Hint("second", "s"), Hint("third", "t")]
    assert rank_hints(hints, {}) == hints


# --- best_hint: integration over the real rule set --------------------------


def test_best_hint_none_when_no_rule_matches(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    # A passing submission with benign code, no events: no failure rule fires.
    ctx = _ctx(source="move_forward(5)", events=[], passed=True)
    assert best_hint(ctx, store) is None


def test_best_hint_defaults_to_author_order_with_no_learned_data(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    src = "\n".join(f"x{i} = {i}" for i in range(15))  # forbidden + too-many-lines
    ctx = _ctx(lesson=_lesson(max_lines=5), source=src, passed=False)
    matches = find_all_hints(ctx)
    assert len(matches) >= 2
    assert best_hint(ctx, store).rule_name == matches[0].rule_name  # type: ignore[union-attr]


def test_best_hint_prefers_a_rule_with_a_proven_record(tmp_path: Path) -> None:
    store = Store(tmp_path / "p.db")
    src = "\n".join(f"x{i} = {i}" for i in range(15))
    ctx = _ctx(lesson=_lesson(max_lines=5), source=src, passed=False)
    matches = find_all_hints(ctx)
    assert len(matches) >= 2
    # Make the normally-last matching rule the proven winner.
    winner = matches[-1].rule_name
    loser = matches[0].rule_name
    _seed(store, winner, shown=12, helped=11)
    _seed(store, loser, shown=12, helped=1)
    assert best_hint(ctx, store).rule_name == winner  # type: ignore[union-attr]
