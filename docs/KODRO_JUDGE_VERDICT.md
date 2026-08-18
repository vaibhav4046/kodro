# Kodro: Independent Judge-Panel Verdict and Build Prompt

> **Superseded snapshot. Read as history, not as status.** This banner was
> measured on 15 August 2026 and pins its own figures the same way the body
> below pins its own. Every measurement,
> line number, score and priority below describes commit `541941d` on 11 July
> 2026. That commit is an ancestor of the current branch, and 26 later commits
> have touched `interpreter.js` and `hooks.jsx` alone, so the cited line numbers
> no longer point at the code they described. Four figures in the "state at
> `541941d`" block have since moved: the bundle builds from 47 sources not 36,
> `qa_interpreter.mjs` reports 180 passed not 163, and `pytest` reports 1638
> passed 1 skipped not 1039 passed 2 skipped. At least two priorities are
> closed: the interpreter now opens a child frame per user-function call
> (`interpreter.js:810` and `:1005`), and the market doc no longer says "no ROS
> export yet", a string that now survives only where this file quotes it. The
> remaining priorities were not re-audited, so do not read the list as open
> work, and do not read this floor of two as a count. Nothing in
> this file is a gate threshold. For current status use
> `docs/implementation-status.md` and the gate logs in `.kodro/ca2-evidence/`.
> The figures below are deliberately left as measured, because a dated
> evaluation records what was true on its date.

Evaluation performed against the live repository at `D:\project\robolearn` (HEAD `541941d`),
by running the build, the interpreter QA, the Python test suite, and the app itself, plus a
63-agent adversarial workflow (5 subsystem maps with independent verification, a strict
dissertation examination with citation checks, live-source field research, and a
loop-until-dry bug hunt). Every number below was reproduced from a real run or read from a
real file. Nothing here is taken on trust.

---

## 1. Scorecard

| Category | Raw /10 | Weight | Weighted |
| --- | --- | --- | --- |
| Technical implementation and correctness | 8.0 | 20 | 160.0 |
| Simulation and realism fidelity | 7.0 | 15 | 105.0 |
| Code quality and architecture | 7.5 | 15 | 112.5 |
| Design and UX | 8.0 | 15 | 120.0 |
| Innovation and idea quality | 7.5 | 10 | 75.0 |
| Academic rigor and the dissertation | 7.5 | 15 | 112.5 |
| Completeness and polish | 7.0 | 5 | 35.0 |
| Market and impact potential | 6.0 | 5 | 30.0 |
| **Overall** | | **100** | **750 / 1000** |

**Weighted overall: 75 / 100, equivalent to 7.5 / 10.**

**Honest academic mark band: low Distinction, approximately 74.** This sits at the bottom of
the project's own self-assessed 74 to 78 band and confirms it rather than inflating it. The
distance to a clear Distinction-plus is a real user study and one genuine algorithmic
contribution, neither of which exists yet, both correctly disclosed as future work.

---

## 2. Executive verdict

Kodro is a genuinely working, honestly built offline studio that does what it claims: you
assemble a robot from real parts, and that build measurably drives the simulation. Verified
at runtime, a heavier build accelerates slower and drains its battery faster, a stronger
motor lifts top speed, and a sensor that is not fitted has its command withheld from the text
editor, the blocks, and the grounded assistant alike, all read from a single command registry
on the move hot path. It is not a winner today because it is boxed in on two sides at once:
Webots already owns the free, offline, no-account, custom-robot, rigid-body-physics axis with
far higher fidelity, and the education incumbents own curriculum, brand, and classroom
management, so Kodro's honest kinematic-plus-fidelity-disclosure niche is real but narrow. The
single biggest thing holding it back is that its central selling point, honest simulation, is
undercut by three unowned physics surfaces (the on-screen JS sim, the Python grader, and the
JS scenario validator) that diverge on battery and collision, so a program can pass validation
or grading yet behave differently on screen. Fix that divergence and ship grammar-constrained
generation plus an offline parts database, and it becomes a defensible product for its niche.

---

## 3. Strengths (each with evidence)

