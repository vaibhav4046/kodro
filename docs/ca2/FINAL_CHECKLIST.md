# CA2 final checklist

Work down it. Nothing here is a formality; every unchecked line is a way the
submission can be worth less than the work behind it.

Three of the items can only be done by the student, and they are marked. They
are also the three that can invalidate everything else.

## Before recording

- [ ] **STUDENT: confirm the video duration from the current Canvas brief.** The
      2023 public page says 10 minutes twice and 15 once, all three in the same
      document. The master script fits 10 with three expansion blocks for 15,
      taking it to 13:30. Source and exact quotes in `BRIEF_VERIFIED.md`.
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
- [x] `docs/eval/test_suite.json` pins a clean-tree run at a named commit, and
      any divergence between that commit and the one being submitted is
      disclosed rather than left for a marker to find. Read the 18 August note
      at the end of this item first: as of the release commit the artefact and
      HEAD are deliberately not the same commit. Done on 17 August: it pins `e70b98b`,
      1,641 collected, 1,641 passed, 0 skipped, 90.85 percent. The nine
      dependent sites moved with it in the same change, and two more were found
      that the recorded procedure below does not catch, both in `SCRIPT.md`,
      where the figures are spelled out as spoken words and no numeric grep can
      see them. Anyone repeating this must run
      `git grep -n -i 'thousand six hundred\|ninety point'` as well as the
      numeric search. The artefact also has a generator now,
      `scripts/gen_test_suite_json.py`, so the next regeneration is
      `--capture`, run pytest, then write from the run's own JUnit XML and
      coverage JSON. The counts can no longer be typed in. The commit stays
      correct only while nothing under `tests/` or the Python source changes
      after the run, so check
      `git diff e70b98b..HEAD -- tests/ 'src/robolearn/**/*.py'` before
      submitting and re-run if it is not empty. The historical record of the
      earlier regeneration is below and stays as written. Regenerating is not a
      standalone act: the dissertation quotes its commit and its
      figures at five separate places and `CLAIM_LEDGER.md` at four more, so
      nine sites move together or the document contradicts the artefact. Do not
      trust the line numbers below, find the sites, because the `.tex` has grown
      since they were recorded:
      `git grep -n 'aa174cf\|1,639\|1,638' -- docs/dissertation/Kodro_Dissertation.tex docs/ca2/CLAIM_LEDGER.md`.
      Run on 15 August that prints `.tex` 150, 160, 633, 850 and 932, and
      `CLAIM_LEDGER.md` 11, 48, 51 and 54. Note that the split is uneven and
      that is the trap: `.tex:150` and ledger 11 and 51 name the commit and
      quote no figure, while `.tex:850`, `.tex:932` and ledger 54 quote the
      figures and name no commit, so a regeneration that chases only one of the
      two strings leaves the other sites stale. Procedure and the full edit
      table are in
      `.kodro/ca2-evidence/2026-08-14-test-suite-evidence.md`, which records
      seven edits and is the authority.
      Updated 18 August, and the update is that the divergence check above
      fired and the recommended fix was refused. The release commit `66e8632`
      bumps to 2.1.0 and is the first commit since 17 August to touch Python
      source, so
      `git diff e70b98b..HEAD -- tests/ 'src/robolearn/**/*.py'` is now
      non-empty: `src/robolearn/ui/splash.py` +4/-1, where a hardcoded `v2.0.0`
      became a metadata lookup, and `tests/unit/test_splash_and_main.py` +21,
      one regression test pinning it. The artefact was **not** regenerated. The
      warning three paragraphs up is the reason: twenty-nine sites move
      together, five of them inside the dissertation with one in the
      declaration and one in the abstract, and the PDF would need rebuilding.
      Every one of those sites names `e70b98b`, and everything they say about
      `e70b98b` is still true and still reproducible from a checkout, so
      regenerating would replace true statements with different true statements
      at the cost of a document-wide edit days before submission. Instead the
      release run was taken and disclosed: at `66e8632`, clean tree, 1,642
      collected, 1,641 passed, 1 skipped, 90.78 percent, exit 0. The full run,
      the skip characterisation and the reasoning are in
      `.kodro/ca2-evidence/2026-08-18-release-run-and-artefact-divergence.md`.
      `CLAIM_LEDGER.md` carries both pairs of figures as separate rows,
      `SCRIPT.md` and `ca2-demo-script.md` speak the release pair, and the
      dissertation keeps the pinned pair. If a later change makes the two
      commits diverge on something that actually alters behaviour rather than a
      version string, that judgement flips and the twenty-nine-site
      regeneration has to happen. Read the diff before deciding, do not reuse
      this decision by default.
      One trap found in the release run, worth more than the decision itself: a
      leftover coverage JSON at the target path survived and reported the
      previous day's figures, which happened to match the `e70b98b` artefact
      exactly. Cross-check `meta.timestamp` in the coverage JSON against the
      JUnit XML timestamp, or delete the target first. Publishing 90.85 for a
      run that measured 90.78 was one careless read away
- [ ] This item read "lines 150, 160 and 633 ... so all four move together"
      until 15 August. Those are exactly the three sites carrying the commit
      name, presented as though they were the sites carrying the figures, which
      they are not: `.tex:850` and `.tex:932` carry 1,639 and name no commit,
      and the ledger has four sites rather than one. The evidence file was
      complete and correct the whole time and this checklist had compressed it
      wrongly. A subset of an authoritative list is the most dangerous shape a
      procedure can take, because it looks like a procedure and it runs to
      completion. The count in the item above was itself wrong once before it
      was committed, written as six from memory and corrected to nine by
      running the command the item now offers, which is the only reason that
      command is in there
- [x] If that regeneration produces a different skip count, report it as
      measured. It did: the 17 August run recorded 0. That was written up as a
      run with no skip rather than as the intermittency being resolved, in the
      artefact's `provenanceNote`, in `CLAIM_LEDGER.md`, in `Q_AND_A.md`, in
      the narration and at two places in the `.tex`. An empty `skipDetail` and
      a fixed defect look identical in a diff, and the difference has to be
      written down or the absence reads as a repair. The count is not stable on
      this host: four runs have now been taken, three of the same
      1,639 tests gave 1 skip, then 2, then 0, and the 1,641-test run gave 0.
      Thirteen test files turn an
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
      pages, 46 body pages excluding references and appendices, 48 if references
      are counted as body. This line said 48 for the excluding-references
      reading until 15 August, which mixed up the two; references run to printed
      page 48, so excluding them the body ends at 46. See `BRIEF_VERIFIED.md`
- [ ] Compiles clean from a clean build directory, two passes, no undefined
      citations, no missing figures, no overfull boxes
- [ ] Every number in the document maps to a current artefact
- [ ] The placeholder in the BCS reference is resolved or removed. **Done on 15
      August 2026, and the access date was not invented.** The page was fetched,
      HTTP 200, all four principle headings quoted at `.tex:899` appear on it
      verbatim, and it carries no version number and no version date anywhere,
      so the year the entry used to assert had no source. The entry now reads
      `BCS(no date)` with a real access date. Verified in the committed PDF, not
      only in the source: `pdftotext` over
      `docs/dissertation/Kodro_Dissertation.pdf` returns zero occurrences of
      `VERIFY VERSION`, two of `Accessed: 15 August 2026`, and renders the
      citation as `(BCS, no date)`. Evidence in
      `.kodro/ca2-evidence/2026-08-15-bcs-citations-and-aux-shadowing.md`. The
      box stays open because it must be re-checked against whichever PDF is
      actually submitted, not because the work is outstanding
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
