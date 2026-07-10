# Kodro research ledger

Format per entry: problem | current | candidates | primary sources (version/date/licence)
| repo fit | risks | spike/benchmark | decision.

## Open questions (seeded; scout populating)
- R-1 Engineering sim adapter (MuJoCo vs Gazebo/ROS2 vs keep kinematic preview):
  measure repo fit before adopting; do not half-integrate multiple engines.
- R-2 RobotSpec/WorldSpec/MissionSpec versioning + migration + round-trip tests.
- R-3 KodroBench eval suite for local models (prompt -> schema/API/capability ->
  exec -> mission -> safety -> latency/mem) BEFORE any fine-tuning claim.
- R-4 URDF/Xacro + glTF export fidelity (only when real geometry/inertials exist).
- R-5 MCP bounded tools + A2A-inspired task/artifact envelope only after a
  security/conformance spike proves value.

## Verified facts this session
- pywebview 6.2.1 + bottle 0.13.4: '/' route arity bug in webview/http.py asset();
  cosmetic (console=False exe hides stderr).
- Ollama local server auto-start works end-to-end on this machine (killed dead ->
  ensure_server() -> 200 in ~16-22s, kodro-fast+kodro-coder warm).
