# How RoboLearn compares

A side-by-side comparison against four widely-used educational
robotics simulators. Competitor figures are sourced from each vendor's
publicly-available documentation as of the project's submission date.

Two notes on this table, because it was written early and the product moved
under it. The product is now called Kodro; the name RoboLearn below is the old
one and is kept only where it names a file. And two of the RoboLearn column's
numbers were stale when they were re-checked on 15 August 2026: the unlockable
count and the install size. They are corrected here to what is measurable in the
repository. A third row, the teacher dashboard, was not wrong about a number but
was wrong about which build does what.

The hint row was corrected twice on the same day, and the first correction was
wrong. It replaced 24 with 12 on the strength of counting one engine and
asserting no other existed. There are two engines. The count below now names
both and says which surface gets which.

| Criterion | **RoboLearn** | VEX VR | CoderZ | Webots | Karel J. Robot |
| --- | --- | --- | --- | --- | --- |
| Cost (per pupil per year) | £0 (open source) | £0 (free tier) | ~£40 (school licence) | £0 (open source) | £0 (textbook only) |
| Internet required | **No** | Yes (browser app) | Yes (cloud IDE) | No | No |
| KS3 curriculum alignment | **Explicit, per-lesson** | Implicit | Implicit | None | None |
| KS4 curriculum alignment | **Explicit (recursion, optimisation)** | Limited | Limited | None | None |
| Built-in hint engine | **24 error rules on the desktop, 12 in the browser, plus 48 lesson hints everywhere, all offline** | None | Cloud-only | None | None |
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

- **24 error rules on the desktop.** `robolearn.memory.hint_engine.RULES` has 24
  entries. Both desktop builds use it: the Tk build imports `find_first_hint` at
  `src/robolearn/app.py:32` and calls it at `:949`, and the WebView2 build ranks
  the same rules through `best_hint` at `src/robolearn/web/app.py:328`, `:336`
  and `:431`. So the original 24 was right for the surface most schools install,
  and an earlier pass on this file wrongly cut it to 12.
- **12 error rules in the browser.** `src/robolearn/assets/web/pupil-errors.js`
  declares `var RULES = [` at line 105 with 12 pattern matchers, each turning a
  Python error into a plain sentence plus a hint. That is the fallback: it runs
  in the browser and inside WebView2, and it is the only error-rule engine when
  there is no Python process behind the page, which is the case on the hosted
  web build. A pupil on the website gets 12; a pupil on either desktop build
  gets 24.
- **48 lesson hints, on every surface.** Separately from the rules, the 24
  bundled lesson files carry 48 hand-written hints between them, two per lesson,
  tied to the specific mission. The web build does not read the YAML: the same
  48 are generated into `LESSON_DATA` in
  `src/robolearn/assets/web/lesson-grader.jsx` (24 lessons, 48 `onFailure`
  strings, counted in both places), and `scripts/qa_grader.mjs` gates that the
  generated copy still matches a fresh extraction.
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
