# CA2 final checklist

Work down it. Nothing here is a formality; every unchecked line is a way the
submission can be worth less than the work behind it.

Three of the items can only be done by the student, and they are marked. They
are also the three that can invalidate everything else.

## Before recording

- [ ] **STUDENT: confirm the video duration from the current Canvas brief.** The
      2023 public page says 10 minutes twice and 15 once, all three in the same
      document. The master script fits 10 with four expansion blocks for 15.
      Source and exact quotes in `BRIEF_VERIFIED.md`.
- [ ] **STUDENT: confirm whether a PDF slide deck and a short report are also
      required, and whether submission is one ZIP.** The 2023 page lists all
      three as one component and neither the deck nor the report exists in this
      repository. This is the item most likely to invalidate an otherwise
      finished submission. See `BRIEF_VERIFIED.md`, section 3 corrected.
- [ ] Working tree clean, and the commit noted: `git status --porcelain && git log --oneline -1`
- [ ] Short gate set green on that exact state: `qa_secrets`, `qa_honesty`,
      `qa_interpreter`, `qa_voice`, `smoke_mcp`
- [ ] `qa_secrets` specifically, because the repository is public and the video
      shows a terminal: a leaked path on screen is published twice over
- [ ] Frame cleared against the list in `STORYBOARD.md`, including the probe
      files in the served asset directory and the two clutter files at the
      repository root
- [ ] Terminal prompt carries no user name, font 16 pt or larger
- [ ] Notifications off, display at 1920 by 1080
- [ ] `SCRIPT.md` rehearsed at least once end to end, out loud, with the numbers
      said from memory
- [ ] The MCP option chosen: harness session or live client. If live client,
      tested in the same session first

## While recording

- [ ] Recording order followed from `CAPTURE_MANIFEST.md`, risky blocks first
- [ ] Every take kept, named `ca2_<order>_<block>_take<n>.mp4`
- [ ] Silence held during the first two seconds of rover motion
- [ ] Nothing said on camera that lacks a row in `CLAIM_LEDGER.md`
- [ ] The limits block recorded in full, not trimmed for time
- [ ] Any fallback used is noted, with which block and why

## After recording, before export

- [ ] Watch the cut end to end with the claim ledger open, pausing at every
      number
- [ ] No frame shows a path containing the machine's user name
- [ ] No frame shows a probe file, harness file, or unrelated tab
- [ ] Audio level consistent across blocks recorded in different sessions
- [ ] Runtime inside the confirmed cap, with at least fifteen seconds of margin
- [ ] Title card carries the module code, the student name and the date
- [ ] Export at 1920 by 1080

## Repository state at submission

- [ ] No secret, token, credential, private path, local user name or personal
      participant data anywhere in tracked files. Run a secret scan
- [ ] Generated artefacts match their sources: the lesson export hash matches on
      regeneration, and the bundle matches its source
- [ ] `docs/eval/test_suite.json` reflects a clean-tree run at the commit being
      submitted, not an older one. It currently pins `aa174cf`. Regenerating it
      is not a standalone act: the dissertation quotes its figures at
      `Kodro_Dissertation.tex` lines 150, 160 and 633, and the claim ledger
      carries the same row, so all four move together or the document
      contradicts the artefact. Procedure and the exact four edits are in
      `.kodro/ca2-evidence/2026-08-14-test-suite-evidence.md`
- [ ] If that regeneration produces a different skip count, report it as
      measured. The count is not stable on this host: three runs of the same
      1,639 tests gave 1 skip, then 2, then 0. Thirteen test files turn an
      intermittent local Tk initialisation failure into a skip instead of a
      failure, and 169 collected tests sit behind those guards. The cause is not
      established, so do not write one into the document, and do not re-run
      until the number looks tidier
- [ ] Re-read the `skipDetail` block after any regeneration. Its `test` and
      `reason` fields are currently an unverified pair: the reason string's
      wording is the format string from `tests/unit/test_ui_main_window.py:27`
      while the test it names lives in `tests/unit/test_ai_studio.py`, which
      emits different wording and always has. The artefact flags this in its own
      `provenance` field. A regeneration must read both fields out of the run's
      JUnit XML rather than carrying either across, and if it does, delete the
      `provenance` field in the same edit
- [ ] The academic-integrity AI-assistance disclosure is present and unaltered in
      the dissertation

## Dissertation

- [ ] **STUDENT: confirm which page count the brief means**, and whether the
      current document complies. Measured: 59 sheets total, 50 arabic-numbered
      pages, 48 body pages excluding references and appendices. See
      `BRIEF_VERIFIED.md`
- [ ] Compiles clean from a clean build directory, two passes, no undefined
      citations, no missing figures, no overfull boxes
- [ ] Every number in the document maps to a current artefact
- [ ] The placeholder in the BCS reference is resolved or removed. It currently
      renders as bold placeholder text in the reference list, and the access date
      must not be invented
- [ ] No claim of human evaluation, physical validation, deployment, signing or a
      Turnitin result

## Submission

- [ ] **STUDENT: confirm the submission mechanics**: accepted format, size cap,
      whether the video is uploaded or linked, whether anything is required
      alongside it, and how the Q&A slot is allocated
- [ ] Submitted before 21 August 2026, 17:00 Europe/London. There is no automatic
      extension and a late submission scores zero
- [ ] `Q_AND_A.md` reread the day before the Q&A, particularly the three
      weaknesses

## The one rule

If a line above cannot be checked honestly, the fix is to change the artefact,
not to check the line.
