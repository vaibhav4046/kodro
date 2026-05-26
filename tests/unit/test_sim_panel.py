"""SimPanel unit tests (Task 13 / canvas refactor)."""

from __future__ import annotations

import os
import tkinter as tk

import pytest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World
from robolearn.ui.sim_panel import (
    DEFAULT_SIM_SIZE_PX,
    SimCallbacks,
    SimPanel,
    _rgb_to_hex,
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
    return World(
        terrain=Terrain.MARS,
        base=(1.0, 1.0),
        samples=[Sample(2.0, 2.0)],
        obstacles=[Obstacle(3.0, 3.0, 0.3)],
        bounds=ArenaBounds(6.0, 6.0),
    )


def test_panel_has_a_pygame_surface(panel: SimPanel) -> None:
    assert panel.surface is not None
    assert panel.surface.get_size() == (120, 120)


def test_default_size_constant_is_positive_pair() -> None:
    assert DEFAULT_SIM_SIZE_PX[0] > 0
    assert DEFAULT_SIM_SIZE_PX[1] > 0


def test_set_world_paints_canvas_items(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    # Base + rover body + heading triangle + obstacle + sample + label text
    # all live as canvas items.
    item_count = len(panel._canvas.find_all())  # type: ignore[attr-defined]
    assert item_count >= 5


def test_render_once_invokes_on_frame_callback(root: tk.Tk) -> None:
    fired: list[int] = []
    cb = SimCallbacks(on_frame=lambda: fired.append(1))
    panel = SimPanel(root, size_px=(60, 60), callbacks=cb)
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    assert fired and fired[-1] == 1


def test_clear_paints_blank_canvas(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    panel.clear()
    # After clear: only the "pick a lesson" placeholder text remains.
    items = panel._canvas.find_all()  # type: ignore[attr-defined]
    assert len(items) == 1


def test_render_once_is_idempotent_without_bound_world(panel: SimPanel) -> None:
    panel.clear()
    panel.render_once()  # must be a no-op, not a crash


def test_rgb_to_hex_formats_correctly() -> None:
    assert _rgb_to_hex((0, 0, 0)) == "#000000"
    assert _rgb_to_hex((255, 255, 255)) == "#ffffff"
    assert _rgb_to_hex((255, 215, 0)) == "#ffd700"


def test_canvas_background_matches_terrain_after_render(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    bg = panel._canvas.cget("background")  # type: ignore[attr-defined]
    # Mars terrain colour from sensors: (193, 68, 14) -> #c1440e
    assert bg.lower() == "#c1440e"
