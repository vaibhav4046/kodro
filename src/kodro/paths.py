"""Where Kodro keeps per-user state, and the one-time move from the old name.

The package was renamed from ``robolearn`` to ``kodro``. The per-user directory
moved with it, and that directory is not scratch space: it holds the pupil
database, the custom lessons a teacher wrote, the accessibility settings and the
welcome sentinel. Pointing the new name at an empty directory would present an
existing install as a fresh one and leave a term's worth of pupil history
stranded under a name nothing reads any more.

So the first call renames the old directory into place. It is a rename, never a
copy or a delete, it runs only when the new directory does not already exist,
and a failure falls back to the old location rather than starting empty.
"""

from __future__ import annotations

from pathlib import Path

#: Pre-rename directory name, still on disk for anyone who ran an older build.
LEGACY_DIR_NAME = ".robolearn"

#: Current directory name.
DIR_NAME = ".kodro"


def app_dir() -> Path:
    """Return the per-user Kodro directory, migrating the pre-rename one once.

    Idempotent. Safe to call from module level, which is how the path constants
    around the package use it.
    """
    current = Path.home() / DIR_NAME
    if current.exists():
        return current

    legacy = Path.home() / LEGACY_DIR_NAME
    if not legacy.is_dir():
        return current

    try:
        legacy.rename(current)
    except OSError:
        # A locked database, a permission problem or a home directory spanning
        # devices leaves the old directory where it is. Keep reading from it:
        # stale-but-present beats correct-but-empty when the contents are a
        # pupil's saved work.
        return legacy
    return current
