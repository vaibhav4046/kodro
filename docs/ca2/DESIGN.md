# KODRO design rules

What the product already looks like, stated so the video, the screenshots and any
new surface stay inside it. This is a description of shipped CSS, not a wish list.
Every value below is read from `src/robolearn/assets/web/styles.css` unless another
file is named.

Every count in this file was re-measured against that stylesheet on 15 August
2026, and four of them were wrong: the number of focus rules, the number of
forced-colours blocks, the size of the elevation scale, and the base font size.
All four are corrected in place and each correction says what the old number
was, because a design document that overstates its own accessibility coverage is
worse than one that omits it. The values that were checked and held: the fifteen
palette hex values in the table below, all four `--fg-*` contrast ratios, the
three `a11y-readable` spacing values and its `styles.css:1169` scope, the skip
link at `styles.css:792`, the four display clamps, the `:root` block at lines
7 to 86, the seven space steps, the four radius tokens, the three durations and
the ease, the thirteen-step type scale from 9px to 30px, the ten
`prefers-reduced-motion` blocks, the nine named themes, and the eighteen vendored
faces. `site/styles.css` is byte-identical to the source stylesheet, so the served
copy is the one described here.

## Where the tokens live

One bare `:root` block, `styles.css:7` to `styles.css:86`, holding 74 token
definitions. That is where a surface should reach for a colour, a radius, a
duration or a font size, and if a new surface needs a value that is not there,
the value is wrong or the token set is missing one, and the fix is to add a
token rather than to hardcode a literal.

There are two documented exceptions and they are the reason this paragraph was
rewritten on 15 August.

The first is the theme system. Nine `:root[data-theme="..."]` blocks redefine
tokens on top of the base set: `light` at `styles.css:1729`, `matrix` at
`:1747`, `pixel` at `:1763`, `game` at `:1785`, `lego` at `:1799`, `chatgpt` at
`:1816`, `abstract` at `:1832`, `wiki` at `:1844` and `contrast` at `:1864`.
Between them they carry 224 redefinitions across 32 distinct tokens, 22 to 28
per theme. This is the token system working rather than a breach of it, because
a theme changes the values and never the names, which is exactly the point made
under Radius below about the pixel theme flattening all four radius tokens to 0.

The second is the syntax highlighter, which is a real breach and is small.
Eleven literal hex colours sit in ordinary declarations outside the base block:
`.tok-fn` at `styles.css:392`, the viewport ground at `:405`, the world selector
at `:427`, the reading-age chip's text colour at `:1198`, the high-contrast
scrollbar at `:1878`, and six per-theme token colours at `:1884` to `:1889`.

The paragraph this replaces read "One `:root` block ... Nothing outside that
block invents a colour, a radius, a duration or a font size." The first sentence
was defensible only on the narrow reading that `:root[data-theme]` is not a
`:root` block. The second was false on any reading, and this document refuted it
itself under Radius below, where it describes the pixel theme flattening the
radius tokens, which is a radius invented outside `styles.css:7` to `:86`. The
rule was right and the scope was absolute when it should have been qualified,
which is the failure mode that makes a design document unusable: a reader who
finds one exception stops trusting the rest of it, including the parts that are
exact.

## Palette

The identity is deep ink, warm paper, route teal and signal gold. It is not a
generic dark dashboard, and the paper tone is what keeps it from reading like one.

| Token | Value | Used for |
|---|---|---|
| `--void` | `#07111b` | Page ground, the darkest layer |
| `--navy` | `#0c1825` | Panel ground |
| `--navy-2` | `#122234` | Raised panel, the glass solid |
| `--navy-3` | `#1a3044` | Control ground, hover ground |
| `--paper` | `#f5f0e4` | Primary text, the warm off-white |
| `--paper-2` | `#ece6d5` | Secondary paper surfaces |
| `--moon` | `#fbfaf5` | The one near-white |
| `--cyan` | `#5ce0d8` | Route teal, the single accent |
| `--cyan-2` | `#3bc0b8` | Accent pressed |
| `--cyan-deep` | `#1a6f6a` | Accent ground behind text |
| `--mars` | `#c8685a` | Terrain accent, Mars sites |
| `--brass` | `#c9a86a` | Signal gold, reading-age chips |
| `--success` | `#7cc49b` | Pass verdicts |
| `--warning` | `#e0b45c` | Partial verdicts |
| `--danger` | `#d06a6a` | Fail verdicts |

