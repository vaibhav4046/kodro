"""Pygame draw routines for the simulation viewport.

The renderer is intentionally procedural: each draw step is a free
function that takes a :class:`pygame.Surface`, the engine state, and a
:class:`ViewTransform`. No state is held by the module so the whole thing
is trivial to call from headless tests.

A small CLI is exposed for the manual visual check the spec asks for in
Section 16 task 5::

    python -m kodro.engine.renderer --terrain mars
"""

from __future__ import annotations

import argparse
import math
import os
from dataclasses import dataclass

import pygame

from .rover import Rover
from .sensors import COLOUR_BASE_INDICATOR, COLOUR_SAMPLE_INDICATOR, TERRAIN_COLOURS
from .terrain import Terrain
from .world import Obstacle, Sample, World

#: Default surface dimensions used by :func:`make_surface` and the CLI.
DEFAULT_SURFACE_SIZE_PX: tuple[int, int] = (600, 600)

#: Pygame-friendly RGB colour for the rover body sprite.
ROVER_BODY_COLOUR: tuple[int, int, int] = (220, 220, 220)

#: Pygame-friendly RGB colour for the rover heading indicator triangle tip.
ROVER_TIP_COLOUR: tuple[int, int, int] = (255, 60, 60)

#: Pygame-friendly RGB colour for static obstacle circles.
OBSTACLE_COLOUR: tuple[int, int, int] = (50, 50, 50)

#: Pygame-friendly RGB colour for the optional world-bounds outline.
GRID_COLOUR: tuple[int, int, int] = (90, 90, 90)

#: Pixel radius of an uncollected sample marker.
SAMPLE_RADIUS_PX: int = 6

#: Pixel radius of the base-station marker.
BASE_RADIUS_PX: int = 10

#: Half-length of the rover heading triangle in pixels.
ROVER_TRIANGLE_LEN_PX: int = 14


@dataclass(frozen=True, slots=True)
class ViewTransform:
    """Maps world coordinates (metres) to pygame pixel coordinates.

    World ``(0, 0)`` is the lower-left corner; positive ``y`` is north.
    Pygame ``(0, 0)`` is the top-left corner; positive ``y`` is south.
    """

    surface_width_px: int
    surface_height_px: int
    world_width_m: float
    world_height_m: float

    @property
    def scale_x(self) -> float:
        """Horizontal pixels per metre."""
        return self.surface_width_px / self.world_width_m

    @property
    def scale_y(self) -> float:
        """Vertical pixels per metre."""
        return self.surface_height_px / self.world_height_m

    def to_screen(self, x: float, y: float) -> tuple[int, int]:
        """Convert a world point to a pygame pixel coordinate."""
        sx = round(x * self.scale_x)
        sy = round(self.surface_height_px - y * self.scale_y)
        return (sx, sy)


# --- pygame setup ----------------------------------------------------------


def init_headless() -> None:
    """Initialise pygame so it works in CI without a display server."""
    os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
    if not pygame.get_init():
        pygame.init()


def make_surface(size_px: tuple[int, int] = DEFAULT_SURFACE_SIZE_PX) -> pygame.Surface:
    """Create a stand-alone :class:`pygame.Surface` of the given size."""
    init_headless()
    return pygame.Surface(size_px)


def transform_for(surface: pygame.Surface, world: World) -> ViewTransform:
    """Build a :class:`ViewTransform` matching ``surface`` to ``world.bounds``."""
    return ViewTransform(
        surface_width_px=surface.get_width(),
        surface_height_px=surface.get_height(),
        world_width_m=world.bounds.width,
        world_height_m=world.bounds.height,
    )


# --- draw helpers ----------------------------------------------------------


def draw_background(surface: pygame.Surface, world: World) -> None:
    """Fill ``surface`` with the per-terrain background colour."""
    surface.fill(TERRAIN_COLOURS[world.terrain])


def draw_grid(surface: pygame.Surface, view: ViewTransform, step_m: float = 1.0) -> None:
    """Draw a faint metre-spaced grid on ``surface``.

    Educational at-a-glance distance readout — useful for the manual visual
    check; tests don't rely on its pixel output.
    """
    width = surface.get_width()
    height = surface.get_height()
    x = 0.0
    while x <= view.world_width_m + 1e-9:
        sx = round(x * view.scale_x)
        pygame.draw.line(surface, GRID_COLOUR, (sx, 0), (sx, height), 1)
        x += step_m
    y = 0.0
    while y <= view.world_height_m + 1e-9:
        sy = round(height - y * view.scale_y)
        pygame.draw.line(surface, GRID_COLOUR, (0, sy), (width, sy), 1)
        y += step_m


def draw_obstacles(surface: pygame.Surface, world: World, view: ViewTransform) -> None:
    """Paint every static obstacle on ``surface``."""
    for obstacle in world.obstacles:
        _draw_obstacle(surface, obstacle, view)


