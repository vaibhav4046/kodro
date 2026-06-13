# How RoboLearn compares

A side-by-side comparison against four widely-used educational
robotics simulators. All figures are sourced from each vendor's
publicly-available documentation as of the project's submission date.

| Criterion | **RoboLearn** | VEX VR | CoderZ | Webots | Karel J. Robot |
| --- | --- | --- | --- | --- | --- |
| Cost (per pupil per year) | £0 (open source) | £0 (free tier) | ~£40 (school licence) | £0 (open source) | £0 (textbook only) |
| Internet required | **No** | Yes (browser app) | Yes (cloud IDE) | No | No |
| KS3 curriculum alignment | **Explicit, per-lesson** | Implicit | Implicit | None | None |
| KS4 curriculum alignment | **Explicit (recursion, optimisation)** | Limited | Limited | None | None |
| Built-in hint engine | **24 rules, offline** | None | Cloud-only | None | None |
| Replay debugger with scrubbing | **Yes (ghost trail)** | No | No | No | No |
| Teacher dashboard with heatmap | **Yes (CSV export)** | Yes | Yes | No | No |
| Multi-terrain physics | **Earth / Mars / Underwater / Space** | Mars only | None | Configurable (advanced) | None |
| Open source (MIT) | **Yes** | No | No | Apache 2.0 | Public-domain code samples |
| Install size | **26 MB single .exe** | Browser-based | Browser-based | 1.2 GB+ | Java JDK + textbook |
| Supported languages | **Python + blocks** | Python / blocks | Python / blocks / C# | C / C++ / Python / Java | Java |
| Customisable lessons (pupil-authored) | **Yes (YAML editor)** | No | No | Yes (advanced) | No |
| Self-improving memory layer | **Yes (EMA per concept)** | Limited progress tracking | Limited progress tracking | None | None |
| Pupil progression / achievements | **15 unlockables + streaks** | Badges | Levels + badges | None | None |

## Where RoboLearn wins

1. **Offline by design.** Every other entry in the table either
   requires the public internet or is a commercial subscription.
2. **Curriculum-mapped lessons.** RoboLearn cites the DfE programme of
   study attainment targets line-by-line; competitors leave alignment
   as an exercise for the teacher.
3. **Time-travel debugger.** A frame-by-frame scrubber with a ghost
   trail of past rover positions is unique to RoboLearn.
4. **Self-improving memory layer.** The EMA-driven pupil model adapts
   the recommendation order without ever needing an account.
5. **Pupil-authored lessons.** The in-app YAML editor lets every
   pupil/teacher add a custom mission without leaving the simulator.
6. **Blocks-to-Python on-ramp.** A Scratch-style click-to-stack
   palette compiles to real Python in the editor, so KS3 starters get
   a low floor without leaving the text-first model. Like everything
   else it runs fully offline, no account.

## Where RoboLearn loses (and why that's OK for the dissertation)

1. **No mobile app.** Web-based competitors trivially run on tablets.
   RoboLearn explicitly scopes to laptop/desktop because the same
   spec also forbids cloud sync of pupil work.
2. **Lean block palette.** RoboLearn ships a Scratch-style blocks
   mode (movement, turns, `repeat`, `if obstacle ahead`), but it is
   deliberately narrower than the full Blockly/Scratch environments in
   VEX VR or CoderZ — no events, variables, or sprites. The blocks are
   an on-ramp that compile straight to Python in the editor, not a
   parallel visual language to live in, because the Computing
   programme of study pushes text-based programming from KS3.

## Sources

* VEX VR: <https://www.vexrobotics.com/vexcode-vr>
* CoderZ: <https://gocoderz.com/>
* Webots: <https://cyberbotics.com/>
* Karel J. Robot: Bergin et al., *Karel J. Robot*,
  ISBN 978-0-9700-4519-1.
* DfE *Computing programmes of study* (DfE-00191-2013) and the BCS
  *Computational Thinking* guide (Csizmadia et al., 2015) for the
  curriculum-alignment row.