Three rules about colour:

1. Teal is the only accent that means "this is the action". Brass means "this is a
   label about the learner". Mars is terrain, never a button.
2. Verdict colour is never the only signal. The lesson tiles carry a tick, a cross
   and a score out of 100 alongside the colour, because a marker will watch this on
   a projector and some of the audience will not separate the greens from the reds.
3. Nothing decorative uses the accent. If teal appears, something is clickable,
   focused, or currently running.

## Text colour and contrast

`--fg-1` through `--fg-4` are solid values, not opacities. The comment at
`styles.css:14` records why: the original opacity-based greys fell under 4.5:1 on
the navy ground. The shipped values clear it, `--fg-2` at 7:1 or better and
`--fg-3` and `--fg-4` at 4.5:1 or better.

The viewport overlays are a separate set, `--hud-fg-1` to `--hud-fg-3`. They sit on
a fixed dark glass in every theme, so theme blocks deliberately do not redefine
them. Light themes flip `--fg-*` dark, and without the split the telemetry, the
terrain switch and the orbit hint would have gone dark on dark.

## Typography

Three families, all vendored as local `.ttf` under `assets/web/vendor/fonts`, 18
faces, 3.5 MB, loaded by `vendor/fonts.css`. There is no font CDN and no network
request. That is a load-bearing property of an offline product, not a preference.

| Token | Family | Role |
|---|---|---|
| `--font-display` | Cormorant Garamond | Headers only, the editorial note |
| `--font-body` | Inter Tight | Everything that is read as interface |
| `--font-mono` | JetBrains Mono | Code, telemetry, chips, anything numeric |

A fourth family, Atkinson Hyperlegible, is vendored but never the default. It comes
on with `body.a11y-readable` and is scoped to reading and code surfaces only
(`styles.css:1169`), with Comic Sans and Verdana as fallbacks because they are the
universal dyslexia-friendlier faces when Atkinson is missing. That mode also lifts
letter spacing to 0.03em, word spacing to 0.08em and line height to 1.7, and raises
the editor to `--text-2xl`. The app grid does not move, which is the whole reason it
is scoped rather than global.

Sizes come from a 13-step scale, `--text-2xs` 9px to `--text-8xl` 30px, plus four
fluid display clamps for the hub, teacher and cockpit headers: `--text-display-sm`
through `--text-display-xl`, topping out at `clamp(28px,4vw,46px)`.

The interface is deliberately small and dense, and this paragraph used to put a
number on that which the stylesheet does not support. It said "12px is the base".
No base font size is declared anywhere: there is no `font-size` on `html`, on
`:root`, or in either `body` rule, and none in `index.html` outside the boot
splash, so anything not given a token inherits the browser default rather than
12px. What is measurable is which token the interface actually reaches for, and
it is not the 12px one. `--text-sm` at 11px is used 87 times, `--text-md` at 12px
48 times, `--text-xs` at 10px 40 times. The three smallest working sizes carry
most of the interface. Hierarchy is carried by the jump from those to the display
clamps, 11px to 46px at the extremes, not by nudging weights.

## Space, radius, elevation, motion

- Space: 4, 8, 12, 16, 24, 32, 48. Seven steps, no others.
- Radius: 4 controls and badges, 6 cards and panels, 10 modals, 16 hero surfaces.
  Pills stay literal at 99px and circles at 50 percent. The pixel theme flattens all
  four tokens to 0 rather than overriding every element, which is the test that the
  scale is real.
