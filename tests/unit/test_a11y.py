"""Accessibility settings tests (text scaling + high contrast)."""

from __future__ import annotations

from pathlib import Path

from robolearn.ui.a11y import (
    MAX_SCALE,
    MIN_SCALE,
    A11ySettings,
    clamp_scale,
    from_mapping,
    load,
    save,
    stepped_scale,
)


def test_clamp_scale_bounds() -> None:
    assert clamp_scale(0.1) == MIN_SCALE
    assert clamp_scale(9.0) == MAX_SCALE
    assert clamp_scale(1.0) == 1.0


def test_stepped_scale_up_and_down() -> None:
    assert stepped_scale(1.0, larger=True) == 1.1
    assert stepped_scale(1.0, larger=False) == 0.9
    assert stepped_scale(MAX_SCALE, larger=True) == MAX_SCALE
    assert stepped_scale(MIN_SCALE, larger=False) == MIN_SCALE


def test_sizes_scale_with_multiplier() -> None:
    settings = A11ySettings(text_scale=2.0)
    assert settings.code_size() == 22
    assert settings.text_size() == 20


def test_toml_roundtrip(tmp_path: Path) -> None:
    settings = A11ySettings(text_scale=1.3, high_contrast=True)
    path = tmp_path / "a11y.toml"
    save(path, settings)
    loaded = load(path)
    assert loaded.high_contrast is True
    assert loaded.text_scale == 1.3


def test_load_missing_returns_default(tmp_path: Path) -> None:
    assert load(tmp_path / "nope.toml") == A11ySettings()


def test_load_invalid_toml_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "bad.toml"
    path.write_text("not = = valid", encoding="utf-8")
    assert load(path) == A11ySettings()


def test_from_mapping_tolerates_bad_values() -> None:
    settings = from_mapping({"text_scale": "abc", "high_contrast": 1})
    assert settings.text_scale == 1.0
    assert settings.high_contrast is True
