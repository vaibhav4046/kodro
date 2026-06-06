# Appendix A — Glossary and abbreviations

Definitions are scoped to how each term is used in this report.

## Education and curriculum

| Term | Meaning |
| --- | --- |
| **KS3** | Key Stage 3 — the lower-secondary phase of the English National Curriculum (school years 7–9, ages 11–14). |
| **KS4** | Key Stage 4 — the GCSE phase (years 10–11, ages 14–16). |
| **GCSE** | General Certificate of Secondary Education — the main KS4 qualification. |
| **CT** | Computational thinking — the problem-solving strands (decomposition, abstraction, algorithms, pattern recognition, evaluation) the lessons target. |
| **DfE** | Department for Education — publisher of the National Curriculum and GCSE subject content. |
| **BCS** | The Chartered Institute for IT — a source of computing-education guidance. |
| **SENDCo** | Special Educational Needs and Disabilities Co-ordinator — a persona band used in the heuristic review. |
| **SUS** | System Usability Scale — the standard usability questionnaire proposed for the human study. |
| **WCAG** | Web Content Accessibility Guidelines — the accessibility standard the future work aims toward. |

## Computing and engineering

| Term | Meaning |
| --- | --- |
| **API** | Application Programming Interface — here, the procedural pupil surface (`move_forward`, `read_distance`, …). |
| **AST** | Abstract Syntax Tree — used by the sandbox to reject unsafe code and by the grader to check required constructs. |
| **EMA** | Exponential Moving Average — the update rule for each pupil's per-concept strength score. |
| **CI** | Continuous Integration — the automated lint/type/test pipeline (GitHub Actions). |
| **GDPR** | General Data Protection Regulation — the data-protection regime the offline design simplifies compliance with. |
| **YAML** | The human-readable data format the lessons are authored in. |
| **SQLite** | The embedded, file-based database used for the single local store. |
| **IDE** | Integrated Development Environment. |
| **LIDAR / IMU** | Simulated rover sensors: a ranging sensor and an inertial measurement (heading) unit. |

## Tools and libraries

| Term | Meaning |
| --- | --- |
| **Tkinter / Tk / ttk** | Python's standard GUI toolkit and its themed widget set; the application's UI. |
| **Pygame-CE** | Community edition of Pygame; provides the SDL-backed surface and audio mixer. |
| **Pymunk** | 2D physics library wrapping Chipmunk; the arena collisions and dynamics. |
| **Ollama** | A local LLM runtime; the *optional*, `localhost`-only AI tutor backend. |
| **PyInstaller** | Packages the app and interpreter into the single-file desktop binary. |
| **Pydantic** | Data-validation library; validates the lesson YAML against the schema. |
| **ruff / mypy** | The linter/formatter and the static type checker enforced in CI. |
