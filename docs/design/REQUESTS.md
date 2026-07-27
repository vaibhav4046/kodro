# Cross-track requests

Need a change in a file the other track owns? Append it here.
Format: file, exact change, why. The owner applies it.

## From the engine track, 27 July

**`home.jsx` has a fourth door.** I added `{ key: 'author', kicker: 'Teach',
title: 'Make a lesson', ... handler: 'onAuthor' }` to the `DOORS` array before
the ownership contract was written, and `app.jsx` now passes `onAuthor` to
`KodroHome`. Keep the door and the handler name when you restyle the front page;
drop them and the Lesson Studio loses its entry point from Home. The More Tools
row is a second, independent entry point, so nothing breaks, but the front page
would stop advertising the feature.

**A warning about translucency over the canvas.** The market survey (see
`docs/design/MARKET_SURVEY.md`, ranked gap 9) found four existing
`backdrop-filter` surfaces in `styles.css` sitting over the live WebGL canvas.
Each forces a backdrop texture readback every composited frame on a GPU the
simulation is already saturating. Measured software-rasterisation medians are
34.4 FPS Low and 28.4 High, so there is no headroom to spend. If you add glass,
keep it off the animating viewport and check
`node scripts/qa_performance.mjs --repeat=3` before and after.

**We share one working tree, not two clones.** Your commits and mine land in the
same local repository on the same machine, so `git pull --rebase` has nothing to
fetch and the bundle conflict I warned about will not happen the way I described.
The real risk is simpler and worse: we can overwrite each other's UNCOMMITTED
edits in a file we both have open. The ownership split above is the whole
defence. Commit often so the other track sees your work; never open a file the
other track owns.

**Honesty fix needed in `README.md` and `docs/index.md`.** Both say the lessons
cover "Key Stage 1 to Key Stage 4". Counted from the YAML library, the split is
1 at KS1, 2 at KS2, 8 at KS3, 7 at KS4. That claim is true in the sense that one
lesson exists at each stage, and misleading to a teacher who reads it as balanced
coverage, which is exactly the class of claim this project has spent the week
removing. Please reword to something like "18 lessons spanning KS1 to KS4,
weighted to KS3 and KS4" and state the split. I have already corrected
`docs/HANDOFF_KEITH.md`. Verify the numbers yourself with:

    python -c "import sys; sys.path.insert(0,'src'); from robolearn.lessons.schema import load_library; from collections import Counter; print(Counter(l.key_stage for l in load_library()))"

**I touched `pyproject.toml` to unbreak CI, and it was your files that broke it.**
Not a complaint, a heads-up about a trap you will hit again.

`ruff format --check .` went red on all three OS legs the moment
`docs/teachers/answer-key.md` landed. Nothing was wrong with the file. Ruff is
pinned only as `ruff>=0.6.0`, and a recent release graduated "format Python
inside markdown code fences" out of preview, so CI's ruff started reformatting
your worksheets while my local ruff (0.15.13) still calls that experimental. The
build broke because a tool updated, not because either of us wrote anything bad.

Fixed by adding `exclude = ["*.md"]` to `[tool.ruff.format]`. That is the right
answer rather than a workaround: your worksheets contain example programs that
are deliberately incomplete or wrong, because that is what a worksheet is for,
and a formatter silently tidying them would destroy the exercise.

You can keep writing Python in fences freely. Run `ruff format --check .` before
you push anyway, since `ruff check` (the linter, separate command) still has
opinions about real .py files.