- Elevation, low to high: `--shadow-card`, `--shadow-menu`, `--shadow-modal`.
  There is a fourth token and this bullet used to deny it. `--shadow-3` is defined
  at `styles.css:36` and used at exactly one site, `.say-bubble` at
  `styles.css:522`, which is the rover speech bubble. The source says so itself in
  the token comment at `styles.css:29`: bubbles and one-off overlays keep
  `--shadow-3`. The rule still holds that a surface picks a token rather than
  writing a bespoke shadow. The scale is three plus one named exception, not
  three.
- Motion: `--duration-fast` 120ms, `--duration-normal` 180ms, `--duration-slow`
  320ms, all on `--ease` `cubic-bezier(0.22,0.61,0.36,1)`. Nothing animates longer
  than 320ms. Nothing loops forever.

## Themes

Nine named themes plus the default: light, matrix, pixel, game, lego, chatgpt,
abstract, wiki, contrast. A theme is a token swap on `:root[data-theme="..."]`, not
a second stylesheet. The demo runs on the default. The contrast theme exists for the
accessibility claim and is worth showing for two seconds, not for a minute.

## Accessibility rules that must not regress

- Nine `:focus-visible` rule blocks, covering 22 selectors. Six carry a 2px or 3px
  teal outline with an offset. The other three carry a teal SVG stroke instead,
  because the focused thing is a child shape inside an SVG where an outline is not
  reliably painted: the memory-graph node at `styles.css:2116` and `:2117`, and the
  lesson-map markers at `:2622`. All nine resolve to `var(--cyan)`. Focus is never
  removed and it is never the browser default. This bullet used to read "18 rules,
  all a 2px or 3px teal outline", and eighteen is not the count of anything in the
  file: not the blocks, not the selectors, not the raw occurrences, not the rules
  that actually draw an outline. The counts were re-measured on 15 August and are
  right, but the three line numbers were not, and they were corrected the same day.
  They read `:2114`, `:2116` and `:2621`. Line 2114 is a text-fill rule with no
  focus state in it at all, and 2621 is `.ls-map [role="button"] { outline:none }`,
  which is the rule that removes the default outline rather than the one that
  replaces it. Citing the removal and not the replacement is the worse of the two
  errors, because it reads as evidence for the opposite of the claim.
- A skip link that becomes visible on focus (`styles.css:792`).
- One `forced-colors: active` block, at `styles.css:271`. It covers the status dots
  and nothing else: Windows high-contrast flattens backgrounds to system colours,
  which would make dots that differ only by colour identical, so each state gets a
  distinct border shape that survives the override. This bullet used to claim three
  blocks. There is one, and no other surface has a forced-colours override. How the
  rest of the UI behaves under forced colours has not been measured, so do not
  present this as coverage.
- Ten `prefers-reduced-motion: reduce` blocks. Every animated surface has one. A
  reviewer who runs the app with reduced motion on sees a static, complete UI, not a
  broken one.
- The reading-age chip is fixed dark ink on brass rather than `var(--void)`, because
  in the light themes `--void` is near-white and the chip fell to about 3:1.

## Anti-patterns, explicitly

These are the things the product does not do, listed because they are the default
temptations when adding a screen under deadline.

1. No new colour literal. If it is not a token, it does not ship.
2. No accent as decoration. Teal is interaction, full stop.
3. No colour-only status. Every verdict carries a glyph and a number.
4. No animation over 320ms, no infinite loop, no animated layout property. Motion is
   transform and opacity.
5. No font from a network. Ever. It breaks the central claim of the product.
6. No opacity-based grey for text. That is the exact bug the solid `--fg-*` values
   were introduced to fix, and it will pass a casual eye while failing 4.5:1.
7. No dark text on the HUD. The `--hud-fg-*` split exists for this and gets undone
   by anyone who "simplifies" the theme blocks.
8. No second elevation system. Four tokens exist, three of them are the scale and
   `--shadow-3` is the documented bubble exception. Pick one of the four rather
   than writing a fifth.
9. No stock hero. The hub is a lesson grid because the product is a lesson product,
   and dressing it as a landing page misrepresents what the marker is about to see.
10. No dashboard-by-numbers. Panels earn their place by being the thing the user is
    editing, running or reading, and the secondary tools sit behind one disclosure
    control by design.
