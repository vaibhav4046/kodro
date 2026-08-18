# The CA2 intro card, built and gated, 15 August 2026

`docs/ca2/STORYBOARD.md` shot 1 asks for a twelve-second title card carrying the
product name, module code, student name and date, cut straight into shot 2.
This is that card, what it is made of, and what every gate actually returned.

It also records two defects that the gates passed over and a person caught by
looking at a frame, because the useful part of this note is the second kind.

## What was built

```
docs/ca2/intro/
  index.html                  the composition
  assets/vendor/gsap.min.js   vendored GSAP 3.14.2
  assets/fonts/*.ttf          four faces, copied from the app
  renders/kodro-intro.mp4     the render
  hyperframes.json meta.json package.json    scaffold config
```

Scaffolded with `hyperframes init --non-interactive --example blank
--resolution landscape`, with `HYPERFRAMES_SKIP_SKILLS=1` set because
`--skip-skills` is currently ignored and init otherwise reaches GitHub. The
scaffold writes `CLAUDE.md` and `AGENTS.md`; both were deleted under the
repository's no-agent-files rule.

The blank scaffold loads GSAP from a jsDelivr CDN. That is vendored instead:

```
assets/vendor/gsap.min.js  72779 bytes
sha256 c174bfce53a729418d57a8ad8625e7247c793a22fef8e2851e3cfa3de9cd8280
header /*! GSAP 3.14.2 ... @license Copyright 2025, GreenSock.
```

Kodro is an offline product and this card is the first thing said about it on
camera. A render that depends on a network fetch resolving the same way twice
would contradict the sentence on screen.

## The fonts are copies, and here is the proof they match

The card uses the three families the product ships. Pointing at the originals
up-tree was tried first and lint rejected it:

```
invalid_parent_traversal_in_asset_path: Found 4 asset path(s) traversing
above the project root with "../"
```

The stated reason is that renders rewrite such a path against each
sub-composition's source path while Studio preview resolves against the project
root, so the same path resolves two ways and one of them 404s. Copying is the
supported answer.

The cost of copying is drift. Measured on both sides today:

```
copy  docs/ca2/intro/assets/fonts/                    original  src/kodro/assets/web/vendor/fonts/
69e7ae35cba23d962227b86f99217c250e642e4c6f6104b4f3ec465039e4e2d8  co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_iE9GnM.ttf   Cormorant Garamond 600
27350bc95b961b9b4e1a80d872f49e903fe727f290f6b2a079e67ceb1685fb1f  NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjDw-qXA.ttf             Inter Tight 400
c2a4bdafb30500a3bd0843f95ad659ad38492f025837803e6a8ef8672c575e8e  NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-qXA.ttf             Inter Tight 500
3386a05f6ece969e4537de6be894170d20558e82f7d56c8c5d332972ef172160  tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8-qxjPQ.ttf         JetBrains Mono 500
```

All four hashes are identical on both sides. Re-checkable in one command:

```bash
sha256sum docs/ca2/intro/assets/fonts/*.ttf src/kodro/assets/web/vendor/fonts/*.ttf
```

The palette is copied from the single `:root` block at
`src/kodro/assets/web/styles.css:7-86`. No colour on this card was invented.
That range was first written here as `7-50`, which was wrong in a way range
checking cannot catch: line 50 is a blank line in the middle of the block, so
the citation resolved without error while truncating the block it named. The
block opens at `:7` and its brace closes at `:86`, holding 74 token
definitions across 40 lines.

## The toolchain was substituting fonts, and a green gate would have hidden it

The families were first declared under their real names with ordinary
fallbacks: `'Cormorant Garamond', Garamond, serif` and so on. `check` then
printed this:

```
Fetched 10 font face(s) for "JetBrains Mono" from Google Fonts
Fetched  7 font face(s) for "EB Garamond"    from Google Fonts
Fetched 11 font face(s) for "Roboto"         from Google Fonts
Injected deterministic @font-face rules for 3 requested font families
```

EB Garamond and Roboto appear nowhere in the file. They are what the compiler
resolved the generic fallbacks to. So the card would have rendered in fonts
downloaded at build time that only approximate the product's, the render would
have required a network, and the gate would have said `Check passed` either way.

This is the same defect class as the three in
`.kodro/ca2-evidence/2026-08-15-secret-gate-utf16-blind-spot.md`: the tool did
not lie, it answered a different question than the write-up would have claimed
it answered. A `Check passed` line here was one edit away from being recorded as
evidence that the card uses the product's typefaces.

The fix is to give the faces private family names with no generic fallback:
`Kodro Display`, `Kodro Body`, `Kodro Mono`. There is then nothing for the
compiler to resolve. The three fetch lines and the injection line are absent
from every run since, which is both the confirmation and the fix.

## Two layout defects the gates could not see

Lint, validate, inspect and check all passed on the first render. A still
pulled at t=6s and looked at showed two things wrong with it.

**The block sat low.** It spanned y=358 to y=916, centring it at 637 against a
frame centre of 540. Ninety-seven pixels of drift reads as a mistake rather than
a choice. Every vertical offset moved up 72px, which lands the block at 286..848,
centre 567, 27px below frame centre: still open at the top, close enough to look
placed.

