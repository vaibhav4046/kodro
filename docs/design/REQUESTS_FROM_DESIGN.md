# Requests for the engine track

## 1. Use the routed K in the persistent mission bar

- File: `src/kodro/assets/web/app-data.jsx`
- Exact change: replace the `ORBIT_SVG` value with the following markup:

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path d="M18 8v48M19 32 49 9M20 32c11 0 15 17 31 24" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path>
  <circle cx="20" cy="32" r="4.8" fill="currentColor"></circle>
  <circle cx="49" cy="9" r="2.4" fill="currentColor"></circle>
  <circle cx="51" cy="56" r="2.4" fill="currentColor"></circle>
</svg>
```

- Why: `app-data.jsx` owns the mark rendered by the persistent mission bar.
  The design track cannot edit it. Home, onboarding, favicons and the icon
  family now use the routed K, so leaving the old orbit there creates two
  competing product marks.

The mission-bar version is intentionally one colour because it inherits the
active theme. The full-colour gold decision node appears in the larger home and
icon versions.

## 2. Expose a safe idle state for liquid surfaces

- Files: `src/kodro/assets/web/app.jsx` and
  `src/kodro/assets/web/Viewport3D.jsx`, or the engine-owned module that
  controls the render loop.
- Exact change: pause the live viewport animation loop whenever an app modal,
  fixed popover or floating telemetry drawer is open. While the loop is paused,
  add `kodro-sim-idle` to `document.body`. Remove the class before the loop
  resumes and during unmount cleanup.
- Why: `styles.css` only enables backdrop blur on modal, popover and floating
  telemetry surfaces under `body.kodro-sim-idle`. Without the class they use
  the solid fallback. This prevents a blurred surface from competing with the
  live Three.js canvas on integrated school GPUs.

The mission toolbar can use blur without the class because it is in its own
layout row and does not overlap the canvas. World controls and HUD surfaces are
always opaque.

## 3. State the lesson weighting on the documentation home page

- File: `docs/index.md`
- Exact change: replace any unqualified claim that the 18 lessons cover KS1 to
  KS4 with: `18 lessons span KS1 to KS4 and are weighted to KS3 and KS4: 1 is
  tagged KS1, 2 are KS2, 8 are KS3 and 7 are KS4 stretch.`
- Why: the statement that every stage is represented is true but can imply
  balanced coverage. The count comes directly from the 18 lesson YAML files.
  The owned README has been corrected, but `docs/index.md` is outside the
  design-track ownership list.

> **DONE, and the exact change above is superseded.** Applied when requested,
> re-checked 15 August 2026. The library has grown from 18 lessons to 24 and
> the split is now 3 KS1, 4 KS2, 9 KS3, 8 KS4, so pasting the literal string
> in "Exact change" would now write four wrong numbers into `docs/index.md`.
> The live wording in that file is current. The reasoning in "Why" still
> stands and is why the qualified form is used at all.
