# Human TODO (post-v0.20.0)

Three deliverables are explicitly out of scope for the autonomous
build (per the autonomous-mode override). Each one needs a human in the
room.

## 1. Record the README demo GIF

The README references `docs/assets/demo.gif`; the file is not yet
checked in.

```bash
# Linux / WSL (peek records, ffmpeg trims):
sudo apt-get install peek ffmpeg
peek &                                  # capture a 12-15s clip of:
                                        #   - open the app
                                        #   - select 05_iteration
                                        #   - press Run
                                        #   - watch the rover collect samples
ffmpeg -i ~/Videos/peek.mp4 -vf "fps=12,scale=720:-1" docs/assets/demo.gif
git add docs/assets/demo.gif
git commit -m "docs: add README demo GIF"
git push
```

```powershell
# Windows: use ScreenToGif (free, https://www.screentogif.com/) to
# record the same sequence; save as docs\assets\demo.gif at <= 4 MB.
```

## 2. Conduct the 5-8 teacher evaluation study

Recruit five to eight UK secondary-school Computing teachers; show
each one the simulator end-to-end (welcome wizard, three lessons of
their choice, the teacher dashboard). Capture:

- Time-to-first-success per lesson.
- Hint-engine usefulness (did the surfaced hint help?).
- Any keystrokes / clicks where they got stuck.
- Free-form feedback.

Store the raw responses in `docs/teachers/evaluation-raw.md` (gitignored
if it contains personal data) and a redacted summary in
`docs/teachers/evaluation-summary.md`.

## 3. Tag v1.0.0

When the demo GIF is in, and the evaluation summary has zero blocker-
severity issues, run:

```bash
git tag -a v1.0.0 -m "v1.0.0 - production release"
git push origin v1.0.0
```

The `release.yml` workflow then builds Windows / macOS / Linux
binaries via PyInstaller and attaches them to the release.

## Optional: implement true PDF export for the teacher dashboard

The current dashboard offers CSV export only. To add PDF:

1. `pip install reportlab` and add to `pyproject.toml` optional
   deps under `dev`.
2. Extend `ui.teacher_dashboard.TeacherDashboard.export_csv` (or add a
   sibling `export_pdf`) to render the heatmap + drill-down via
   `reportlab.platypus`.
3. Mirror the same `export_path_chooser` injection for testability.

## Optional: launch the renderer demo CLI

The renderer ships a CLI; verify that:

```bash
python -m robolearn.engine.renderer --terrain mars
```

opens a window and renders a demo world. Headless CI cannot test this
path.