**The subtitle broke inside a compound word.** Left to wrap in its 1240px box it
split "disclosed-fidelity" after the hyphen, which on screen reads as a typo. An
explicit `<br />` after "testing" fixes it and removes the last thing on the card
that depended on a wrapping algorithm.

Neither is a lint error, a runtime error, a contrast failure or an overflow.
No automated gate in this toolchain has an opinion about them. The check that
caught them was extracting a frame and reading it.

## Gate results, all at the final state of the file

Re-run after the layout fixes, so these describe the file that shipped rather
than an earlier one.

```
lint                    0 errors, 0 warnings                                EXIT=0
validate                No console errors, 22 text elements pass WCAG AA    EXIT=0
inspect --samples 15    0 layout issues across 15 sample(s)                 EXIT=0
check                   Lint      0 errors, 0 warnings
                        Runtime   0 errors, 0 warnings
                        Layout    0 issues across 9 sample(s)
                        Motion    0 errors, 0 warnings
                        Contrast  21/21 text checks pass WCAG AA
                        Snapshots disabled
                        Check passed                                        EXIT=0
```

`validate` and `inspect` both print a deprecation notice pointing at `check`.
They are run anyway because the CA2 blueprint names all three by name, and
`check` is run because it is the gate that is actually current. All four agree.

`Snapshots disabled` is not a pass. There is no committed snapshot baseline for
this composition, so that row asserts nothing.

## The render

```bash
npx --yes hyperframes@0.7.109 render --quality high --fps 30 \
  --resolution landscape --low-memory-mode --strict-all -o renders/kodro-intro.mp4
```

```
◇  docs/ca2/intro/renders/kodro-intro.mp4
   756.6 KB · 12.0s video · rendered in 14.8s
```

Measured on the file afterwards:

```
codec_name=h264  width=1920  height=1080  pix_fmt=yuv420p
r_frame_rate=30/1  nb_frames=360  duration=12.000000
size=774768  bit_rate=516512
sha256 dd12a3b4ee020284f52d82a5b036de400bbe5fc10816c56013ab35313d8f161a
```

360 frames at 30fps is exactly twelve seconds, which is what the storyboard
allots shot 1.

`--low-memory-mode` is forced rather than left to auto-detect. Auto-detection
keys off *total* RAM at an 8 GB threshold; this machine has 15.7 GB total and
had 1.2 GB free, so it would not have engaged, and `doctor` had already warned
that renders may fail. Safe mode pins one worker and uses screenshot capture.

`--strict-all` makes the render itself a gate: it fails on lint warnings, not
just errors.

An earlier render of the pre-fix file measured 763383 bytes / sha256
`7744c846e7d61cc2bfb4b5f16dd7065d772a1d4c6d3b197b1b8b50858c5a99d6`. That file no
longer exists and that hash should not be quoted anywhere as current.

## Determinism

The blueprint requires the intro to be deterministic: no `Math.random()`, no
asynchronous timeline construction, no infinite repeats, no jump cuts, no
animation of layout dimensions, no overlapping track timings. How each is met:

- Every value in the timeline is a literal. There is no `Math.random` in the
  file and no clock is read.
- The timeline is built by a blocking classic script at parse time. No `await`,
  no timer, no load handler, so it is complete before the runtime seeks it.
- Every tween is a `fromTo` with an explicit start state, so seeking to a time
  gives the same frame whether it was played into or jumped to. `from` alone
  does not give that, and frame rendering is all seeking.
- Nothing repeats and nothing yoyos.
- Only `opacity`, `y` and `scaleX` are touched. All three are compositor
  properties. No width, height, margin, padding or font size is animated, so
  nothing reflows mid-render. The rules named `width`/`height`, which GSAP does
  support here and which are deliberately unused; `scaleX` draws the two rules
  in as a transform instead.
- Positions are absolute times passed as the third argument, never relative
  labels, so reordering the lines cannot change the output.
- One element per track index, all present for the full twelve seconds, so no
  two clips can overlap on a track by construction.
- The card does not dissolve out. Shot 2 is a straight cut, so shot 1 ends.

`[static-dedup] reused 255/360 frame(s) (71%)` in the render log is consistent
with a card whose last tween settles at 3.60s and then holds still.

One honest gap: the product's motion token is
`cubic-bezier(0.22, 0.61, 0.36, 1)`. The timeline uses GSAP's `power2.out` and
`power3.out`, which are close but not that curve. Matching it exactly needs the
CustomEase plugin. This is an approximation and is recorded as one rather than
described as a match.

## Reproducing

```bash
cd docs/ca2/intro
npx --yes hyperframes@0.7.109 check
npx --yes hyperframes@0.7.109 render --quality high --fps 30 \
  --resolution landscape --low-memory-mode --strict-all -o renders/kodro-intro.mp4
```

The render is byte-reproducible only insofar as the encoder is; the composition
is deterministic, the muxer timestamps may not be. Compare frames, not hashes,
if a rebuild differs.
