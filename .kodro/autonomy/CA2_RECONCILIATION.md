# CA2 reconciliation: what the real source of truth is

Written 2026-08-14 as Phase 0 of the CA2 release work, before any branch is cut
and before any commit. Everything below was read out of the live repository in
this session. Nothing here is recalled from an earlier note.

Working directory: `D:\project\robolearn`. One worktree, no linked worktrees.

## 1. Refs and commits

| Ref | Commit | Subject |
|---|---|---|
| `HEAD` -> `main` | `02dd047a392884a12ef40f2f4113f217ac5470b1` | feat: add click-to-insert step palette for KS1 lessons |
| `origin/main`, `origin/HEAD` | `02dd047` | same commit, 0 ahead / 0 behind |
| `origin/agent/kodro-2-1-completion` (PR 3 head) | `123c325` | Finalize Kodro 2.1 dissertation evidence |
| PR 3 parent | `0559257` | Prepare Kodro 2.1 verified product candidate |
| merge base | `f01767e` | feat: make companion edits and learning evidence reviewable |

`git rev-list --left-right --count origin/main...origin/agent/kodro-2-1-completion`
returns `1  2`. Main carries one commit PR 3 does not have (the KS1 step
palette). PR 3 carries two commits main does not have. They are siblings off
`f01767e`, not a fast-forward in either direction.

PR 3 diff against the merge base: 41 files, +1586 / -1264.

## 2. What exists only in the working tree

Nothing is staged. Nothing is committed. The entire current release effort lives
as uncommitted changes: **53 modified tracked files and 22 untracked paths**.

These untracked paths are the only copy of whole subsystems:

- `src/robolearn/mcp/` - the MCP server package
- `src/robolearn/assets/web/voice.js` - the voice layer (already wired into the
  bundle: it appears in the `ORDER` list in `scripts/build_web.cjs:24`)
- `src/robolearn/interop/kodro_project.py` - project interop
- `src/robolearn/runtime/session.py` - runtime session
- `scripts/qa_voice.mjs` - the voice gate
- `docs/developers/mcp-server.md`
- seven new unit test modules: `test_kodro_project.py`, `test_mcp_server.py`,
  `test_kodrobench_cli.py`, `test_prove_cli.py`, `test_urdf_io.py`,
  `test_web_bridge_export.py`, `test_web_startup.py`
- three evidence artefacts named in the dissertation Declaration:
  `docs/eval/test_suite.json`, `docs/eval/ui_eval.json`, `docs/eval/vibe_eval.json`
- `docs/eval/qa_gate_runs_2026-08-14.md`, `docs/dissertation/DIAGNOSTIC_2026-08-14.md`

If the worktree were reset, all of the above would be destroyed. It is not
recoverable from any ref. This is the single largest risk in the whole release
and is the reason the candidate branch is cut from the working tree rather than
from PR 3.

Build detritus that should be ignored rather than committed:
`.pytest-full.log`, `.pytest-tmp-final/`, `docs/dissertation/pass1.txt`,
`docs/dissertation/pass2.txt`.

## 3. The dissertation divergence

The local `.tex`, `main`'s `.tex` and PR 3's `.tex` are three different
documents. Line counts: **local 1066, main 876, PR 3 906**.

Marker probe:

| Marker | local | main | PR 3 |
|---|---|---|---|
| `\hypersetup{pageanchor=false}` | 0 | 0 | 1 |
| "Approximate word count" | 0 | 0 | 1 |
| `v2.0-submission` | 2 | 4 | 0 |

Local and PR 3 are parallel forks of main's document. Neither is a superset of
the other. Local is the larger and more recent revision but is missing PR 3's
`pageanchor` fix and its word-count statement, and it has only partly removed
the `v2.0-submission` references that PR 3 removed completely.

**Merging PR 3 would clobber or conflict with the larger local document.** The
integration has to happen at the source level, claim by claim.

## 4. PR 3 conflict surface

Of PR 3's 41 files, 14 are also dirty locally and 27 are not.

Cleanly portable (no local edit, can be taken from PR 3 without a content
decision): `.kodro/autonomy/{ACCEPTANCE_MATRIX,DISSERTATION_TRACEABILITY,EVIDENCE.json,HANDOFF,STATE}`,
`CHANGELOG.md`, `HUMAN_TODO.md`, `docs/ACCEPTANCE.md`, `docs/GPT_HANDOFF.md`,
`docs/HANDOFF_GPT56_COMPLETE.md`, `docs/PRODUCT_DIRECTION_2026.md`,
`docs/dissertation/{INTEGRITY_AUDIT,REFERENCE_AUDIT,REVISION_TRACKING,VERIFICATION_REVIEW}_2026-08-13.md`,
`docs/index.md`, the four `docs/teachers/*.md`, `scripts/qa_honesty.mjs`,
`src/robolearn/assets/web/{lesson-studio.js,onboarding.jsx,sw.js}`,
`tests/unit/{test_docs_match_reality,test_sensors,test_web_interpreter}.py`.

