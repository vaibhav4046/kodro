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
| `docs/eval/ui_eval.json` | `node scripts/qa_ui.mjs` full suite | regenerated 2026-08-14T18:20:31Z, 66/66, 100, PASS |
| `docs/dissertation/Kodro_Dissertation.pdf` | not rebuilt since the `.tex` was edited | **STALE** - must be recompiled before any claim about it |

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
get a per-hunk decision. PR 3's two real dissertation improvements to carry
across are the `\hypersetup{pageanchor=false}` fix and the removal of the
remaining `v2.0-submission` references.

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

## 9. Actions that still require the student's explicit confirmation

Not taken, not to be taken without a fresh instruction naming the exact action
and target: merging PR 3, tagging a release, publishing a release, pushing to
`main`, submitting to Canvas, uploading the dissertation, contacting a
supervisor, deleting any branch, worktree or stash.
