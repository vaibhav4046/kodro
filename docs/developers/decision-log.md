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
