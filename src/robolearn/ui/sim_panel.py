"""Simulation viewport: pygame surface rendered into a Tk widget.

The cross-platform path uses ``pygame.image.tobytes`` to convert each
frame to PPM bytes, then loads those bytes into a ``tk.PhotoImage`` via
its ``data`` argument. This keeps the simulator in-process, dodges the
brittle ``SDL_WINDOWID`` embedding trick, and works headlessly with
``SDL_VIDEODRIVER=dummy`` for tests.

Implemented in Task 13 of the build plan.
"""

from __future__ import annotations

import base64
import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from tkinter import ttk

import pygame

from robolearn.engine import renderer
from robolearn.engine.rover import Rover
from robolearn.engine.world import World

#: Default pixel dimensions for the embedded simulation surface.
DEFAULT_SIM_SIZE_PX: tuple[int, int] = (480, 480)


@dataclass(slots=True)
class SimCallbacks:
    """Optional callbacks fired by the sim panel."""

    on_frame: Callable[[], None] | None = None


class SimPanel(ttk.Frame):
    """A Tk widget that displays the pygame simulation surface."""

    def __init__(
        self,
        parent: tk.Misc,
        *,
        size_px: tuple[int, int] = DEFAULT_SIM_SIZE_PX,
        callbacks: SimCallbacks | None = None,
    ) -> None:
        """Build the sim panel."""
        super().__init__(parent)
        self._size_px = size_px
        self._callbacks = callbacks or SimCallbacks()
        renderer.init_headless()
        self._surface: pygame.Surface = renderer.make_surface(size_px)
        self._photo: tk.PhotoImage | None = None
        self._label = tk.Label(self, width=size_px[0], height=size_px[1])
        self._label.pack(fill=tk.BOTH, expand=True)
        self._world: World | None = None
        self._rover: Rover | None = None
        self._draw_blank()

    # --- public API ---------------------------------------------------------

    @property
    def surface(self) -> pygame.Surface:
        """Return the underlying pygame :class:`Surface`."""
        return self._surface

    def set_world(self, world: World, rover: Rover) -> None:
        """Bind a world + rover and render one frame."""
        self._world = world
        self._rover = rover
        self.render_once()

    def render_once(self) -> None:
        """Composite a frame of the bound world + rover, then push to Tk."""
        if self._world is None or self._rover is None:
            return
        renderer.render(self._surface, self._world, self._rover)
        self._push_surface_to_label()
        if self._callbacks.on_frame is not None:
            self._callbacks.on_frame()

    def clear(self) -> None:
        """Detach the bound world/rover and paint a blank background."""
        self._world = None
        self._rover = None
        self._draw_blank()

    # --- private ------------------------------------------------------------

    def _draw_blank(self) -> None:
        self._surface.fill((20, 20, 30))
        self._push_surface_to_label()

    def _push_surface_to_label(self) -> None:
        """Convert ``self._surface`` to a Tk PhotoImage and display it."""
        photo = _surface_to_photo(self._surface, master=self)
        if photo is None:
            return
        # Hold a reference; Tk drops the image otherwise.
        self._photo = photo
        self._label.configure(image=photo)


def _surface_to_photo(surface: pygame.Surface, *, master: tk.Misc) -> tk.PhotoImage | None:
    """Convert a pygame surface into a :class:`tk.PhotoImage` via PPM bytes.

    Returns ``None`` when Tk on the current platform cannot load the PPM
    (extremely rare; tests skip on this branch).
    """
    width, height = surface.get_size()
    rgb_bytes = pygame.image.tobytes(surface, "RGB")
    ppm_header = f"P6\n{width} {height}\n255\n".encode("ascii")
    payload = base64.b64encode(ppm_header + rgb_bytes)
    try:
        return tk.PhotoImage(master=master, data=payload, format="PPM")
    except tk.TclError:  # pragma: no cover -- platform-specific Tk fallback
        return None