- **The central design claim holds end to end, verified at runtime.** Running `avoid.py` in the
  live app drove the rover 22.4 m in 18.4 s, draining battery 100 to 82.5 percent, keeping a
  110 cm obstacle clearance. `KodroCommands.check(noUltrasonic,'distance')` returned a readable
  refusal; with an ultrasonic fitted it returned `ok:true`; a build without an IMU refused
  `heading()`. Live probe of `resolveKodroRobot`: a motors2 build gives massFactor 0.60, runtime
  100 min, speedFactor 1.0; a motors4-plus-sensors build gives 0.72, 83 min, 1.25; battery drain
  scales 0.76 to 1.98 percent per metre with mass. Registry at
  `src/kodro/assets/web/RobotLab.jsx:234`, consumed on the move path at
  `hooks.jsx:817-820` and `hooks.jsx:1220-1226`. The adversarial verifier reproduced this and
  confirmed `massFactor` is fetched fresh each move.

- **The tests are real, meaningful, and pass.** Reproduced: `node scripts/qa_interpreter.mjs`
  gives 163 passed, 0 failed; `python -m pytest -q` gives 1039 passed, 2 skipped in 127 s; the
  coverage gate `--cov-fail-under=85` is real at `pyproject.toml:171`. These are not trivial
  asserts: `test_golden_traces.py` drives real pupil programs through the actual executor,
  `test_motion_model_conformance.py` hash-gates the shared constant table across the JS and
  Python engines, and the sensor rays are property-tested closed forms (`engine/sensors.py:65-142`).

- **The sandbox is hardened against the classic DoS vectors.** Reproduced under Node:
  `while True: pass` throws "while loop ran too long" in 28 ms; `9**9**9` is guarded;
  `s = s + s` doubled 200 times throws "sequence too large (limit 1000000)"; `range(10**12)`
  throws "range() is too large". Caps at `interpreter.js:468,477,622,787`, with `clampNum` and
  `frameProgress` giving defense in depth against non-finite magnitudes (`interpreter.js:925,934`).

- **The honesty is structural and verifiable.** Every performance figure is badged HONOURED,
  APPROXIMATED, or NOT SIMULATED (`specschema.js:65-89`), the docs enumerate every limitation
  (`docs/known-limitations.md`), and the KodroBench leaderboard publishes numbers that cut
  against the project (its own fine-tunes invent commands at 0.60 and 1.00 while the rule-engine
  floor beats them), backed by a real artifact `results/kodrobench-v0.1.json`.

- **It reads as a shipped product.** The running studio has onboarding, 11 example programs, 6
  worlds and 17 named mission sites, four quality tiers, a live telemetry rail with compass and
  arc gauges, procedural sound, blocks and voice and AI panels, a Realism dashboard, and a
  guided demo. Accessibility is considered throughout: `aria-label` on every control, `sr-only`
  headings, reduced-motion handling. Verified via `read_page` and live JS on `localhost:8080`.

- **The single-source-of-truth discipline is genuine for constants.** The arena half-extent, the
  0.6 pass threshold, the 30 cm collision radius, and the physics constant table are each read
  from one place across all consumers (`scenario.jsx:24,30`, `agents.jsx:24`, `motion-model.js:30`),
  and the constant table is byte-identical and hash-gated across the JS and Python twins.

- **The dissertation is a real asset.** A 146 KB, ten-chapter LaTeX document with roughly 18
  genuine citations, an exemplary AI-use and ethics declaration, and an evaluation chapter that
  separates measured from planned in a status table. Zero em-dashes and zero en-dashes in the
  source, confirmed by an exhaustive Unicode scan. The suspicious 2026 arXiv citations were
  verified as real against arXiv.

---

## 4. Weaknesses, bugs, and risks (severity ranked)

No CRITICAL issue was found (nothing causes remote compromise or unrecoverable data loss; the
app is a local sandboxed studio). The HIGH items are genuine and several are load bearing for
the product's core honesty claim.

### HIGH

