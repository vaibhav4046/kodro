# Decision log

One entry per non-obvious technical decision, written at the time the
decision is made. The dissertation chapter on critical reflection draws
from this log.

---

## 2026-05-26 — Procedural pupil API on top of an object-oriented engine

**What was considered.** A pure object-oriented `Rover` class that pupils
instantiate, versus a procedural module with free functions, versus a hybrid
where pupils write classes that subclass `RoverBehaviour`.

**What was chosen.** A flat, procedural module — `robolearn.rover_api` — that
hides a singleton engine handle. Pupils write `move_forward(50)`; the engine
is OO internally for state encapsulation.

**Why.** UK KS3 pupils encounter functions before classes in the programme of
study. Forcing them to instantiate a class first conflates the curriculum
goal (sequence / selection / iteration) with object-oriented mechanics they
have not yet been taught. Teachers reading the source benefit from the same
simplicity.

---

## 2026-05-26 — Pygame-CE + Pymunk + Tk over a single-window pygame app

**What was considered.** Pure pygame for both the simulation and the UI;
pygame embedded in a Tk shell; a Qt-based UI.

**What was chosen.** Tk for the surrounding UI (it ships with Python and
needs zero extra install on classroom estates) with a pygame-CE surface
embedded inside it. Physics is Pymunk for collision handling.

**Why.** Tk's ubiquity matters in schools where pip wheels for Qt can be
blocked. Pygame is the safest cross-platform 2D renderer with no licensing
surprises.

---

## 2026-05-26 — Rover API: clamp-and-warn over raise-on-bad-input (Task 2)

**What was considered.** Three failure modes for bad pupil inputs:
(a) raise a `ValueError` immediately, (b) silently truncate, (c) clamp and
emit a `logging.WARNING`.

**What was chosen.** Option (c) — `_clamp_finite` clamps any out-of-range
or non-finite value into the valid interval, logs a warning naming the
argument, and returns the safe default. NaN and `±inf` are also clamped
to the lower bound.

**Why.** Section 4 of the spec is explicit: "No function may raise on bad
input — clamp, log a warning, return a safe default." A KS3 pupil who
types `move_forward(-5)` should see their rover sit still and a yellow
warning, not a traceback that derails the lesson. The logging-based
warnings give the teacher dashboard a clean event stream to surface in
the hint engine (Task 10) without changing the public signatures.

---

## 2026-05-26 — Package-root re-exports of the rover API (Task 2)

**What was considered.** Force pupils to write
`from robolearn.rover_api import move_forward`, or re-export every public
symbol from `robolearn/__init__.py`.

**What was chosen.** Re-export. Pupils can write either
`from robolearn import move_forward` or
`from robolearn.rover_api import move_forward`; both bind to the same
function object (asserted by `test_package_root_reexports_full_api`).

**Why.** Section 3 of the spec literally says
`__init__.py # exports public Rover API only`. The shorter form is what
lesson YAMLs will embed in their `starter_code`, and shorter imports keep
the curriculum-mapped lesson code legible at the back of the classroom.
