# Kodro: Master Handoff for the Next Agent

> Paste this whole file as the first message of a fresh Claude Code (ultracode)
> session. It is self contained: the product, where it lives, the exact current
> state, the hard constraints, how to verify, the multi agent orchestration to
> use, and the remaining work to make Kodro a genuine winner. Read it fully
> before touching anything. Verify against git and the working tree before
> acting, because the prior agent already did a lot.

---

## 0. Who I am and the non negotiable rules (never violate)

- I am Vaibhav Lalwani, MSc Computer Science honours year, University of
  Liverpool, module COMP702. Kodro is my dissertation project.
- No fabricated scores. Never write "10/10" or "100" or invent a marker grade.
  The honest measured marker grade is a strong A (about 74 to 78). A higher band
  needs real empirical data from a human study that has not been run.
- No fake testing, no fake user studies, no fake citations, no fabricated
  results anywhere, especially in the dissertation.
- Hard offline constraint: zero paid services, zero cloud API calls, zero
  accounts, zero model weight retraining. "Self refining" means system level
  localStorage reflection and a skill library, honestly framed, not model
  weight updates.
- Writing style for any prose deliverable: organic, blunt, concrete. No em
  dashes and no en dashes. Use "to" for ranges.
- Production quality procedural Python and clean JS. No shortcuts, no stubs left
  behind. When something is verified, say so with the evidence. When a test
  fails, quote it.
- Cost discipline. The previous session cost over 1400 US dollars by iterating
  live in the browser one tweak at a time. Do not repeat that. Verify logic
  cheaply first (headless Node smoke tests, build, the QA harness), batch edits,
  and only open the browser to confirm a finished change, not to probe.

---

## 1. What Kodro is

Kodro is an offline desktop robot design and simulation platform for a capable
non expert adult. The loop is: design a custom robot, program it in Python,
blocks or voice with a grounded local AI assistant and a code reviewer, validate
its behaviour in a realistic simulated world, and let the system self refine
from accumulated use. It runs entirely on one laptop with no account and no
cloud. It is not a kids coding toy and it does not claim to replace Isaac Sim,
Gazebo, Webots or MuJoCo.

The robot the user assembles drives the simulation, so changing the build
changes the behaviour: a heavier robot accelerates slower and drains battery
faster, a stronger motor lifts top speed, and a sensor that is not fitted
withholds its command from every way of programming the robot.

---

## 2. Where everything lives

- Project root: `D:\project\robolearn` (Windows 11, PowerShell and Bash both
  available).
- GitHub: https://github.com/vaibhav4046/robolearn (remote `origin`). Branches
  `main` and `kodro-identity-pass` are both at the latest commit. There is also
  a `gitlab` remote.
- Web app source (vendored React and Three.js r137, precompiled offline, no
  build server), all under `src/robolearn/assets/web/`:
  - `app.jsx` main App: editor, run pump, telemetry, panels, the EXAMPLES
    (basecamp, autopilot, etc.), the world picker, the quality selector.
  - `interpreter.js` Python subset interpreter. `window.RoverLang.compile(src)
    .run(host)` yields motion and sensor events.
  - `Viewport3D.jsx` Three.js scene: per world ground and sky, lights, the robot
    model, the natural motion tick, sensor attachments, the orbit and first
    person cameras, the performance tiers.
  - `terrains.jsx` the terrain catalogue and SITES presets (city, room, earth,
    mars, underwater, space, plus mission sites and the new lab, warehouse,
    debug_grid). `window.resolveSite` merges a site onto its base.
  - `RobotLab.jsx` the parts catalogue, `derive()` (mass, speed, runtime,
    commands), `WORLD_FOR`, `window.KodroCommands` (the single command registry),
    `window.getKodroRobot()`, `window.KodroRobotFromText` (the onboarding agent
    mapper), `applySpec`, `buildFromText`.
  - `scenario.jsx` `window.KodroScenario`: seeded domain randomised multi seed
    validation, persists to localStorage and SQLite.
  - `realism.jsx` `window.KodroRealism`: the realism dashboard cards.
  - `demo.jsx` `window.KodroDemo`: the guided realism demo.
  - `memory.jsx` `window.KodroMemory`: reflections, skills, scenario reports.
  - `agents.jsx` `window.KodroAgents`: city traffic and pedestrians.
  - `bridge.js` host bridge (`window.RoboLearn`), `sound.js`, `bundle.js` (the
    built artifact, 17 modules). Rebuild after any `.jsx` edit with
    `node scripts/build_web.cjs`. The ORDER array in that script sets module
    load order.
