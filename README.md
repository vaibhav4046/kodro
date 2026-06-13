# RoboLearn

[![CI](https://github.com/vaibhav4046/robolearn/actions/workflows/ci.yml/badge.svg)](https://github.com/vaibhav4046/robolearn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)

A free, open source, fully offline desktop platform where students learn to
program by commanding a simulated rover. Students describe a mission in plain
language, a local AI model writes short Python for it, and the rover runs that
code across real world mission sites with authentic physics. Built for students
beginning to learn programming, in particular first year undergraduates in
computing.

> **Status: public beta (v1.6.0).** The platform is feature complete and CI
> green on Windows, macOS and Linux. Active work is now on evaluation and
> documentation, with a clear roadmap below. Download the app from the
> [latest release](https://github.com/vaibhav4046/robolearn/releases/latest)
> and see [`CHANGELOG.md`](CHANGELOG.md) for the full history (v1.0.0 to
> v1.6.0).

This repository accompanies an MSc research project (COMP702, University of
Liverpool). The specification and design proposal is in
[`docs/ca1/`](docs/ca1/).

## Why

Physical robotics kits are expensive, fragile, and rarely reach every UK
classroom. RoboLearn replaces them with a single download. Pupils write
procedural Python against a tiny, readable API (`move_forward`, `read_distance`,
`collect_sample`) and watch their code drive a rover through curriculum-mapped
lessons. A pupil-progress memory layer adapts the difficulty and surfaces
personalised hints. A teacher dashboard summarises class-wide strengths and
weaknesses.

## Features

- **Closed learning loop** — press **Run**, watch the rover animate, then
  get an immediate verdict: a green pass / orange fail banner, a 0–100
  score, a specific hint on failure, and a sound cue.
- **18 curriculum-mapped lessons** (KS1 → KS4) covering sequence,
  selection, iteration, functions, sensors, recursion, decomposition and
  abstraction, each with DfE/BCS references.
- **Adaptive memory** — per-concept strength model, recommended-next
  lesson, achievements + streaks, and a teacher dashboard. A top-bar
  progress strip shows streak / lessons passed / last score.
- **Accessibility** — text-size controls (`A-` / `A+`), a high-contrast
  toggle (persisted offline), and keyboard shortcuts (F5/Ctrl+Enter run,
  Esc stop, Ctrl+R reset).
- **Procedural sound effects** synthesised at runtime — no asset files,
  silently disabled on machines without audio.
- **Optional local AI** (Ollama on `localhost`) to generate extra lessons
  and explain code — strictly offline, no cloud, no account.

## Quick start

**Just want the app?** Download **`RoboLearn-windows.exe`** from the
[latest release](https://github.com/vaibhav4046/robolearn/releases/latest) and
double-click it — the full mission-control desktop app (the modern web UI in a
native window), no Python install required.

Three ways to code, all offline:

- **Type Python** in the editor (lessons KS1–KS4, hints, live 3D rover).
- **🧩 Blocks** — stack Scratch-style blocks; they turn into real Python that
  types itself into the editor.
- **✨ Vibe** — describe what the rover should do and a **local** AI model
  (Qwen 2.5 Coder or Gemma via [Ollama](https://ollama.com)) writes the code.
  No cloud, no account: `ollama pull qwen2.5-coder:3b` and the panel lights up.

The rover also **speaks** its `say()` lines aloud using your computer's
built-in offline voice.

## Quick start (developers)

```bash
git clone https://github.com/vaibhav4046/robolearn.git
cd robolearn
pip install -e ".[dev]"
python -m robolearn.web   # modern web UI (pywebview)  — or:
python -m robolearn       # classic Tk UI (fallback)
```

## Quick start (pupils)

```python
from robolearn.rover_api import move_forward, turn_left, collect_sample

move_forward(50)
turn_left(90)
collect_sample()
```

## Install steps per OS

| Platform | One-liner |
| --- | --- |
| Windows | Download **`RoboLearn-windows.exe`** from the [latest release](https://github.com/vaibhav4046/robolearn/releases/latest) (~33 MB, the modern web UI; bundles Python + WebView2 bridge) and double-click it. The classic Tk build ships alongside as `robolearn-windows-tk.exe` |
| macOS | Download `robolearn-macos.zip` from the [latest release](https://github.com/vaibhav4046/robolearn/releases/latest), unzip and open `robolearn.app` — or `pip install -e . && python -m robolearn` |
| Linux | Download the `robolearn-linux` binary from the [latest release](https://github.com/vaibhav4046/robolearn/releases/latest) and `chmod +x` it — or `pip install -e . && python -m robolearn` |

## Roadmap

The beta is complete and works offline today. Planned directions, in priority
order, are:

1. **Voice agents.** A spoken agent that plans and runs a whole mission from a
   single voice instruction, beyond the current voice input and output.
2. **Context awareness.** Memory across a session and across lessons, so the
   assistant recalls earlier missions and adapts to each learner's progress.
3. **Self improving generation.** A loop in which every sandbox validated
   solution feeds back into the examples that guide the local model, so the
   system gets stronger from its own verified work.
4. **Multi agent missions.** Several programmable rovers and drones cooperating
   in one world.
5. **Higher fidelity rendering.** A WebGL renderer behind the same event stream
   for richer three dimensional worlds.

## Documentation

Full docs live at [`docs/`](docs/) and are served via MkDocs Material:

```bash
mkdocs serve -f docs/mkdocs.yml
```

## Acknowledgements

Submitted in partial fulfilment of COMP702 at the University of Liverpool.
Curriculum mapping follows the BCS / Department for Education programmes of
study for Computing at Key Stages 3 and 4.

## Licence

Released under the [MIT Licence](LICENSE).
