"""Train the RoboLearn model on its own validated output (self-distillation).

True fine-tuning needs GPU hours; what a laptop CAN do is the prompt-space
equivalent: run a battery of RoboLearn tasks through the current model at
high temperature, validate every candidate in the REAL sandbox, score the
survivors (correct first, then loop-use, then brevity), and bake the winning
programs back into the model template as exemplars. The model literally
learns from its own best, verified work -- and ships as ``robolearn-fast``.

Usage::

    python scripts/train_ai.py            # regenerate exemplars + rebake
    python scripts/train_ai.py --dry      # show winners, don't rebake
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from robolearn.ai.ollama_client import OllamaClient, OllamaError
from robolearn.web.app import BridgeAPI, _strip_code_fences

#: Task battery: one exemplar slot per row -- (request, must-use verb hint).
BATTERY: list[tuple[str, str]] = [
    ("drive in a hexagon with 1 metre sides", "for"),
    ("explore on your own and avoid every obstacle", "read_distance"),
    ("build a camp: a beacon in the middle and a flag at each corner of a square", "place"),
]

#: Extra validation tasks (not baked, just measured) to confirm generality.
HOLDOUT: list[str] = [
    "draw a spiral with the pen",
    "beep more times each lap for three laps",
]

CANDIDATES_PER_TASK = 4


def score(code: str) -> tuple[int, int]:
    """Higher is better: (uses a loop, -length)."""
    has_loop = int("for " in code or "while " in code)
    return (has_loop, -len(code.splitlines()))


def main() -> int:
    parser = argparse.ArgumentParser(description="Self-distil robolearn-fast.")
    parser.add_argument("--dry", action="store_true", help="show winners, don't rebake")
    parser.add_argument("--base", default="gemma3:1b")
    args = parser.parse_args()

    from robolearn.lessons.schema import load_library
    from robolearn.memory.store import Store

    api = BridgeAPI(
        store=Store(Path(tempfile.mkdtemp()) / "train.db"), lessons=list(load_library())
    )
    client = OllamaClient()
    if not client.available():
        sys.stderr.write("Ollama is not running.\n")
        return 1
    model = api._pick_fast_model(client.models()) or api._pick_ai_model(client.models())
    print(f"distilling from {model}")

    winners: list[tuple[str, str]] = []
    for request, hint in BATTERY:
        best: str | None = None
        for i in range(CANDIDATES_PER_TASK):
            try:
                raw = client.generate(
                    f"Pupil: {request}\nYou:",
                    system=None if str(model).startswith("robolearn-fast") else api._AI_CHAT_SYSTEM,
                    model=model,
                    temperature=0.3 + 0.2 * i,  # widen the search per attempt
                    num_predict=420,
                    keep_alive="30m",
                )
            except OllamaError as exc:
                print(f"  gen failed: {exc}")
                continue
            text = raw.strip()
            if text.upper().startswith("CODE:"):
                text = text[5:]
            code = _strip_code_fences(text)
            if hint not in code:
                continue
            if api._validate_generated(code) is not None:
                continue
            if len(code.splitlines()) > 14:
                continue
            if best is None or score(code) > score(best):
                best = code
        status = "OK" if best else "NO VALID CANDIDATE (keeping hand exemplar)"
        print(f"  {request[:52]:54} -> {status}")
        if best:
            winners.append((request, best.strip()))

    if not winners:
        print("no winners; model unchanged")
        return 1

    rules = (
        "You are a friendly coding partner inside RoboLearn, an educational "
        "rover simulator for children. The pupil chats with you about what "
        "the rover should do.\n"
        "If the request gives NO distance, count or goal at all (like just "
        "'go forward'), you MUST reply with exactly one short clarifying "
        "question on one line, prefixed 'QUESTION: ' -- never guess. Ask at "
        "most one question per request; if the pupil has already answered "
        "one, write the code.\n"
        "Otherwise reply 'CODE:' on the first line, then the program. "
        "Use ONLY these functions: move_forward(metres), move_backward(metres), "
        "turn_left(degrees), turn_right(degrees), set_speed(percent), beep(times), "
        "log(text), say(text), led(colour), scan(), wait(seconds), read_distance(), "
        "obstacle_ahead(), collect_sample(), sample_detected(), at_base(), "
        "pen_down(), pen_up(), place(kind), clear_props(). place plants a prop "
        'where the rover stands: "flag", "beacon", "person", "tree", '
        '"rock", "crate", "photo" or "drone" - use it to BUILD scenes. '
        "Plain procedural Python: for/while/if, simple variables, def with no "
        "classes or imports. Define every variable before use. No f-strings, "
        "lists, dicts or input(). Write top-level statements; do NOT wrap the "
        "program in main(). One short # comment per step. "
        "No markdown fences, no prose around the code.\n"
        "Examples:\n"
        "Pupil: go forward\n"
        "You: QUESTION: How far should the rover drive, in metres?\n"
    )
    for request, code in winners:
        rules += f"Pupil: {request}\nYou: CODE:\n{code}\n"

    if args.dry:
        print("\n--- distilled system prompt ---\n" + rules[-1200:])
        return 0

    modelfile = (
        f"FROM {args.base}\n"
        f'SYSTEM """{rules}"""\n'
        "PARAMETER temperature 0.25\n"
        "PARAMETER num_ctx 2048\n"
        "PARAMETER num_predict 420\n"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".mf", delete=False, encoding="utf-8") as f:
        f.write(modelfile)
        path = f.name
    proc = subprocess.run(
        ["ollama", "create", "robolearn-fast", "-f", path],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr or proc.stdout)
        return proc.returncode
    print(f"rebaked robolearn-fast with {len(winners)} self-distilled exemplars")

    # Holdout check with the NEW model.
    ok = 0
    for request in HOLDOUT:
        try:
            raw = client.generate(
                f"Pupil: {request}\nYou:",
                model="robolearn-fast",
                temperature=0.25,
                num_predict=420,
                keep_alive="30m",
            ).strip()
        except OllamaError:
            continue
        if raw.upper().startswith("CODE:"):
            raw = raw[5:]
        ok += api._validate_generated(_strip_code_fences(raw)) is None
    print(f"holdout validity: {ok}/{len(HOLDOUT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
