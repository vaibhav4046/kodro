# Validation boundary: what Kodro proves, what it does not

This is the honest version of the product's limits. It exists so a
judge, teacher, or maker never has to guess what a passing proof means.

## What a passing proof means

- The program runs inside Kodro's kinematic world model on the tested
  seeds: motion, sensing, and goal checks behave as specified.
- The command set used is the one the fitted robot actually has
  (grounded registry, no invented commands).
- The evidence manifest reproduces byte-identically on re-run.

## What it never means

- It is not a physical validation. No dynamics solver, contact model,
  motor driver, battery protection, wiring, or mechanical fit is
  checked. Real hardware still needs competent review before
  purchase or power-up.
- It is not parity with Gazebo, Webots, Isaac Sim, or MuJoCo. Those
  are full physics simulators with rigid-body dynamics and
  contact solvers; Kodro is a hand-written kinematic tick for
  learning and early design comparison. See `docs/known-limitations.md`.
- It is not safety certification of any kind.

## Where Kodro sits (decision question, not feature list)

| Tool class | Answers | Does not answer |
|---|---|---|
| Full physics simulators (Gazebo, Webots, Isaac Sim, MuJoCo) | "Does this design behave under realistic dynamics?" | Whether the version should become hardware; classroom cost of being wrong |
| Sustainability dashboards | "How green is something that already exists?" | Whether it should have been built |
| Kodro + EarthProof | "Do we have enough evidence to justify building this version at all?" | Physical safety, fit, lifecycle assessment |

Kodro's wedge is deliberately narrow: the checkpoint between
simulation and committing parts, batteries, and materials. Everything
outside that checkpoint is out of scope by design, not by omission.

## From argument to measurement

Until now the environmental benefit was a reasoned argument: moving
failure into software should mean fewer wasted builds. The decision
journal (`src/kodro/journal.py`) is the instrument that can turn the
argument into data. Every Prove -> Build decision is logged with its
verdict and cited evidence fingerprint:

```bash
python -m kodro.journal log --log decisions.jsonl \
  --decision deferred --design "rover v3" --verdict "pass 5/5" \
  --fingerprint <earthproof-sha256> --note "candidate uses less energy"
python -m kodro.journal summary --log decisions.jsonl
```

The summary counts recorded decisions. A deferred build is a
decision, not proof a prototype was avoided — the limitation is
printed in every summary. The study this enables (do classrooms using
virtual-first design buy fewer parts?) is future work, now with a
data format waiting for it.