- Python engine and API: `src/robolearn/engine/`, `rover_api.py`, the SQLite
  store at `src/robolearn/memory/store.py` (now has a `scenario_runs` table),
  the pywebview bridge at `src/robolearn/web/app.py` (BridgeAPI, with
  `save_scenario_run`, `set_ai_model`, the Ollama model pick).
- Tests: `tests/` (854 passing). Dissertation: `docs/dissertation/
  Kodro_Dissertation.tex` and `.pdf` (35 pages, compiled offline with the
  vendored tectonic at `.tools/tectonic.exe`). Living plan and status:
  `docs/UPGRADE_AND_DISSERTATION_PLAN.md`, `docs/implementation-status.md`,
  `docs/known-limitations.md`, `docs/realism-system.md`.

---

## 3. Current state, what the prior agent already did (do not redo blindly)

All verified, committed and pushed (latest `main` around commit `7927886`):

- Robot specification as the single source of truth, with a command registry
  (`KodroCommands`) that gates every sensor command across text, blocks, voice
  and the assistant, with a readable refusal when a part is missing.
- Movement dynamics: mass scaled acceleration, cruise, braking and momentum
  carry over, with exact move endpoints so collisions and distances are
  unchanged and the interpreter QA still passes.
- Scenario validation with domain randomisation, persisted to localStorage and
  to SQLite (`Store.save_scenario_run`, tested).
- Ollama model picker (pick any installed local model, persisted), onboarding
  agent (natural language to a validated robot spec), realism dashboard, guided
  demo.
- A visual pass: the 3D ground and rocks now derive their colour from each
  site's palette (the Sahara renders sandy, not green), deeper lighting, the
  robot scaled up with visible sensor pods, foliage harmonised to the biome,
  environment presets (lab, warehouse, debug grid), a Low to Cinematic quality
  toggle, and the first person camera.
- Bug fixes: the default example is the sense think act autopilot, a build with
  no sensors is floored to ultrasonic plus IMU so it can sense, a custom build
  recommends open terrain not the traffic city, and the `getKodroRobot`
  fallback no longer drops the recommended world.
- The dissertation: 35 page LaTeX with the University of Liverpool logo, real
  references, the AI disclosure, compiled offline.

Verification last measured: 854 pytest passing, interpreter QA 21 of 21, bundle
fresh, zero console errors on load, and a live in browser smoke test of 14
modules and 11 feature areas with zero errors.

---

## 4. The honest ceiling and the one big remaining lever

The renderer is core Three.js procedural geometry: boxes, cylinders, spheres,
extruded shapes and canvas textures, with an environment map, shadow maps and
tone mapping. There is no glTF or URDF asset loader and no post processing. This
is by design (offline, no asset pipeline), and it is why the look reads as clean
low poly rather than photoreal. The prior agent improved the coherence a lot but
could not cross into AAA fidelity, because that is an architecture change, not a
polish pass.

The single biggest lever to make Kodro a visual winner is a real asset and
shading upgrade, done without breaking the offline guarantee:

1. A vendored glTF or GLB loader (Three.js GLTFLoader, copied into `vendor/`,
   no CDN) and a small set of hand made or generated low poly but well shaded
   models: a believable rover, a humanoid, a few props, kept tiny so the app
   stays offline and fast.
2. An optional, measured post processing chain (a light SSAO or bloom pass),
   gated behind the Cinematic quality tier and `prefers-reduced-motion`, so the
   Low tier stays smooth on a laptop with no discrete graphics card.
