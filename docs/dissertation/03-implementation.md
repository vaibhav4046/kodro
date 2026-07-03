# 5. Implementation

> **Superseded draft.** The canonical Implementation chapter is Chapter 5 of
> [`Kodro_Dissertation.tex`](Kodro_Dissertation.tex). This file is an earlier
> draft written for the older teaching-tool framing; where it differs, the
> `.tex` is authoritative.

## Current framing (v2.0)

The implementation is grounded in the codebase and the
[test evidence](../developers/test-evidence.md). Key elements:

- **The program surface and interpreter:** a Python-subset interpreter
  (`interpreter.js`) compiles source to a generator of motion/sensor events
  so the studio animates a run; two call styles are both valid.
- **The KRS import:** `specschema.js` validates an imported specification,
  clamps mildly out-of-range values visibly and rejects wild ones, and the
  physical closed forms then drive the sim; the schema also exports.
- **The shared motion model:** `motion-model.js` and `engine/motion_model.py`
  hold the mirrored closed forms and constants, gated by
  `test_motion_model_conformance.py` (constants hash),
  `test_golden_traces.py` (catalogue traces) and
  `test_physical_golden_trace.py` (formula parity, rel 1e-12).
- **The verification report:** pure functions in `verify.jsx` render the
  build as simulated, each figure tagged by fidelity tier and how it was
  derived, to a standalone HTML file.
- **Worlds and shading:** procedural geometry on core Three.js with
  generated surface relief and a gated Cinematic post pass, all offline.
- **Showcases, icons, project files:** three showcase programs (Encore,
  Searchlight, Gauntlet), a procedural SVG icon set replacing emoji, and a
  single-file `.kodro` project format.
- **Removing the voice route:** the earlier voice/speech-to-text route was
  removed in full; `say()` remains as a visual console line only, and the
  shipped app has no voice input.

See Chapter 5 of the `.tex` for the full detail and the challenges met and
fixed (including the two v2.0 honesty-defect fixes and the motion-model
unification).