Needs a per-hunk decision (dirty locally and touched by PR 3):
`.github/workflows/ci.yml`, `README.md`, `docs/HANDOFF_KEITH.md`,
`docs/dissertation/Kodro_Dissertation.{tex,pdf,aux,log,toc}`,
`docs/dissertation/README.md`, `pyproject.toml`,
`src/robolearn/assets/web/{app.jsx,bundle.js,home.jsx,lesson-studio.jsx}`.

Note `src/robolearn/assets/web/lesson-studio.js` is a hand-written source file
in the bundle `ORDER` list, not a generated twin of `lesson-studio.jsx`. Both
exist and both are real sources.

## 5. Generated-artefact state

Checked this session, not assumed:

| Artefact | Gate | Result |
|---|---|---|
| `src/robolearn/assets/web/bundle.js` | `node scripts/build_web.cjs --check` | `bundle.js is up to date.` exit 0 |
| `src/robolearn/assets/web/lessons.json` | re-ran `scripts/export_lessons.py`, compared SHA-256 | byte-identical (`f1167f28...`), matches its 24 authoritative YAML lessons |
| `docs/eval/ui_eval.json` | `node scripts/qa_ui.mjs` full suite | re-run 2026-08-15T12:32:17Z against the current bundle, 66/66, 100, PASS; `artifactHashes.bundleSha256` equals the live `bundle.js` (`2bbeac69...`). The earlier 2026-08-14T18:20:31Z run reported the same totals against the bundle at `706f93d` |
| `docs/dissertation/Kodro_Dissertation.pdf` | recompiled 2026-08-15, two clean passes, then synced from `_build` | byte-identical to `_build/Kodro_Dissertation.pdf`: 59 pages, 1,115,505 bytes, sha256 `294103b92657dcd2...` |

**The PDF row is superseded, 2026-08-15 later the same day.** It was correct when
written. Verifying the bibliography against live sources afterwards turned up a
wrong title on `reza2025`, and fixing it at `Kodro_Dissertation.tex:1004` changed
the document. Recompiled and re-measured:

```
Kodro_Dissertation.pdf         pages= 59 bytes=1115217 sha256=217e7a978d60f573ded832d8a57fcaa255b79d0697f4b4df845e7aecea4553da
_build/Kodro_Dissertation.pdf  pages= 59 bytes=1115217 sha256=217e7a978d60f573ded832d8a57fcaa255b79d0697f4b4df845e7aecea4553da
```

Still 59 pages, still byte-identical across the two locations, still two passes
at exit 0 with zero overfull boxes and zero undefined citations or references.
The row above is left as written rather than retro-edited, for the same reason
the list below exists. See `.kodro/ca2-evidence/2026-08-15-bibliography-verification.md`
and `.kodro/ca2-evidence/2026-08-15-secret-gate-utf16-blind-spot.md`.

Stale documents that must not be silently retro-edited, because they record what
was measured at a past state:

- `docs/dissertation/DIAGNOSTIC_2026-08-14.md` audits an 879-line `.tex`. The
  file is now 1066 lines. Dated today but already superseded.
- `docs/ACCEPTANCE.md` is a 2026-07-09 snapshot against `v2.0.2`.
- `docs/dissertation/INTEGRITY_AUDIT_2026-07-17.md` records a 39-behaviour matrix.

Pinned deliberately and not re-run: `docs/eval/vibe_eval.json` and
`persona_eval_results.json`. Ollama is installed but not serving. Re-running
`qa_personas` and `qa_vibe` without a model server exits 0 while producing no
data, which would overwrite artefacts the dissertation paraphrases with empty
ones. Those two gates are recorded as SKIPPED, not as passes.

## 6. UI matrix count change

The behaviour matrix moved from 40 to 41 asserts this session, because
`chat-lesson` was added to the suite and two pre-existing asserts were
de-vacuumed (`checkVibeBuild` and `checkVibeLesson` were matching strings that
`--dump-dom` serialises out of `cap.html`'s own inline driver script, so they
were true on every page). Totals moved 65 -> 66 and the header line moved
`46/46` -> `47/47`.

Five live count sites were updated to match the measured run: `README.md`,
`docs/HANDOFF_KEITH.md`, `Kodro_Dissertation.tex` (abstract and results),
`docs/eval/qa_gate_runs_2026-08-14.md`. Dated snapshot audits were left alone.

