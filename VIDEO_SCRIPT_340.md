# VIDEO_SCRIPT_340 — 3:40 narrated demo

Target: under the 5-minute cap. Based on the demo plan in
`NEXTSTEP_SUBMISSION.md` (0:00–3:40). Rule for the whole recording:
**show the in-product evidence before the terminal.**

Judging criteria hit (in order): Originality → Track → Completion →
Learning → Design → Technology. Each segment header names its criterion.

---

## 0:00–0:20 | THE DECISION (Originality)

**Show:** Physical robot parts on a desk, or the Kodro robot design screen.
Title overlay: "Kodro EarthProof".

**Say (exact):**

> "Most robotics tools ask, 'Does this robot work?' Kodro EarthProof asks,
> 'Do we have enough evidence to justify building this version at all?'
> EarthProof is the pre-build evidence gate between simulation and committing
> resources to hardware."

## 0:20–0:45 | THE LOOP (Track: Earth Forward)

**Show:** Kodro open in browser. Overlay the loop text big:
**Design -> Simulate -> Prove -> EarthProof -> Build.**

**Say (exact):**

> "Design, Simulate, Prove, EarthProof, Build. EarthProof is not a
> sustainability dashboard added to the simulator. It changes what the
> simulation is for: evidence for the build decision. Kodro itself predates
> NextStep — it's an MSc research project. EarthProof is the hackathon
> contribution."

## 0:45–1:20 | DESIGN + SIMULATION (Completion: the working product)

**Show:** The existing robot spec and controller. Run it in the 3D
environment. Keep moving — do not tour menus.

**Say (exact):**

> "Here's the existing product. I design the robot, program it, and run it
> in the visual world. This all worked before NextStep, and I kept it
> working — this is a real product, not a hackathon mockup."

## 1:20–1:50 | DETERMINISTIC PROOF (Technology, part 1)

**Show:** One seeded proof contract and its pass/fail evidence. Show the
seed and the verdict.

**Say (exact):**

> "Then I run a seeded proof contract. AI can help with code, but AI cannot
> change this verdict. The proof is deterministic and replayable — same seed,
> same evidence, every time."

## 1:50–2:25 | EARTHPROOF IN THE PRODUCT (Design)

**Show:** Open **Build**. Point the cursor directly at the **EarthProof
card**: baseline **0.040 kWh**, candidate **0.020 kWh**, **−50%
illustrative operating-energy scenario**, then move the cursor to
**CO2e not claimed**.

**Say (exact):**

> "And here is the new NextStep work, at the Build decision. Baseline
> 0.040 kilowatt-hours, candidate 0.020 — a minus-50-percent illustrative
> operating-energy scenario. And CO2e: not claimed. This is an illustrative
> energy comparison, not measured carbon savings."

## 2:25–2:55 | REPRODUCE THE EVIDENCE (Technology, part 2)

**Show:** Terminal. Type and run:

```bash
python -m kodro.earthproof docs/eval/earthproof-scenario.json --baseline docs/eval/earthproof-baseline.json
```

Point at the matching numbers: 0.04, 0.02, −50.0. Then point at the
assumptions, limitations, and SHA-256 fingerprint
(`11b6238e6236…`).

**Say (exact):**

> "Same evidence, reproducible from committed JSON inputs. Baseline 0.04,
> candidate 0.02, minus 50 percent. Every report carries its assumptions,
> its limitations, and a SHA-256 fingerprint — change the evidence, and the
> fingerprint changes."

## 2:55–3:20 | THE ANTI-GREENWASHING MOMENT (Learning)

**Show:** The report's `"operational_emissions_kgco2e": null` field,
then cut back to the in-product "CO2e not claimed" boundary.

**Say (exact):**

> "Here's what I learned building this: the hardest part was deciding what
> not to claim. Kodro does not invent the missing number. No sourced carbon
> factor, no carbon claim. Uncertainty stays visible as low, central, and
> high ranges."

## 3:20–3:40 | CLOSE (Track restated)

**Show:** The loop overlay again:
**Design -> Simulate -> Prove -> EarthProof -> Build.** End on the live
product.

**Say (exact):**

> "EarthProof is not measuring how green a robot is after we build it. It
> asks whether the evidence justifies building that version in the first
> place. Design it. Simulate it. Prove it. EarthProof it. Then build."

---

## DO-NOT-SAY LIST (banned phrases — check the final cut)

- "Eliminates e-waste" (or "eliminate / cut / end e-waste")
- "Reduces carbon 50%" (or "cuts emissions 50%", "50% greener",
  "50% carbon saving")
- "Built during NextStep" about Kodro as a whole (only EarthProof is the
  NextStep contribution)
- Any LCA claim ("lifecycle assessment", "lifecycle analysis",
  "cradle-to-grave", "embodied carbon measured")
- "Every simulation avoids a prototype" (prototype avoidance is always a
  user-supplied scenario assumption, never inferred from a sim pass)
- "Zero carbon" / "carbon neutral" / "sustainable robot" as a verdict
- Any environmental number without its assumption stated beside it

## Preferred fallback lines (use these instead)

- "Illustrative operating-energy scenario, not measured impact."
- "CO2e not claimed — no factor supplied."
- "Energy comparison only; not a carbon or lifecycle-impact claim."
- "Scenario assumption, not a measured outcome."
