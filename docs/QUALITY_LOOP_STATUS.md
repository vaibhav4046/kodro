# God-mode quality loop status

Live record of the iterative quality push. Update after each round. The rule
that does not bend: scores are EARNED and assessed honestly, never fabricated.
A 10 is only written when the harsh review genuinely gives it; structural
ceilings (no human study yet, small local model, procedural-not-photoreal by
design) are stated, not papered over.

## Verify (cheap, offline, run before each commit)
```
node scripts/build_web.cjs            # rebuild bundle
node scripts/qa_interpreter.mjs       # expect 21/21
node scripts/qa_vibe.mjs              # measured vibe pass-rate (needs Ollama)
python -m pytest -q --no-cov          # expect 854 (0 failed)
```
Re-rate with the brutal review workflow: `kodro-brutal-review` (6 harsh raters).
Capture worlds for visual judging: `cap.html?world=<id>&robot=rover&q=high&run=1`
at 1280x800 via headless Chrome with `--use-angle=swiftshader` (see prior
captures in docs/img/audit). Do NOT hammer the single-thread server: one shot at
a time, pause between.

## Honest ratings (last full brutal review = 6.5 avg; updated by earned fixes)
- Offline robustness: 8 -> 9  (auto-fallback to 2.5D on 3D failure, b6858b0)
- AI / vibe: 7 -> 8  (normalizer + validate gate; measured 8/8 runnable, e112471, a85c4eb)
- UX / first-run: 6 -> ~6.5  (onboarding reduced-motion + phone 44px, 2d7183d) -- MORE TO DO
- Visual realism: 6.5  -- NEXT
- Code quality: 7  -- big lever, risky
- Dissertation: 6.5  (integrity fixes 0a0b920) -- needs author decision

## Remaining work per axis (do, verify, re-review, repeat)
1. VISUAL (next): indoor worlds (lab/warehouse) under-lit and wash out -- darker
   contrast walls + a floor relief/texture for indoor floors + horizon haze on
   the open-world sky. Capture each world in 3D and judge. Arm/home worlds need
   surrounding detail, not a void.
2. UX (continue): studio toolbar clips at 1280px; the first-load editor dumps a
   26-line program (consider a shorter default); 7 navbar icons are hover-only
   (touch discoverability). Onboarding still uses hardcoded colours not theme
   tokens.
3. CODE: app.jsx is a ~2100-line God component (77 useState) -- decompose into
   hooks/modules; BridgeAPI (web/app.py) is 1548 lines -- split; retire or demote
   the legacy Tkinter default entrypoint.
4. DISSERTATION (author decision): reconcile audience (adult-maker vs the KS3/KS4
   lesson set the code ships) so prose matches the artifact; make the persona
   table trace to ONE source (it currently differs from evaluation.md); wire the
   measured qa_vibe number in as honest AI evidence.

## Honest ceiling note
Evaluation cannot truthfully be 10 until the HUMAN_TODO.md user study is run by a
human. That is the one axis no amount of code work can take to 10 honestly.
