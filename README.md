# RoboLearn

[![CI](https://github.com/vaibhav4046/robolearn/actions/workflows/ci.yml/badge.svg)](https://github.com/vaibhav4046/robolearn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)

A free, open-source Python desktop simulator that lets UK secondary school
pupils learn the Computing National Curriculum by programming a virtual rover
across Earth, Mars, underwater and space terrains.

> **Status:** under active development. See [`CHANGELOG.md`](CHANGELOG.md) for
> what landed and the [recommended task order](#recommended-task-order) for what
> is next.

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
- **15 curriculum-mapped lessons** (KS3 → KS4) covering sequence,
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

## Quick start (developers)

```bash
git clone https://github.com/vaibhav4046/robolearn.git
cd robolearn
pip install -e ".[dev]"
python -m robolearn
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
| Windows | Download `robolearn-windows.exe` from the [latest release](https://github.com/vaibhav4046/robolearn/releases/latest) (~27 MB, bundles Python + Tcl/Tk + Pygame) and double-click it |
| macOS | Download `robolearn-macos.zip` from the [latest release](https://github.com/vaibhav4046/robolearn/releases/latest), unzip and open `robolearn.app` — or `pip install -e . && python -m robolearn` |
| Linux | Download the `robolearn-linux` binary from the [latest release](https://github.com/vaibhav4046/robolearn/releases/latest) and `chmod +x` it — or `pip install -e . && python -m robolearn` |

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
