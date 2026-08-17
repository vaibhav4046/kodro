# Human TODO

A few deliverables remain that the autonomous build cannot finish
without a human in the room.

## 1. Conduct the 5-8 teacher evaluation study

Recruit five to eight UK secondary-school Computing teachers; show
each one the simulator end-to-end (welcome wizard, three lessons of
their choice, the teacher dashboard, the new lesson editor, the
replay debugger). Capture:

- Time-to-first-success per lesson.
- Hint-engine usefulness (did the surfaced hint help?).
- Achievement-system reaction (motivating? distracting?).
- Free-form feedback.

**Do not write the responses into `docs/teachers/evaluation-raw.md` or
`docs/teachers/evaluation-summary.md`.** Those two files are already taken.
They hold the speculative teacher-persona walkthrough, which is an
analyst-written design review with no participants and no measurements, and
both say so on their first line. Writing study output into them would either
destroy that artefact or, worse, leave a reader unable to tell which parts came
from a person and which were imagined in advance. That is the exact confusion
the whole evidence discipline in this repository exists to prevent.

Use new files instead:

- `docs/teachers/study-raw.md` for the raw responses. Add it to `.gitignore`
  before writing anything into it if it will carry names, schools, or any other
  personal data.
- `docs/teachers/study-summary.md` for the redacted summary.

When the study exists, the two speculative files should gain a line at the top
pointing at it, since their stated purpose is to raise hypotheses that the
study then tests.

## 2. Cut the next release tag

The three version records disagree, and the disagreement is the author's to
settle. Measured on 14 August 2026:

| Record | Value |
| --- | --- |
| Latest semver tag | `v2.0.2`, commit `e1df641`, 9 July 2026, an ancestor of the candidate branch |
| Other v2 tags | `v2.0.0` `7dfdebf`, `v2.0.1` `3008566`, and `v2.0-submission` `ab8cdb1` on 27 July |
| `pyproject.toml` | `version = "2.0.0"` |
| CHANGELOG | `[Unreleased]`, then `[2.0.0]` dated 7 July 2026 |

So `v2.0.1` and `v2.0.2` were tagged without CHANGELOG entries and without a
version bump, and `v2.0-submission` is a marker tag rather than a semver
release. Nothing here is broken at runtime, because the package version is only
metadata, but a marker reading the repository would find a tag list that the
CHANGELOG does not explain.

Two honest options, both the author's call: bump `pyproject.toml` to `2.0.2`
and backfill two short CHANGELOG entries describing what those tags carried, or
leave the tags alone and add a line to the CHANGELOG saying that `2.0.1` and
`2.0.2` were untracked point tags. Do not delete or move a published tag.

For an actual future release, add a dated CHANGELOG entry, bump the
`pyproject.toml` version to match, then tag and push:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The `release.yml` workflow then builds the Windows, macOS and Linux
binaries via PyInstaller and attaches them to the release.

## 3. Deferred polish (P7 + P8)

The "polish-to-90" sweep deliberately stopped after **P1–P6** and
left two ambitious tasks for a follow-up sprint:

### P7 — Automated demo-GIF recorder (deferred)

`scripts/record_demo.py` is not yet written. Recording a GIF
automatically requires:

1. A working `xvfb-run` pipeline on Linux CI (already in place).
2. A pygame surface dump every 80 ms during a scripted lesson run.
3. `imageio` to compose the frames into a 25 s, ≤4 MB GIF.

For now the README still ships without an animated demo; replace the
placeholder with a manually-recorded clip (ScreenToGif on Windows,
peek on Linux) until P7 is built.

### P8 — Web companion (SHIPPED, this entry was stale)

This was written while the web port was still a proposal. It was built. There
are 92 tracked files under `src/robolearn/assets/web/`, a PyInstaller spec at
`robolearn-web.spec`, a build and freshness gate at `scripts/build_web.cjs`,
and `tests/unit/test_web_lesson_parity.py` holds the two runtimes to the same
grading behaviour.

The three questions it posed were answered by what got built, not by a meeting:

- **Teaser or peer?** Peer. `scripts/qa_grader.mjs` loads the shipped
  `interpreter.js`, `motion-model.js` and `lesson-grader.jsx` under Node and
  holds them to two things: the lesson table embedded in the JS grader must
  match a fresh extraction from every lesson YAML, and known-good and known-bad
  submissions must produce the exact pupil-facing reason strings `grader.py`
  produces. 55 checks, all passing.
  `tests/unit/test_web_lesson_parity.py` covers the neighbouring property, that
  every lesson's starter code runs without a name error in both runtimes and
  that every shipped lesson is reachable by voice.
- **Share the lesson YAMLs or fork them?** Share. `scripts/export_lessons.py`
  converts the authoritative YAML to JSON at build time, and re-running it
  reproduces the committed JSON byte for byte.
