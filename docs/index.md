# Kodro

> An offline AI-assisted robotics design and simulation platform. Build a
> custom robot from real parts, program its behaviour in code, blocks or
> plain language, and validate it in a 3D world chosen to suit it. It runs
> entirely on your own computer with no account and, by default, no cloud.

Kodro is a self-contained desktop studio for a capable non-expert adult who
wants to design and test robot behaviour without a lab, a kit, or a cloud
subscription. Try it in the browser, zero install, at
[vaibhav4046.github.io/robolearn](https://vaibhav4046.github.io/robolearn/);
the full desktop app adds the local Python engine, lesson grading and
multi-pupil progress.

## The loop

1. **Design.** In the Robot Lab you assemble a robot from a board, sensors,
   actuators and a chassis type (rover, car, home or arm). Kodro derives its
   mass, top speed and runtime from the parts you choose.
2. **Program.** Write procedural Python against a small, readable API, stack
   Scratch-style blocks that compile to that same Python, or describe the
   behaviour and let a local AI model draft it.
3. **Validate.** Kodro recommends the world that fits the robot and drops it
   in: a self-driving car gets the City, a home or arm robot gets the Room, a
   rover gets planetary terrain.
4. **Refine.** Every run is recorded. A localStorage memory layer reflects on
   outcomes and keeps the skills you save, so the studio gets more useful from
   your own verified work. No model weights are retrained.

## What you get

- A tiny, readable [pupil-facing API](pupils/api-cheatsheet.md): `move_forward`,
  `turn_left`, `read_distance`, `collect_sample` and more.
- Eighteen bundled lessons mapped to the UK DfE / BCS computing programme of
  study, from KS1 through KS4 stretch.
- A self-improving memory layer that adapts difficulty per pupil.
- A teacher dashboard with class-wide strengths and weaknesses.
- A time-travel debugger that replays any submission frame by frame.

## Get started

| If you are a … | Start here |
| --- | --- |
| Teacher | [Getting started](teachers/getting-started.md) |
| Pupil | [API cheatsheet](pupils/api-cheatsheet.md) |
| Contributor | [Architecture](developers/architecture.md) |
