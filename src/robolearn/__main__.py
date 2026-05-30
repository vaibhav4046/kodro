"""Console entry point: ``python -m robolearn`` and the ``robolearn`` script."""

from __future__ import annotations

import sys


def main(argv: list[str] | None = None) -> int:
    """Launch the RoboLearn desktop application.

    Every startup error is written to ``~/.robolearn/startup.log`` so
    the windowed PyInstaller binary still leaves a trail when something
    goes wrong on a user's machine.
    """
    _ = argv if argv is not None else sys.argv[1:]
    import datetime
    import logging
    import traceback
    from pathlib import Path

    log_dir = Path.home() / ".robolearn"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "startup.log"
    # Attach a fresh FileHandler each call rather than relying on
    # logging.basicConfig (which is idempotent and would pin the log path
    # to whatever home was on the very first call -- wrong if the process
    # is reused, as in the test suite).
    logger = logging.getLogger("robolearn.startup")
    logger.setLevel(logging.INFO)
    handler = logging.FileHandler(str(log_path), mode="a", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logger.addHandler(handler)
    logger.info("---- startup at %s ----", datetime.datetime.now().isoformat())
    try:
        from robolearn import app as _app

        logger.info("robolearn package imported OK")
        return _app.main()
    except BaseException as exc:
        logger.exception("fatal startup error")
        try:
            import tkinter as tk
            from tkinter import messagebox

            root = tk.Tk()
            root.withdraw()
            messagebox.showerror(
                "RoboLearn",
                (f"RoboLearn failed to start.\n\n{type(exc).__name__}: {exc}\n\nSee {log_path}"),
            )
            root.destroy()
        except Exception:
            sys.stderr.write(f"RoboLearn failed: {exc}\n")
            sys.stderr.write(traceback.format_exc())
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
