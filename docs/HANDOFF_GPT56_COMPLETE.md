# KODRO / ROBOLEARN — COMPLETE HANDOFF (for GPT-5.6 or any successor agent)

You are taking over an **in-flight, already-working, already-live** MSc project.
**Do NOT restart, re-architect, or re-scaffold anything.** Continue from the exact
state below.

---

## 0. IDENTITY / MISSION

- **Project**: Kodro (repo/package name `robolearn`) — an offline-first robot
  design + simulation studio where a learner builds a robot from real parts,
  programs it in a Python subset, and watches it drive in a living 3D world,
  with **honest** derived numbers (fidelity-tiered).
- **Owner**: Vaibhav Lalwani, student **201979723**, University of Liverpool,
  **COMP702 MSc Project** (dissertation = 70%). Supervisor: **Keith Dures**.
  Dissertation due **11 Sep 2026**, max 50 pages, Turnitin.
- **Three deliverables**: (1) the application, (2) the live website, (3) the
  LaTeX dissertation.

---

## 1. AUTHORITATIVE LOCATIONS (absolute paths — Windows)

| What | Absolute path / URL |
|---|---|
| **Repo root (AUTHORITATIVE)** | `D:\project\robolearn` |
| Git remote | `https://github.com/vaibhav4046/robolearn` |
| **Live site** | https://vaibhav4046.github.io/robolearn/ |
| Dissertation source | `D:\project\robolearn\docs\dissertation\Kodro_Dissertation.tex` |
| Dissertation PDF | `D:\project\robolearn\docs\dissertation\Kodro_Dissertation.pdf` |
| CA1 proposal (marked, B band) | `D:\project\robolearn\docs\ca1\Kodro_CA1_Specification_Design_Proposal.pdf` |
| CA1 source | `D:\project\robolearn\docs\ca1\Kodro_CA1.tex` |
| Autonomy state (READ FIRST) | `D:\project\robolearn\.kodro\autonomy\STATE.md` |
| Findings ledger | `D:\project\robolearn\.kodro\autonomy\FINDINGS.jsonl` |
| Evidence ledger | `D:\project\robolearn\.kodro\autonomy\EVIDENCE.json` |
| Acceptance matrix | `D:\project\robolearn\.kodro\autonomy\ACCEPTANCE_MATRIX.md` |
| Dissertation traceability | `D:\project\robolearn\.kodro\autonomy\DISSERTATION_TRACEABILITY.md` |
| Backlog (all findings) | `D:\project\robolearn\.kodro\autonomy\BACKLOG.json` |
| Acceptance criteria | `D:\project\robolearn\docs\ACCEPTANCE.md` |
| Known limitations | `D:\project\robolearn\docs\known-limitations.md` |
| Human-only tasks | `D:\project\robolearn\HUMAN_TODO.md` |

**WARNING — stale clone**: `C:\Users\lalwa\OneDrive\Desktop\codex fix\robolearn`
is a **STALE** copy pinned at `e1df641` / tag `v2.0.2` with a clean tree.
**Ignore it.** All real work is in `D:\project\robolearn`.

---

## 2. CURRENT STATE (as of handoff)

- Branches **`main` == `kodro-identity-pass` == `origin/*` == `38a5e92`**, tree CLEAN.
- **Live bundle SHA-256 `dcc35c08…` == committed bundle** (verified). Live HTTP **200**.
- CI green on **3 OSes** (ubuntu/macos/windows). Gated Pages deploy green.
- Latest tag `v2.0.2` (no new tag cut; fixes ship continuously via Pages deploy).
- **14 adversarial judge rounds** completed, every accepted finding fixed + gated +
  shipped + live-hash-verified. **Zero P0/P1 outstanding.**
- `FINDINGS.jsonl`: **77 findings — 76 FIXED, 1 DISCLOSED**; all 56 judge-round
  findings fixed.
- Dissertation: clean `pdflatex` build, **exactly 50 pages**, **0 em/en dashes**,
  ~23,300 words.

