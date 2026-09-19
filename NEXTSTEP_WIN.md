# NEXTSTEP_WIN — 1-day leverage checklist

Goal: maximum judge comprehension in minimum edits. Docs + presentational home entry + regenerated bundle + certificate script (no engine or physics changes).

## 1. Devpost title + tagline fix (do first, 5 min)

**Title (exact):**

```text
Kodro EarthProof — Prove the build before you buy the hardware
```

**Tagline (exact):**

```text
Prove the build decision before resources become hardware.
```

**First paragraph must contain the loop (exact):**

```text
Design -> Simulate -> Prove -> EarthProof -> Build
```

Why: judges decide in the first 15 seconds whether this is "another simulator"
or a pre-build evidence gate. The loop is the differentiator. Put it above the
fold, and repeat it once in the video's first 45 seconds.

## 2. GIF placement (15 min)

- [ ] Add ONE GIF directly under the tagline/loop, before any text wall.
- [ ] GIF content, in order: open Build → EarthProof card visible
  (0.040 → 0.020 kWh, −50%) → cursor points at "CO2e not claimed" → cut.
- [ ] Keep it under ~10 seconds, looping, no audio, no terminal.
- [ ] Everything else (screenshots, architecture diagrams) goes below the
  "Try it" section. Judges who never scroll past the GIF still get the story.

## 3. Before / During box (copy verbatim, 5 min)

Paste this block prominently in Devpost (it is copied from `NEXTSTEP_2026.md`
lines 27–44 — keep it exact so Devpost matches the repo disclosure):

> ### Before NextStep Hacks 2026
>
> Kodro already existed as an MSc research project. Before this contribution it
> already included robot design, Python/blocks programming, kinematic 3D
> simulation, deterministic seeded proof contracts, evidence manifests,
> curriculum lessons, offline/local AI options, an MCP server, browser/desktop
> delivery and a substantial automated QA suite.
>
> ### Built during NextStep Hacks 2026
>
> The dated NextStep branches and pull requests add:
>
> 1. `src/kodro/earthproof.py`: the deterministic EarthProof evidence engine and baseline comparison CLI.
> 2. `tests/unit/test_earthproof.py`, `tests/unit/test_earthproof_validation.py` and `tests/unit/test_nextstep_judge_surface.py`: calculation, validation, reproducibility and judge-surface coverage.
> 3. `docs/eval/earthproof-scenario.json` and `docs/eval/earthproof-baseline.json`: explicitly illustrative candidate and baseline inputs.
> 4. `docs/eval/earthproof-report.json` and `docs/eval/earthproof-comparison-report.json`: reproducible machine-readable outputs.
> 5. The in-product EarthProof card at the Build decision point, plus this disclosure, methodology, demo plan and judging audit.
>
> No claim is made that pre-existing Kodro was built during NextStep.

Add one line beneath it with the dated PR/commit links as before-vs-during
evidence.

## 4. Impact box (copy verbatim, 5 min)

Paste this directly under the GIF. Do not rephrase the boundary sentence.

> **Illustrative scenario (not measured user impact):** baseline central
> operating energy **0.040 kWh** → candidate central operating energy
> **0.020 kWh** (**−50%** central operating-energy difference between two
> illustrative scenarios). **CO2e not claimed** — no grid-carbon factor was
> supplied, so `operational_emissions_kgco2e` is `null`.
> **Energy comparison only; it is not a carbon or lifecycle-impact claim.**

Honest claim boundaries (never cross these):

- Say "illustrative operating-energy scenario", never "saves 50%" or
  "reduces carbon 50%".
- Say "CO2e not claimed", never "zero carbon".
- Say "one prototype assumed avoided (scenario input)", never "avoids a
  prototype per simulation".
- Say "EarthProof is not lifecycle-assessment software", never "LCA tool".
- Say "Kodro predates NextStep; EarthProof is the hackathon contribution",
  never "built during NextStep" about the whole product.

## 5. First Click guide — 4 steps, 60 seconds (10 min)

Put this as the Devpost "Try it" section, in this order:

1. **Open the live build:** https://vaibhav4046.github.io/kodro/
2. **Design → Simulate → Prove:** run the robot in the 3D world, then show
   one seeded proof contract passing. (This is pre-existing Kodro.)
3. **Build → EarthProof card:** open Build, point at 0.040 → 0.020 kWh
   (−50% illustrative) and "CO2e not claimed".
4. **Reproduce in one command** (from repo root):
   ```bash
   python -m kodro.earthproof docs/eval/earthproof-scenario.json --baseline docs/eval/earthproof-baseline.json
   ```
   Expect: fingerprint `11b6238e6236…`, central change `−50.0%`,
   `operational_emissions_kgco2e: null`.

Full 60-second path with expected outputs and objection handlers lives in
`JUDGE_RUN.md` — link it from Devpost.

## 6. Built With + sponsor line (5 min)

**Built With (exact, matches submission pack):**

```text
Python, pygame-ce, Pymunk, React, Three.js, JavaScript, JSON, pytest, GitHub Actions, optional Ollama, Model Context Protocol.
```

**Sponsor/track line (one sentence, under Built With):**

```text
Built for the Earth Forward track: EarthProof turns simulation into auditable pre-build evidence so fewer physical iterations are needed before hardware is purchased.
```

Note the verb: "so fewer … are needed" is an aim, not a measured outcome.
Do not write "so fewer builds happen" or "reducing e-waste by X%".

## 7. Learning + What's Next (copy-adapt, 10 min)

**What I learned (2–3 sentences):**

> Environmental software is as much about claim discipline as arithmetic. A
> correct calculation still misleads if its activity data, factor provenance,
> system boundary, or uncertainty is hidden — so EarthProof treats
> assumptions and limitations as first-class output, and keeps AI assistance
> out of proof verdicts.

**What's next (2 sentences):**

> Validation, not a bigger green score. Classroom and maker studies measuring
> whether virtual-first design changes physical iteration count, component
> purchases, and discarded parts — measured outcomes replace scenario
> assumptions where evidence exists.

## 8. Final pre-submit gate (5 min)

- [ ] Title, tagline, and loop are exact.
- [ ] GIF is above the fold; EarthProof card shown before any terminal shot.
- [ ] Before/During box + dated PR links present.
- [ ] Impact box present with CO2e-not-claimed boundary intact.
- [ ] 4-step First Click guide present with working live + repo links
      (test in a logged-out browser).
- [ ] Video is 3:40 (under the 5-min cap) — script in `VIDEO_SCRIPT_340.md`.
- [ ] No banned phrase anywhere (check against `VIDEO_SCRIPT_340.md`
      DO-NOT-SAY list).
- [ ] `NEXTSTEP_2026.md` linked as the technical deep link.
