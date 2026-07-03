# 3-4. Requirements, Design and Architecture

> **Superseded draft.** The canonical Requirements (Chapter 3) and Design &
> Architecture (Chapter 4) chapters live in
> [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex). This file is an earlier
> draft written for the older teaching-tool framing; where it differs, the
> `.tex` is authoritative.

## Current framing (v2.0)

The design rests on three load-bearing decisions, all grounded in the code:

1. **The robot specification is the single source of truth**, imported as a
   schema-validated KRS JSON document (`specschema.js`) of measured numbers,
   or derived from a parts catalogue in the Robot Lab. It generates the
   command registry every surface reads, so a command exists only if the part
   that provides it is fitted.
2. **A three-tier fidelity disclosure** (HONOURED / APPROXIMATED / NOT
   SIMULATED) badges every performance figure in the Lab, a realism
   dashboard and a per-robot verification report, and a value the sim does
   not actually drive is never badged honoured (for example an out-of-band
   top speed drops to approximated with the true direction stated).
3. **One shared motion model** (`motion-model.js` and
   `engine/motion_model.py`) drives both engines, locked by a constants
   hash, a golden-trace corpus and a formula-parity test, so the visible
   studio and the tested Python engine cannot silently drift.

Around these sit the trace-driven scoring/hinting/replay core, the
sandbox/executor/simulation-gate safety machinery, the worlds and 17 named
mission sites with moving agents, and the grounded assistant with its
deterministic fallback. See Chapters 3 and 4 of the `.tex`.
