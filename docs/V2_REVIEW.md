# Kodro v2.0 (v2.0.0) — Panel Review

**Chair:** synthesis + independent re-verification of all six dimensions.
**Scope:** research / review only. No code was changed, nothing was committed.
Evidence is drawn from direct source quotes, the four QA suites, a full `pytest`
run, and standalone reproductions of the two physics-honesty defects computed
against the shipped constant table and the shipped `Reference Rover` fixture.

---

## Overall verdict

**Panel average: 0.75 / 1.00.**

Kodro v2.0 is a coherent, honesty-forward product with a closed
spec -> sim -> report -> refine loop and a genuinely disciplined three-tier
fidelity disclosure. The core mission — a skeptical builder imports a real KRS
spec and sees derived-from-hardware behaviour — is real and mostly well-built.

But this panel is harsher than the previous pass in the two dimensions it
scored, and it is right to be. Two of the flagship *honesty* surfaces are
broken in ways that cut directly against the product's one differentiating
promise:

1. **Slow robots are simulated FASTER than their real top speed, and the number
   is still stamped "HONOURED"** — with warning copy that is literally false.
   This is not a rounding issue: a 60-rpm / 3-cm-wheel educational rover
   (0.19 m/s real) is simulated at 0.94 m/s — **5x too fast** — under a green
   "honoured" badge.
2. **The predictive "Design Check" and the physics engine that actually drives
   the sim use two different, contradicting mobility models.** On the *shipped
   Reference Rover fixture* the Design Check says "WON'T COPE — slips and
   stalls" while the engine drives it fine. The two headline surfaces disagree
   by ~7x on the demo robot.

Both are confirmed by standalone reproduction below. On top of that, the React
layer is a single 2305-line God component with zero memoisation and no lint
gate, and the celebrated "JS/Python parity" only covers *catalogue* mode — the
Python grader ignores the imported spec entirely.

**A literal 1.00 is not a claimable target.** No non-trivial software is
defect-free, and this review found real, reproducible defects in five of six
dimensions, including two HIGH honesty defects. The chair explicitly rejects
any 1.00 or fabricated-perfect claim. The **honest ceiling for the current
build is ~0.90**, reachable only after the two physics-honesty HIGH items are
fixed. The true ceiling of the *thesis* (that a skeptical builder trusts the
honest-fidelity sim) cannot be established from code review at all — it depends
on the human persona study, **which has not yet been run.** Do not report a
study result that does not exist.

---

## Per-dimension scores

| Dimension | Score | Chair status | One-line basis |
|---|---|---|---|
| runtime-bugs | **0.88** | scored by chair (panel left undefined) | Interpreter 145/145 green; product QA green when serial; no product crash. Held down by an order-/timing-dependent GUI test group and known Python-subset interpreter gaps. |
| react-quality | **0.52** | adopted from panel | 2305-line `App()`, 131 `use*()` calls (69 `useState` + 29 `useRef` + 28 `useEffect`), **zero** `useMemo`/`useCallback`; no ESLint anywhere; vibe-chat cancel race; index-keyed reorderable list; 6 dead icons. |
| product-ux | **0.90** | scored by chair (panel left undefined) | Closed, internally-consistent studio; honest copy end to end; only Run-feedback affordance + toolbar-density nits. |
| realism-worlds | **0.82** | scored by chair (panel left undefined) | 6 worlds + 17 sites render with honest physics; 3 marquee sites (Giza, Olympus Mons, Antarctica) fail to deliver headline identity in the default frame. |
| mission-fidelity | **0.62** | adopted from panel | KRS import loop is real and mostly accurate, but the slow-robot speed lie + Design-Check/engine contradiction directly damage the "trust me" thesis, and physical-mode fidelity is JS-only. |
| dissertation-ready | **0.78** | scored by chair (panel left undefined) | Docs are strong and honest; the flaky/skip-prone GUI test group threatens the "pytest passing" evidence a dissertation would cite. |

Average = (0.88 + 0.52 + 0.90 + 0.82 + 0.62 + 0.78) / 6 = **0.753 → 0.75**.

---

## Verification notes (what the chair re-checked and how)

