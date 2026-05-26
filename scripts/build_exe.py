"""PyInstaller wrapper used by ``release.yml`` and by developers locally.

Produces a single-file binary under ``dist/`` for the host platform.
Full implementation lands in Task 21 of the build plan.
"""

from __future__ import annotations

import sys


def main() -> int:
    sys.stdout.write("scripts/build_exe.py is a stub — wired in Task 21.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
