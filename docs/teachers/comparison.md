# How RoboLearn compares

A side-by-side comparison against four widely-used educational
robotics simulators. Competitor figures are sourced from each vendor's
publicly-available documentation as of the project's submission date.

Two notes on this table, because it was written early and the product moved
under it. The product is now called Kodro; the name RoboLearn below is the old
one and is kept only where it names a file. And three of the RoboLearn column's
numbers were stale when they were re-checked on 15 August 2026: the hint count,
the unlockable count and the install size. They are corrected here to what is
measurable in the repository. One of the three is a smaller claim than the one
it replaces, and the install size is a much larger one. A fourth row, the
teacher dashboard, was not wrong about a number but was wrong about which build
does what.

| Criterion | **RoboLearn** | VEX VR | CoderZ | Webots | Karel J. Robot |
| --- | --- | --- | --- | --- | --- |
| Cost (per pupil per year) | £0 (open source) | £0 (free tier) | ~£40 (school licence) | £0 (open source) | £0 (textbook only) |
| Internet required | **No** | Yes (browser app) | Yes (cloud IDE) | No | No |
| KS3 curriculum alignment | **Explicit, per-lesson** | Implicit | Implicit | None | None |
| KS4 curriculum alignment | **Explicit (recursion, optimisation)** | Limited | Limited | None | None |
| Built-in hint engine | **12 error rules + 48 lesson hints, offline** | None | Cloud-only | None | None |
| Replay debugger with scrubbing | **Yes (ghost trail)** | No | No | No | No |
| Teacher dashboard with heatmap | **Yes (exports depend on the build)** | Yes | Yes | No | No |
| Multi-terrain physics | **Earth / Mars / Underwater / Space** | Mars only | None | Configurable (advanced) | None |
| Open source (MIT) | **Yes** | No | No | Apache 2.0 | Public-domain code samples |
| Install size | **Single .exe: 71 MB Tk build, 188 MB WebView2 build** | Browser-based | Browser-based | 1.2 GB+ | Java JDK + textbook |
| Supported languages | **Python + blocks** | Python / blocks | Python / blocks / C# | C / C++ / Python / Java | Java |
| Customisable lessons (pupil-authored) | **Yes (YAML editor)** | No | No | Yes (advanced) | No |
| Self-improving memory layer | **Yes (EMA per concept)** | Limited progress tracking | Limited progress tracking | None | None |
| Pupil progression / achievements | **16 unlockables + streaks** | Badges | Levels + badges | None | None |

### Where the corrected numbers come from

Measured on 15 August 2026, so that none of them has to be taken on trust.

- **12 error rules.** `src/robolearn/assets/web/pupil-errors.js` holds a `RULES`
  array with 12 pattern matchers, each turning a Python error into a plain
  sentence plus a hint. That is the offline engine. The row said 24, and there
  is no 24-rule table anywhere in the code; 24 is the number of lesson files,
  which is probably where it came from.
- **48 lesson hints.** Separately from the rules, those 24 bundled lesson files
  carry 48 hand-written hints between them, tied to the specific mission.
- **16 unlockables.** `robolearn.memory.achievements.CATALOGUE` has 16 entries.
  The row said 15. No note explains the difference, so treat 16 as the count
  and 15 as stale.
- **Install size.** `Kodro.exe` is 196,929,209 bytes and `RoboLearn.exe` is
  74,824,499 bytes, rounded above in the same binary megabytes the old figure
  used. The old "26 MB" still matches a file on disk, `RoboLearn-windows-x64.exe`
  at 27,447,321 bytes, but that is a May 2026 build and not what the releases
  page hands out now. Why the current builds are larger has not been broken
  down, so no explanation is offered here.

The dashboard row now says "depend on the build" rather than naming CSV,
because the two desktop builds do not export the same things.
[`classroom-setup.md`](classroom-setup.md) sets out which does what.

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
