"""Self-improving hint selection (fully offline).

The rule engine in :mod:`kodro.memory.hint_engine` is deterministic:
:func:`~kodro.memory.hint_engine.find_first_hint` returns the first
matching rule in author order. That is a sensible default, but it can
never learn that, for a given class, a later rule actually unblocks
pupils more reliably than an earlier one.

This module closes that loop without any model or network. The store
records, per rule, how often a shown hint was followed by a passing
attempt (``helped``) out of how many times it was shown and then
re-attempted (``shown``). :func:`rank_hints` re-orders the matching
hints by a Laplace-smoothed success rate, keeping author order as the
tie-break so behaviour is stable until real evidence accumulates.

The smoothing matters: with no data every rule scores the neutral prior
:data:`PRIOR_RATE`, so a brand-new install behaves exactly like the old
first-match engine and only diverges once outcomes are observed.
"""

from __future__ import annotations

from kodro.memory.hint_engine import Hint, HintContext, find_all_hints
from kodro.memory.store import HintStat, Store

#: Pseudo-counts for Laplace / additive smoothing. ``PRIOR_HELPED`` of 1
#: over ``PRIOR_SHOWN`` of 2 gives an unseen rule a neutral 0.5 score, so
#: ranking only departs from author order once a rule has a real record.
PRIOR_HELPED: float = 1.0
PRIOR_SHOWN: float = 2.0

#: The score returned for a rule with no recorded outcomes.
PRIOR_RATE: float = PRIOR_HELPED / PRIOR_SHOWN


def effectiveness(stat: HintStat | None) -> float:
    """Return a rule's smoothed success rate in ``[0, 1]``.

    ``None`` (no record yet) yields the neutral :data:`PRIOR_RATE`.
    """
    if stat is None or stat.shown <= 0:
        return PRIOR_RATE
    return (stat.helped + PRIOR_HELPED) / (stat.shown + PRIOR_SHOWN)


def rank_hints(hints: list[Hint], stats: dict[str, HintStat]) -> list[Hint]:
    """Return ``hints`` ordered by learned effectiveness, best first.

    The input is expected in author order (as produced by
    :func:`find_all_hints`). Sorting is stable, so rules with equal scores
    keep that order, which means an install with no learned data returns
    the list unchanged.
    """
    return sorted(hints, key=lambda h: effectiveness(stats.get(h.rule_name)), reverse=True)


def best_hint(context: HintContext, store: Store) -> Hint | None:
    """Pick the most effective matching hint for ``context``.

    Falls back to the deterministic first match when nothing matches or
    no outcomes have been recorded yet.
    """
    matches = find_all_hints(context)
    if not matches:
        return None
    ranked = rank_hints(matches, store.get_hint_stats())
    return ranked[0]
