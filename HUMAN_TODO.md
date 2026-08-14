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

## 5. One trip to bcs.org closes two dissertation items

Both need a browser and neither can be done from here: `WebFetch` and
`WebSearch` fail in the release session with `There's an issue with the selected
model (auto/best-free)`.

1. **The `bcscode` placeholder** at `Kodro_Dissertation.tex:952` renders as bold
   `[VERIFY VERSION, URL AND ACCESS DATE BEFORE SUBMISSION]` inside the
   References. Confirm the BCS Code of Conduct version, URL and access date and
   replace it. Do not invent a date.
2. **The BCS traceability table.** PR 3 carries a nine-row table mapping BCS
   abilities 2.1.1 to 2.1.9 to project evidence, cited to the BCS course
   accreditation guidelines. The candidate has prose only. The table is the
   stronger answer to that marking criterion and its Chapter 6 and Chapter 7
   cross-references already match this document's numbering, but it was not
   ported because its citation could not be verified. Conditions, the exact
   block to lift and the insertion point are in
   `.kodro/autonomy/CA2_RECONCILIATION.md` section 10.4.

If the accreditation PDF does not confirm what PR 3 says it does, the table does
not go in and prose only is a defensible answer.

## Optional: implement true PDF export for the teacher dashboard

The current dashboard offers CSV export only. To add PDF, the
`reportlab`-based curriculum-coverage generator
(`scripts/generate_curriculum_report.py`) is a good template — copy
its `SimpleDocTemplate` usage into a sibling `export_pdf` method on
`ui.teacher_dashboard.TeacherDashboard`.
