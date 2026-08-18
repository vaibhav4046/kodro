# Kodro - Master Context + Handoff for Codex

Task for Codex: read ALL of this, then OUTPUT a single, exact, self-contained
development prompt to paste into "Fable 5" (Claude Opus, Fable Protocol) to take
Kodro to a god-tier product in every aspect AND finish the MSc dissertation. Do
not start coding. The only deliverable is that Fable 5 prompt.

## 0. What Kodro is
Offline-first, $0, browser + desktop platform that teaches ages 6-17 to code real
robots in Python (blocks for the youngest, Python for teens), lessons mapped to UK
Key Stages KS1-KS4. Deterministic robot simulator (2.5D + real 3D via vendored
Three.js), a lesson grader with pupil-facing hints, a self-refining memory
(reflections + skills + a memory graph), and an AI layer (local Ollama by default,
optional BYOK cloud) that writes code AND builds robots / switches worlds from
plain English. Also the artefact for an MSc dissertation (COMP702, Liverpool).

## 1. Identity / owner
- Vaibhav Lalwani, UK honours-year CS student, University of Liverpool.
- Module COMP702 MSc dissertation (70%). Due 11 Sep 2026. Single PDF, max 50
  pages, Turnitin.
- The dev pastes prompts into "Fable 5" (Claude Opus running the Fable Protocol).

## 2. Repo / paths
- Local root: `D:\project\robolearn` (Windows; git-bash + PowerShell).
- Origin: https://github.com/vaibhav4046/robolearn.git
- Work branch `kodro-identity-pass`; main `main`. Flow: commit on
  kodro-identity-pass, `git checkout main`, `git merge --ff-only
  kodro-identity-pass`, push BOTH.
- HEAD 157950a (plus a light-theme HUD readability fix landing on top).

## 3. Live links
- Web app: https://vaibhav4046.github.io/robolearn/
- Installer: `D:\project\robolearn\dist\Kodro.exe` (PyInstaller from kodro-web.spec).

## 4. Dissertation
- Source `docs/dissertation/Kodro_Dissertation.tex`; compiled
  `docs/dissertation/Kodro_Dissertation.pdf`. Chapter seeds
  `docs/dissertation/00-introduction.md` .. `05-glossary.md`.
- Supporting: `docs/ACCEPTANCE.md`, `docs/HANDOFF_MASTER_PROMPT.md`,
  `docs/MARKET_RESEARCH.md`, `docs/implementation-status.md`,
  `docs/known-limitations.md`, `docs/realism-system.md`, `docs/roadmap.md`,
  `docs/ca1/`, `docs/ca2-demo-script.md`, `docs/eval/`, `mkdocs.yml`.
- Measured results only. No fabricated user studies or 10/10. Personas SIMULATED,
  labelled as such. Must not contradict the submitted CA1.

## 5. Architecture
- Web app has NO build tooling, NO npm. Vendored React + Three.js r137 UMD.
  `src/kodro/assets/web/*.jsx|*.js` are IIFE modules; `scripts/build_web.cjs`
  concatenates ~36 modules per a fixed ORDER into `bundle.js`. After ANY web edit,
  rebuild `bundle.js` (`node scripts/build_web.cjs`) and COMMIT it; CI freshness
  gate is `node scripts/build_web.cjs --check`. Static site:
  `node scripts/build_web.cjs --static` (site/, gitignored, CI-built).
- Modules talk via `window.Kodro*` globals. Key files: app.jsx, hooks.jsx,
  panels.jsx, Viewport3D.jsx, Viewport.jsx, RobotLab.jsx, lesson-grader.jsx,
  memory.jsx, memory-graph.js, ai-web.jsx, ai-providers.jsx, chat-intent.js,
  sim-physics.js, terrains.jsx, styles.css.
- `cap.html` is a GENERATED test harness (gitignored) from
  `scripts/build_screenshot_harness.cjs` - edit the generator, never cap.html.
- Desktop: kodro-web.spec (pywebview -> Kodro.exe), kodro.spec (Tk).
  Python package `src/kodro` (grader, interpreter, engine, ai/ollama_client.py).
- CI `.github/workflows/ci.yml` (ubuntu+macos+windows). `deploy-pages.yml` deploys
  on workflow_run after CI success. qa_ui and qa_worlds are LOCAL-only gates.

## 6. Gate commands (counts as at 10 July 2026, not current)

The commands below are still the right commands. The numbers beside them are a
snapshot from when this file was written on 10 July 2026 and several have since
grown, so do not treat a mismatch as a regression. The current figures, with the
exact printed summary line for each gate, are in
[`docs/eval/qa_gate_runs_2026-08-14.md`](eval/qa_gate_runs_2026-08-14.md).

