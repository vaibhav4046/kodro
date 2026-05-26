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
| Windows | Download `RoboLearn-windows.exe` from the latest [release](https://github.com/vaibhav4046/robolearn/releases) |
| macOS | Download `RoboLearn-macos.dmg` from the latest [release](https://github.com/vaibhav4046/robolearn/releases) |
| Linux | `pip install robolearn && python -m robolearn` |

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