### Recent shipped commits (newest first)
```
38a5e92  chore(autonomy): checkpoint — JR14/PKG-01/CTR-01 shipped
9877f15  fix: judge round 14 — drive-grip mobility model + skip-link focus
b4b441a  chore(autonomy): checkpoint — JR13+sound+pkg+contrast; ledgers complete
17db315  fix: light-theme Run button contrast (proactive theme-contrast audit)
94298da  fix: pip wheel build (redundant hatch force-include double-add)
18f67c4  chore(autonomy): EVIDENCE.json ledger
dd6cbf5  fix: judge round 13 + sound off by default + Phase-0 reconciliation ledgers
9b58d89  fix: judge round 12 — assumed-wheel top speed honesty + WCAG label-in-name
75db527  fix: judge round 11 — battery-range consistency + teacher table headers
```

---

## 3. ARCHITECTURE (critical — read before editing)

**The web app is NO-BUILD.** Vendored React + Three.js UMD. 38 IIFE modules in
`D:\project\robolearn\src\robolearn\assets\web\` are concatenated by
`scripts\build_web.cjs` (fixed `ORDER` array, line ~24) into a **COMMITTED**
`bundle.js`.

### THE RULE
> After **ANY** edit to a `.jsx` / `.js` file under `src\robolearn\assets\web\`:
> ```
> node scripts/build_web.cjs
> ```
> then **commit `bundle.js`**. CI has a bundle-freshness gate that fails otherwise.

### Bundle ORDER (dependency order — do not reorder casually)
```
motion-model.js, specschema.js, parts-db.js, project.js, runreport.js,
pupil-store.js, icons, agents, memory, memory-graph.js, terrains, Rover,
Viewport, textures, post, worldfx, ambient, Viewport3D, Editor, Telemetry,
tweaks-panel, diagnostics, selftest, RobotLab, scenario, lesson-grader, verify,
realism, demo, onboarding, ai-providers, ai-web, chat-intent.js, sim-physics.js,
hooks, app-data, panels, app
```

### Key modules (all in `src\robolearn\assets\web\`)
| File | Role |
|---|---|
| `motion-model.js` | **Shared physics constants + closed forms.** Mirrored by `src\robolearn\engine\motion_model.py`; locked by golden-trace parity tests. Exposes `window.KodroMotion`. |
| `diagnostics.jsx` | **Design Check** (`assess`, `afterRun`) — the deterministic "will this build cope" layer. `window.KodroDiagnostics`. |
| `specschema.js` | KRS robot-spec schema + validator + `deriveFromPhysical` + **FIDELITY** 3-tier disclosure table. |
| `RobotLab.jsx` | Robot builder, parts catalogue (`ACTUATORS`/`SENSORS`/`BOARDS`), `derive()`. `window.getKodroRobot()`. |
| `hooks.jsx` | Sim engine tick, run loop, seeds, console, toasts, teacher, project IO. |
| `app.jsx` | Root component, mission bar, settings, modals wiring. |
| `interpreter.js` | Python-subset recursive-descent interpreter + sandbox. |
| `lesson-grader.jsx` + `lessons.json` | 18 graded lessons + grading. |
| `Viewport3D.jsx`, `worldfx.jsx`, `ambient.jsx` | 3D world, weather, agents/traffic. |
| `terrains.jsx` | 6 base worlds + 17 named mission sites (env: gravity/temp/pressure/light/traction). |
| `pupil-store.js` | On-device class register (localStorage, EMA concept strength). |
| `styles.css` | **All CSS + 10 theme token blocks.** NOT in bundle.js — served separately. |
| `sound.js` | Synthesised audio. **Muted by default** (user request). |
| `cap.html` | **GENERATED** by `scripts\build_screenshot_harness.cjs` — gitignored. **Edit the generator, never cap.html.** |

### Python side
`src\robolearn\` — `web\app.py` (pywebview desktop), `engine\motion_model.py`
(JS twin), `envs\kodro_env.py` (Gymnasium `KodroEnv-v0`), `kodrobench.py`,
`interop\urdf_io.py`, `lessons\`, `memory\`, `ui\` (Tk fallback).

---

## 4. QA GATES — EXACT COMMANDS

Run from `D:\project\robolearn`.

### Node gates (fast, no browser)
```bash
node scripts/qa_interpreter.mjs      # 180 passed
node scripts/qa_grader.mjs           # 34
node scripts/qa_physics.mjs          # 20
node scripts/qa_ai_web.mjs           # 27
node scripts/qa_parts.mjs            # 40
node scripts/qa_memgraph.mjs         # 22
node scripts/qa_pupilstore.mjs       # 23
node scripts/qa_scenario_parity.mjs  # 4
node scripts/qa_interp_fixes.mjs     # 13
node scripts/qa_honesty.mjs          # 91  <-- the honesty regression gate
node scripts/qa_contrast.mjs         # 61  <-- WCAG AA across 10 themes
node scripts/qa_web.mjs              # 5/5 (boot + privacy + studio-mount)
```

### Browser gates (need a static server on :8099 serving the web dir)
```bash
node scripts/build_web.cjs                      # rebuild bundle
node scripts/build_screenshot_harness.cjs       # regenerate cap.html
# serve D:\project\robolearn\src\robolearn\assets\web on http://localhost:8099
node scripts/qa_ui.mjs        # 6/6 flows, 38/38 behaviour, 12/12 modals
node scripts/qa_worlds.mjs    # 61 world/site renders
```

### Python
```bash
python -m pytest                       # CI-authoritative
python -m ruff check .
python -m ruff format --check .
python -m mypy src
python -m build --wheel                # robolearn-2.0.0-py3-none-any.whl
```

**CI does NOT run `qa_ui` / `qa_worlds`** — they are LOCAL acceptance gates.
CI is authoritative for shipping.

---

## 5. SHIP PROTOCOL (follow exactly — hard-won lessons)

```bash
node scripts/build_web.cjs                      # 1. rebuild bundle
# 2. run affected gates, then the full battery
git add <every changed file>                    # 3. SEE WARNING BELOW
git commit -m "fix: ..."
git push origin kodro-identity-pass
git checkout main && git merge --ff-only kodro-identity-pass && git push origin main
git checkout kodro-identity-pass
# 4. watch CI  ->  5. watch Deploy Pages  ->  6. verify live hash
```

### Verify live == committed
```bash
git show HEAD:src/robolearn/assets/web/bundle.js | sha256sum
curl -s "https://vaibhav4046.github.io/robolearn/bundle.js?v=$(git rev-parse --short HEAD)" | sha256sum
# For CSS-only changes bundle hash is UNCHANGED — verify styles.css instead:
curl -s "https://vaibhav4046.github.io/robolearn/styles.css?v=..." | grep <your-token>
```

### TWO REAL MISTAKES ALREADY MADE — DO NOT REPEAT
1. **`git add src/.../*.jsx *.js` SILENTLY DROPS `styles.css`.** That shipped a
   commit whose CSS never landed, reddened CI (`qa_contrast`), and the gated
   deploy correctly SKIPPED it. **Always stage `.css` and `bundle.js` explicitly.**
2. **Pushing a follow-up commit while CI is still running CANCELS that CI run**
   (concurrency group). Wait for CI to finish before pushing the next commit.

---

## 6. THE ADVERSARIAL JUDGE LOOP (the convergence engine)

**Workflow script** (a Claude-Code "Workflow"; port the idea if you lack that tool):
```
C:\Users\lalwa\.claude\projects\D--project-robolearn\8de95992-bd5b-4a12-b04f-1b334c9f4674\workflows\scripts\kodro-judge-round-wf_08492b6b-dff.js
```
It runs **6 judges in parallel** over an evidence pack, dedups, then **independently
refutes every finding** (refuter defaults to REJECT if uncertain), returning
`{accepted, rejected, rawCount}`.

**Judge lenses**: first-timer, teacher, budget-builder, accessibility, performance,
honesty-auditor.

**Evidence pack** (14 surfaces, `.png` + `.html`) in `D:\project\robolearn\tmp\evidence\`:
`onboarding_first_contact, default_load_city, city_run, robot_lab, budget_build,
ai_vibe_no_model, settings, realism_fidelity, runs_replay, blocks,
classroom_lesson, teacher_register, memory_skills, narrow_mobile`.
Captured by a script in the session scratchpad; regenerate `narrow_mobile` at a
**TRUE 420px** viewport via CDP (`scripts\lib\cdp-viewport.mjs`) because
`--window-size` **clamps to ~482px** in headless Chrome and silently makes phone
gates vacuous.

### Convergence definition
**TWO consecutive COMPLETE clean rounds** (0 accepted findings, all 6 judges
finishing). **CURRENT COUNTER: 0.**

### Defect trend (all fixed + shipped)
`R7=3, R8=1(partial), R9=19, R10=4, R11=2, R12=2, R13=2, R14=2` — all P2/P3, no
P0/P1 for many rounds. The **theme-contrast class is proactively exhausted** (a
300-measurement runtime audit across 10 themes × desktop+phone is clean).

---

## 7. ACTIVE BLOCKER (the reason this was handed off)

**The local headless Chrome / swiftshader / virtual-time pipeline degraded** after
hours of process churn on this box.

- Symptoms: `qa_ui` / `qa_worlds` ETIMEDOUT spawn failures, blank renders, and the
  Riverside City first-run demo being **broadsided at spawn (0 m)** by real-time
  cross-traffic.
- **PROVEN NOT a product defect and NOT a regression**: the shipped/live committed
  build fails it **identically**; it **passed earlier the same session**; the
  `gripFactor` change cannot alter city speed (`mob > mobilityWarnBand(0.75)` →
  `mobilityMultiplier = 1` either way); the live site loads and runs in a real browser.
- **Root cause**: the rover tick (`setTimeout` 16 ms) and the traffic animation
  (rAF, `agents[i].update(tsec,dts)` in `Viewport3D.jsx` ~line 1915) **desync under
  `--virtual-time-budget`**, progressively worse on a loaded box. City traffic runs
  on the **animation clock**, not the run seed, so a fixed seed does NOT fix it.
- **FIX**: restart Chrome / reboot the machine. Then `qa_ui`, `qa_worlds`, and
  evidence capture recover.

**Flake protocol**: kill headless Chrome, cool down 20–35 s, re-run **in isolation**.
Classify honestly — never call a flake a pass, never call a flake a product bug.

---

## 8. HARD RULES (non-negotiable — these are the project's spine)

1. **NEVER fabricate.** No invented test results, screenshots, citations, user
   feedback, teacher studies, statistics, or ethics approval. If it wasn't run,
   say "not measured".
2. **Automated personas are NOT people.** Describe them only as automated
   scenario-based evaluation. The 5–8 teacher study **has not happened** — it is a
   stated limitation / future work.
3. **No literal "0% Turnitin"** claim. Turnitin was not run — "not measured".
4. **House style**: **ZERO em/en dashes** in the dissertation (verified at build).
   Natural, blunt, concrete, project-specific student voice. No "revolutionary",
   "seamless", "flawless".
5. **Honesty is the product's thesis.** Every displayed number must be
   fidelity-tiered (HONOURED / APPROXIMATED / NOT SIMULATED) and consistent across
   every surface. Most judge findings have been exactly this.
6. **Never weaken a gate to make it pass.** Add gates that would have failed before
   the fix.
7. **Do not hide limitations.** `docs\known-limitations.md` + the FIDELITY table.
8. **No Claude/Anthropic attribution** anywhere in the repo (owner's standing rule).

---

## 9. WHAT THE HONESTY MODEL LOOKS LIKE (so you don't break it)

- `specschema.js` → `FIDELITY.{honoured, approximated, notSimulated}` is the single
  disclosure table, rendered by the Realism dashboard, RobotLab badges, and the
  verification report annex.
- **Verdict scoping**: `diagnostics.jsx` `assess()` stamps
  `numbers.unsimHazard` when a world's defining hazard is unmodelled
  (underwater DEPTH, space VACUUM, Mars thin atmosphere `pressure<0.5 atm`,
  slope-named sites via `terrain.unsimHazard`). `afterRun()` then refuses the
  blanket "the design held up" and scopes the claim. **Any new world with an
  unmodelled defining hazard must be tagged.**
- **Top speed** is count-independent (kinematic: rpm × wheel circumference).
  **Mobility/grip IS count-dependent** (`ACTUATORS[].grip`: motors2 1.0,
  motors4 1.4, servos 0.85 → `derive().gripFactor` → `mobilityScore(gripFactor,
  massFactor, traction)`). Both the Design Check and the live tick read
  `gripFactor` — **keep them in parity**.
- **Battery** is a distance ledger; every endurance figure derives from it
  (`KodroMotion.catRangeCm` / `catEnduranceMin`), at the **world's traction**.
- An **assumed** wheel radius (quick-fit motor) can never be badged HONOURED.

---

## 10. DISSERTATION STATE + RULES

- Builds clean, **exactly 50 pages**, **0 dashes**. Keep the ~50-page design —
  **do not pad**. The brief sets no larger target.
- Has: Introduction, Background/related work, Requirements, Methodology, Design,
  Implementation, Verification/Testing, Evaluation, Discussion, **Professional
  Issues (separate Ethics + BCS criteria)**, Limitations, Future work, Conclusion,
  References, Appendices.
- **CA1 feedback (real, B band) already addressed** — see
  `.kodro\autonomy\DISSERTATION_TRACEABILITY.md`: AI-sounding prose → rewritten;
  no BCS → dedicated BCS section; ethics not separate → own Ethics section;
  literature name-dropping → each source tied to a design decision.
- Build:
  ```bash
  cd D:\project\robolearn\docs\dissertation
  pdflatex -interaction=nonstopmode Kodro_Dissertation.tex   # twice
  ```
- Verify after every edit: page count == 50, dash count == 0, no TODO/placeholder,
  all refs resolve.

---

## 11. EXACT NEXT ACTIONS (in order)

1. **Restart Chrome / reboot** (clears the degraded headless state).
2. `cd D:\project\robolearn && git rev-parse --short HEAD` → expect `38a5e92` or later.
3. Read `D:\project\robolearn\.kodro\autonomy\STATE.md` (the authoritative checkpoint).
4. Sanity-check the environment recovered:
   ```bash
   node scripts/build_web.cjs && node scripts/build_screenshot_harness.cjs
   # serve src/robolearn/assets/web on :8099
   node scripts/qa_ui.mjs     # first-run-clean should PASS again (drives ~8 m clean)
   node scripts/qa_worlds.mjs # 61/61
   ```
   If `first-run-clean` still halts at 0 m **on a fresh box**, only then treat it as
   a real defect and investigate the rover-spawn vs city-traffic-lane geometry.
5. Capture fresh evidence into `D:\project\robolearn\tmp\evidence\` (14 surfaces),
   regenerating `narrow_mobile` at a **true 420px** CDP viewport.
6. Run **judge round 15**. For each accepted finding: reproduce → root-fix →
   add a gate that would have failed before → run affected gates → full battery →
   ship (§5) → record in `BACKLOG.json` + regenerate `FINDINGS.jsonl` → update
   `STATE.md`.
7. Repeat until **two consecutive clean complete rounds**.
8. Then deliver the final report: live URL + commit hashes + live==committed hash +
   full gate matrix with real numbers + two-clean-round evidence + parity summary +
   dissertation paths/page/word/reference counts + honest list of what was
   deliberately not done.

---

## 12. HUMAN-ONLY / OUT OF SCOPE (do NOT fake these)

| Item | Status |
|---|---|
| 5–8 teacher usability study | Needs real participants + ethics/consent. **Not done.** Dissertation states it as a limitation / future evaluation. |
| Turnitin similarity | External system. **"not measured".** |
| Windows `.exe` code signing | Needs credentials. Unsigned build documented. |
| K-001 desktop pywebview boot traceback | **DISCLOSED**, harmless (console hidden). |

---

## 13. ONE-PARAGRAPH SUMMARY FOR A COLD START

Kodro is a finished, live, CI-green offline robot design + simulation studio at
`D:\project\robolearn`, deployed at https://vaibhav4046.github.io/robolearn/ with
the live bundle hash-verified equal to the committed one at `38a5e92`. Fourteen
adversarial judge rounds have been fixed, gated, and shipped; zero P0/P1 remain and
the tail is narrow P2/P3 honesty/accessibility polish. The web app is a no-build
concatenated bundle — **always `node scripts/build_web.cjs` and commit `bundle.js`
(and `styles.css`) after any web edit**. The remaining goal is two consecutive clean
adversarial rounds, blocked only by a degraded local headless Chrome pipeline that a
restart clears. The dissertation builds clean at exactly 50 pages with zero dashes
and full CA1/BCS traceability. Never fabricate evidence; never call automated
personas real users; never weaken a gate.