- `node scripts/qa_interpreter.mjs` -> 157
- `node scripts/qa_grader.mjs` -> 34
- `node scripts/qa_physics.mjs` -> 20
- `node scripts/qa_ai_web.mjs` -> 19
- `node scripts/qa_web.mjs` -> 4/4 (Chrome)
- `node scripts/qa_ui.mjs` -> 6/6 flows, 28/28 behaviour, 12/12 modals (:8099 + Chrome)
- `node scripts/qa_worlds.mjs` -> 61/61 (:8099 + Chrome)
- `python -m pytest -q --basetemp=<fresh dir>` -> 0 failed, coverage over the 85
  percent gate. Pass counts are deliberately not restated here, because the ones
  that were have gone stale; `docs/eval/test_suite.json` pins the authoritative
  run to a commit. The `--basetemp` flag works around a host ACL defect on this
  machine, recorded in `.kodro/ca2-evidence/2026-08-15-suite-reproduction-and-tempdir-defect.md`.
- Serve for browser gates: `cd src/kodro/assets/web && python -m http.server 8099`
- `CHROME_PATH=/c/Program Files/Google/Chrome/Application/chrome.exe`
- ENV TRAP (fixed, keep fixed): the `robolearn` editable-install .pth at
  `...\Python313\Lib\site-packages\_editable_impl_robolearn.pth` was pointing at a
  stale OneDrive clone; now points at `D:\project\robolearn\src`. Verify with
  `python -c "import kodro.ai.ollama_client as m; print(m.__file__)"`.

## 7. Hard constraints (never violate)
1. Honesty is the product. Never fabricate benchmarks/tests/user-studies/"10/10".
   An adversarial judge panel plateaus ~8.1; a literal 10.0 is not reachable
   without gaming it. Report measured results and failures plainly.
2. No em-dashes or en-dashes in dissertation / README / launch copy.
3. Offline-first, $0 default. Cloud is opt-in BYOK only; keys in localStorage,
   sent only to the chosen provider, never logged. Never type the user's real keys.
4. Personas / evaluations are simulated, not human. Say so.
5. Do not contradict the submitted CA1 (`docs/ca1`).
6. Git: work on kodro-identity-pass, ff main, push both. No Co-Authored-By
   trailer. Zero Claude/Anthropic attribution in vaibhav4046 repos.
7. All gates green at every commit; deploy gated on CI success.
8. After any web edit: rebuild and commit bundle.js.
9. Gate every behavioural change with a real test; verify end-to-end in a real
   browser (headless Chrome via cap.html), not just compile.

## 8. Already done (build on it, do not redo)
5 demo bugs; durable Vibe chat; memory graph (KodroMemoryGraph); chat-builds-world
(KodroChatIntent, conservative, works offline); classroom learning loop (goal
checklist, progressive hints, ask-why, stuck-detection, next-lesson); round-2
direction/motion + honesty fixes; light-theme HUD readability (fixed --hud-fg
tokens; qa_ui light-hud assert; world-switch text luminance 0.87 on dark glass).

## 9. Gaps / god-tier targets (verified against source at e801511)
ALREADY SHIPPED (do not list as gaps): KodroBench (src/kodro/kodrobench.py,
bench.py, results/kodrobench-v0.1.json), CLI console scripts (robolearn, kodro,
kodrobench in pyproject.toml), URDF import+export (src/kodro/interop/urdf_io.py,
[interop] extra), seeded domain randomization (bench.py), model picker.
GENUINELY OPEN, highest leverage first: (1) in-browser pupil records store -- the
web Teacher Dashboard is a self-admitted empty-state (panels.jsx TeacherModal),
killing the hosted/$0 classroom value; (2) run replay + seed/event enrichment
(runreport.js stores summaries only, no seed/trace); (3) Gymnasium KodroEnv-v0 over
bench.py (KodroBench shipped, the Env wrapper did not); (4) full sensor command
bindings (camera/gps/bumper/line/gripper are fitted but have no runnable command;
gating exists only for distance()/heading()); (5) URDF->KRS import into the web Lab
(both ends exist, no bridge); (6) world/mission authoring UI (worlds are code-only);
(7) bounded AI tool/function-calling loop (chat-builds-world is regex intent-parse);
(8) RobotSpec v0->v1 migration step. STILL PARTIAL/ABSENT: app.jsx God-component
decomposition (partial); packaged glTF/Webots/ROS export bundle (absent, glTF blocked
by offline rule); i18n (absent, not partial); Pymunk-into-runtime (largest single
change); accessibility + mobile/touch + full element-by-element theme parity (partial).

## 10. Codex output
Produce ONE copy-paste Fable 5 prompt that: (a) restates identity, repo,
branch/push flow, live links, dissertation paths, and all section-7 constraints;
(b) directs god-tier work across sim correctness/realism, KS1-KS4 pedagogy, AI
layer, design/UX (full light+dark parity, WCAG, mobile), performance, and the
section-9 roadmap, each gated by a real test and verified end-to-end, in small
green commits; (c) directs finishing the dissertation (.tex -> .pdf, <=50pp,
Turnitin-ready, no dashes, measured results, consistent with CA1); (d) encodes
Fable Protocol discipline + all gates green + rebuild/commit bundle.js after web
edits; (e) tells Fable 5 to first run every section-6 gate to confirm a green
baseline and reconcile git before working in prioritised phases. Self-contained,
concrete, no em/en dashes. Output ONLY that prompt.
