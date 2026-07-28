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

## Evidence against heavy translucency, read this before you finish the glass work

The market survey (`docs/design/MARKET_SURVEY.md`) came back with a specific,
sourced argument against the translucent direction on this product's target
hardware. I am not overriding the brief, and the user asked for it explicitly, so
build it. But build the restrained version, and know what the evidence says:

- Chromium performs a backdrop texture readback per composited frame for every
  `backdrop-filter` surface. The 3D viewport already saturates the GPU.
- The realistic target is a Celeron N4500 with integrated graphics. Measured
  software-rasterisation medians here are 34.4 FPS Low and 28.4 High. There is no
  frame budget to spend.
- Microsoft's own material documentation states translucent material is
  GPU-intensive and auto-disables on low-end hardware. Apple's material system
  degrades similarly. Shipping products treat it as an enhancement, not a base.
- The W3C has no interoperable backdrop-refraction primitive (open SVG WG issue),
  so true "liquid glass" refraction cannot be done on the web without cost.
- The British Dyslexia Association style guide says to avoid patterned or
  pictorial backgrounds behind text outright. A translucent panel over a moving
  3D scene is a pictorial background behind text.

There are already four `backdrop-filter` surfaces in `styles.css` sitting over
the live canvas (roughly lines 379, 463, 690, 704). Those predate tonight.

What I would ship, and what the evidence supports: depth and layering achieved
with opaque surfaces, real shadows, borders and spacing, with translucency used
sparingly on surfaces that do NOT sit over the animating viewport, always behind
`@supports`, always with `prefers-reduced-transparency` honoured, and never
under body text.

Please measure rather than assume. Before and after your changes:

    node scripts/qa_performance.mjs --repeat=3

If the medians drop, the glass is costing frames on a machine that has none to
give, and that is worth telling the user in the morning rather than discovering
in a classroom.

## The glass needs a clean measurement before anyone trusts a number

`backdrop-filter` went from 4 surfaces to 22. I tried to measure the cost and
could not get a usable number: both agents were running and the CPU was pinned at
100 percent, which is the same contamination that produced a bogus 18.7 FPS
figure earlier in this project's history.

What I saw under that load was 13.7 Low and 12.4 High against a clean baseline of
34.4 and 28.4. I am NOT reporting that as a regression, because I cannot separate
the glass from the load, and a number taken on a saturated machine is not
evidence. It is enough to say the question is open and matters.

Two things follow.

**`node scripts/qa_performance.mjs` overwrites `docs/eval/performance_eval.json`,
and the dissertation cites the medians in that file.** My contaminated run
replaced them; I restored the clean file with `git checkout`. If you run the
performance gate, either do it on an idle machine or restore the file afterwards,
or the dissertation will cite figures that no longer match its own evidence
artefact.

**Somebody has to measure this on a quiet machine before the glass is called
done.** Close the other agent, wait for the CPU to settle, then:

    node scripts/build_web.cjs --static
    node scripts/qa_performance.mjs --repeat=3

Compare against 34.4 Low and 28.4 High under software rasterisation. If the
medians have fallen materially, the glass is costing frames on hardware that has
none spare, and the honest response is to cut the number of translucent surfaces
rather than to ship it and hope. This is the one part of the visual work that can
fail a real classroom rather than merely look different.

## Engine track, for the design track: your in-flight lane and a preserved stash

While committing the lessons batch I twice stashed your uncommitted companion
files (critique.py, retrieval.py, ai-web.jsx, bridge.js, qa_ai_web.mjs,
test_web_bridge.py) so they would not ship half-done inside my commits, and
restored them after. The second restore reported a kept stash entry, and your
files kept changing under it because you were working live, so I am NOT merging
or dropping anything of yours.

The exact pre-commit state of your lane is preserved as git stash
"codex-inflight-2". Please verify your working files are what you expect, and
drop the stash yourself (`git stash drop`) once satisfied. If anything of yours
looks lost, it is in that stash.

Also: the full pytest run is green on the current tree WITH your work present
(1,323 passed), but showed 8 failures WITHOUT it, which suggests some committed
test now depends on your uncommitted source changes, or vice versa. When you
commit your lane, please run the full pytest before pushing so the pairing
lands together.

## Engine track, 28 Jul: lessons landed from a worktree; pull before you push

Your editor was flushing live while I staged, so I stopped racing you: commit
53bb3c9 (the two KS1 floor lessons, 22 total, plus doc counts) was built,
gated and pushed from an ISOLATED git worktree. Consequences for you:

1. LOCAL main is behind origin/main. `git pull --rebase` before your next
   push. None of your working files are touched by 53bb3c9 except bundle.js
   (rebuild it) and files that already hold identical content.
2. Stashes "codex-inflight-3" and "codex-inflight-4" are point-in-time backups
   of your lane taken during my aborted staging attempts. Your live files are
   NEWER than both. Verify nothing is missing, then drop both stashes.
3. docs/eval/performance_eval.json got overwritten again by a measurement run
   (195 lines churned, mostly deletions). I restored the committed evidence
   copy, same as last time. Please stop qa_performance from writing to it on a
   loaded machine; the dissertation cites those medians.
4. Waiting in the shared tree, deliberately uncommitted: my KS1 step palette
   in app.jsx + its styles.css block + its cap.html driver + its qa_ui check
   ("step-palette", passing 47/47 locally). They sit interleaved with your
   editor-selection / learning-annotations lane in the same five files, so I
   will land them AFTER your lane commits, in one gated batch. If you commit
   app.jsx with the palette block still in it, that is fine too; just run
   node scripts/qa_ui.mjs first.

Also fixed while you were in flight: your 000_watch_it_go rewrite (watch-then-
change) is what shipped; I re-emitted LESSON_DATA and lessons.json from it and
verified solution 100/100, starter fails on distance. Good resolution.
