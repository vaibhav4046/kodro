# Implementation Status

This table is the honest per component view of what ships in Kodro
today. Status values:

- **Complete**: shipped, tested, on the user path.
- **Partial**: shipped and useful, but with known gaps documented in
  [`known-limitations.md`](known-limitations.md).
- **Experimental**: shipped behind a flag or only on a side path, not
  yet production quality.
- **Roadmap**: not in the code; tracked in [`roadmap.md`](roadmap.md).

| Component | Status | Notes |
| --- | --- | --- |
| Robot Builder | Complete | Robot Lab assembles a robot from board, sensors, actuators and chassis type; derives mass, top speed, runtime. |
| Python Interpreter | Complete | Python subset interpreter in `interpreter.js`; `node scripts/qa_interpreter.mjs` reported 180 passed, 0 failed on 14 August 2026, and it runs all bundled lessons. |
| Block Coding | Complete | Scratch style blocks palette compiles to the same Python the interpreter runs; reordering, speed, wait, pen and drop blocks. |
| 3D Rendering | Complete | Three.js r137 core, environment map, shadows, tone mapping, per type motion feel. Procedural geometry only, no glTF loading. |
| 2D Viewport | Complete | Tk embedded pygame surface via base64 PPM, four terrain palettes, perspective diorama mode, pen trail. |
| Moving Agents | Partial | City traffic and pedestrians brake for the rover. Motion is kinematic, not rigid body. Pymunk exists but is not wired into the runtime. |
| Telemetry | Complete | Heading, battery, LIDAR distance, samples collected, compass dial, arc gauges, history charts, pen trail minimap. |
| Experience Memory | Partial | localStorage reflections and saved skills can feed later sessions. Storage and retrieval are implemented, but no controlled ablation demonstrates fewer design iterations. |
| Local AI Assistant | Complete | Ollama on localhost, 3 to 4B open model preference, deterministic rule based fallback when Ollama is absent. Vibe coding, ask, review and budget builder panels. |
| Code Reviewer | Complete | Propose then critique reviewer on the local model; up to three issues; rewrite accepted only after passing the same sandbox as Run. |
| Lesson Grading | Complete | Pure function grader over the trace; per criterion checks for samples, collisions, battery, constructs, base return, steps, distance; AST walk for allowed constructs. |
| Teacher Dashboard | Complete | Class concept strength heatmap in both the web app and the legacy Tk dashboard. Exports differ by surface and the row used to flatten them: the Tk dashboard exports the heatmap as CSV or PDF (`ui/teacher_dashboard.py:196-205`); the web teacher modal's two CSV downloads are gated on `browserMode` (`assets/web/panels.jsx:333`), so the packaged WebView2 window shows neither, and no surface but Tk exports PDF. The single-pupil progress report is separate from the modal, at Settings (`assets/web/app.jsx:2716`), and writes HTML on the desktop or a text file in the browser. The per pupil drill down, a submissions list plus a strength table, is Tk only (`ui/teacher_dashboard.py:183-190`); the web modal (`assets/web/panels.jsx:280-417`) has no cell handler. Browser mode keeps one combined on-device record in localStorage, not the SQLite register. |
| SQLite Persistence | Complete | Pupils, submissions and concept strength tables; EMA updates; submission trace round trips through JSON. |
| PyInstaller Packaging | Complete | `python scripts/build_exe.py` builds a windowed WebView2 `Kodro.exe`; verified launching and rendering the full UI. |
| Command Registry | Complete | `KodroCommands` (in `RobotLab.jsx`) is the single source of truth; every fitted-part command is gated across text, blocks and the assistant, with a readable refusal when a part is missing. |
| Movement Dynamics | Complete | Mass-scaled acceleration, cruise and braking plus momentum carry-over in `animateMove`; move endpoints are exact, so collisions and distances are unchanged. Kinematic, not rigid body. |
| Scenario Validation | Complete | `KodroScenario` runs a program across seeded, domain-randomised runs (friction, mass, sensor noise, obstacle placement) and reports a spread; results persist to localStorage and to SQLite (`Store.save_scenario_run`, tested). |
| Deterministic Prove | Complete | Four declarative contracts run over five controlled seeds, emit a canonical manifest and human report, compare against a baseline, reproduce byte-identically and fail for the committed broken controller fixture. |
| Realism Dashboard | Complete | `KodroRealism` shows physics, sensors, scenario score, environment and the command registry from the live sources of truth. |
| Onboarding Agent | Complete | A typed description is mapped onto the validated parts catalogue (`RobotLab.fromText`); it produces data only, never executable code. |
| Model Picker | Complete | The user can point Kodro at any installed local model (DeepSeek, Nemotron, Qwen, a custom fine-tune); the choice persists and is honoured by the assistant, with the deterministic fallback preserved. |
| Guided Realism Demo | Complete | `KodroDemo` performs the real build, gate, validate, refuse, refit and reuse loop with no faked screens. |
| Web Companion | Complete | 92 tracked files under `assets/web/` build a browser runtime that shares the desktop interpreter, motion model and lesson library. `scripts/qa_grader.mjs` holds its JavaScript grader to the reason strings `grader.py` produces (55 checks). Single-pupil: the browser keeps one combined record, the desktop bridge keeps separate identities. |
| MCP Server | Complete | `robolearn.mcp` speaks JSON-RPC over stdio using only the standard library, no protocol package. 8 tools and 25 resources counted at run time; 66 unit tests; the Windows and Unix smoke scripts each pass 14 checks against a real subprocess. Verified against a real stdio session, not against a named client. |
| Voice Control | Partial | Speech and typing reach the same deterministic intent parser, so a transcript parses identically either way; 108 checks in `qa_voice.mjs`. Local speech-to-text is benchmarked and offline. Browser dictation is opt-in, off by default, and sends audio off the machine, which the in-product notice states. |
