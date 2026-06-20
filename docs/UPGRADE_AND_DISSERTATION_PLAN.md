# Kodro: Dissertation + Realism Upgrade — Living Plan

This is the single source of truth for the current work sweep. One item at a
time, top to bottom. Status: TODO / WIP / DONE / BLOCKED. No fabricated
results. Offline only. No em-dashes in any deliverable prose.

Toolchain confirmed on this machine: node, python 3.13, ollama, chrome,
tectonic 0.16.9 (vendored at `.tools/tectonic.exe`, bundle cached -> genuine
offline LaTeX -> PDF).

## TRACK A — Dissertation (LaTeX, UoL logo, humanized) [PRIORITY 1, explicit]

- A1. Stage figures into `docs/dissertation/img/`. **DONE**
- A2. Author `docs/dissertation/Kodro_Dissertation.tex`. **DONE** (report
      class, CA1 framing; title page w/ UoL logo, COMP702, Keith Dures;
      declaration + AI disclosure + ethics; Intro, Background, Requirements,
      Design, Implementation, Evaluation, Discussion/Limitations, Conclusion,
      17 real references, 3 appendices; 4 figures embedded).
- A3. Compile with tectonic. **DONE** -> `Kodro_Dissertation.pdf`, 35 pages,
      638 KB, figures + TOC + lists resolved. Stale HTML-built PDF replaced.
- A4. Proof. **DONE** zero em/en dashes (grep clean); honest numbers
      (interpreter 21/21, >800 pytest ~86%, persona 5.86->7.36); AI
      disclosure + ethics present; no fabricated study results.

  TRACK A COMPLETE. Deliverable: docs/dissertation/Kodro_Dissertation.tex
  + Kodro_Dissertation.pdf. Reproduce: `.tools/tectonic.exe
  Kodro_Dissertation.tex` from docs/dissertation/.

## TRACK B — Product realism upgrade (offline, honest labels)

Grounded in `docs/known-limitations.md` (the real gaps), not the generic
template. Each item shipped + rebuilt bundle + verified.

- B1. RobotSpec as true source of truth. **DONE** (verified: build OK,
      interpreter QA 21/21). `window.KodroCommands` (RobotLab.jsx) is the one
      registry: check/availability/groundingText. `host.sensor()` (app.jsx)
      refuses ungated sensor commands with a readable reason across text +
      blocks + voice. Assistant `vibeSend` injects `groundingText` so the model
      is told which commands to use and which to refuse; the runtime gate +
      self-test are the deterministic backstop for any code source.
- B2. Movement dynamics pass. **DONE** (verified: build OK, QA 21/21, profile
      math proven exact-endpoint + monotonic across mass). animateMove now uses
      a mass-scaled trapezoidal accel/cruise/brake profile; momentum carries
      between straight moves (s.vel), turns + waits bleed it; turns are
      mass-scaled and eased. Endpoints exact so collisions/distances unchanged.
      Traction + battery-by-mass + collision-stop already present, retained.
- B3. Scenario validation + domain randomisation. **ENGINE+PERSISTENCE DONE**
      (verified: Node end-to-end deterministic run; 4 store tests pass; bundle
      OK; QA 21/21). New `scenario.jsx` (window.KodroScenario): seeded
      domain-randomised headless multi-seed evaluator on the real interpreter
      (varies friction/mass/sensor-noise/obstacle jitter), full schema + 3
      presets, per-seed + aggregate metrics (successRate, collisions, time,
      battery, score, clearance). Persists to SQLite via new
      `Store.save_scenario_run`/`list_scenario_runs` + BridgeAPI
      `save_scenario_run` + bridge.js `saveScenarioRun`, and to localStorage
      via `KodroMemory.saveScenarioReport`. Registered in build ORDER.
      REMAINING (folded into B8/B9): on-screen report card + trigger button.
- B4. Environment realism. **PARTIAL (core already present)**. Viewport3D
      already renders City + Room + Earth/Mars/Moon/underwater/space with
      shadows, PMREM env maps, PBR materials, fog, obstacles and moving
      agents (traffic + pedestrians that brake for the robot). REMAINING
      (needs a working visual preview to do well): explicit Warehouse + Debug
      grid presets, a Low/Med/High/Cinematic performance toggle, robot-POV
      mini viewport. Deferred: blind edits to the 52KB Viewport3D without
      visual verification are low-confidence.
