# Web Decoupling Map (Phase 0)

Read-only recon produced this map. It records what the current web UI needs from
the Python desktop bridge, and the plan to run each feature fully client-side in
the static Kodro Web build (Phase 1). No source was changed to produce it.

Sources: `src/robolearn/assets/web/bridge.js` (the `window.RoboLearn` wrapper over
`window.pywebview.api`), `src/robolearn/web/app.py` (the `BridgeAPI` class), the
web `.jsx`/`.js` sources, and `docs/PERSONA_PANEL.md`.

## How the bridge is wired today

- The desktop app injects `window.pywebview.api`; `bridge.js` wraps it as
  `window.RoboLearn` and polls `isAvailable()` on mount. Every call already has a
  graceful-degradation path when the bridge is absent (the browser-demo case).
- `BridgeAPI` exposes 27 methods. The whole simulation core (program execution,
  domain-randomised validation, worlds, viewport, motion, audio) already runs in
  JavaScript with no bridge call.
- `index.html` loads the pre-compiled `bundle.js` plus vendored React, React-DOM,
  and Three.js. It does NOT load Babel at runtime (Babel is harness-only). The
  static build ships the prebuilt bundle; no in-browser transpile.

## Feature decoupling table

Legend: BROWSER = runs client-side today (or via `window.KodroProviders`);
PORT = Python logic to re-implement in JS backed by the JS engine + IndexedDB;
POLYFILL = replace a desktop file dialog / filesystem write with a browser
File API + Blob download; each is hidden behind a capability flag only if it
genuinely cannot run in the browser (none here must be hidden).

| Bridge method | Depends on | Status | Web plan |
|---|---|---|---|
| program run / step (RoverLang) | pure JS | BROWSER | already client-side (`interpreter.js`) |
| domain-randomised validation | pure JS | BROWSER | already client-side (`scenario.jsx`) |
| worlds / viewport / motion / audio | pure JS | BROWSER | already client-side |
| `list_lessons`, `get_lesson` | none (Python lesson library) | PORT | ship lessons as JSON at build; JS loader |
| `submit_attempt` (grade) | SQLite + grader + hints + learner | PORT | **largest item**: port `grader.py` success-criteria eval to JS over the JS engine trace; parity-check against golden lesson traces |
| `get_hint` | SQLite + hint engine | PORT | port `hint_engine.py` matching to JS |
| `get_pupil_summary`, `get_class_heatmap`, `list_pupils`, `create_pupil`, `select_pupil`, `rename_pupil` | SQLite (learner model, EMA) | PORT | IndexedDB `pupils` store + EMA concept-strength in JS |
| `save_scenario_run`, `list_scenario_runs` | SQLite | PORT | IndexedDB `runs` store (easy) |
| `swarm_run` | pure compute | PORT (light) | run N poses through `interpreter.js` in JS |
| `ai_status`, `ai_generate`, `ai_review_code`, `ai_ask`, `ai_chat`, `ai_chat_start`, `ai_chat_poll` | localhost Ollama | BROWSER | via `window.KodroProviders` (WebLLM / Ollama-localhost / BYOK / deterministic fallback) |
| `budget_build` | local LLM | BROWSER | via `KodroProviders`; degrade to deterministic plan with no model |
| `set_ai_model` | writes `~/.robolearn/ai_models.json` | POLYFILL | web already has `kodro_web_model` in localStorage |
| `log` | Python logger | POLYFILL | `console.*` in the browser |
| `export_report` | SQLite + filesystem | POLYFILL | build HTML in JS, Blob download |
| `pick_photo` | native file dialog | POLYFILL | `<input type=file>` to data URL |
| `import_robot_spec`, `import_project` | native file dialog | POLYFILL | `<input type=file>` reader |
| `export_robot_spec`, `export_project`, `save_verification_report` | file save dialog | POLYFILL | Blob download |

No feature is desktop-only in a way that must be hidden. The 8 filesystem
methods all have a standard browser File API equivalent.

### The one hard port: grading

`submit_attempt` and `get_hint` are the only non-trivial ports. Two options:

1. **Port the trace-grading to JS (planned default).** Physics and the execution
   trace are ALREADY produced in JS and parity-gated against the Python engine by
   golden traces (`qa_worlds` runs lessons headlessly in JS). Grading is a
   deterministic function over that trace against a lesson's success criteria, so
   it ports cleanly. Parity is protected by testing the JS grader against the same
   golden lesson traces the Python grader is tested on.
