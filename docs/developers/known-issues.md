# Known issues

Limitations and platform-specific quirks the autonomous-mode build has
hit but cannot fully reproduce headlessly. Each entry is something a
human is expected to verify visually before the final v1.0.0 tag.

## UI / Tk

- **`Tk.geometry()` on a withdrawn window returns `1x1+0+0`** on Windows
  with some Python builds. The :class:`MainWindow` tests assert the
  ``DEFAULT_GEOMETRY`` constant and the title rather than reading
  `wm_geometry()` back. Real-window geometry is only verifiable by
  launching ``python -m robolearn`` on a machine with a working display.
- **`event_generate` does not fire ``bind_all`` handlers on hidden
  windows** consistently across platforms. Where the build needs to
  exercise a keyboard binding (e.g. the Ctrl+Shift+T teacher dashboard
  shortcut) the test invokes the bound private handler directly. The
  real binding is still installed in production code; manual smoke-test
  needed before release.
- **Some Windows Python installs ship without a usable Tcl library**
  (the error reads ``invoked from within "uplevel #0 [list source
  -encoding utf-8 $file]"`` followed by ``This probably means that tk
  wasn't installed properly``). The UI tests catch :class:`tkinter.TclError`
  and :class:`RuntimeError` in their fixture and skip cleanly when this
  happens; the corresponding tests still run on Linux (xvfb) and macOS
  CI.

## Engine / runtime

- **Daemon-thread executor cannot hard-kill pupil code.** Section 9 of
  the spec asks for a hard 30-second timeout; the implementation honours
  it by `thread.join(timeout=...)` then returns, but the daemon thread
  keeps spinning until the process exits. The sandbox already blocks
  IO-heavy escapes; this is acceptable for an educational sandbox and is
  documented in the decision log.

## Packaging

- **PyInstaller binaries are only spot-checked on Ubuntu CI.** Per the
  autonomous-mode override the Windows and macOS binaries are built by
  ``release.yml`` on tag pushes and not verified locally.

## Demo GIF

- **The README demo GIF is a placeholder until the human records it.**
  See ``HUMAN_TODO.md`` for the exact ``ffmpeg`` / ``peek`` command.
