"""Renderer tests (Task 5). Run headlessly via SDL_VIDEODRIVER=dummy."""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")

import pygame

from robolearn.engine.renderer import (
    BASE_RADIUS_PX,
    OBSTACLE_COLOUR,
    ROVER_BODY_COLOUR,
    SAMPLE_RADIUS_PX,
    ViewTransform,
    _demo_world,
    draw_background,
    draw_base,
    draw_grid,
    draw_obstacles,
    draw_samples,
    init_headless,
    make_surface,
    render,
    transform_for,
)
from robolearn.engine.rover import Rover
from robolearn.engine.sensors import (
    COLOUR_BASE_INDICATOR,
    COLOUR_SAMPLE_INDICATOR,
    TERRAIN_COLOURS,
)
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, Obstacle, Sample, World


@pytest.fixture(autouse=True)
def _pygame_initialised() -> None:
    init_headless()


def test_make_surface_returns_pygame_surface_of_expected_size() -> None:
    surface = make_surface((320, 240))
    assert isinstance(surface, pygame.Surface)
    assert surface.get_size() == (320, 240)


def test_view_transform_maps_world_origin_to_bottom_left() -> None:
    vt = ViewTransform(600, 600, 10.0, 10.0)
    assert vt.to_screen(0.0, 0.0) == (0, 600)
    assert vt.to_screen(10.0, 10.0) == (600, 0)
    assert vt.to_screen(5.0, 5.0) == (300, 300)


@pytest.mark.parametrize("terrain", list(Terrain))
def test_draw_background_paints_terrain_colour(terrain: Terrain) -> None:
    world = World(terrain=terrain, base=(0.0, 0.0), bounds=ArenaBounds(10.0, 10.0))
    surface = make_surface((40, 40))
    draw_background(surface, world)
    centre = surface.get_at((20, 20))
    assert (centre.r, centre.g, centre.b) == TERRAIN_COLOURS[terrain]


def test_draw_base_paints_indicator_at_base_pixel() -> None:
    world = World(terrain=Terrain.MARS, base=(5.0, 5.0), bounds=ArenaBounds(10.0, 10.0))
    surface = make_surface((100, 100))
    surface.fill((0, 0, 0))
    view = transform_for(surface, world)
    draw_base(surface, world, view)
    cx, cy = view.to_screen(*world.base)
    pixel = surface.get_at((cx, cy))
    assert (pixel.r, pixel.g, pixel.b) == COLOUR_BASE_INDICATOR


def test_draw_samples_paints_at_each_uncollected_position() -> None:
    world = World(
        terrain=Terrain.MARS,
        base=(0.0, 0.0),
        samples=[Sample(2.0, 2.0), Sample(8.0, 8.0, collected=True)],
        bounds=ArenaBounds(10.0, 10.0),
    )
    surface = make_surface((100, 100))
    surface.fill((0, 0, 0))
    view = transform_for(surface, world)
    draw_samples(surface, world, view)
    sx, sy = view.to_screen(2.0, 2.0)
    cx, cy = view.to_screen(8.0, 8.0)
    pixel_uncollected = surface.get_at((sx, sy))
    pixel_collected = surface.get_at((cx, cy))
    assert (
        pixel_uncollected.r,
        pixel_uncollected.g,
        pixel_uncollected.b,
    ) == COLOUR_SAMPLE_INDICATOR
    assert (pixel_collected.r, pixel_collected.g, pixel_collected.b) == (0, 0, 0)


def test_draw_obstacles_paints_obstacle_pixel() -> None:
    world = World(
        terrain=Terrain.EARTH,
        base=(0.0, 0.0),
        obstacles=[Obstacle(5.0, 5.0, 0.4)],
        bounds=ArenaBounds(10.0, 10.0),
    )
    surface = make_surface((100, 100))
    surface.fill((255, 255, 255))
    view = transform_for(surface, world)
    draw_obstacles(surface, world, view)
    sx, sy = view.to_screen(5.0, 5.0)
    pixel = surface.get_at((sx, sy))
    assert (pixel.r, pixel.g, pixel.b) == OBSTACLE_COLOUR


def test_render_composites_full_frame_with_rover_body() -> None:
    world = _demo_world(Terrain.SPACE)
    rover = Rover(world)
    rover.state.x, rover.state.y, rover.state.heading_deg = 5.0, 5.0, 0.0
    surface = make_surface((300, 300))
    render(surface, world, rover)
    view = transform_for(surface, world)
    cx, cy = view.to_screen(5.0, 5.0)
    # Heading 0 (east) makes the heading triangle point east; a pixel 12 px
    # NORTH of the centre stays inside the body circle (radius 14 px) but
    # outside the heading triangle.
    body_pixel = surface.get_at((cx, cy - 12))
    assert (body_pixel.r, body_pixel.g, body_pixel.b) == ROVER_BODY_COLOUR


def test_render_is_deterministic() -> None:
    world = _demo_world(Terrain.MARS)
    rover = Rover(world)
    surface_a = make_surface((200, 200))
    surface_b = make_surface((200, 200))
    render(surface_a, world, rover)
    render(surface_b, world, rover)
    assert pygame.image.tobytes(surface_a, "RGB") == pygame.image.tobytes(surface_b, "RGB")


def test_draw_grid_does_not_raise() -> None:
    surface = make_surface((50, 50))
    view = ViewTransform(50, 50, 5.0, 5.0)
    draw_grid(surface, view)


@pytest.mark.parametrize("terrain", list(Terrain))
def test_render_each_terrain_produces_distinct_corner_pixel(terrain: Terrain) -> None:
    world = World(terrain=terrain, base=(0.5, 0.5), bounds=ArenaBounds(10.0, 10.0))
    rover = Rover(world)
    surface = make_surface((50, 50))
    render(surface, world, rover)
    # Top-right corner pixel should be unaffected by the rover / base — pure
    # background colour for that terrain.
    pixel = surface.get_at((49, 0))
    assert (pixel.r, pixel.g, pixel.b) == TERRAIN_COLOURS[terrain]


def test_base_marker_radius_is_at_least_sample_radius() -> None:
    # Sanity invariant: the base is at least as visually prominent as a sample.
    assert BASE_RADIUS_PX >= SAMPLE_RADIUS_PX
