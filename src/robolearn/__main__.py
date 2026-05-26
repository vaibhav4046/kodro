"""Console entry point: ``python -m robolearn`` and the ``robolearn`` script."""

from __future__ import annotations

import sys


def main(argv: list[str] | None = None) -> int:
    """Launch the RoboLearn desktop application."""
    _ = argv if argv is not None else sys.argv[1:]
    from robolearn import app as _app

    return _app.main()


if __name__ == "__main__":
    raise SystemExit(main())
