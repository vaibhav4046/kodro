# KODRO — ULTIMATE MASTER HANDOFF PROMPT

> Paste this whole file as the first message of a new Claude Code session.
> It is self-contained: every path, link, constraint, and the full week plan.
> The new session must orchestrate with **multi-agent Workflows** (many small fast
> agents in parallel), validate **everything in the browser**, and drive the
> product to a genuine, measured 10/10 — without faking any number.

> **STALENESS WARNING, added 15 August 2026. Read this before you trust any
> number below.** The instructions, paths and constraints in this file are still
> broadly right. The measurements are not: they are a snapshot from well before
> the CA2 release pass and every one of them now reads low, because the gates and
> the library grew, not because anything regressed. Specifically, this file says
> the interpreter gate is `21/21` (it is 180), that `pytest` is `851 passed`
> (the last clean full run collected 1639, passed 1638, skipped 1, at commit
> `aa174cf`, with coverage 90.9 against the 85 gate), that the library holds
> 10 lessons (it holds 24), and that the dissertation is about 20 pages (it is
> 50 numbered pages). Do not treat the higher live figures as failures against
> the "expect" lines in sections 4 and 8. For the current figure on every gate,
> with the exact summary line it printed, see
> [`docs/eval/qa_gate_runs_2026-08-14.md`](eval/qa_gate_runs_2026-08-14.md); for
> the Python suite see [`docs/eval/test_suite.json`](eval/test_suite.json).

---

## 0. WHO I AM / NON-NEGOTIABLE INTEGRITY RULES (read first, never violate)

- I am Vaibhav Lalwani, MSc Computer Science honours-year student, University of
  Liverpool, module COMP702. Kodro is my dissertation project.
- **No fabricated scores.** Never write "10/10" or "100" or invent a marker grade.
  The honest measured marker grade today is ~74 (strong A). A* needs real empirical
  data from the planned user/teacher study, which only a real run can produce.
- **No fabricated testing / no fake user studies / no fake citations / no fake
  results** in the dissertation. Report measured persona-eval numbers honestly.
- **Hard offline constraint:** zero paid services, zero cloud API calls, zero
  accounts, zero LLM weight-retraining. "Self-refining" = system-level localStorage
  reflection/skills, honestly framed, NOT model weight updates.
- **Writing style:** organic, blunt, concrete prose. **No em-dashes or en-dashes.**
  Brutal honest use cases including who it is NOT for. Keep the AI-assistance
  disclosure in the dissertation.
- **Working style:** production-quality procedural Python and clean JS. Strict
  quality bar. No shortcuts, no stubs left behind.
- When something is verified, say so with the evidence. When a test fails, quote it.

---

## 1. WHAT KODRO IS (the reframe — this is NOT a kids' coding tutor)

Kodro is an **offline desktop robot DESIGN-and-SIMULATION platform** for a
non-expert. The loop is: **design a custom robot → program it (code / blocks /
voice, with a grounded local-AI assistant + code reviewer) → validate its
behaviour in a realistic simulated WORLD → the system self-refines from usage.**

- The AI **recommends the right world** for the robot it is given: a self-driving
  car gets the **City** (traffic + pedestrians + crossings); a companion/home/arm
  robot gets the **Room** (furniture + people); a rover gets a planetary terrain
  (Earth/Mars/Moon/underwater/space). "Test it there first."
- Worlds must read as **real and accurate** (not AAA, but believable): one-way lane
  traffic that loops and **brakes for the robot**, pedestrians on pavements that use
  the crossing, 3D depth you can orbit 360 degrees.
- Movement must read as **natural** (weight transfer, suspension, banking, front-wheel
  steer), not sliding props.

---

## 2. WHERE EVERYTHING LIVES

**Project root:** `D:\project\robolearn`  (Windows 11, PowerShell + Bash both available)
**GitHub:** https://github.com/vaibhav4046/robolearn  (remote `origin`, branch `main`)
**Portfolio site:** repo `vaibhav-portfolio` (static, deployed on Vercel)
**GitHub profile README:** repo `vaibhav4046` (profile). GH push email is the noreply form.
**User email:** the account's own address; commits use the GitHub noreply form above.   **Today:** 2026-06-14
**Auto-memory index:** `%USERPROFILE%\.claude\projects\D--\memory\MEMORY.md`

### Web app source (React JSX, pre-compiled offline — NO build server)
All under `src/robolearn/assets/web/`:
- `app.jsx` — main App. EXAMPLES programs (7), host.sensor, animateMove/animateTurn
  kinematics, advance() generator pump, navbar (Robot Lab 🛠 / Memory 🧠), world
  selector, brand mark (`ORBIT_SVG`, lines ~1310). **NO onboarding/landing screen yet.**
- `interpreter.js` — Python-subset interpreter. `window.RoverLang.compile(src).run(host)`
  returns a generator yielding `{type:'move'|'turn'|'speed'|'sensor'|...}`. Two motion
  call styles, both correct: bare `move_forward(2)` = 2 metres (scaled x100 at line 603);
  `rover.forward(200)` = 200 cm (engine units). Validated 21/21 (see section 4).
