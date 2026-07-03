# Appendix A — Glossary and abbreviations

> **Superseded draft.** The canonical Glossary is Appendix A of
> [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex). This file is an earlier
> reference written for the older teaching-tool framing; where it differs, the
> `.tex` is authoritative.

## Key terms (v2.0)

| Term | Meaning |
| --- | --- |
| **KRS** | Kodro Robot Specification: a schema-validated JSON document of a real robot's measured numbers (mass, drive geometry, battery, sensors) that can be imported or exported and that drives the simulation through the physical closed forms. |
| **Fidelity tier** | One of HONOURED, APPROXIMATED or NOT SIMULATED: the disclosed level at which the simulation treats a reported figure. |
| **RobotSpec** | The structured robot specification, imported as KRS or derived from chosen parts; the single source of truth for behaviour and the command registry. |
| **Shared motion model** | The single set of closed-form equations and constants, mirrored in `motion-model.js` and `motion_model.py` and locked by conformance tests, that both engines obey. |
| **Grounding** | Constraining the model's suggestions to the build the user assembled or imported, so it cannot call a part that is not fitted. |
| **Kinematic motion** | Motion advanced by a hand-written tick that fakes the feel of weight and traction, as distinct from a rigid-body solver that resolves forces. |
| **Trace** | The recorded sequence of command events from one run; the single representation that scoring, hinting and replay all read. |
| **Sandbox** | The pre-execution check that rejects unsafe imports, builtins and operations before a program runs. |
| **Ollama** | A local model runtime; the optional, loopback-only backend for the assistant. |
| **SQLite** | The embedded, file-based database used for the single local store. |

See Appendix A of the `.tex` for the full glossary.
