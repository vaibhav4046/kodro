"""``python -m robolearn.web`` entry point."""

from __future__ import annotations

import argparse

from .app import launch


def main() -> None:
    """Parse args and launch the pywebview window."""
    p = argparse.ArgumentParser(prog="robolearn.web")
    p.add_argument("--debug", action="store_true", help="Open the webview devtools")
    args = p.parse_args()
    launch(debug=args.debug)


if __name__ == "__main__":
    main()