- B5. Robot visual realism. **SUBSTANTIALLY DONE (existing + B2)**. Detailed
      car/rover/arm/home models with rimmed wheels on the ground; wheels
      rotate proportional to distance moved (Viewport3D:708); front-axle
      steering; status LED; matte/metal/rubber MeshStandard materials. B2
      added the acceleration/inertia/braking feel that fixes the "magical
      sliding" complaint. REMAINING enhancement: a visible sensor module on
      the robot reflecting the fitted parts.
- B6. Ollama UX. **DONE** (verified: bundle OK, web.app imports set_ai_model).
      ai_status now returns installed models + current override; new
      `set_ai_model` bridge persists the user's chosen model to
      ~/.robolearn/ai_models.json; both `_pick_ai_model` and `_pick_fast_model`
      honour it (so a user can point Kodro at DeepSeek/Nemotron/Qwen/etc.).
      Vibe panel shows a model dropdown + Auto reset. Deterministic fallback
      preserved (override only used if the model is installed).
- B7. Onboarding AI agent. **DONE** (verified: bundle OK; Node mapper check
      across 5 prompts all produce valid catalogue-bound specs, no invented
      parts). `RobotLab.fromText`/`buildFromText` + `window.KodroRobotFromText`
      map a typed/spoken description onto the validated parts catalogue (data
      only, never executable code). Onboarding step 1 has a "describe your
      robot" input + voice button; step 2 shows the fitted parts. enterStudio
      preserves the agent-built spec.
- B8. Realism dashboard. **DONE** (verified: bundle 16 sources, QA 21/21).
      New `realism.jsx` (window.KodroRealism) renders 5 cards (physics,
      sensors, scenario score, environment, command registry with
      available/disabled-and-reason) from the live sources of truth. Wired a
      "📊 Realism" button + a "🎯 Validate" button (runs B3 seeded validation
      on the current program, persists, opens the dashboard). This also
      completes B3's on-screen report/trigger.
- B9. Guided "Kodro Realism Demo". **DONE** (verified: Node runs all 6 step
      actions; DEMO FLOW OK true; the remove-ultrasonic step genuinely refuses
      read_distance; skill+reflection saved and retrieved). New `demo.jsx`
      (window.KodroDemo): a 6-step guided tour that performs REAL actions
      (build -> registry -> validate seeds -> remove sensor + refusal -> refit
      + save skill/reflection -> retrieve), launched by a "▶ Demo" button. No
      faked screens. Bundle 17 sources, QA 21/21.
- B10. Docs honesty pass. **DONE**. New `docs/realism-system.md` and
       `docs/ca2-demo-script.md`; updated `implementation-status.md` (new
       components) and `known-limitations.md` (gating now complete, movement
       dynamics noted). README already carries the honest positioning and the
       "what Kodro is NOT" section with no fake NVIDIA/HF/ROS2/Isaac/Blender
       claims. GitHub/portfolio refresh (TRACK C) not done.

## B12 — Final verification. DONE
- Full pytest: 853 passed, 1 skipped (was 851; +2 scenario store tests, no
  regressions). bundle.js freshness check passes. Interpreter QA 21/21.
  Node end-to-end checks: scenario evaluator deterministic, onboarding mapper
  valid for all prompts, full demo flow OK (incl. sensor-removal refusal).

## TRACK C — Verification (every change)

- node scripts/qa_interpreter.mjs  (expect 21/21)
- python -m pytest                  (expect ~851 pass)
- node scripts/build_web.cjs        (rebuild bundle after any .jsx edit)
- Offline screenshot harness for visual proof.

## Hard constraints (never violate)

Offline: zero paid services, zero cloud API, zero accounts. Ollama localhost
only, deterministic fallback always works. No fake NVIDIA/HF/ROS2/Isaac/
Blender integration. No claim of production accuracy or replacing Isaac/
Gazebo/Webots/MuJoCo. "Real-world data" = vendored offline datasets/maps, not
live API. Honest marker grade ~74 (strong A); never fabricate a score.
