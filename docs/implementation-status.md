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
| Python Interpreter | Complete | Python subset interpreter in `interpreter.js`, 21 of 21 interpreter QA passing, runs all bundled lessons. |
| Block Coding | Complete | Scratch style blocks palette compiles to the same Python the interpreter runs; reordering, speed, wait, pen and drop blocks. |
| Voice Input | Partial | Deterministic phrase parser works everywhere. With `faster-whisper` installed, speech to text is offline and cross platform. Without it, falls back to Windows SAPI. |
| 3D Rendering | Complete | Three.js r137 core, environment map, shadows, tone mapping, per type motion feel. Procedural geometry only, no glTF loading. |
| 2D Viewport | Complete | Tk embedded pygame surface via base64 PPM, four terrain palettes, perspective diorama mode, pen trail. |
| Moving Agents | Partial | City traffic and pedestrians brake for the rover. Motion is kinematic, not rigid body. Pymunk exists but is not wired into the runtime. |
| Telemetry | Complete | Heading, battery, LIDAR distance, samples collected, compass dial, arc gauges, history charts, pen trail minimap. |
| Self-Refinement Memory | Complete | localStorage reflections and saved skills feed later sessions. System level refinement, no model retraining. |
| Local AI Assistant | Complete | Ollama on localhost, 3 to 4B open model preference, deterministic rule based fallback when Ollama is absent. Vibe coding, ask, review and budget builder panels. |
| Code Reviewer | Complete | Propose then critique reviewer on the local model; up to three issues; rewrite accepted only after passing the same sandbox as Run. |
| Lesson Grading | Complete | Pure function grader over the trace; per criterion checks for samples, collisions, battery, constructs, base return, steps, distance; AST walk for allowed constructs. |
| Teacher Dashboard | Complete | Class concept strength heatmap, per pupil drill down, CSV export, progress report. Web app and legacy Tk both surface it. |
| SQLite Persistence | Complete | Pupils, submissions and concept strength tables; EMA updates; submission trace round trips through JSON. |
| PyInstaller Packaging | Complete | `python scripts/build_exe.py` builds a windowed WebView2 `RoboLearn.exe`; verified launching and rendering the full UI. |
| Command Registry | Complete | `KodroCommands` (in `RobotLab.jsx`) is the single source of truth; every fitted-part command is gated across text, blocks, voice and the assistant, with a readable refusal when a part is missing. |
| Movement Dynamics | Complete | Mass-scaled acceleration, cruise and braking plus momentum carry-over in `animateMove`; move endpoints are exact, so collisions and distances are unchanged. Kinematic, not rigid body. |
| Scenario Validation | Complete | `KodroScenario` runs a program across seeded, domain-randomised runs (friction, mass, sensor noise, obstacle placement) and reports a spread; results persist to localStorage and to SQLite (`Store.save_scenario_run`, tested). |
| Realism Dashboard | Complete | `KodroRealism` shows physics, sensors, scenario score, environment and the command registry from the live sources of truth. |
| Onboarding Agent | Complete | A typed or spoken description is mapped onto the validated parts catalogue (`RobotLab.fromText`); it produces data only, never executable code. |
| Model Picker | Complete | The user can point Kodro at any installed local model (DeepSeek, Nemotron, Qwen, a custom fine-tune); the choice persists and is honoured by the assistant, with the deterministic fallback preserved. |
| Guided Realism Demo | Complete | `KodroDemo` performs the real build, gate, validate, refuse, refit and reuse loop with no faked screens. |
