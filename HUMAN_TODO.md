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

## 4. Capture real-app screenshots (visual proof for README + portfolio)

The automated preview tooling cannot screenshot the running web app:
the screenshot grab hangs (30s timeout) on the WebGL viewport. This was
isolated three ways - freezing requestAnimationFrame, removing the
canvas, and losing the WebGL context - and it still hangs every time,
so it is a harness limitation, not a product bug. The app itself boots
clean (zero console errors) and the onboarding flow was fully verified
in-browser via DOM snapshots.

So the marketing/README stills must be captured by a human from the
real window:

1. Launch the built app (`dist/RoboLearn.exe` / `Kodro.exe`) or serve
   `src/robolearn/assets/web/index.html` and open it in a normal browser.
2. Capture, at 1280x800: the onboarding landing (new logo + "Design a
   robot. Program it. Watch it work."), the robot picker, the world
   recommendation, and the studio with the City world running (traffic
   + a moving robot).
3. Drop the PNGs in `docs/img/` and reference them from the README and
   the portfolio card.

Everything else (logo, onboarding flow, world recommendation) is wired
and verified; only the pixel capture needs a human at the keyboard.

Note on the logo: the brand mark (`ORBIT_SVG` in `app.jsx`, mirrored in
`onboarding.jsx`) was refined from a rounded-square frame to a true-circle
orbit with a comet-style robot node. It is monochrome (`currentColor`),
geometrically validated (symmetric, centered, not clipped via `getBBox`),
and renders without error, but its visual aesthetic could not be screenshot
for the same WebGL reason above. Give it a quick human eye at 24px and 256px;
revert the `ORBIT_SVG` / `MARK` edits if the old mark reads better.

## Optional: implement true PDF export for the teacher dashboard

The current dashboard offers CSV export only. To add PDF, the
`reportlab`-based curriculum-coverage generator
(`scripts/generate_curriculum_report.py`) is a good template — copy
its `SimpleDocTemplate` usage into a sibling `export_pdf` method on
`ui.teacher_dashboard.TeacherDashboard`.
