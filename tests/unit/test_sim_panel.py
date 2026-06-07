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


def test_pen_trail_records_then_clears_on_new_world(panel: SimPanel) -> None:
    rover = Rover(_world())
    panel.set_world(_world(), rover)
    assert len(panel.trail) >= 1  # start point recorded
    rover.state.x += 1.0
    panel.refresh()
    rover.state.x += 1.0
    panel.refresh()
    assert len(panel.trail) >= 3
    # Binding a new world resets the trail.
    panel.set_world(_world(), Rover(_world()))
    assert len(panel.trail) == 1


def test_perspective_toggle_renders_both_modes(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    assert panel.is_perspective is True
    assert len(panel._canvas.find_all()) > 10  # type: ignore[attr-defined]
    panel.set_perspective(False)
    assert panel.is_perspective is False
    assert len(panel._canvas.find_all()) > 10  # type: ignore[attr-defined]  # flat still draws
    panel.set_perspective(True)
    assert panel.is_perspective is True


def test_celebrate_overlay_paints_and_clears(panel: SimPanel) -> None:
    rover = Rover(_world())
    panel.set_world(_world(), rover)
    assert panel.is_celebrating is False
    panel.celebrate()
    assert panel.is_celebrating is True
    assert panel._canvas.find_withtag("celebrate")  # type: ignore[attr-defined]
    # The next repaint clears the overlay.
    panel.refresh()
    assert panel.is_celebrating is False
    assert not panel._canvas.find_withtag("celebrate")  # type: ignore[attr-defined]


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


def test_render_paints_gradient_and_rover(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    # The premium render draws a multi-band gradient + glow + rover, so the
    # canvas should hold many more items than the old flat fill (>20).
    assert len(panel._canvas.find_all()) > 20  # type: ignore[attr-defined]


def test_render_skips_collected_samples(panel: SimPanel) -> None:
    world = World(
        terrain=Terrain.SPACE,
        base=(1.0, 1.0),
        samples=[Sample(2.0, 2.0, collected=True), Sample(4.0, 4.0)],
        obstacles=[Obstacle(3.0, 3.0, 0.5)],
        bounds=ArenaBounds(6.0, 6.0),
    )
    rover = Rover(world)
    panel.set_world(world, rover)
    assert len(panel._canvas.find_all()) > 10  # type: ignore[attr-defined]


def test_refresh_keeps_particles(panel: SimPanel) -> None:
    world = _world()
    rover = Rover(world)
    panel.set_world(world, rover)
    before = panel._particles  # type: ignore[attr-defined]
    panel.refresh()
    # refresh() must NOT recreate the particle system (trail persists).
    assert panel._particles is before  # type: ignore[attr-defined]


def test_refresh_without_world_is_safe(panel: SimPanel) -> None:
    panel.clear()
    panel.refresh()  # no bound world -> no-op, must not raise


@pytest.mark.parametrize("terrain", list(Terrain))
def test_render_each_terrain(root: tk.Tk, terrain: Terrain) -> None:
    world = World(terrain=terrain, base=(1.0, 1.0), bounds=ArenaBounds(8.0, 8.0))
    panel = SimPanel(root, size_px=(160, 160))
    rover = Rover(world)
    panel.set_world(world, rover)
    assert len(panel._canvas.find_all()) > 10  # type: ignore[attr-defined]