- **Does static hosting honour the no-cloud clause?** Unresolved, and
  deliberately so. Nothing is hosted. The web build runs from a local file or a
  local server, so the question has not had to be answered yet, and it should
  not be answered by quietly deploying something.

Nothing is required here. The entry is kept rather than deleted because the
questions and their answers are the record of why the web runtime looks the way
it does.

## 4. Real-app screenshots (DONE, with a reproducible offline capture path)

The interactive preview tool (`preview_screenshot`) hangs on this app and
was confirmed to hang even on a WebGL-free DOM-only page, so it is an
unusable harness limitation, not a product bug. The screenshots were
instead captured offline with headless Chrome, which works and is
reproducible:

```bash
node scripts/build_screenshot_harness.cjs   # writes harness.html + studio_harness.html
# onboarding landing + brand mark (no WebGL):
chrome --headless=new --window-size=1280,800 --virtual-time-budget=2500 \
  --screenshot=docs/img/onboarding_landing.png \
  file:///.../src/robolearn/assets/web/harness.html
# studio in the City world (WebGL via SwiftShader):
chrome --headless=new --window-size=1280,800 --use-angle=swiftshader \
  --enable-unsafe-swiftshader --virtual-time-budget=9000 \
  --screenshot=docs/img/studio.png \
  file:///.../src/robolearn/assets/web/studio_harness.html
```

`docs/img/onboarding_landing.png` and `docs/img/studio.png` are committed and
referenced from the README. The studio shot confirms the City world renders
with traffic, a crossing, the robot, the code editor and live telemetry, and
the brand mark reads cleanly. Remaining nice-to-haves for a human: a retina
(2x) re-shoot via `--force-device-scale-factor=2`, and stills of the robot
picker and Robot Lab if wanted for the portfolio.

## 5. The two bcs.org dissertation items (DONE, 15 August 2026)

Both are closed. The reason they were blocked turned out to be wrong: `WebFetch`
and `WebSearch` do still fail with `There's an issue with the selected model
(auto/best-free)`, but `curl` has full network access and had never been tried
on these two URLs. Evidence and exact commands:
`.kodro/ca2-evidence/2026-08-15-bcs-citations-and-aux-shadowing.md`.

1. **The `bcscode` placeholder is gone.** The Code of Conduct page returns 200,
   the four principles the dissertation names appear on it verbatim, and the URL
   and title are confirmed. But the page states **no version and no date
   anywhere**, so the entry now reads `BCS (no date)` with a real access date of
   15 August 2026 rather than the `(2022)` it used to assert. If you want a
   dated edition instead, you have to find one that BCS actually publishes.
2. **The BCS traceability table is in.** The accreditation PDF confirmed all
   four conditions: it is `Guidelines on course accreditation`, dated **January
   2020** (not 2022), and page 31 enumerates abilities 2.1.1 to 2.1.9 with the
   wording PR 3's rows use. Seven rows lift verbatim. Two were rewritten,
   because they claimed things this dissertation does not support: "study
   consent" became "the planned study's consent requirements" (no study has
   happened), and "removes per-seat fees" became "needs no account or
   subscription" (`per-seat` appears zero times in this document).

Your call, one open point: the canonical PDF is 59 sheets and
`_build/current/` holds an older 50-sheet snapshot. The table did not cause
that, the PDF was 59 before and after. It is audit HIGH 4 and it needs the real
Canvas brief, not another rebuild. See section 6.

## 6. Confirm the page limit against the current brief

Nothing in this repository is authoritative on it. Every statement of "50 pages"
traces back to a note the author wrote to a tool, not to a brief. The document
measures three different ways:

| Reading | Count |
| --- | --- |
| Body, Chapter 1 through References | 48 |
| All arabic-numbered pages, body plus appendices | exactly 50 |
| Every sheet in the submitted PDF | 59 |

If the brief counts sheets, nine pages of front matter are the exposure and this
is urgent. If it counts the body, there are two pages of margin. Only you can
settle which, and until you do, `docs/ca2/CLAIM_LEDGER.md` forbids stating the
limit as settled on camera.

## Note for anyone editing the dissertation next

`docs/dissertation/Kodro_Dissertation.aux` is tracked, and TeX reads it in
preference to the one under `-output-directory=_build`. A stale copy makes every
**newly added** `\label` or `\citep` key render as undefined forever while all
existing keys resolve normally, and running more passes cannot fix it. After any
structural edit, refresh the three source-dir files from the build:

```bash
cp _build/Kodro_Dissertation.aux _build/Kodro_Dissertation.out _build/Kodro_Dissertation.toc .
```