1. **A malformed `.kodro` boot-bricks the studio.** A hand-edited or corrupt project whose
   `physical.sensors` is not an array passes the project loader's incomplete guard, is written
   raw, then throws a TypeError on every reload via the init path, so the studio will not open
   until localStorage is cleared. A shared or exported `.kodro` could brick another user.
   Evidence: crash at `specschema.js:408`, guard gap at `project.js:173-181,233-236`, triggered
   on boot through `RobotLab.jsx:181 -> :135`. Fix: validate `physical` as a typed schema in
   `project.js` before writing, and make `deriveFromPhysical` defensive against non-array fields.

2. **The interpreter has no function-local scope.** Non-parameter locals and for-loop variables
   write to the single global scope, so a callee silently clobbers a caller's variable and
   multi-local recursion computes wrong results. For a tool whose purpose is to teach
   programming, this mis-models Python. Evidence: single `const scope` at `interpreter.js:619`,
   only params saved and restored at `:712-713`, body writes go to the shared scope at `:754,:777`.
   Fix: give each user-function call a child scope chained to globals for reads, with writes
   landing in the local frame.

3. **Three physics surfaces diverge, undercutting the honesty story.** The JS scenario validator
   treats the robot as a dimensionless point for collisions, roughly 30 cm more permissive than
   the live sim (`scenario.jsx` collision tests), and the Python grader charges battery with a
   different model than the terrain- and mass-aware JS tick the pupil actually watches
   (`engine/rover.py` grader path). So a program can pass validation or a lesson yet behave
   differently on screen. Fix: thread the rover radius into the validator's collision tests and
   drive the grader's drain through `motion_model.move_drain_pct` with the build's factors.

4. **Two sandbox DoS vectors bypass the documented caps.** List or tuple repeat `[N] * count`
   builds via concat in a loop and is O(n^2), and an expression-context call to a user function
   drains the entire function body in one synchronous `gen.next()`; both freeze the tab and the
   second ignores Pause and Reset. Evidence: `interpreter.js:1017` (repeat, cap at `:1011` not
   reached) and `interpreter.js:718` (`for (const _ev of execBlock(ufn.body)) {}`). Fix: apply
   `capSeqLen` to the repeat allocation and yield periodically from expression-context calls.

5. **The Python engine has two obstacle-handling bugs.** `Rover.move()` drives through the
   nearest obstacle when a farther one appears earlier in `world.obstacles`
   (`engine/rover.py:123-136`, mis-scale at `:127-128` vs `:134-135`), and a rover that touches
   an obstacle is permanently trapped because `segment_circle_hit` returns t=0 for any move
   starting inside the grown radius (`engine/motion_model.py:326`). Real-world impact is lower
   because this engine is off the JS hot path, but it is the grader's engine.

### MEDIUM

- `break` or `continue` outside a loop leaks the internal sentinel as "[object Object]"
  (`interpreter.js:224,752`).
- Augmented assignment on an undefined variable defaults the base to 0 instead of raising
  NameError, masking pupil errors (`interpreter.js:756`).
- Identifiers equal to `Object.prototype` members (`constructor`, `toString`, `__proto__`)
  resolve as built-ins instead of NameError (`interpreter.js:640`).
- The "three in a row" achievement unlocks after two consecutive passes because history is read
  after the current record is written (`web/app.py:286,305`).
- Pupil code runs against unsynchronized process-global engine bindings; a background
  AI-validation daemon thread can hijack a live submission's rover (`runtime/binding.py:19-20`,
  `web/app.py:236-250` vs `:820`).
- Per-terrain gravity and traction live in two unsynchronised tables with a genuine value
  conflict, not covered by the hash gate (`engine`/`scenario.jsx` env tables).
- The pywebview grading path is spec-blind and discards the client trace, so an imported KRS
  build's mass and battery never reach the grade.
- A comment after a string literal ending in an escaped backslash is not stripped, breaking
  tokenization (`interpreter.js:88`).
- The `RobotLab.jsx:250-253` comment overclaims that `driveCheck` is the same source of truth the
  grader reads; the grader does not consult it, so an arm could in principle pass a driving lesson.

