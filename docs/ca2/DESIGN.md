# KODRO design rules

What the product already looks like, stated so the video, the screenshots and any
new surface stay inside it. This is a description of shipped CSS, not a wish list.
Every value below is read from `src/robolearn/assets/web/styles.css` unless another
file is named.

## Where the tokens live

One `:root` block, `styles.css:7` to `styles.css:86`. Nothing outside that block
invents a colour, a radius, a duration or a font size. If a new surface needs a
value that is not there, the value is wrong or the token set is missing one, and
the fix is to add a token rather than to hardcode a literal.

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
fluid display clamps for the hub, teacher and cockpit headers. The interface is
deliberately small and dense: 12px is the base. Hierarchy is carried by the jump
from body to the display clamps, which is 12px to 46px at the top end, not by
nudging weights.

## Space, radius, elevation, motion

- Space: 4, 8, 12, 16, 24, 32, 48. Seven steps, no others.
- Radius: 4 controls and badges, 6 cards and panels, 10 modals, 16 hero surfaces.
  Pills stay literal at 99px and circles at 50 percent. The pixel theme flattens all
  four tokens to 0 rather than overriding every element, which is the test that the
  scale is real.
- Elevation, low to high: `--shadow-card`, `--shadow-menu`, `--shadow-modal`. A
  surface picks the one that matches what it is, never a bespoke shadow.
- Motion: `--duration-fast` 120ms, `--duration-normal` 180ms, `--duration-slow`
  320ms, all on `--ease` `cubic-bezier(0.22,0.61,0.36,1)`. Nothing animates longer
  than 320ms. Nothing loops forever.

## Themes

Nine named themes plus the default: light, matrix, pixel, game, lego, chatgpt,
abstract, wiki, contrast. A theme is a token swap on `:root[data-theme="..."]`, not
a second stylesheet. The demo runs on the default. The contrast theme exists for the
accessibility claim and is worth showing for two seconds, not for a minute.

## Accessibility rules that must not regress

- 18 `:focus-visible` rules, all a 2px or 3px teal outline with an offset. Focus is
  never removed, and it is never the browser default.
- A skip link that becomes visible on focus (`styles.css:792`).
- Three `forced-colors: active` blocks for Windows high-contrast mode.
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
8. No second elevation system. Three shadows, pick one.
9. No stock hero. The hub is a lesson grid because the product is a lesson product,
   and dressing it as a landing page misrepresents what the marker is about to see.
10. No dashboard-by-numbers. Panels earn their place by being the thing the user is
    editing, running or reading, and the secondary tools sit behind one disclosure
    control by design.