2. **Pyodide (rejected for Phase 1).** Running the unchanged `grader.py` in the
   browser via Python-to-WASM preserves parity for free but adds a ~6 MB download
   and a second runtime. Deferred; revisit only if the JS port cannot hold parity.

## Persistence: localStorage today, IndexedDB target

26 keys today. Migration groups (Phase 1 `WebBackend`):

- **UI state** (`or_terrain`, `or_tab`, `or_theme`, `kodro_mode`, `kodro_quality`,
  `kodro_tod`, `kodro_weather`, `or_view3d`, `or_fpv`, `or_readable`, `or_muted`,
  `or_onboarded`, `kodro_layout_v1`): stay in localStorage (small, synchronous).
- **Project + program data** (`kodro_robot_v2`/`v1`, `or_programs`,
  `or_lesson_buffers`): IndexedDB `projects` store, plus explicit Export/Import
  project JSON so users own their data.
- **Self-refinement memory arrays** (`kodro_reflections_v1`, `kodro_skills_v1`,
  `kodro_scenarios_v1`, `kodro_run_reports_v1`): IndexedDB object stores (they grow
  unbounded and blow the ~5 MB localStorage cap).
- **AI config + secrets** (`kodro_ai_provider`, `kodro_ai_cloud_model`,
  `kodro_web_model`, `kodro_ai_key_<id>`): keys stay browser-only, never logged,
  sent only to the selected provider. Kept in a dedicated store, not mixed with
  exportable project data, so an Export never leaks a key.

## Asset weight and web performance budget

Prod `index.html` loads (does NOT load Babel):

| Asset | Approx KB | Note |
|---|---|---|
| fonts (15 TTF) | 3619 | **largest** — subset to needed weights of the 3 families |
| bundle.js | 876 | app + components |
| three.min.js | 604 | 3D engine |
| react-dom.production.min.js | 129 | |
| interpreter.js | 41 | RoverLang |
| react + sound + motion + project | ~45 | |
| **prod JS + fonts total** | **~6.3 MB** | before font subsetting |
| babel.min.js | 3064 | harness-only, NOT shipped by index.html |

Budget target (Section 4.6): interactive under 5 s on a no-model cold load,
mid-range laptop. Levers, in order: (1) subset fonts (biggest win, ~3.6 MB to a
few hundred KB), (2) gzip/brotli via GitHub Pages, (3) defer Three.js until the 3D
viewport is opened, (4) service-worker cache so second load is instant. Model
shards (WebLLM) are opt-in and never counted in the cold-load budget.

## Baseline gates (measured this session, clean tree)

| Gate | Result |
|---|---|
| qa_interpreter | 156 / 156 |
| qa_ui | 6 flows / 24 behaviour / 12 modals |
| qa_worlds | 61 / 61 |
| pytest | 919 passed, 2 skipped (broken local Tk), 89.01% coverage |

**Baseline finding (honest):** CI on `kodro-identity-pass` had been RED since
mid-June, before pytest ever ran: ruff (43 errors), format (10 files), mypy (16
errors), then pytest coverage 83.3% < 85, plus an intermittent coverage/executor
deadlock (sandbox daemon thread traced by coverage with no declared concurrency).
All fixed in the preceding commit: ruff/format/mypy clean, coverage 89%,
`concurrency=["thread"]` added. One test, `test_cross_engine_conformance`, spawns
a Node subprocess that flakes on this Windows box; it is excluded from local
measurement and runs on CI (Linux/xvfb).

New permanent gate to add in Phase 1: `qa_web` (headless Chrome against a locally
served `site/`, asserting zero external requests in default mode, golden-trace
match on 3 lessons, IndexedDB round-trip, service-worker second-load, a11y smoke,
and the measured cold-load time).

## Known packaging gap found during recon (defer to Phase 2 core packaging)

`src/robolearn/interop/urdf_io.py` tells users to `pip install robolearn[interop]`,
but no `[interop]` optional-dependency extra is defined in `pyproject.toml`. Add
the `interop` extra (yourdfpy, urdf_parser_py) when packaging kodro-core.