### LOW

- `min()`/`max()` on an iterable over roughly 124k elements crash with a stack overflow
  (`interpreter.js:533`).
- A stale `runStartRef` leaks a prior run's start time into a later step-through, corrupting
  `wallMs` telemetry (`hooks.jsx:1492`).
- Duplicate function parameter names overwrite an existing global without restoring it
  (`interpreter.js:713`).
- The pymunk collision handler records the settled near-zero impulse and drops the wall impulse
  on same-step double contact (`engine/physics.py:196-214`).
- `swarm_run` leaves the process-global engine bindings dangling after a fleet run
  (`runtime/swarm.py:76-99`).
- Stale doc comments attribute `animateMove`/`frames` to `app.jsx`; they live in `hooks.jsx`.
- Repo hygiene: `_kbd_probe*.mjs`, `test_*.js`, and `nul` sit in the root untracked, and the
  working tree ships uncommitted `bundle.js`/`panels.jsx`/`styles.css` changes.
- Grammar nit in refusal messages: "a IMU", "a Ultrasonic".

---

## 5. Improvement and addition roadmap

All items respect the hard offline rule: no cloud, no account, no paid service, only a local
Ollama on `localhost`, and the app stays fully usable with the model absent.

### Quick wins (days)

1. **Grammar-constrained generation from the fitted-command set.** Feed a JSON grammar built
   from the build's real commands into Ollama's XGrammar constrained decoding, so the local
   model cannot emit a symbol outside the fitted set. Impact: high, it directly kills the
   measured failure mode where `kodro-coder` invents `rover.forward()` at 100 percent. Effort:
   medium. Source: https://github.com/ollama/ollama/blob/main/docs/api.md (structured outputs),
   https://github.com/mlc-ai/xgrammar.

2. **Extend seeded domain randomisation from obstacle positions to dynamics.** Jitter the motion
   constants (rolling resistance, drivetrain efficiency, mass) per seed so `success@N` becomes an
   honest sim-to-real proxy rather than a fixed-dynamics number. Impact: high. Effort: low to
   medium, pure seeded arithmetic. Source: Tobin et al. 2017, https://arxiv.org/abs/1703.06907.