## 7. The CA2 candidate branch

**The candidate is cut from the current working tree, not from PR 3.**

Reasons, in order of weight:

1. The working tree is the only home of the MCP package, the voice layer,
   project interop, the runtime session, seven test modules and three
   Declaration-named evidence artefacts. PR 3 contains none of them.
2. The local dissertation is 160 lines longer than PR 3's and reflects today's
   verification. Taking PR 3's document would lose that.
3. Main already carries one commit PR 3 lacks. PR 3 is behind on product code.

PR 3's genuinely additive content is integrated afterwards at the source level:
the 27 cleanly portable files can be taken as-is, and the 14 overlapping files
get a per-hunk decision. PR 3's two candidate dissertation improvements were the
`\hypersetup{pageanchor=false}` fix and the removal of the remaining
`v2.0-submission` references. **Both were examined and both are closed without a
port. Section 10 records why, and records the one thing PR 3 has that the
candidate genuinely lacks.**

## 8. Preservation plan

Binding, in force for the rest of this release:

1. No `git reset --hard`, no `git checkout -- .`, no `git clean`, no
   `git stash drop`, no forced overwrite of the worktree. Ever, for any reason,
   including "to clean it up".
2. The candidate branch is created with `git checkout -b`, which moves the
   branch pointer and leaves every uncommitted change in place. No stashing.
3. The three stashes are preserved untouched. They are not part of this release
   and are not to be applied or dropped. Recorded here so they cannot be
   mistaken for junk:

   | Stash | Message | Contents |
   |---|---|---|
   | `stash@{0}` | On main: codex-inflight-4 | 6 files, +524/-21: `build_web.cjs`, `qa_ui.mjs`, `Editor.jsx`, `RobotLab.jsx`, `app.jsx`, `hooks.jsx` |
   | `stash@{1}` | On main: codex-inflight-3 | 5 files, +360/-73: `Editor.jsx`, `RobotLab.jsx`, `hooks.jsx`, `interpreter.js`, `panels.jsx` |
   | `stash@{2}` | On main: codex-inflight-2 | 5 files, +200/-28: `ai/critique.py`, `ai/retrieval.py`, `ai-web.jsx`, `bridge.js`, `test_web_bridge.py` |

   `stash@{0}` and `stash@{1}` both touch `app.jsx`, `hooks.jsx` and
   `RobotLab.jsx`, all three of which are heavily modified in the working tree.
   Applying either would conflict badly. Leave them.
4. `origin/agent/kodro-2-1-completion` is not deleted, not force-pushed and not
   merged. PR 3 stays open. Content moves off it by cherry-pick or by hand.
5. Build detritus is added to `.gitignore` rather than committed or deleted.

## 10. PR 3 integration: the decision, and what is left open

Settled 2026-08-14 at `b53f552`, after reading every file PR 3 adds that the
candidate does not have. PR 3 stays open and unmerged. Nothing below changes
that.

Scale first, because it explains the rest. `git diff --stat HEAD
origin/agent/kodro-2-1-completion` is 161 files, +14,671 / -27,876. PR 3 is a
long way behind the candidate on product code, which is section 7's finding and
has not changed. The question here is narrower: of the files PR 3 adds, which
are absent from the candidate, and is anything in them worth having.

Four files, all dissertation audits dated 2026-08-13:
`INTEGRITY_AUDIT` (65 lines), `REFERENCE_AUDIT` (37), `REVISION_TRACKING` (18),
`VERIFICATION_REVIEW` (32).

### 10.1 The four audit documents are not ported

They are read, not dismissed. Their figures are all older than the candidate's:
1,239 passed with 140 Tk skips against the candidate's 1,638 passed with 1 skip;
product commit `0559257`; a 50-page PDF against the candidate's 59.

The candidate already carries the same four document types as July snapshots,
each headed with an explicit stale banner that points forward to 14 August, plus
the newer `CA2_INTEGRITY_AUDIT_2026-08-14.md` and `DIAGNOSTIC_2026-08-14.md`.
Adding a third, intermediate generation of the same four documents would leave a
reader holding three dated audits of one dissertation with no way to tell which
one governs. That is the precise defect this release pass has spent its time
closing everywhere else, and importing it here to gain nothing would be
self-defeating.

### 10.2 The `v2.0-submission` carry-over is closed, not deferred

PR 3 removed every `v2.0-submission` reference from its `.tex`. The candidate
keeps two, and keeps them deliberately. `.tex:150` reads that the suite grew
after tagging and its headline count therefore belongs to the commit named
inside the artefact, `aa174cf`, rather than to `v2.0-submission`. That is a
better fix than deletion: it names the producer of the number instead of
removing the only thing that made the mismatch visible. The other tracked
references are descriptions of the tag inside audit documents and the `describe`
field of `docs/eval/test_suite.json`, where naming the tag is correct.