- **Interpreter QA:** `node scripts/qa_interpreter.mjs` -> **145 passed, 0 failed**.
- **pytest:** full `python -m pytest -q --no-cov` on the chair's machine ->
  **864 passed, 2 skipped, 0 failed** in 66 s. The Tk-dependent GUI tests
  *skipped* cleanly here because Tk is unavailable (`init.tcl` not found). The
  prior chair pass, on a box where Tk *was* partly available, saw the same
  tests **flake red** under full-suite load. The failure mode is therefore
  environment- and timing-dependent, not deterministic — which is exactly the
  dissertation-readiness risk (H3): a marker with a working Tk can see red.
- **No lint gate:** `ls .eslintrc* eslint.config.* package.json` -> all "No such
  file". Confirmed at repo root and under `assets/web`.
- **God component:** `wc -l app.jsx` -> **2305**; `grep -c` -> 69 `useState`,
  29 `useRef`, 28 `useEffect`; `grep -cE "useMemo|useCallback"` in
  `app.jsx`/`hooks.jsx`/`panels.jsx` -> only the single dead `useCallback`
  import.
- **Speed-honesty (H1):** standalone node repro against the shipped constants
  (`baseSpeedCmPerS 312.5`, `physSpeedFactorLo 0.3`): a 60-rpm / 3.0-cm rover
  has real `vMax` 0.188 m/s but `physSpeedFactor` floors at 0.3, so the sim
  runs it at `312.5 * 0.3 = 93.75 cm/s = 0.938 m/s` (**4.97x**), the warning
  branch (`specschema.js:357`) fires, the copy says "0.19 m/s **exceeds** the
  simulable band" (false — it is *below*), and `badges.topSpeed = 'honoured'`
  is still set (`specschema.js:363`).
- **Design-Check contradiction (H2):** the Design Check computes mobility at
  `diagnostics.jsx:55` as the *catalogue proxy* `(speedFactor*traction)/massFactor`;
  the live tick computes it at `app.jsx:1015-1017` as *force-ratio*
  `physMobility(stallForceN, massKg, traction, g)`. Fed the shipped
  `Reference Rover` (massKg 1.2, wheelRadius 3.25 cm, 300 rpm, 0.35 N*m, 2
  motors): Design Check `catMob` = **0.24** (city) / **0.18** (earth) →
  **FAIL "WON'T COPE"**, while the tick's `physMob` = **1.79** / **1.35** →
  drives comfortably (stall band is 0.45). Matches the panel's cited
  "0.245 vs 1.83" to the third digit.
- **Python engine scope:** `engine/motion_model.py` exposes only
  `gravity_factor`, `mobility_score`, `move_drain_pct`, `turn_drain_pct`,
  `segment_circle_hit` — **none** of the `phys*` closed forms and **no**
  `sensor_pose`. `rover_api.py` never reads `massKg`/`stallTorque`/`rpm`/
  battery/mount. `sensors.py` `lidar_distance`/`ultrasonic_distance` use fixed
  module constants and ray from the rover centre, ignoring the imported
  `rangeCm` and mount offset. The E-C4 hash matches only because the *constant
  table* is mirrored — the *formulas* are not.

---

## Prioritized confirmed-defect list

No CRITICAL (data-loss / security / crash) defect was found. The two HIGH items
are honesty defects: the sim tells the user a false thing about a real build.

### HIGH

**H1 — Slow robots are simulated FASTER than their real top speed, still badged
"HONOURED", with false warning copy.**
- **File:** `src/robolearn/assets/web/specschema.js:355-363`. The floor is
  `physSpeedFactorLo: 0.3` at `motion-model.js:75`;
  `physSpeedFactor` clamps at `motion-model.js:129-131`.
- **Evidence:** any build whose motor-derived `vMax` is below
  `0.3 * 312.5 = 93.75 cm/s` (0.9375 m/s) — a large fraction of realistic
  educational/hobby rovers (60-200 rpm on small wheels) — gets clamped UP to
  0.9375 m/s. The warning at line 358 reads "Top speed 0.19 m/s **exceeds** the
  simulable band; simulated at 0.94 m/s" — the direction word is wrong (it is
  *below* the band and sped *up*), and `out.badges.topSpeed = 'honoured'`
  (line 363) is set unconditionally. Repro: 60 rpm / 3 cm -> 0.19 m/s real,
  0.94 m/s simulated, **4.97x**; 30 rpm / 3 cm -> **9.95x**.
