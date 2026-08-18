"""Create the ``kodro-fast`` Ollama model (baked prompt, tuned params).

"Editing the model" the legitimate way: an Ollama Modelfile FROM a small base
(gemma3:1b) with RoboLearn's full system prompt + few-shot examples BAKED into
the template, a trimmed context window and tuned sampling defaults. Per-request
prompts are then just the short conversation transcript, so prompt evaluation
-- the dominant first-token cost on laptop hardware -- nearly disappears.

Usage::

    python scripts/make_ai_model.py            # creates/updates kodro-fast
    python scripts/make_ai_model.py --base gemma3:4b --name kodro-quality
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from kodro.web.app import BridgeAPI


def main() -> int:
    parser = argparse.ArgumentParser(description="Bake the RoboLearn prompt into an Ollama model.")
    parser.add_argument("--base", default="gemma3:1b", help="base model (default gemma3:1b)")
    parser.add_argument("--name", default="kodro-fast", help="created model name")
    args = parser.parse_args()

    system = BridgeAPI._AI_CHAT_SYSTEM  # single source of truth for the prompt
    modelfile = (
        f"FROM {args.base}\n"
        f'SYSTEM """{system}"""\n'
        "PARAMETER temperature 0.4\n"
        "PARAMETER num_ctx 2048\n"
        "PARAMETER num_predict 420\n"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".modelfile", delete=False, encoding="utf-8") as f:
        f.write(modelfile)
        path = f.name
    proc = subprocess.run(
        ["ollama", "create", args.name, "-f", path], capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr or proc.stdout)
        return proc.returncode
    sys.stdout.write(f"created {args.name} (FROM {args.base}, prompt baked, ctx 2048)\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
