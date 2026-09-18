# Nebius Physical AI gap analysis (2026-09-17)

Target: a Stage-1-passing, Stage-2-competitive Physical AI submission by
2026-10-30 10:00 PDT. Status per requirement — HELD vs GAP. No Nebius,
NVIDIA-cloud, or Tavily integration is claimed anywhere in the tree
(verified: zero repo matches for Nebius/Tavily; Nemotron appears only as a
local Ollama picker example).

## HELD

- Public MIT repo with README run instructions; deterministic kinematic
  simulator + grader + Prove contracts + Genesis compare loop (the
  falsification loop the track rewards, minus the sponsor runtime).
- Eligible-window update story with 52 commits (`CHANGELOG_HACKATHON.md`).
- Raw demo footage: scripted 90 s golden journey, 7/7 assertions, no mocks.
- Offline-first posture matches "sense/act with evidence before hardware".

## GAP (ordered by Stage-1 risk)

1. **Sponsor runtime (Stage-1 pass/fail).** No Token Factory inference call
   and no AI Cloud compute in any runtime path. Smallest credible design:
   a `kodro-genesis --planner nemotron` adapter where candidate *proposals*
   come from Nemotron via Token Factory while measurement stays in Prove
   (preserves "Nemotron reasons, Kodro proves"); or Serverless Jobs for the
   seeded batch with local fallback. Blocked on: human claims credits
   (form code `NEBIUS-DEVPOST-GLOBAL26` or Builders Program) and provides
   account access — cannot be done from here.
2. **NVIDIA model in the loop.** Same adapter as (1): Nemotron 3 Nano/Super
   for fast proposal calls. No heavyweight robotics stack needed; our
   engine is the simulator of record.
3. **Video.** Raw footage exists; needs narration + <3 min cut with ≥1 min
   of modules in action (studio run, evidence, lab, provider state).
4. **Devpost fields.** Description, track, feedback section, and the final
   submit click are human actions.
5. **Tavily bonus (optional).** Only candidate use: traceable retrieval of
   real component specs (e.g. ESP32/motor datasheets) into Robot Lab
   validation with source provenance. Not started; skip unless it earns
   its complexity before Oct 20.

## Non-goals (would weaken the entry)

Reskinning as a generic chatbot, claiming a cloud integration without a
runtime call, adding ROS/Gazebo/Isaac weight, Tavily-for-bonus theatre.
