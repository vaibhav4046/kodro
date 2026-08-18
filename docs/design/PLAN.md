# Kodro visual identity and teacher documentation plan

Prepared 27 July 2026 for the parallel design track.

## Boundaries

- Edit only the design-track files listed in `docs/design/OWNERSHIP.md`.
- Do not hand-edit `bundle.js`. Rebuild it with `node scripts/build_web.cjs`.
- Do not stage or alter the engine-track changes already present in the shared worktree.
- Put any required engine-track change in `docs/design/REQUESTS_FROM_DESIGN.md`.

## Design direction

Kodro should feel like a capable making tool for a classroom, not a developer dashboard and not a toy. The identity will combine two ideas:

1. A route that becomes the letter K, representing code becoming movement.
2. A compact rover wheel or sensor node, representing the physical machine at the end of that route.

The mark will be hand-authored SVG with a reduced one-colour form that remains recognisable at 16 px. The primary palette will retain the existing dark navy, warm paper and teal foundation so the ten shipped themes keep their tested contrast relationships. A warmer yellow accent will be used sparingly for wayfinding and classroom energy.

Icons will use a 24 by 24 grid, 1.75 px rounded strokes, a 2 px optical margin and the same small circular node used by the brand mark.

## Work order

### 1. Tokens

- Add shared colour, spacing, border, shadow, motion and glass tokens.
- Preserve the existing public token names used by all ten themes.
- Add solid fallbacks for glass surfaces.
- Add reduced-transparency and reduced-motion treatment.

### 2. Mark and icons

- Replace `icon.svg` with the new Kodro mark.
- Keep the manifest on the scalable SVG icon unless generated local PNG assets can be added without a new dependency.
- Update the in-app and onboarding mark so all brand touchpoints agree.
- Redraw the inline icon registry as one coherent family without changing icon names.

### 3. Glass surfaces

- Apply blur only to floating, non-reading surfaces such as modals, menus, the mission toolbar and the telemetry drawer.
- Keep the world controls over a live canvas opaque while animation is active.
- Use an `@supports not (backdrop-filter: blur(1px))` solid fallback.
- Disable blur under `prefers-reduced-transparency`.

### 4. Front door

- Keep all four doors and the required `z-index: 4300`.
- Make the primary learning route immediately obvious.
- Give each door its own hand-authored line illustration while keeping the text honest.
- Make the offline and privacy promise visible without competing with the main action.
- Verify the composition at 320 px and on a short classroom projector.

### 5. Teacher and pupil documentation

- Arrange the real 18 YAML lessons into practical KS2 and KS3 half-term blocks.
- State where KS1 entry work and KS4 stretch lessons fit without inventing new lessons.
- Create printable block worksheets with planning space and vocabulary from the lesson YAML.
- Copy every answer exactly from `solution_code`.
- Create a one-page first-lesson card.
- Extend existing accurate documentation through links rather than contradicting it.

### 6. README

- Lead with what Kodro is, who it is for, a real screenshot and a direct try link.
- Keep every current factual claim and every honesty disclosure.
- Move deep technical and research material below the first-use path.
- Do not introduce any unmeasured figure.

## Verification

Run the required fast gates after implementation:

```text
node scripts/build_web.cjs
node scripts/qa_contrast.mjs
node scripts/qa_web.mjs
python -m pytest tests/unit/test_web_jsx_valid.py tests/unit/test_a11y.py -q
```

Run the final static and browser gates before the final push:

```text
node scripts/build_web.cjs --static
node scripts/qa_ui.mjs --suite=paint
node scripts/qa_ui.mjs --suite=layout
node scripts/qa_ui.mjs --suite=modals
```

Record measured outcomes and any blocked work in `docs/design/NIGHT_LOG.md`.
