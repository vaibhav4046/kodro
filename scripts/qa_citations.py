"""Citation gate: resolve every `path:line` reference in tracked Markdown.

Why this exists
---------------
The documentation set cites source and evidence by line number. Those citations
drift: a later commit inserts text above a cited line and every reference into
that file silently shifts. A range-only check does not catch this, because a
drifted citation still lands on a line that exists. On 15 August 2026 a
range-only pass reported "140 found, 138 in range, 0 out of range" while six
citations in a single block were wrong, one landing on a bare `}` and one on a
sentence about an unrelated commit hash.

So this gate reports two different things and does not conflate them:

  hard failures  a citation that cannot be resolved to a tracked file, or that
                 points past the end of the file it names. These are always
                 wrong and exit non-zero.

  review items   a citation that resolves but whose target line is a poor
                 anchor (blank, or nothing but a brace or bracket), or whose
                 path is ambiguous across tracked files. These are usually
                 wrong but not always: a document that deliberately quotes a
                 stale citation as a worked example is correct, and a file
                 carrying a dated "superseded, read as history" banner is
                 correct too. Those go in the allowlist with a reason.

The gate cannot prove a citation is right. A number can land on a plausible
line and still be wrong. It narrows where a human has to look.

Usage
-----
    python scripts/qa_citations.py            # repo root
    python scripts/qa_citations.py --list     # print every resolved citation

Exit 0 only when there are no hard failures and no unallowlisted review items.

Limits, so nobody reads a green run as more than it is
------------------------------------------------------
Only files known to `git ls-files` are scanned, and only they count as valid
citation targets. A brand new file is invisible until it is staged, and a
citation pointing at one reports as "no such tracked file". That is deliberate,
because it keeps build output and untracked scratch files out of the sweep, but
it means the gate is only meaningful on a staged tree. It caught this author out
once: a self-test cited two paths that were still untracked, so two of the three
failure classes never fired and the run looked conclusive anyway.

Waived citations are not checked at all. The count is printed on every run.

The first version of this gate read only full `path:line` forms and reported
PASS over 148 citations while 129 backticked `:N` continuations sat outside its
regex entirely. Fifteen of those were real citations into real files. A gate
written to catch citation drift had a blind spot of the same shape as the defect
it hunts, which is why the summary line now prints the unanchored count instead
of discarding it: a hole that is not counted out loud reads as green.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

CITE = re.compile(
    r"`?([A-Za-z0-9_.][A-Za-z0-9_./\-]*"
    r"\.(?:md|tex|py|mjs|cjs|js|jsx|json|yaml|yml|toml)):(\d+)"
)

# Documents cite several lines of one file as `path/to/f.md:17`, `:60`, `:309`.
# Only the first is a full citation; the rest inherit the path. CITE cannot see
# them, so an early version of this gate checked 148 citations while 129 bare
# continuations went unexamined and it still printed PASS. A continuation is
# only resolved when a full citation appears earlier on the same line, which is
# what makes the shorthand readable in the first place. A backticked `:8099`
# with no citation before it is a port number, not a line reference, and is
# counted as unanchored rather than guessed at.
CONT = re.compile(r"`:(\d+)`")

# Anchors that are almost never what a citation meant to point at.
STRUCTURAL = {"}", "{", ">", "<", "]", "[", ")", "(", "```", "---", "|", "});", "};"}

ALLOWLIST_NAME = "qa_citations_allow.txt"


def repo_root() -> str:
    return str(Path(__file__).resolve().parent.parent)


def load_allowlist(root: str) -> tuple[dict[str, str], dict[str, str]]:
    """Read the allowlist into (per_line, per_file).

    A key of "path/to/doc.md:120" waives one citation site. A key of
    "path/to/doc.md" with no trailing line number waives the whole document,
    which is only appropriate for a file that is wholesale historical and says
    so in its own text. Per-file waivers are a coverage hole by construction,
    so the gate prints them on every run rather than letting them go quiet.
    """
    path = Path(root) / "scripts" / ALLOWLIST_NAME
    per_line: dict[str, str] = {}
    per_file: dict[str, str] = {}
    if not path.exists():
        return per_line, per_file
    with path.open(encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            key, _, reason = line.partition("#")
            key = key.strip()
            reason = reason.strip() or "no reason recorded"
            _, sep, tail = key.rpartition(":")
            if sep and tail.isdigit():
                per_line[key] = reason
            else:
                per_file[key] = reason
    return per_line, per_file


class Repo:
    def __init__(self, root: str) -> None:
        self.root = root
        out = subprocess.run(
            ["git", "ls-files"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        self.tracked = {p.replace("\\", "/") for p in out.splitlines() if p}
        self._cache: dict[str, list[str] | None] = {}

    def lines(self, rel: str) -> list[str] | None:
        if rel not in self._cache:
            try:
                with (Path(self.root) / rel).open(encoding="utf-8", errors="replace") as fh:
                    self._cache[rel] = fh.read().splitlines()
            except OSError:
                self._cache[rel] = None
        return self._cache[rel]

    def resolve(self, citing: str, target: str) -> tuple[str | None, bool]:
        """Return (path, ambiguous). Tries repo-root, then citing-file-relative,
        then a unique suffix match so shorthand like `engine/foo.py` works."""
        if target in self.tracked:
            return target, False
        here = citing.rpartition("/")[0]
        if here:
            rel = os.path.normpath(f"{here}/{target}").replace("\\", "/")
            if rel in self.tracked:
                return rel, False
        hits = sorted(p for p in self.tracked if p.endswith("/" + target))
        if len(hits) == 1:
            return hits[0], False
        if len(hits) > 1:
            return hits[0], True
        return None, False


def line_citations(line: str) -> tuple[list[tuple[str, int]], int]:
    """Return (citations, unanchored) for one line.

    Continuations inherit the path of the nearest full citation starting before
    them on the same line. One with nothing before it is not a citation at all
    and is returned in the unanchored count so the gap is printed rather than
    dropped.
    """
    full = [(m.start(), m.group(1), int(m.group(2))) for m in CITE.finditer(line)]
    out = [(target, num) for _, target, num in full]
    unanchored = 0
    for match in CONT.finditer(line):
        prior = [f for f in full if f[0] < match.start()]
        if not prior:
            unanchored += 1
            continue
        out.append((prior[-1][1], int(match.group(1))))
    return out, unanchored


def bad_anchor(text: str) -> str | None:
    stripped = text.strip()
    if not stripped:
        return "blank line"
    if stripped in STRUCTURAL:
        return f"structural only ({stripped!r})"
    return None


def main() -> int:
    show_all = "--list" in sys.argv
    root = repo_root()
    repo = Repo(root)
    allowed, allowed_files = load_allowlist(root)

    hard: list[str] = []
    waived_hard: list[str] = []
    review: list[str] = []
    resolved = 0
    waived = 0
    unanchored = 0
    waived_per_file: dict[str, int] = {}
    docs = sorted(p for p in repo.tracked if p.endswith(".md"))

    for doc in docs:
        body = repo.lines(doc)
        if body is None:
            continue
        for lineno, line in enumerate(body, 1):
            cites, loose = line_citations(line)
            unanchored += loose
            for target, num in cites:
                key = f"{doc}:{lineno}"
                # A hard failure is normally unwaivable, because an unresolvable
                # citation is always wrong. The exception is a document quoting
                # this gate's own failure output, where the broken citation is
                # the evidence. Without this, the only way to get green would be
                # to edit a recorded result, which is the worse outcome. Waived
                # hard failures print on their own line so they never go quiet.
                excused = doc in allowed_files or key in allowed
                path, ambiguous = repo.resolve(doc, target)
                if path is None:
                    entry = f"{key} -> {target}:{num}  no such tracked file"
                    (waived_hard if excused else hard).append(entry)
                    if excused:
                        waived += 1
                    continue
                dest = repo.lines(path)
                if dest is None or not 1 <= num <= len(dest):
                    length = 0 if dest is None else len(dest)
                    entry = f"{key} -> {path}:{num}  past end of file (len={length})"
                    (waived_hard if excused else hard).append(entry)
                    if excused:
                        waived += 1
                    continue
                resolved += 1
                anchor = dest[num - 1]
                if show_all:
                    print(f"      {key} -> {path}:{num}  {anchor.strip()[:80]}")
                if doc in allowed_files:
                    waived += 1
                    waived_per_file[doc] = waived_per_file.get(doc, 0) + 1
                    continue
                if key in allowed:
                    waived += 1
                    continue
                if ambiguous:
                    review.append(
                        f"{key} -> {target}:{num}  ambiguous path, matches "
                        f"several tracked files; cite the full path"
                    )
                    continue
                why = bad_anchor(anchor)
                if why:
                    review.append(f"{key} -> {path}:{num}  {why}")

    total = resolved + len(hard) + len(waived_hard)
    for entry in hard:
        print(f"FAIL  {entry}")
    for entry in waived_hard:
        print(f"WAIVED-BROKEN {entry}  (allowlisted, see scripts/{ALLOWLIST_NAME})")
    for entry in review:
        print(f"REVIEW {entry}")
    for name, reason in sorted(allowed_files.items()):
        count = waived_per_file.get(name, 0)
        print(f"WAIVED {name}, {count} citations unchecked: {reason}")

    tail = (
        f"{total} found across {len(docs)} documents, {len(hard)} unresolvable, "
        f"{len(review)} needing review, {waived} waived "
        f"({len(allowed)} by line, {len(allowed_files)} by file), "
        f"{unanchored} backticked `:N` not a citation"
    )
    if hard or review:
        print(f"FAIL  citations: {tail}")
        print(
            "      A citation that resolves is not a citation that is correct. "
            "Read the line before trusting it."
        )
        return 1

    print(f"PASS  citations: {tail}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
