# Human TODO (post-v1.0.0-rc2)

Three deliverables remain that the autonomous build cannot finish
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

Store the raw responses in `docs/teachers/evaluation-raw.md` (gitignored
if it contains personal data) and a redacted summary in
`docs/teachers/evaluation-summary.md`.

## 2. Tag v1.0.0

Once the teacher evaluation summary has zero blocker-severity issues,
run:

```bash
git tag -a v1.0.0 -m "v1.0.0 - production release"
git push origin v1.0.0
```

The `release.yml` workflow then builds Windows / macOS / Linux
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

### P8 — Web companion (deferred, needs a scope discussion)

The desktop spec deliberately forbade web frameworks; a JS-port of
the rover API would re-architect the project as two parallel
codebases. Before starting, decide:

- Is the web port a teaser (read-only demos) or a peer (full lessons)?
- Will it share the lesson YAMLs (build-time JSON conversion) or
  fork them?
- Does GitHub Pages count as the "no cloud" clause being honoured?
  (It is static hosting, so arguably yes.)

Once those questions are answered the `web/` folder can be added
with a JS mini-interpreter, a Canvas renderer, and a Playwright
smoke test, exactly as the P8 spec describes.

## Optional: implement true PDF export for the teacher dashboard

The current dashboard offers CSV export only. To add PDF, the
`reportlab`-based curriculum-coverage generator
(`scripts/generate_curriculum_report.py`) is a good template — copy
its `SimpleDocTemplate` usage into a sibling `export_pdf` method on
`ui.teacher_dashboard.TeacherDashboard`.