3. **Surface the existing URDF export as a one-click "Graduate to ROS / Webots / Gazebo".** The
   engine (`interop/urdf_io.py` with a ROS-parity re-parse) already exists and is undersold; the
   market doc still says "no ROS export yet". Un-gate it from the optional pip extra and add a
   GUI button. Impact: medium to high, it converts the strongest competitor criticism ("KRS is a
   dead-end format") into a bridge. Effort: low to medium. Source: urdf2webots,
   https://github.com/cyberbotics/urdf2webots.

4. **Fix the three-surface physics divergence (also HIGH bug 3).** One shared collision-with-
   radius and one shared battery model across the JS sim, the Python grader, and the JS
   validator. Impact: high, it is the credibility of the honesty claim. Effort: medium.

### Big levers (weeks)

5. **Ship a curated offline parts database.** Common hobby DC gearmotors (N20, TT, NEMA) plus
   LiPo and NiMH batteries and wheels, bound to the KRS spec as a bundled static file. Impact:
   high, it closes the single biggest gap versus eCalc and gives Kodro the pre-purchase-hobbyist
   wedge no competitor serves offline. Effort: medium to high (data curation). Offline-safe: a
   static file, no registry lookup.

6. **Grow KodroBench from 5 to 20 to 50 tasks with the ablation and pass@k.** Ship the already
   scaffolded with-spec versus without-spec ablation and a real held-out split, which turns the
   benchmark from "a proof of mechanism" into evidence the contribution can lean on. Impact: high
   for the dissertation and positioning. Effort: medium to high. Offline-safe: deterministic
   floor plus local Ollama, runs in CI with no GPU.

7. **A vendored offline glTF loader behind the quality tiers.** This is the one lever that
   raises the visual-fidelity ceiling without breaking offline. Vendor a minimal glTF parser and
   a small, well-shaded model and texture set, gated so Low and High never pay for it and the
   interpreter QA is untouched. Impact: medium to high on the "reads as a product" axis. Effort:
   high. This is the honest ceiling-raiser named in `docs/known-limitations.md`.

8. **Calibrate the fidelity badges from qualitative to a measured error band.** Compare Kodro's
   kinematic drivetrain output against an offline reference (for example a pymunk rollout) and
   surface the measured gap, turning "we admit it is approximate" into "here is the number".
   Impact: medium. Effort: medium. Offline-safe: local computation only.

The competitive reality to design against: Webots (https://cyberbotics.com/) is free,
open-source, offline, no account, with rigid-body physics and URDF import, so Kodro cannot win
on "offline sim" alone; its defensible ground is the combination of a beginner-writable custom
build that drives the sim, point-of-use fidelity disclosure, an architecturally offline
grounded assistant behind a deterministic gate, and the URDF graduation bridge. RoboEval
(https://arxiv.org/abs/2311.11183) is the nearest prior art for the grounding metric and checks
an invalid argument to a fixed API, not an invented symbol against a per-build API, which is
exactly the gap Kodro's metric occupies and should cite.

---

## 6. Dissertation verdict

**Score: 7.2 / 10. Mark band: low Distinction, approximately 72 percent** (Liverpool MSc
Distinction is 70 and above). This is a well-written, scrupulously honest engineering
dissertation whose ceiling is set by the absence of human-subject data and the integration
(rather than algorithmic) nature of the contribution, both correctly disclosed.

**Verified strengths.** The honesty is the strongest feature and it survives stress-testing
against the code: every headline data table reproduces a committed file exactly (KodroBench
from `results/kodrobench-v0.1.json`, the persona-task funnel from `docs/eval/persona_eval_results.json`),
the measured/planned separation is rigorous (a status column, a labelled speculation, a
declaration that no human-study result is reported), and the literature is derivational rather
than decorative with genuine sources. Zero em-dashes or en-dashes in the whole source. The
three suspicious 2026 arXiv citations were checked and are real.

**Specific weaknesses and the exact edits that raise the grade.**

1. **No human-subject evaluation; every method is simulated personas, the product's own
   interpreter as judge, and the author's own fine-tunes.** This is the single biggest cap. Do
   not add fake data. In Section 6.1 add one crisp sentence: "No claim of usefulness to a human
   is made or implied anywhere in this chapter; every result below is either an automated
   correctness measure or an analyst-run formative signal."

2. **Stale checkable numbers contradict the declaration's promise.** The text says 157 of 157 QA
   and "just over 88 percent" coverage; the live repo is 163 of 163 and 87 percent. Replace "one
   hundred and fifty seven of one hundred and fifty seven" with "one hundred and sixty three of
   one hundred and sixty three" in the abstract and Sections 6.2, 6.10, 8.1, and correct the
   coverage figure to the measured value.

3. **The objective 35 percent headline is a single stochastic run.** Report it as a mean with
   range over the four post-fix runs in Table 6.3's caption and Section 6.4: "task completion 35
   percent (mean of four post-fix runs, range 30 to 40 percent)".

4. **RoboEval/CodeBotler, the nearest prior art, is in a footnote not the bibliography.** Promote
   it (Hu, Lucchetti, Schlesinger et al., arXiv:2311.11183) into the numbered references and cite
   it inline in Section 2.5 and Section 6.6 with one sentence contrasting invalid-argument versus
   invented-symbol grounding.

5. **The adversarial-panel section is the longest but the weakest evidence.** Condense the seven
   round-by-round paragraphs to roughly half, keep the methodological punchline, and either
   commit the consolidated per-defect record it claims exists or soften the claim.

6. **A few sentences are too long.** Split the abstract's opening period and the longest
   sentences in Sections 2.3, 4.4, 4.6 at their natural clause boundaries.

---

## 7. The ultimate build prompt

Copy everything between the rules below into a fresh coding agent with no prior context.

---

You are the lead engineer taking Kodro to the top of its category. Kodro is an offline desktop
robot design and simulation studio for a capable non-expert adult: assemble a robot from real
parts, program it in Python or blocks or plain language with a grounded local AI assistant plus
a code reviewer, validate its behaviour in a realistic simulated world, and let the system
self-refine from accumulated use. It runs entirely on one laptop with no account and no cloud.
It is an MSc research and teaching tool (COMP702, University of Liverpool), not a production
robotics simulator, and it does not replace Isaac Sim, Gazebo, Webots, or MuJoCo.

**Repository.** `D:\project\robolearn` on Windows 11 (PowerShell and Bash both available).
GitHub `vaibhav4046/robolearn`, branch `main`.

**Hard constraints, never violate.**
- Offline is absolute. No cloud dependency, no account, no paid service. The only permitted
  network peer is a local Ollama on `localhost:11434`, and the app must stay fully usable with
  Ollama absent (a deterministic rule engine is the default fallback).
- No fabrication anywhere, including the dissertation. Report measured numbers only. No invented
  test results, benchmarks, user studies, or citations. If you cannot verify something, say so.
- No em-dashes and no en-dashes in any dissertation prose (`docs/dissertation/`). Spelled-out
  ranges only.
- Do not claim ROS2, Isaac, NVIDIA, Hugging Face, or Blender integration. A URDF import and
  export exists (`interop/urdf_io.py`); a live ROS2 bridge does not.
- The renderer is core Three.js r137 procedural geometry by design; keep it offline and keep the
  interpreter QA green when you touch it.

**Architecture and file map (read before editing).**
- Web UI, vendored React and Three.js r137, precompiled to one `bundle.js`, under
  `src/kodro/assets/web/`. Rebuild with `node scripts/build_web.cjs` (writes `bundle.js`
  from 36 sources). Key files:
  - `interpreter.js` (`window.RoverLang`): Python-subset tree-walking generator interpreter,
    sandbox caps at lines 468, 477, 622, 787.
  - `motion-model.js` (`window.KodroMotion`): the single physics and battery source of truth,
    mirrored by the Python twin `engine/motion_model.py` and hash-gated in CI.
  - `hooks.jsx`: the run pump (`pumpLoop` ~1455, `advance` ~1191), the sensor host (~809), and
    the kinematic tick (`animateMove` ~914).
  - `app.jsx`: wires `robotSpec`, run reports, world picker, quality tiers.
  - `RobotLab.jsx`: parts catalogue, `derive()` (mass, speed, runtime), the `KodroCommands`
    single command registry (~234), `WORLD_FOR`.
  - `specschema.js`: the HONOURED / APPROXIMATED / NOT SIMULATED fidelity tiers and KRS import.
  - `scenario.jsx` (`window.KodroScenario`): domain-randomised validation.
  - `realism.jsx`, `terrains.jsx`, `agents.jsx`, `Viewport3D.jsx`, `memory.jsx`, `lesson-grader.jsx`.
- Python engine under `src/kodro/engine/` (`physics.py` pymunk, `sensors.py`, `motion_model.py`,
  `rover.py`, `world.py`), plus `rover_api.py`, `memory/store.py` (SQLite), `web/app.py`
  (pywebview BridgeAPI), `grounding.py`, `kodrobench.py`, `bench.py`, `interop/urdf_io.py`.
- Dissertation at `docs/dissertation/Kodro_Dissertation.tex`, compiled offline with
  `.tools\tectonic.exe`.

**Verified state at `541941d`, 11 July 2026. Four of these figures have since moved; see the banner.**
- `node scripts/build_web.cjs` -> bundle from 36 sources. `node scripts/qa_interpreter.mjs` ->
  163 passed, 0 failed. `python -m pytest -q` -> 1039 passed, 2 skipped. Coverage gate 85
  percent at `pyproject.toml:171`.
- The central claim works at runtime: heavier build accelerates slower and drains faster,
  stronger motor lifts top speed, unfitted sensor withholds its command via the single registry.
- Sandbox stops `while True: pass`, huge exponents, string doubling, and huge ranges.
- The dissertation scores about 72 (low Distinction), honest and citation-clean.

**Priorities as ranked on 11 July 2026, highest leverage first. Not re-audited since; several are closed. Do not run this as a task list.**

1. Fix HIGH bug: a malformed `.kodro` (non-array `physical.sensors`) boot-bricks the studio.
   Validate the `physical` block as a typed schema in `project.js` before writing, make
   `deriveFromPhysical` (`specschema.js:408`) defensive, and add a corrupt-spec regression test.
2. Fix HIGH bug: the interpreter has no function-local scope (`interpreter.js:619,754,777`).
   Give each user-function call a child scope so locals and for-loop variables do not clobber the
   caller; add tests for shadowing and multi-local recursion.
3. Fix HIGH bug and the honesty gap: unify the three physics surfaces. One collision-with-radius
   and one battery model shared by the JS sim, the Python grader (`engine/rover.py`), and the JS
   validator (`scenario.jsx`); add a cross-surface conformance test alongside the existing hash
   gate.
4. Fix the two sandbox bypasses: cap `[N] * count` allocation (`interpreter.js:1017`) and make
   expression-context user-function calls yield periodically (`interpreter.js:718`).
5. Ship grammar-constrained generation from the fitted-command set via Ollama XGrammar, so the
   local model cannot invent a symbol; keep the deterministic fallback. Re-run KodroBench and
   report the new invention_rate.
6. Extend seeded domain randomisation to the motion constants so `success@N` is an honest
   sim-to-real proxy.
7. Grow KodroBench to 20 to 50 tasks with the with-spec versus without-spec ablation, pass@k, and
   a held-out split.
8. Ship a curated offline parts database (N20, TT, NEMA motors, LiPo and NiMH) bound to KRS.
9. Surface the existing URDF export as a one-click "Graduate to ROS / Webots / Gazebo" and update
   the market doc, which wrongly says "no ROS export yet".
10. Optional ceiling raiser: a vendored offline glTF loader behind the quality tiers, plus a
    small shaded model set, gated so Low and High are never charged and the interpreter QA stays
    green.
11. Fix the MEDIUM correctness bugs (break/continue sentinel leak, augmented-assign default,
    prototype-member builtins, achievement off-by-one, thread-unsafe global bindings) and clean
    the LOW items and repo hygiene.
12. Dissertation edits: update 157 to 163 and the coverage figure everywhere, report the 35
    percent headline as a mean with range, promote the RoboEval citation into the bibliography,
    condense the adversarial-panel section, and split the longest sentences. Recompile with
    tectonic and confirm zero em-dashes and en-dashes.

**Verification loop as specified on 11 July 2026. The counts are that date's floors, not
current thresholds; the live gate list is in `docs/implementation-status.md`.**
```
node scripts/build_web.cjs          # rebuild the bundle from source
node scripts/qa_interpreter.mjs     # floor on 11 July was 163 passed, 0 failed
python -m pytest -q                 # must stay green, coverage gate 85
python scripts/demo.py              # serves http://localhost:8080; drive the real flow
```
For an interpreter change, add a Node harness assertion in the style of `scripts/qa_interpreter.mjs`
(window-shimmed IIFE load, drive the generator, assert the fix and a regression). For a physics
change, add or extend a golden-trace and the cross-surface conformance test. For a UI change,
run the app and observe the behaviour; do not claim a fix you did not exercise.

**Orchestration.** Pipeline by default: for each priority, one agent implements while the next is
scoped, and every fix is adversarially verified by a second independent agent whose job is to
refute it by re-reading the cited lines and reproducing. Use a barrier only when a stage needs
all prior results at once (for example deduping bugs before a batch fix). For discovery work
(new bugs, dead code, honesty gaps) loop until two consecutive passes find nothing new, hard cap
five passes, and a pass counts only if its findings survive refutation. Never silently cap
coverage; if you check only the top N of something, say so. Report failures plainly with the real
output; report a fix as done only after you have run the affected flow end to end.

---

*Generated by an independent judge-panel evaluation, 2026-07-11.*
