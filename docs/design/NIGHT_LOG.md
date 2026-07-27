# Design track night log

Date: 27 July 2026

## Ownership state at start

The shared worktree already contained uncommitted changes in engine-owned
files, including `app.jsx`, `hooks.jsx`, two scripts and the generated
`bundle.js`. Those source files were not edited, staged or reverted by the
design track.

The plan was committed first as `89d293a`.

## Visual identity

- Replaced the orbit icon with the routed K identity.
- Added full-colour, maskable and one-colour hand-authored SVG assets.
- Generated and inspected the 192 px and 512 px PNG icons from the SVG.
- Updated manifest metadata and icon purposes.
- Updated the page title, description, theme colour and favicon links.
- Reworked the onboarding mark to match.
- Added a request for the engine track to update the persistent mission-bar
  mark in `app-data.jsx`, which the design track does not own.

The routed K represents one program path reaching a decision and splitting
into possible robot routes. The central gold node is the decision or sensor
reading.

## Icon family

- Redrew the inline icon registry on a 24 by 24 grid.
- Standardised on a 1.75 px rounded stroke, 2 px rectangular corners and a
  2 px optical margin.
- Kept every existing icon name and the offline `currentColor` implementation.
- Reused the brand's small circular route nodes as the family's fill detail.

## Liquid material

- Added shared glass, spacing and motion tokens.
- Kept a solid background as the baseline for every glass surface.
- Added the required no-support fallback and reduced-transparency treatment.
- Removed blur from terrain controls, HUD chips, view pills, orbit hints,
  loading masks and the full modal backdrop because they overlap the live
  canvas.
- Allowed the top toolbar to use blur because it occupies a separate layout
  row.
- Gated modal, popover and floating telemetry blur behind
  `body.kodro-sim-idle`.
- Requested an engine-track change to pause the viewport loop and expose that
  class while floating surfaces are open.

## Front door

- Kept all four routes and `z-index: 4300`.
- Made Learn to code the first and visually primary route.
- Gave each route a coherent hand-authored icon, plain description and visible
  next action.
- Kept the offline, account and local-storage promises visible.
- Kept the simulation boundary visible in the footer.
- Added responsive one-column and two-column arrangements.
- Captured the real rebuilt page at 1440 by 1050 for the README.

Visual regression notes:

- At 1440 px, all four routes fit on one row with complete descriptions.
- The first card has a visible keyboard focus ring in the capture.
- The title, mark and card text remain clear against the default dark theme.
- The 900 px breakpoint removes the decorative mark panel to give text and
  actions priority.
- The 600 px breakpoint uses one card per row.
- The 360 px rule reduces outer padding and hides only the secondary brand
  descriptor.

## Teacher and pupil documentation

- Added a four-block scheme of work covering all 18 shipped lessons.
- Presented the seven source-labelled KS4 stretch lessons as extension or
  bridge material rather than core KS3.
- Added four printable block worksheets with tasks, planning space and
  vocabulary.
- Added a one-page first-lesson card.
- Added a teacher answer key with all 18 `solution_code` blocks.
- Compared the answer key to every YAML file programmatically. Result:
  18 answer blocks matched 18 YAML fields exactly.
- Updated Getting started to describe the four current front-door routes.
- Extended the pupil API cheatsheet with route planning and debugging prompts.

## README

- Reordered the first screen around what Kodro is, a direct live link, a real
  screenshot and the four choices.
- Added a short first-lesson path and direct teacher-resource links.
- Kept the existing honesty disclosures, measured quality text, benchmark
  figures, architecture and installation material.
- Moved the earlier captures under More screenshots.

## Verification so far

After the first visual implementation:

```text
wrote bundle.js (1335998 bytes) from 43 sources
PASS contrast + responsive: 61 passed, 0 failed (over 10 themes)
QA_WEB: 5/5 checks passed
```

The generated bundle contains both tracks' current source state and remains
unstaged until the shared-worktree commit boundary is safe.

## Open cross-track items

See `REQUESTS_FOR_CLAUDE.md`:

1. Replace the engine-owned `ORBIT_SVG` with the routed K.
2. Pause the live render loop and expose `body.kodro-sim-idle` while glass
   surfaces float over the viewport.

## Final gate status

Pending the required unit, static, paint, layout and modal runs.
