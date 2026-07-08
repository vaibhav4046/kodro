"""Regression tests for the ``str.format`` attribute-walk sandbox bypass.

``str.format`` / ``str.format_map`` resolve their replacement-field names at
runtime, so a template like ``"{0.__class__.__init__.__globals__}"`` walks an
exposed object all the way to the real, unrestricted module globals without ever
emitting a ``__dunder__`` AST node the sandbox walker could reject. These tests
lock the fix in :mod:`robolearn.runtime.sandbox`: attribute-access field specs
are blocked while ordinary positional / keyword / format-spec / subscript
formatting keeps working.
"""

from __future__ import annotations

import pytest

from robolearn.runtime import (
    Tracer,
    execute,
    find_violations,
    is_safe,
    set_active,
)

# Templates that reach into an attribute -- every one must be rejected.
ATTACK_SNIPPETS: tuple[str, ...] = (
    "'{0.__class__}'.format(move_forward)",
    "'{0.__globals__}'.format(move_forward)",
    "'{0.__globals__[__builtins__]}'.format(move_forward)",
    "'{0.__class__.__init__.__globals__}'.format(move_forward)",
    "'{0.__class__.__mro__}'.format(move_forward)",
    "'{x.__class__}'.format_map({'x': move_forward})",
    # attribute walk hidden inside a nested format spec
    "'{0:{1.__class__}}'.format(3, move_forward)",
    # template stored in a variable before use -- literal is still in the AST
    "fmt = '{0.__globals__}'\nfmt.format(move_forward)",
)

# Ordinary formatting a pupil might legitimately write -- must stay allowed.
LEGIT_SNIPPETS: tuple[str, ...] = (
    "'x = {}'.format(3)",
    "'{0}'.format(7)",
    "'{name}'.format(name='bo')",
    "'{0} {1}'.format('a', 'b')",
    "'{:.2f}'.format(1.5)",
    "'{:>8}'.format('r')",
    "'{0!r}'.format('hi')",
    # subscripting alone is legitimate and cannot escalate on its own
    "'{0[0]}'.format(read_colour())",
    "'{0[key]}'.format({'key': 1})",
    # nested width spec (the nested field is a plain index, no attribute)
    "'{0:{1}}'.format(3, 8)",
    # escaped braces are literal text, not a field
    "'{{not a field}}'.format()",
    # a plain string that merely looks templated but is never formatted
    "log('coordinates use x and y')",
)


@pytest.mark.parametrize("snippet", ATTACK_SNIPPETS)
def test_format_attribute_walk_is_flagged(snippet: str) -> None:
    violations = find_violations(snippet)
    assert violations, f"attack not flagged: {snippet!r}"
    assert any(v.kind == "format-attr" for v in violations), (
        f"expected a 'format-attr' violation for {snippet!r}, got {[v.kind for v in violations]}"
    )
    assert not is_safe(snippet)


@pytest.mark.parametrize("snippet", ATTACK_SNIPPETS)
def test_format_attribute_walk_rejected_before_running(snippet: str) -> None:
    tracer = Tracer()
    set_active(tracer)
    result = execute(snippet, timeout_s=2.0)
    assert result.success is False
    assert result.error_kind == "sandbox"
    # Nothing from the snippet may have executed.
    assert tracer.events() == []


@pytest.mark.parametrize("snippet", LEGIT_SNIPPETS)
def test_legitimate_formatting_still_allowed(snippet: str) -> None:
    assert is_safe(snippet), f"legitimate formatting wrongly rejected: {snippet!r}"


@pytest.mark.parametrize("snippet", LEGIT_SNIPPETS)
def test_legitimate_formatting_runs_to_completion(snippet: str) -> None:
    result = execute(snippet, timeout_s=2.0)
    assert result.success, f"legit snippet failed: {snippet!r}; error={result.error_message}"


def test_format_walk_never_leaks_builtins_end_to_end() -> None:
    """The classic escape springboard must not reach the real builtins via log."""
    tracer = Tracer()
    set_active(tracer)
    result = execute(
        "print('{0.__globals__[__builtins__]}'.format(move_forward))",
        timeout_s=2.0,
    )
    assert result.success is False
    assert result.error_kind == "sandbox"
    logged = [str(e.args[0]) for e in tracer.events() if e.name == "log"]
    assert not any("builtins" in msg for msg in logged)


def test_format_spec_only_formatting_is_allowed() -> None:
    """A format spec (after ':') is not a field name and must not be flagged."""
    assert is_safe("'{:.3f}'.format(3.14159)")
    assert find_violations("'{:.3f}'.format(3.14159)") == []