Do not delete them instead. They are tracked deliberately, see `.gitignore:91`.

## Optional: implement true PDF export for the teacher dashboard

The current dashboard offers CSV export only. To add PDF, the
`reportlab`-based curriculum-coverage generator
(`scripts/generate_curriculum_report.py`) is a good template — copy
its `SimpleDocTemplate` usage into a sibling `export_pdf` method on
`ui.teacher_dashboard.TeacherDashboard`.

## 7. Decide whether to rewrite published history

> Renumbered from 6 to 7 on 15 August 2026. This file carried two sections
> numbered 6, so "HUMAN_TODO section 6" was ambiguous. Section 6 is the page
> limit; this one is the history rewrite.
>
> Retitled on 17 August 2026. It used to read "for a leaked account name",
> which was accurate when there was one reason. There are now two, 7a and 7b,
> and they share a single decision because they share a single force-push.

**This one is yours because it is irreversible.** Everything that could be fixed
without your call has been.

### 7a. A leaked local account name

Six tracked files under `docs/dissertation/` were pdflatex console captures that
named the local Windows account on 20 paths apiece, in a public repository:

```
compile1.txt  compile2.txt  doi_compile1.txt
doi_compile2.txt  final_compile1.txt  final_compile2.txt
```

Already done, no decision needed:

- `scripts/qa_secrets.mjs` was reading every file as UTF-8. PowerShell
  redirection writes UTF-16LE, so the account name sat behind NUL bytes and all
  fourteen rules matched nothing. It now sniffs the encoding, with six new
  self-checks. This is why the gate had been printing `PASS` over the leak.
- `.gitignore` gained `docs/dissertation/*compile*.txt`. The existing
  `pass*.txt` and `**/*.log` rules did not cover this filename.
- The six were removed from the index with `git rm --cached`. They are still on
  disk. Nothing in the tree referenced them.
- The gate is green for a real reason now: 33 checks, 471 of 773 tracked files,
  and a sweep confirms zero UTF-16 text files left in the tree.

What is left, and only you can decide it: **the commits already pushed to the
public remote still contain these files.** Untracking stops republication, not
disclosure. Rewriting that history means a force-push that invalidates every
existing clone and the open PR.

The disclosed value is a Windows account name, not a credential. Nothing needs
rotating. Deciding it is not worth a history rewrite is a perfectly reasonable
outcome; the point is that it should be a decision rather than an oversight.

If you do want it gone, that is `git filter-repo --invert-paths` over those six
paths followed by a force-push, and it is a step to take deliberately when no
other work is in flight. Do not let an agent do it for you.

### 7b. 186 authorship trailers in the public history

Found 17 August 2026 while removing the branch PR 2 sat on. The commit messages
already on the public remote carry 186 co-author trailers naming the assistant
vendor, which is the thing your standing rule forbids in a `vaibhav4046`
repository. The same rule is enforced going forward by your global `commit-msg`
hook, so this is history only.

Measured, not assumed. The count comes from the same pattern the hook uses:

```
git log origin/main --format='%B' \
  | grep -Eic 'co-authored-by:.*(claude|anthropic)'
186
```

They resolve to four distinct model strings, the largest accounting for 104 of
the 186. The rendered trailers are deliberately not reproduced here, because
pasting them would put back into the tree the exact text this section exists to
remove.

Four facts that bound how urgent this is:

- All 186 are dated between 1 June and 15 June 2026. None is later.
- The count is 186 on every remote branch, including `main`. It is shared
  history, so no branch introduced it and no branch can be blamed for it.
- `git log origin/main..origin/agent/kodro-ca2-candidate --grep=... | wc -l`
  returns **0**. The CA2 candidate's own 52 commits are clean.
- `core.hooksPath` points at your global hooks directory and both `commit-msg`
  and `pre-commit` are present there, which is why nothing has been added since.
  The guard is working; it was installed after these commits existed. The path
  is not written here on purpose, because it names the local account and
  `scripts/qa_secrets.mjs` correctly fails on that. It caught this very line on
  the first run of this edit.

No author or committer field is affected. `git log --format='%an <%ae>%n%cn <%ce>'`
piped through a case-insensitive match for `claude` or `anthropic` returns 0 on
every branch. This is message text only.

Same decision as 7a, and deliberately not a separate one, because the repair is
one operation. Removing the trailers is `git filter-repo` with a message
callback stripping the matching lines, over all refs, then the same force-push
that 7a needs. Doing 7a and 7b in one pass costs one force-push instead of two.

Nothing here is a credential and nothing needs rotating. The cost of leaving it
is that a public repository contradicts a rule you set. The cost of fixing it is
that every existing clone and PR 3 are invalidated. Decide it; do not let it
sit as an oversight, and do not let an agent do it for you.