- `Viewport3D.jsx` — Three.js r137 (core only, vendored). buildCity / buildRoom,
  type-aware robot (car/home/arm/rover), natural-motion tick (pitch/roll/suspension/steer),
  PMREM env map, shadows, ACES tone mapping.
- `Viewport.jsx` — 2D viewport.
- `terrains.jsx` — terrain catalogue incl. city + room; 2D obstacles/agents renderers.
- `agents.jsx` — `window.KodroAgents`: shared moving traffic + pedestrians in cm world
  coords; one-way lanes, looping, brakes for `window.KODRO_ROVER`; rAF-driven with a
  no-rAF fallback. (rAF is throttled by browser-automation tabs — artifact, not a bug;
  the real window animates via this + rover via setTimeout.)
- `memory.jsx` — `window.KodroMemory`: localStorage self-refinement (reflections + skills).
- `RobotLab.jsx` — `window.RobotLab` + `window.getKodroRobot()`: boards/sensors/actuators/
  types catalogue, derive() (mass/speed/runtime), WORLD_FOR map, save() dispatches
  `kodro-robot` event with the recommended world.
- `Editor.jsx`, `Telemetry.jsx`, `tweaks-panel.jsx`, `Rover.jsx` — supporting UI.
- `bridge.js`, `sound.js` — host bridge + audio.
- `bundle.js` — built artifact (320 KB). **Rebuild after any .jsx edit:**
  `node scripts/build_web.cjs`  (vendored Babel, offline; ORDER array sets load order).

### Python engine + API (metres world; pymunk/pygame-ce)
- `src/robolearn/rover_api.py` — public API (move_forward in metres, clamp 0-1000 m).
- `src/robolearn/engine/physics.py` — arena in METRES, walls as pymunk segments.
- `src/robolearn/engine/` — rover, sensors, terrain, world, renderer, particles.
- `src/robolearn/app.py`, `__main__.py` — app entry.
- `src/robolearn/lessons/library/*.yaml` — 10 lessons (00_first_drive … 07_sensors).

### Build / packaging / scripts (`scripts/`)
- `build_web.cjs` — JSX → bundle.js (run after every web edit).
- `build_exe.py` + `robolearn-web.spec` — PyInstaller → `dist/RoboLearn.exe` (windowed
  WebView2 app). Also `dist/RoboLearn-windows-x64.exe`. Desktop copy named `Kodro.exe`.
- `qa_interpreter.mjs` — **offline functional QA harness** (Node). Loads the shipped
  interpreter, drives the generator with the real kinematics + wall ray, asserts command
  semantics + all 7 examples. Run: `node scripts/qa_interpreter.mjs`. Currently 21/21.
- `make_icon.py`, `make_ai_model.py`, `train_ai.py`, `stress_test_lessons.py`,
  `generate_curriculum_report.py`.
- App icon: `src/robolearn/assets/icon.ico`. Brand SVG: `ORBIT_SVG` in `app.jsx`.

### Docs / dissertation / report
- Dissertation HTML (CA3, 70%, due **2026-09-11**, max 50pp, Turnitin):
  `docs/dissertation/Kodro_Dissertation.html` (+ `.pdf`, + chapter .md files 00–05).
- CA1 proposal (marked ~A / 74): `docs/ca1/CA1_Specification_Design_Proposal.html`,
  `docs/ca1/Kodro_CA1_Specification_Design_Proposal.pdf`, text at `docs/ca1/_proposal_text.txt`,
  figures in `docs/ca1/img/`.
- `HUMAN_TODO.md` — the 3 things only a human can finish (the teacher study etc.).
- `README.md`, `CHANGELOG.md`, mkdocs site under `docs/`.

### Test suite
- `tests/` — 851 pytest tests, 1 skipped (Tk env), ~86% coverage, gate `--cov-fail-under=85`.
  Run: `python -m pytest`.

---

## 3. CONSTRAINTS THE NEW SESSION MUST RESPECT

- Three.js is **core only** (no GLTFLoader / postprocessing addons). Build geometry in code.
- D:\ root is **not writable**; subdirectories are. Write under `D:\project\robolearn`.
- Local Ollama (localhost:11434, small 3-4B open model) optional; deterministic rule-based
  fallback must always work with Ollama absent.
- Browser-automation tabs throttle requestAnimationFrame (rafFired:0). That is an
  automation artifact. Verify agent motion by stepping `KodroAgents.step(dt)` directly,
  and rover motion via the setTimeout-driven `frames()` path — both work in the real window.

---

## 4. VALIDATED STATE AS OF THIS HANDOFF (already proven, do not redo blindly)

- **Interpreter + kinematics: 21/21** via `node scripts/qa_interpreter.mjs`. Command
  semantics correct (move metres vs cm both right, turn, speed clamp, 10**400 guarded,
  for/while/sensor), all 7 shipped example programs terminate, move, stay in the 3000x3000
  arena box, never hit a wall, never throw.
