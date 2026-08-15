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
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

CITE = re.compile(
    r"`?([A-Za-z0-9_.][A-Za-z0-9_./\-]*"
    r"\.(?:md|tex|py|mjs|cjs|js|jsx|json|yaml|yml|toml)):(\d+)"
)

# Anchors that are almost never what a citation meant to point at.
STRUCTURAL = {"}", "{", ">", "<", "]", "[", ")", "(", "```", "---", "|", "});", "};"}

ALLOWLIST_NAME = "qa_citations_allow.txt"


def repo_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(here)


def load_allowlist(root: str) -> tuple[dict[str, str], dict[str, str]]:
    """Read the allowlist into (per_line, per_file).

    A key of "path/to/doc.md:120" waives one citation site. A key of
    "path/to/doc.md" with no trailing line number waives the whole document,
    which is only appropriate for a file that is wholesale historical and says
    so in its own text. Per-file waivers are a coverage hole by construction,
    so the gate prints them on every run rather than letting them go quiet.
    """
    path = os.path.join(root, "scripts", ALLOWLIST_NAME)
    per_line: dict[str, str] = {}
    per_file: dict[str, str] = {}
    if not os.path.exists(path):
        return per_line, per_file
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            key, _, reason = line.partition("#")
            key = key.strip()
            reason = reason.strip() or "no reason recorded"
            head, sep, tail = key.rpartition(":")
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
                with open(
                    os.path.join(self.root, rel), "r", encoding="utf-8", errors="replace"
                ) as fh:
                    self._cache[rel] = fh.read().splitlines()
            except OSError:
                self._cache[rel] = None
        return self._cache[rel]

    def resolve(self, citing: str, target: str) -> tuple[str | None, bool]:
        """Return (path, ambiguous). Tries repo-root, then citing-file-relative,
        then a unique suffix match so shorthand like `engine/foo.py` works."""
        if target in self.tracked:
            return target, False
        here = os.path.dirname(citing)
        if here:
            rel = os.path.normpath(os.path.join(here, target)).replace("\\", "/")
            if rel in self.tracked:
                return rel, False
        hits = sorted(p for p in self.tracked if p.endswith("/" + target))
        if len(hits) == 1:
            return hits[0], False
        if len(hits) > 1:
            return hits[0], True
        return None, False


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
    review: list[str] = []
    resolved = 0
    waived = 0
    waived_per_file: dict[str, int] = {}
    docs = sorted(p for p in repo.tracked if p.endswith(".md"))

    for doc in docs:
        body = repo.lines(doc)
        if body is None:
            continue
        for lineno, line in enumerate(body, 1):
            for match in CITE.finditer(line):
                target, num = match.group(1), int(match.group(2))
                key = f"{doc}:{lineno}"
                path, ambiguous = repo.resolve(doc, target)
                if path is None:
                    hard.append(f"{key} -> {target}:{num}  no such tracked file")
                    continue
                dest = repo.lines(path)
                if dest is None or not 1 <= num <= len(dest):
                    length = 0 if dest is None else len(dest)
                    hard.append(f"{key} -> {path}:{num}  past end of file (len={length})")
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

    total = resolved + len(hard)
    for entry in hard:
        print(f"FAIL  {entry}")
    for entry in review:
        print(f"REVIEW {entry}")
    for name, reason in sorted(allowed_files.items()):
        count = waived_per_file.get(name, 0)
        print(f"WAIVED {name}, {count} citations unchecked: {reason}")

    tail = (
        f"{total} found across {len(docs)} documents, {len(hard)} unresolvable, "
        f"{len(review)} needing review, {waived} waived "
        f"({len(allowed)} by line, {len(allowed_files)} by file)"
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