- **Why it matters:** this is the exact failure the whole product is meant to
  prevent — a builder is shown a distorted number under a green "trust this"
  badge. It poisons the thesis on precisely the slow, cheap robots a student is
  most likely to import.
- **Fix:** when `vMax` is below the floor, either (a) drop the *display* lower
  clamp and scale sim time instead so the rover actually crawls at real speed,
  or (b) set `out.badges.topSpeed = 'approximated'` and rewrite the copy to the
  truth: `Top speed 0.19 m/s is below the simulable floor; simulated FASTER at
  0.94 m/s.` Never label a number "honoured" when the sim runs a different
  value. Add a golden case at the floor boundary.

**H2 — The Design Check verdict contradicts the physics engine on the same
imported build, including the shipped Reference Rover.**
- **Files:** predictive check mobility at
  `src/robolearn/assets/web/diagnostics.jsx:55` (uses catalogue proxy
  `mobilityScore(speedFactor, massFactor, traction)`); live-tick mobility at
  `src/robolearn/assets/web/app.jsx:1015-1017` (uses `physMobility`).
- **Evidence:** shipped `Reference Rover` -> Design Check `catMob` 0.18-0.24
  → **FAIL "Underpowered... it slips and stalls"** (`diagnostics.jsx:60-63`),
  while the tick's `physMob` 1.35-1.79 sails past the 0.45 stall band and drives
  fine (`app.jsx:1021-1040`, `motion-model.js:142-144`). The two headline
  honesty surfaces disagree by ~7x on the flagship demo robot.
- **Why it matters:** the predictive "Design Check" is sold as the honest
  before-you-run verdict; when it flatly disagrees with what then happens on
  screen, the credibility of both surfaces collapses — and it does so on the
  one robot every demo and screenshot uses.
- **Fix:** when `robot.phys.stallForceN` is present, drive the Design Check's
  mobility dimension from `physMobility` / `physStallVerdict` (the same model
  the tick uses) instead of the parts proxy, so prediction and simulation agree.
  Keep the catalogue proxy only for catalogue (non-physical) builds.

### MEDIUM

**M1 — Physical / KRS simulation is JavaScript-only; the Python engine (grader +
`rover_api`) ignores the imported spec, so "JS/Python parity" covers catalogue
mode only.**
- **Files:** `src/robolearn/engine/motion_model.py` (no `phys*` functions, no
  `sensor_pose`); `src/robolearn/rover_api.py` (no `massKg`/`rpm`/battery/mount
  awareness); `src/robolearn/engine/sensors.py:65-107` (fixed-range rays from
  centre).
- **Evidence:** the JS `motion-model.js` has 12 `phys*` closed forms +
  `sensorPose`; the Python twin has none of them. The E-C4 conformance hash
  passes only because the *constant table* is mirrored, not the formulas.
- **Why it matters:** a reader who trusts "the two engines are hash-locked" will
  wrongly believe an imported build is graded with the same measured physics in
  Python. It is not — Python simulates every import as a generic catalogue
  rover.
- **Fix:** either (a) port the `phys*` formulas + `sensorPose` to
  `motion_model.py` and add a physical-spec golden-trace case, or (b) explicitly
  disclose in `docs/known-limitations.md` and the FIDELITY copy that
  measured-build fidelity is the JS studio only.