- **Python engine: 851 passed, 1 skipped, ~86% coverage.**
- City has one-way looping traffic that brakes for the robot; pedestrians on pavements +
  crossing. 3D has a detailed car, env map, shadows, natural-motion tick. Robot Lab +
  Memory (self-refinement) wired into the app.
- Dissertation grown to ~20 pages with real chapters + architecture diagram + figures.
- RoboLearn.exe builds and runs (installed WebView2 window titled "Kodro").

---

## 5. THE WEEK PLAN — what the new session must deliver (run as parallel Workflows)

> **Orchestration rule:** use the **Workflow tool** for every non-trivial phase. Many
> small fast agents in parallel (pipeline by default, barrier only when a stage needs all
> prior results). Adversarially verify findings. Validate in the browser with the
> `preview_*` tools (start server, reload, snapshot, click/fill, console/network, screenshot)
> — never claim something works without browser proof. Keep the integrity rules in section 0.

**TRACK A — PRODUCT to a measured 10/10**
1. **Full functional re-validation (white-box + browser).** Re-run `qa_interpreter.mjs`
   and `pytest`. Then in the browser: load the app, run all 7 examples + every lesson,
   confirm visible motion, traffic/pedestrian animation, collisions, sensors, Robot Lab
   save → world recommendation, Memory reflections. Capture screenshots as proof. Fan out:
   one agent per example/lesson, one per subsystem.
2. **New sleek minimal LOGO.** Redesign the Kodro brand mark (`ORBIT_SVG` in `app.jsx`)
   and `src/robolearn/assets/icon.ico` — modern, minimal, professional. Rebuild bundle +
   exe. Show before/after in browser.
3. **Onboarding / landing / home PIPELINE (currently absent).** Add a professional app
   flow like real products: splash/landing → short onboarding (what Kodro is, pick a
   robot or a world) → home/dashboard → main IDE. Smooth, beautiful, skippable, remembered
   in localStorage. Verify the whole flow in the browser.
4. **Motion + environment realism pass.** Make movement natural and worlds accurate across
   city/room/terrains. Give rover and home-bot the same detail pass the car already has.
5. **Code quality / complexity audit.** White-box review of interpreter, app.jsx,
   Viewport3D, agents, engine. Flag complexity hot spots, dead code, edge cases; fix.
   Adversarially verify each fix.
6. **Package + smoke-test the installed app** (RoboLearn.exe / Kodro.exe), not `python -m`.

**TRACK B — DISSERTATION (parallel, due 2026-09-11)**
7. Grow `docs/dissertation/Kodro_Dissertation.html` toward the 50pp CA3 spec: tighten
   Intro/positioning, Requirements (tables + use cases), Design + architecture,
   Implementation (real, from the actual code), Evaluation (honest measured persona-eval +
   the observed self-refinement loop; mark the teacher study as pending in `HUMAN_TODO.md`),
   Conclusion. No fabricated data or citations. No em-dashes. Keep the AI disclosure.
8. Regenerate the PDF and proof it in the browser/PDF viewer.

**TRACK C — GITHUB / PORTFOLIO (parallel)**
9. Update `vaibhav4046/robolearn`: polished README with **screenshots** (capture from the
   browser), feature list, the design→program→validate→refine loop, build/run instructions,
   architecture diagram, the honest QA numbers (21/21 interpreter, 851 pytest).
10. Add a Kodro project card to the portfolio (`vaibhav-portfolio`) and the profile README
    (`vaibhav4046`) with a hero screenshot. Commit + push (use the noreply email form).

**INTEGRITY GATES on every track:** report the real measured marker number, never a faked
10/100; no fabricated testing or citations; offline-only; no em-dashes; verify in the
browser before claiming done.

---

## 6. FAST-START COMMANDS

```
cd D:\project\robolearn
node scripts/qa_interpreter.mjs          # interpreter functional QA (expect 21/21)
python -m pytest                          # engine tests (expect 851 passed)
node scripts/build_web.cjs                # rebuild bundle.js after any .jsx edit
python scripts/build_exe.py               # rebuild dist/RoboLearn.exe
```
Web entry: `src/robolearn/assets/web/index.html` (loads bundle.js).
Brand mark to redesign: `ORBIT_SVG` in `app.jsx` (~line 1311) + `src/robolearn/assets/icon.ico`.

---

## 7. ONE-LINE KICKOFF FOR THE NEW SESSION

> "Read docs/HANDOFF_MASTER_PROMPT.md. Then orchestrate the Week Plan (section 5) using
> multi-agent Workflows — many small fast agents in parallel, adversarially verified,
> browser-validated. Drive Kodro to a genuine measured 10/10: re-route all QA/testing,
> new sleek minimal logo, add the onboarding/landing/home pipeline, realism pass, code +
> complexity audit, dissertation in parallel, and update GitHub + portfolio with
> screenshots. Respect every integrity rule in section 0. Do not fake any score. Begin."