def _draw_obstacle(surface: pygame.Surface, obstacle: Obstacle, view: ViewTransform) -> None:
    cx, cy = view.to_screen(obstacle.x, obstacle.y)
    radius_px = max(1, round(obstacle.radius * view.scale_x))
    pygame.draw.circle(surface, OBSTACLE_COLOUR, (cx, cy), radius_px)


def draw_samples(surface: pygame.Surface, world: World, view: ViewTransform) -> None:
    """Paint every uncollected sample on ``surface``."""
    for sample in world.samples:
        if sample.collected:
            continue
        _draw_sample(surface, sample, view)


def _draw_sample(surface: pygame.Surface, sample: Sample, view: ViewTransform) -> None:
    cx, cy = view.to_screen(sample.x, sample.y)
    pygame.draw.circle(surface, COLOUR_SAMPLE_INDICATOR, (cx, cy), SAMPLE_RADIUS_PX)


def draw_base(surface: pygame.Surface, world: World, view: ViewTransform) -> None:
    """Paint the base station marker on ``surface``."""
    bx, by = world.base
    cx, cy = view.to_screen(bx, by)
    pygame.draw.circle(surface, COLOUR_BASE_INDICATOR, (cx, cy), BASE_RADIUS_PX)


def draw_rover(surface: pygame.Surface, rover: Rover, view: ViewTransform) -> None:
    """Paint the rover as a body circle with a heading triangle on top."""
    cx, cy = view.to_screen(rover.state.x, rover.state.y)
    pygame.draw.circle(surface, ROVER_BODY_COLOUR, (cx, cy), ROVER_TRIANGLE_LEN_PX)
    rad = math.radians(rover.state.heading_deg)
    tip_x = cx + round(ROVER_TRIANGLE_LEN_PX * math.cos(rad))
    tip_y = cy - round(ROVER_TRIANGLE_LEN_PX * math.sin(rad))
    left_rad = rad + math.radians(140)
    right_rad = rad - math.radians(140)
    left = (
        cx + round(ROVER_TRIANGLE_LEN_PX * math.cos(left_rad)),
        cy - round(ROVER_TRIANGLE_LEN_PX * math.sin(left_rad)),
    )
    right = (
        cx + round(ROVER_TRIANGLE_LEN_PX * math.cos(right_rad)),
        cy - round(ROVER_TRIANGLE_LEN_PX * math.sin(right_rad)),
    )
    pygame.draw.polygon(surface, ROVER_TIP_COLOUR, [(tip_x, tip_y), left, right])


# --- composite -------------------------------------------------------------


def render(
    surface: pygame.Surface,
    world: World,
    rover: Rover,
    *,
    draw_grid_lines: bool = False,
) -> None:
    """Composite a full simulator frame onto ``surface``.

    Args:
        surface: Target Pygame surface (any size).
        world: World state to render.
        rover: Rover to render on top of the world.
        draw_grid_lines: If ``True``, overlay a metre grid (helpful for the
            manual visual check; tests leave this off).
    """
    view = transform_for(surface, world)
    draw_background(surface, world)
    if draw_grid_lines:
        draw_grid(surface, view)
    draw_obstacles(surface, world, view)
    draw_samples(surface, world, view)
    draw_base(surface, world, view)
    draw_rover(surface, rover, view)


# --- CLI -------------------------------------------------------------------


def _demo_world(terrain: Terrain) -> World:
    """Build a small demo world for the manual visual check CLI."""
    return World(
        terrain=terrain,
        base=(1.0, 1.0),
        samples=[Sample(3.0, 3.0), Sample(7.0, 4.0), Sample(5.0, 7.5)],
        obstacles=[Obstacle(6.0, 5.0, 0.5), Obstacle(2.5, 6.5, 0.35)],
    )


def main(argv: list[str] | None = None) -> int:
    """Open a window and render a demo world for ``--terrain``.

    Headless CI does not run this entry point; it exists for the
    "manual visual check" mentioned in Section 16 of the spec.
    """
    parser = argparse.ArgumentParser(description="Render a demo terrain.")
    parser.add_argument(
        "--terrain",
        default="mars",
        choices=[t.value for t in Terrain],
        help="terrain to render (default: mars)",
    )
    args = parser.parse_args(argv)
    world = _demo_world(Terrain(args.terrain))
    rover = Rover(world)
    rover.state.x, rover.state.y, rover.state.heading_deg = 5.0, 5.0, 30.0
    pygame.init()
    try:
        screen = pygame.display.set_mode(DEFAULT_SURFACE_SIZE_PX)
        pygame.display.set_caption(f"RoboLearn — {args.terrain}")
        clock = pygame.time.Clock()
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
            render(screen, world, rover, draw_grid_lines=True)
            pygame.display.flip()
            clock.tick(60)
    finally:
        pygame.quit()
    return 0


if __name__ == "__main__":  # pragma: no cover - manual CLI only
    raise SystemExit(main())