**M2 — FIDELITY "Sensor mount pose / range (HONOURED)" and "motor-derived top
speed (HONOURED)" overclaim: honoured in JS only, not in the Python sensor
model.**
- **Files:** `docs/known-limitations.md:143-144` ("HONOURED: ... motor-derived
  top speed ... sensor mount pose and range"); `specschema.js:66-69, 94-95`.
- **Evidence:** `sensors.py` `read_distance`/`ultrasonic_distance` ignore the
  imported `rangeCm` and the mount offset entirely; `sensorPose` exists only in
  JS.
- **Fix:** scope the honoured[] sensor and top-speed lines to the studio sim, or
  wire `sensorPose` + imported `rangeCm` into `engine/sensors.py` so
  `read_distance` honours the mount geometry the badge promises.

**M3 — No lint gate exists for the entire vendored-React frontend.**
- **Files:** repo root — no `package.json`, `.eslintrc*`, or `eslint.config.*`.
- **Evidence:** `ls .eslintrc* eslint.config.* package.json` -> all "No such
  file".
- **Why it matters:** the index-key bug (M6), the dead `useCallback` import
  (L2) and the dead icons (L4) would all be caught for free by
  `eslint-plugin-react` + `react-hooks`, and any future rules-of-hooks
  regression ships silently.
- **Fix:** add a dev-only `package.json` + flat ESLint config with `react`,
  `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`, and
  `no-unused-vars`, run over `assets/web/*.jsx` in CI. Build-time only — does not
  touch the offline runtime.

**M4 — `App()` is a 2305-line God component owning ~126 state/ref/effect
bindings with zero memoisation.**
- **File:** `src/robolearn/assets/web/app.jsx` (whole component).
- **Evidence:** 2305 lines; 69 `useState` + 29 `useRef` + 28 `useEffect`; 131
  total `use*()` calls; 0 `useMemo`; 0 `useCallback` (the one match is the dead
  import).
- **Why it matters:** unreviewable surface area; every state write re-renders
  the whole chrome. Real engineering debt, not a nitpick — it would not pass a
  well-maintained React shop without a refactor pass.
- **Fix:** continue the extraction begun in `hooks.jsx`/`panels.jsx`. Pull the
  run/animation engine (`advance`/`animateMove`/`animateTurn`/`pumpLoop`/
  `collisionAt`/`rayDistance`) into a `useSimEngine` hook; pull the
  vibe/swarm/ask/teacher async handlers into dedicated hooks; leave `App` as JSX
  composition + hook wiring. Wrap `Viewport3D`/`Telemetry`/panels in
  `React.memo` and memoise the terrain derivation (L1).

### LOW

**L1 — Terrain is re-derived (incl. O(n^2) obstacle rejection-sampling for
mission sites) on every render, unmemoised, at animation-frame cadence during a
run.**
- **Files:** `app.jsx:91-93` (`resolveSite(terrainId)` + `applyTod(...)` in the
  render body); `resolveSite` -> `genObstacles` at `terrains.jsx:429-442`;
  `genObstacles` is an O(n^2) rejection loop at `terrains.jsx:21-38`.
- **Evidence:** for a mission site, `resolveSite` calls
  `genObstacles(seed, count, ...)` fresh on every render; base terrains are
  cached in the static table so this is scoped to sites. Counts are small
  (14-17), so impact is bounded → LOW.
- **Fix:** `useMemo(() => applyTod(resolveSite(terrainId), tod, weather),
  [terrainId, tod, weather])` so the derivation only re-runs when the world
  actually changes, not on every rover-position render.

**L2 — Vibe-chat cancel does not stop an in-flight `chatPoll` from committing
state after the panel is closed.**
- **File:** `src/robolearn/assets/web/app.jsx:526-541`.
- **Evidence:** the poll loop checks `vibeCancelRef.current` *before* the
  `await chatPoll` (line 528) but not *after* it resolves (line 529-530); the
  resolved result then falls through to `setVibeLive`/`setVibeMsgs`/
  `setVibeError` (lines 532, 534-541) even if the user cancelled during the
  await. Impact is bounded (state on a closed modal) → LOW.
- **Fix:** immediately after the `await chatPoll` resolves, re-check
  `if (vibeCancelRef.current) { setVibeBusy(false); return; }` before touching
  any state.

**L3 (was M6) — Reorderable / removable Blocks list is keyed by array index.**
- **File:** `src/robolearn/assets/web/panels.jsx:547-548` —
  `blocks.map((b, i) => <div key={i}>`; reordered by `moveBlock` and mutated by
  `removeBlock` (`hooks.jsx:144-156`).
- **Evidence:** the row holds a controlled `<input value={b.val}>`
  (`panels.jsx:551-552`); on reorder/delete, DOM focus/selection and any
  in-flight keystroke can attach to the wrong row. Bounded because `value` is
  prop-driven → LOW.
- **Fix:** assign a stable id at `addBlock` (`hooks.jsx:138`) and key on `b.id`.

**L4 — Dead `useCallback` import.**
- **File:** `src/robolearn/assets/web/app.jsx:5` — destructured, never used.
- **Fix:** remove it, or start using it for handlers passed to memoised children
  when M4 lands.

**L5 — Six registered-but-unused SVG icons: `award`, `globe`, `next`, `open`,
`save`, `undo`.**
- **File:** `src/robolearn/assets/web/icons.jsx`.
- **Evidence:** each defined exactly once in `icons.jsx`, referenced zero times
  anywhere else in the bundle.
- **Fix:** remove them, or wire the clearly-intended ones (`save`/`open` look
  meant for the project-file save/open buttons, which currently render without
  an icon).

### Carried from the prior chair pass (realism + dissertation risk)

**H3 — The GUI test group is non-deterministic (skips when Tk is missing, flakes
red when Tk is present under load).**
- **Files:** `tests/unit/test_app.py:66` (`_pump` spins a fixed wall-clock
  budget) and `:40-63` (module-scoped `MainWindow()` fixture that only
  `pytest.skip`s on `TclError` at build time).
- **Why it matters:** a dissertation that cites "pytest passing" is undermined
  the first time a marker with a working Tk runs the suite and sees red. Highest
  leverage for dissertation-readiness.
- **Fix:** drive the graded run to completion synchronously (await its terminal
  callback) instead of racing the Tk clock; tear the Tk root down between GUI
  test modules; guard the assert with a clear skip if Tk genuinely cannot
  schedule callbacks.

**M5 — Three marquee sites don't deliver headline identity in the default
frame.** (MEDIUM, user-visible)
- **Files:** `terrains.jsx:257` (Giza / `egypt`), `:337` (Olympus Mons /
  `olympus`), `:194` (Antarctica).
- **Evidence:** prior chair captures at `cap.html?site=egypt|olympus|antarctica&view=3d`
  — pyramids wash into the sky, no visible shield volcano, near-white void.
- **Fix:** lower fog-tint and raise/re-azimuth the hero landform so each site
  unmistakably reads as itself at first glance.

---

## What the chair explicitly rated as NOT defects

- **1200 g Robot-Lab spec vs 623 g header chip** — two different robots
  (imported Reference Rover, `massKg 1.2`, vs active default). Not a bug.
- **The E-C4 constant-hash conformance** — genuinely holds; the JS/Python drift
  it prevents is real and valuable. The gap is that it locks *constants*, not
  the physical-mode *formulas* (M1) — that is a scope disclosure issue, not a
  broken test.
- **Kinematic (not rigid-body) motion, flat worlds, procedural geometry** —
  permanent offline/procedural constraints, self-disclosed in
  `docs/known-limitations.md`. Not scored against.
- **Empty-dep-array effects using refs** (keyboard handler, run token latch) —
  deliberate and correct; the run/pause/reset token system is careful, sound
  engineering.

---

## Honest closing

The build is close to its practical ceiling on product coherence, world variety,
and disclosure discipline. What drags the panel from ~0.90 down to 0.75 is not
polish — it is **two honesty defects in the exact surfaces the product stakes
its credibility on**: a slow robot shown running 5x too fast under a green
"honoured" badge (H1), and a predictive verdict that flatly contradicts the sim
on the shipped demo robot (H2). Fix those two and the JS/Python scope disclosure
(M1), and the honest ceiling of ~0.90 is in reach. The remaining lift — the God
component behind a lint gate (M3+M4) and the three landmark sites (M5) — is
ordinary engineering and art debt.

Beyond ~0.90, the last tenth is a question the code cannot answer. It needs the
human persona study, **which has not been run.** Report that study honestly when
it exists; do not manufacture a 10/10.