3. Textured terrain (baked canvas or small vendored textures) so the ground
   reads as real sand, concrete, grass, rather than a flat colour with a noise
   overlay.
4. Better robot articulation: wheels that steer and compress on suspension,
   visible fitted sensors that clearly map to the spec.

Everything above must stay offline, must keep the bundle small, and must not
regress the interpreter QA (which uses its own kinematics, independent of the
viewport) or the pytest suite. Label anything not yet real as roadmap in
`docs/known-limitations.md`.

The other remaining real item, recorded honestly, is the human user study in
`HUMAN_TODO.md`. Only a human can run it. Do not fabricate its results.

---

## 5. How to verify (do this, do not assert)

```
cd D:\project\robolearn
node scripts/build_web.cjs        # rebuild bundle.js after any .jsx edit
node scripts/qa_interpreter.mjs   # interpreter and kinematics QA, expect 21/21
python -m pytest -q --no-cov      # Python engine, expect 854 passed
.tools\tectonic.exe docs\dissertation\Kodro_Dissertation.tex --outdir _build  # dissertation PDF
```

Headless logic verification is cheap and should be your default. Load the real
modules in Node with a fake window (see how `scripts/qa_interpreter.mjs` and the
prior smoke tests do it) and assert behaviour, rather than opening a browser for
every change.

