"""PyInstaller wrapper used by ``release.yml`` and by developers locally.

Produces a single-file binary under ``dist/`` for the host platform.
The bundle includes the bundled lesson YAMLs, Pygame's bundled SDL2, and
(on Windows) Tcl/Tk so end-users do not need a system Python install
with a working Tk.

Usage::

    python scripts/build_exe.py            # uses the current OS
    python scripts/build_exe.py --debug    # console-attached build
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT: Path = Path(__file__).resolve().parent.parent
DIST_DIR: Path = REPO_ROOT / "dist"
BUILD_DIR: Path = REPO_ROOT / "build"
SPEC_DIR: Path = BUILD_DIR / "spec"


def main(argv: list[str] | None = None) -> int:
    """Build a single-file PyInstaller binary for the current platform."""
    parser = argparse.ArgumentParser(description="Build RoboLearn into a single-file binary.")
    parser.add_argument(
        "--debug", action="store_true", help="produce a console-attached build for diagnostics"
    )
    parser.add_argument(
        "--clean", action="store_true", help="remove dist/ and build/ before running PyInstaller"
    )
    args = parser.parse_args(argv)

    if args.clean:
        shutil.rmtree(DIST_DIR, ignore_errors=True)
        shutil.rmtree(BUILD_DIR, ignore_errors=True)

    pathsep = ";" if sys.platform.startswith("win") else ":"
    library_src = (REPO_ROOT / "src" / "robolearn" / "lessons" / "library").as_posix()
    add_data = f"{library_src}{pathsep}robolearn/lessons/library"

    tk_binary_name = "robolearn-tk" if sys.platform.startswith("win") else "robolearn"
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--name",
        tk_binary_name,
        "--specpath",
        SPEC_DIR.as_posix(),
        "--paths",
        (REPO_ROOT / "src").as_posix(),
        "--add-data",
        add_data,
        "--collect-submodules",
        "robolearn",
        "--collect-data",
        "robolearn",
        "--hidden-import",
        "robolearn.app",
    ]
    if not args.debug:
        cmd.append("--windowed")
    cmd.append((REPO_ROOT / "src" / "robolearn" / "__main__.py").as_posix())

    sys.stdout.write("Running: " + " ".join(cmd) + "\n")
    result = subprocess.run(cmd, check=False, cwd=REPO_ROOT)
    if result.returncode != 0:
        sys.stderr.write(f"PyInstaller failed with exit code {result.returncode}\n")
        return result.returncode

    binary_path = _resolve_binary_path()
    if binary_path is not None:
        sys.stdout.write(f"Built: {binary_path}\n")

    web_rc = _build_web_app()
    if web_rc != 0:
        return web_rc
    return 0


def _build_web_app() -> int:
    """On Windows, also build the pywebview desktop app (RoboLearn.exe).

    The web UI ships in a pywebview window; its spec pulls in pywebview +
    pythonnet, which are Windows-specific here, so it is built on Windows only.
    The Tk binary above remains the cross-platform fallback.
    """
    if not sys.platform.startswith("win"):
        return 0
    spec = REPO_ROOT / "robolearn-web.spec"
    if not spec.exists():
        return 0
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", spec.as_posix()]
    sys.stdout.write("Running (web app): " + " ".join(cmd) + "\n")
    result = subprocess.run(cmd, check=False, cwd=REPO_ROOT)
    if result.returncode != 0:
        sys.stderr.write(f"Web-app PyInstaller failed with exit code {result.returncode}\n")
        return result.returncode
    web_binary = DIST_DIR / "RoboLearn.exe"
    if web_binary.exists():
        sys.stdout.write(f"Built: {web_binary}\n")
    return 0


def _resolve_binary_path() -> Path | None:
    """Return the path to the binary PyInstaller produced (if any)."""
    candidates = (
        DIST_DIR / "robolearn-tk.exe",
        DIST_DIR / "robolearn.exe",
        DIST_DIR / "robolearn-tk",
        DIST_DIR / "robolearn",
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


if __name__ == "__main__":
    raise SystemExit(main())
