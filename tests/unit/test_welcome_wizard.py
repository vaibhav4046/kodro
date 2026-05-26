"""Welcome-wizard tests (Task 18)."""

from __future__ import annotations

import tkinter as tk

import pytest

from robolearn.engine.terrain import Terrain
from robolearn.ui.welcome_wizard import (
    AGE_BANDS,
    KEY_STAGES,
    WelcomeWizard,
    WizardResult,
)


@pytest.fixture
def root():  # type: ignore[no-untyped-def]
    try:
        r = tk.Tk()
        r.withdraw()
    except (tk.TclError, RuntimeError) as exc:  # pragma: no cover
        pytest.skip(f"Tk unavailable: {exc}")
    try:
        yield r
    finally:
        r.destroy()


def test_wizard_constants_match_spec() -> None:
    assert AGE_BANDS == ("11-12", "13-14", "15-16", "17-18")
    assert set(KEY_STAGES) == {"KS3", "KS4"}


def test_wizard_starts_at_step_zero(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    try:
        assert wiz.step == 0
    finally:
        wiz.destroy()


def test_next_step_advances(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    try:
        wiz.next_step()
        assert wiz.step == 1
        wiz.next_step()
        assert wiz.step == 2
        wiz.next_step()
        assert wiz.step == 3
    finally:
        wiz.destroy()


def test_back_step_returns_to_previous(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    try:
        wiz.next_step()
        wiz.next_step()
        wiz.back_step()
        assert wiz.step == 1
    finally:
        wiz.destroy()


def test_back_step_on_first_is_no_op(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    try:
        wiz.back_step()
        assert wiz.step == 0
    finally:
        wiz.destroy()


def test_next_step_on_last_finishes(root: tk.Tk) -> None:
    captured: list[WizardResult] = []
    wiz = WelcomeWizard(root, on_complete=captured.append)
    wiz.set_display_name("Alice")
    wiz.set_age_band("13-14")
    wiz.set_key_stage("KS3")
    wiz.set_terrain("mars")
    for _ in range(4):
        wiz.next_step()
    assert captured and captured[0].display_name == "Alice"
    assert captured[0].age_band == "13-14"
    assert captured[0].key_stage == "KS3"
    assert captured[0].terrain is Terrain.MARS


def test_default_display_name_when_blank(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    wiz.set_display_name("   ")  # whitespace
    for _ in range(4):
        wiz.next_step()
    assert wiz.result is not None
    assert wiz.result.display_name == "Pupil"


def test_cancel_clears_result(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    wiz.cancel()
    assert wiz.result is None


def test_set_terrain_accepts_enum_or_string(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    try:
        wiz.set_terrain(Terrain.UNDERWATER)
        wiz.set_terrain("space")
    finally:
        wiz.destroy()


def test_finish_records_terrain_from_string_var(root: tk.Tk) -> None:
    wiz = WelcomeWizard(root)
    wiz.set_terrain("underwater")
    for _ in range(4):
        wiz.next_step()
    assert wiz.result is not None
    assert wiz.result.terrain is Terrain.UNDERWATER
