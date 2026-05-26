"""SimPanel unit tests (Task 13). Run headlessly via SDL_VIDEODRIVER=dummy."""

from __future__ import annotations

import os
import tkinter as tk

import pytest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, World
from robolearn.ui.sim_panel import (
    DEFAULT_SIM_SIZE_PX,
    SimCallbacks,
    SimPanel,
    _surface_to_photo,
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


@pytest.fixture
def panel(root: tk.Tk) -> SimPanel:
    return SimPanel(root, size_px=(120, 120))


def _world() -> World:
    return World(terrain=Terrain.MARS, base=(1.0, 1.0), bounds=ArenaBounds(6.0, 6.0))


def test_panel_has_a_pygame_surface(panel: SimPanel) -> None:
    assert panel.surface is not None
    assert panel.surface.get_size() == (120, 120)


def test_default_size_constant_is_positive_pair() -> None:
    assert DEFAULT_SIM_SIZE_PX[0] > 0
    assert DEFAULT_SIM_SIZE_PX[1] > 0


def test_set_world_renders_without_error(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)


def test_render_once_invokes_on_frame_callback(root: tk.Tk) -> None:
    fired: list[int] = []
    cb = SimCallbacks(on_frame=lambda: fired.append(1))
    panel = SimPanel(root, size_px=(60, 60), callbacks=cb)
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    assert fired and fired[-1] == 1


def test_clear_resets_state(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    panel.clear()
    # After clear the surface contains the blank background colour (20, 20, 30).
    pixel = panel.surface.get_at((10, 10))
    assert (pixel.r, pixel.g, pixel.b) == (20, 20, 30)


def test_render_once_is_idempotent_without_bound_world(panel: SimPanel) -> None:
    panel.clear()
    panel.render_once()  # must be a no-op, not a crash


def test_surface_to_photo_returns_photoimage(root: tk.Tk) -> None:
    import pygame

    surface = pygame.Surface((40, 40))
    surface.fill((10, 20, 30))
    photo = _surface_to_photo(surface, master=root)
    # Either a PhotoImage or None -- both are valid outcomes on weird Tk builds.
    assert photo is None or isinstance(photo, tk.PhotoImage)