Live browser verification uses the claude in chrome MCP. Start the app with
`python scripts/demo.py` (serves http://localhost:8080), connect to the user's
Chrome (`list_connected_browsers`, `select_browser`), navigate, and screenshot
or run `javascript_tool` smoke tests in the page. Important caveat learned the
hard way: the single thread `http.server` plus heavy WebGL can freeze the
renderer under rapid reloads. Wait a few seconds between reloads, do not hammer
it, and restart the server if a screenshot times out. Prefer one screenshot of a
finished change over many probing ones.

---

## 6. Multi agent orchestration (ultracode is on, use the Workflow tool)

With ultracode on, author and run a Workflow for every substantive phase. The
Workflow tool runs many small fast subagents deterministically. Rules that
matter:

- Default to `pipeline(items, stage1, stage2, ...)`: each item flows through all
  stages with no barrier, so wall clock is the slowest single chain, not the sum
  of stages.
- Use `parallel(thunks)` only when a stage genuinely needs all prior results at
  once (dedup, merge, early exit on zero findings). A thunk that throws resolves
  to null, so filter Boolean before using results.
- Use `agent(prompt, {schema, label, phase, isolation})`. Pass a JSON schema to
  force structured output. Use `isolation: 'worktree'` only when agents mutate
  files in parallel and would conflict.
- Adversarially verify. For any finding or fix, spawn two or three independent
  skeptics prompted to refute it, and keep it only if a majority cannot.
- Loop until dry for open ended discovery (bugs, edge cases): keep spawning
  finders until two consecutive rounds find nothing new, deduping against
  everything seen so far, not just what was confirmed.

Concrete workflows worth running here, in order:

1. Asset pipeline build (the winner lever). Phase one: research the offline
   glTF loader vendoring and a tiny model set. Phase two pipeline: one agent per
   asset (rover model, humanoid, props, terrain textures, optional post process
   pass), each producing code plus a self check. Phase three: integrate into
   `Viewport3D.jsx` behind the quality tiers, rebuild, and verify in the browser
   with one screenshot per world. Keep it offline and small.
2. Exhaustive bug and UX review. Dimensions: first run experience, command
   gating, movement, validation, dashboard, demo, blocks, voice, accessibility,
   performance, mobile at 375px. Pipeline each dimension: find, then
   adversarially verify each finding, then fix, then re verify in the browser.
3. Dissertation deepening. Grow the LaTeX toward the 50 page cap with grounded
   chapters only, no fabricated data or citations, recompile with tectonic,
   keep zero em and en dashes.

Scale the fan out to the task. Do not chase every future integration. Make the
current Kodro feel real, premium, offline, safe, and academically defensible,
and prove every claim.

---

## 7. Git and shipping workflow

- Work on `kodro-identity-pass`, then fast forward `main` to it and push both:
  `git push origin kodro-identity-pass`, then `git push origin
  kodro-identity-pass:main`, then `git branch -f main HEAD`. Both refs should
  end at the same commit.
- Conventional commit messages (feat, fix, docs, chore). Attribution is disabled
  in this user's config, so do not add a Co-Authored-By trailer.
- A GateGuard hook will ask for facts before the first Bash and before editing
  or creating each file. Present the four facts (callers, affected API, data
  schema, the verbatim instruction) and retry. To remove the friction for a long
  session, the user can start with `ECC_GATEGUARD=off`.

---

## 8. One line kickoff for the new session

> Read docs/HANDOFF_NEXT_AGENT.md fully. Then, using multi agent Workflows and
> adversarial verification, take Kodro to a genuine winner: build the offline
> glTF asset and shading upgrade behind the quality tiers without breaking the
> offline guarantee or the 21/21 interpreter QA and 854 pytest, run an
> exhaustive bug and UX review with browser proof, and deepen the dissertation
> with grounded content only. Respect every rule in section 0. Never fake a
> score or a result. Verify everything, quote the evidence, and ship to main.

---

## 9. Update after the shading, bug-review and dissertation pass (2026-06-20)

Shipped to `main` and `kodro-identity-pass` (both at the same commit, pushed to
`origin`). Verified each step rather than asserted.

What changed:

- Shading upgrade (offline, behind the quality tiers). Two new modules:
  `textures.jsx` (`KodroTextures.groundMaps`) adds a tileable Sobel-derived
  normal map plus a roughness map to open-terrain ground; `post.jsx`
  (`KodroPost.create`) is a hand-written bloom plus vignette at the Cinematic
  tier, composited additively over the unchanged base render, gated and
  degrading gracefully (off under reduced motion, off after the slow-GPU
  downgrade, dropped on target-allocation or frame-time failure). No new
  vendored binary, no network.
- The glTF lever is recorded as honest roadmap, not shipped: neither a loader
  nor good models are obtainable under the zero-network rule in this
  environment. The real offline win was procedural relief plus the gated post
  pass. Documented in `docs/known-limitations.md`.
- Exhaustive bug and UX review (multi-agent find then adversarial verify across
  first run, command gating, movement, accessibility, performance and mobile).
  Every confirmed critical and high was fixed and re-verified, the visual ones
  in a headless Chrome SwiftShader capture (`docs/img/audit/*`): the mission-site
  crash, the 90-degree 3D rover/FPV heading, the arm first-run failure, the
  phantom-command catalogue (now reconciled so only `distance()` and `heading()`
  are advertised and gated), the reduced-motion tunnelling, plus accessibility
  (slider name, telemetry live region, contrast) and the 375px toolbar.
- Dissertation: corrected the now-false "no post-processing" claims, added a
  grounded implementation section on the offline shading and a grounded note on
  the adversarial review. Recompiled with tectonic: 36 pages, zero em/en dashes.

The medium and low review items are now also cleared (commit `8f38c93`):
in-place Low/Med/High quality switching (no scene rebuild), hidden-tab rAF
gating in both loops, live prefers-reduced-motion in the 3D view, a visible
3D-canvas keyboard hint with focus-on-open, exact out-of-charge halt and
odometer, the default world following the build, honest scenario gating on a
missing build, a non-silent onboarding build error, and forced-colors
fallbacks. The out-of-charge endpoint finding turned out to already be
correct in the code; it was left as-is. The human user study in
`HUMAN_TODO.md` remains the one thing only a human can run; do not fabricate
its results.

Verification last measured: build 19 sources, interpreter QA 21/21, headless
bundle-eval 3/3, gating assertions 7/7, full pytest 854 collected (852 to 854
pass with 0 to 2 Tk GUI tests skipped depending on whether this Python's Tcl
initialises that run; zero failures).
