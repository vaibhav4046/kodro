# Kodro

> An offline AI-assisted robotics design and simulation platform. Build a
> custom robot from real parts, program its behaviour in code, blocks or
> plain language, and validate it in a 3D world chosen to suit it. It runs
> entirely on your own computer with no account and, by default, no cloud.

Kodro is a self-contained desktop studio for a capable non-expert adult who
wants to design and test robot behaviour without a lab, a kit, or a cloud
subscription. Try it in the browser, zero install, at
[vaibhav4046.github.io/kodro](https://vaibhav4046.github.io/kodro/);
the full desktop app adds the local Python engine, lesson grading and
multi-pupil progress.

## The product journey

1. **Design.** In the Robot Lab you assemble a robot from a board, sensors,
   actuators and a chassis type (rover, car, home or arm). Kodro derives its
   mass, top speed and runtime from the parts you choose.
2. **Prove.** Write procedural Python against a small, readable API, stack
   Scratch-style blocks that compile to that same Python, or ask the optional
   local companion to draft behaviour. Run repeatable scenarios and keep their
   assumptions, seeds and outcomes.
3. **Build.** Export a concept bill of materials and prototype brief. Verify
   exact parts against original datasheets, assemble safely, measure the physical
   result and feed those measurements back into the design.

Kodro reduces uncertainty before a first prototype. It does not certify real
world performance or replace physical calibration. Read the
[product direction and evidence boundary](PRODUCT_DIRECTION_2026.md) for the
current scope and source-backed roadmap.

## What you get

- A tiny, readable [pupil-facing API](pupils/api-cheatsheet.md): `move_forward`,
  `turn_left`, `read_distance`, `collect_sample` and more.
- Twenty-four bundled lessons mapped to the UK DfE / BCS computing programme of
  study. The 24 lessons span KS1 to KS4 and are weighted to KS3 and KS4:
  3 are tagged KS1, 4 are KS2, 9 are KS3 and 8 are KS4 stretch. Counted on
  15 August 2026 with
  `python -c "import sys; sys.path.insert(0,'src'); from kodro.lessons.schema import load_library; from collections import Counter; lib=load_library(); print(len(lib), Counter(l.key_stage for l in lib))"`.
- A self-improving memory layer that adapts difficulty per pupil.
- A teacher dashboard with class-wide strengths and weaknesses.
- A time-travel debugger that replays any submission frame by frame.

## Get started

| If you are a … | Start here |
| --- | --- |
| Teacher | [Getting started](teachers/getting-started.md) |
| Pupil | [API cheatsheet](pupils/api-cheatsheet.md) |
| Contributor | [Architecture](developers/architecture.md) |
