"""Console entry point: ``python -m robolearn`` and the ``robolearn`` script."""

from __future__ import annotations

import sys


def main(argv: list[str] | None = None) -> int:
    """Launch the RoboLearn desktop application.

    The UI shell is implemented in :mod:`robolearn.app` and lands in Task 11
    of the build plan. For now, this entry point simply prints a friendly
    placeholder so that the packaging path can be exercised end-to-end.
    """
    _ = argv if argv is not None else sys.argv[1:]
    sys.stdout.write("RoboLearn scaffold — full UI lands in Task 11.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