### 10.3 The `pageanchor` carry-over is closed as not applicable

PR 3 carries `\hypersetup{pageanchor=false}` at its `.tex:84` with
`pageanchor=true` restored at `:116`. The candidate has neither line and does not
need them: `grep -c "has been already used"
docs/dissertation/_build/Kodro_Dissertation.log` returns **0**. There is no
duplicate-destination warning on this branch to fix. PR 3's own
`REVISION_TRACKING_2026-08-13.md` row 9 confirms the change was made against a
warning that branch emitted. Porting a fix for a warning that does not occur
would add two untested `hypersetup` calls to a document that currently compiles
clean.

### 10.4 One real gap: PR 3 has a BCS traceability table, the candidate does not

This is the only thing found on PR 3 that the candidate genuinely lacks, and it
is not portable today.

Both documents have a `\section{BCS professional issues and project criteria}`.
The candidate's is prose only, at `.tex:899`, citing the BCS **Code of Conduct**
as `bcscode`. PR 3's is prose plus a nine-row table, `tab:bcsmap` at its
`.tex:729-750`, mapping BCS abilities 2.1.1 to 2.1.9 to specific project
evidence, cited to the BCS **course accreditation guidelines** PDF as `bcs2020`.
Two different BCS documents, not two versions of one.

The table is the stronger artefact for this criterion. It maps published
abilities to evidence rather than asserting alignment in prose. Its cross
references would land correctly here as well: it names Chapter 6 and Chapter 7,
and in the candidate Evaluation is chapter 6 and Discussion and Limitations is
chapter 7.

**CLOSED on 2026-08-15. The table is ported and both citations are real.**

The blocker written here was that "neither the accreditation PDF nor the Code of
Conduct page could be opened to confirm a title, a date or a URL", because
`WebFetch` and `WebSearch` fail with `There's an issue with the selected model
(auto/best-free)`. Those two tools do still fail. The inference drawn from that
was wrong: `curl` through the Bash tool has full network access and had simply
never been tried on these two URLs.

What the four pre-staged conditions returned:

1. `https://www.bcs.org/media/11ofljxo/course-accreditation-guidelines.pdf`
   returns HTTP 200, `application/pdf`, 798,814 bytes, 47 pages. Cover reads
   `Guidelines on course accreditation` / `Information for universities and
   colleges` / **January 2020**. Page 31 is `Section 2 / Core requirements for
   accreditation of honours programmes` and enumerates **2.1.1 through 2.1.9**
   with the ability wording PR 3's rows use. This independently reproduces PR
   3's `REFERENCE_AUDIT_2026-08-13.md` rather than trusting it.
2. Condition met, so the block was taken across, with the access date set to 15
   August 2026, the date it was actually fetched.
3. `bcscode` resolved separately, and **downgraded**. The Code of Conduct page
   returns HTTP 200 and carries all four principles the candidate names at
   `.tex:899` verbatim, but it states **no version and no date anywhere**: the
   only `version` strings in the raw HTML belong to the analytics SDK. So
   `(2022)` was an assertion the source does not make, and the entry now reads
   `BCS (no date)` with a real access date. The `[VERIFY VERSION, URL AND ACCESS
   DATE BEFORE SUBMISSION]` placeholder is gone, which closes audit LOW 13.
4. Not reached.

Two of the nine rows were **not** lifted verbatim, because each asserted
something this document does not support. Row 2.1.6's "study consent" became
"the planned study's consent requirements", since the candidate's ethics section
states no study has happened and one is only planned. Row 2.1.7's "removes
per-seat fees" became "needs no account or subscription", because `per-seat`
occurs **zero** times in this dissertation while "no account or subscription"
and "zero-cost" are its own words. The other seven lift unchanged, and the
claims embedded in them were each checked here first: Chapter 6 is Evaluation,
Chapter 7 is Discussion and Limitations, and the objectives really do run O1 to
O10 because the second `enumerate` at `.tex:242` carries `start=7`.

Full evidence, including the exact `curl` output and the build defect found
while compiling this change, is in
`.kodro/ca2-evidence/2026-08-15-bcs-citations-and-aux-shadowing.md`.

## 11. Actions that still require the student's explicit confirmation

Not taken, not to be taken without a fresh instruction naming the exact action
and target: merging PR 3, tagging a release, publishing a release, pushing to
`main`, submitting to Canvas, uploading the dissertation, contacting a
supervisor, deleting any branch, worktree or stash.
