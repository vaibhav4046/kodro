# BCS citations closed, and a build trap found while closing them

Dated 2026-08-15. Branch `agent/kodro-ca2-candidate`, working tree at `a3fd0d5`
plus the uncommitted dissertation edits described below.

Two dissertation items were carried as blocked because "a browser is needed and
`WebFetch` fails". That justification expired: `WebFetch` and `WebSearch` do
still fail with `There's an issue with the selected model (auto/best-free)`, but
`curl` through the Bash tool has full network access and was never tried on
these two URLs. Both items are now closed against the primary sources.

A third thing came out of the compile that matters more than either of them,
because it will silently break the next person who edits the `.tex`. It is in
section 3.

## 1. What was verified, and what was not

### The course accreditation guidelines: fully verified

```
curl -sS -o bcs.pdf -w "HTTP=%{http_code} TYPE=%{content_type} SIZE=%{size_download}\n" \
  https://www.bcs.org/media/11ofljxo/course-accreditation-guidelines.pdf
HTTP=200 TYPE=application/pdf SIZE=798814
```

Read with `pypdf`: 47 pages, 126,115 characters of extracted text.

- Cover page reads `Guidelines on course accreditation` / `Information for
  universities and colleges` / `January 2020`. So the date is January 2020, not
  the 2022 that an earlier draft carried. This independently reproduces what PR
  3's `REFERENCE_AUDIT_2026-08-13.md` recorded, rather than trusting it.
- Page 31 carries `Section 2` / `Core requirements for accreditation of honours
  programmes` and enumerates **2.1.1 through 2.1.9**, with ability wording
  matching the row labels PR 3's table uses.

All four conditions written down in `CA2_RECONCILIATION.md` section 10.4 were
therefore met, and the table was ported.

### The Code of Conduct: partly verified, and the citation was downgraded

```
curl -sS -o coc.html -w "HTTP=%{http_code} TYPE=%{content_type} SIZE=%{size_download}\n" \
  https://www.bcs.org/membership-and-registrations/become-a-member/bcs-code-of-conduct/
HTTP=200 TYPE=text/html; charset=utf-8 SIZE=82128
```

Confirmed: the URL resolves; the `<h1>` is `BCS Code of Conduct`; the `<title>`
is `BCS Code of Conduct for members - Ethics for IT professionals | BCS`; and
all four principles the dissertation names at `.tex:899` appear verbatim on the
page as `PUBLIC INTEREST`, `PROFESSIONAL COMPETENCE AND INTEGRITY`, `DUTY TO
RELEVANT AUTHORITY` and `DUTY TO THE PROFESSION`.

Not confirmed, because it does not exist: **the page carries no version number
and no version date anywhere.** The only strings matching `version` in the raw
HTML belong to the analytics SDK (`sv:"5",version:2`,
`"ai.internal.sdkVersion"`). The only date-bearing content string is the footer
copyright line.

So the old `\bibitem[BCS(2022)]{bcscode}` asserted a year the source does not
state. It was replaced with `(no date)` plus a real access date, which is what
the evidence supports. Inventing a version to make the entry look tidy was the
one option not available.

## 2. Edits made to `Kodro_Dissertation.tex`

1. **Table inserted.** The nine-row `tab:bcsmap` block, after the Code-of-Conduct
   paragraph in `\section{BCS professional issues and project criteria}`.
2. **Bibliography.** The `[VERIFY VERSION, URL AND ACCESS DATE BEFORE
   SUBMISSION]` placeholder is gone. Two real entries replace it: `bcs2020` and
   `bcscode`, both with an access date of 15 August 2026, which is the date they
   were actually fetched.
3. **Column widths** `p{1.5cm}p{4.2cm}p{8.0cm}` to `p{1.4cm}p{4.8cm}p{8.2cm}`,
   because row 2.1.7 hyphenated mid-word in the rendered PDF.

Two of PR 3's nine rows were **not** taken verbatim, because they assert things
this document does not support:

| Row | PR 3 wording | Why it was changed |
|---|---|---|
| 2.1.6 | "study consent" | This candidate's ethics section states that no study has happened and one is only planned. Changed to "the planned study's consent requirements". |
| 2.1.7 | "removes per-seat fees" | `per-seat` has **zero** occurrences in this dissertation. Changed to "needs no account or subscription", which is the document's own evidenced wording. |

The other seven rows lift verbatim. Each claim inside them was checked against
this document before it was accepted: Chapter 6 is Evaluation and Chapter 7 is
Discussion and Limitations, so the cross-references land; and the objectives do
run O1 to O10, because the second `enumerate` at `.tex:242` carries `start=7`
rather than restarting at 1.

## 3. The build trap: a tracked stale `.aux` silently shadows `-output-directory`

**Symptom.** After inserting the table, every pass printed:

```
LaTeX Warning: Citation 'bcs2020' on page 43 undefined
LaTeX Warning: Reference 'tab:bcsmap' on page 43 undefined
```

and they survived **four** consecutive `pdflatex` passes. The first hypothesis,
that pass 1 had simply not written the aux yet, is wrong: that condition clears
on pass 2 by construction.

**Diagnostic that cracked it.** Only the newly added keys were undefined. The
other 25 citations in the document resolved normally. And
`_build/Kodro_Dissertation.aux` demonstrably contained both:

```
\newlabel{tab:bcsmap}{{8.1}{43}...}
\bibcite{bcs2020}{{3}{2020}{{BCS}}{{}}}
```

The aux being read was not the aux being written.

**Root cause.** `docs/dissertation/Kodro_Dissertation.aux` is **tracked by git**
and was left over from an older build. The compile runs with
`-output-directory=_build`, but TeX's input path searches the source directory
first, so it read the stale source-dir copy and ignored the fresh `_build` one.
Any newly added `\label` or `\citation` therefore stays undefined forever, no
matter how many passes run, while every pre-existing key resolves fine. That
asymmetry is what makes it hard to spot.

**Fix applied.** Refresh, not delete:

```bash
cp _build/Kodro_Dissertation.aux _build/Kodro_Dissertation.out _build/Kodro_Dissertation.toc .
```

Delete was rejected. These files are tracked on purpose. `.gitignore:91-92`
records why: the `.log` is ignored because it carries a local username, while
"the .aux, .toc and .out files do not, and one of them is cited by a diagnostic,
so those stay."

**This will happen again.** Anyone who adds a `\label`, a `\citep` key or a new
figure to the `.tex` and compiles into `_build` will see exactly this, and the
obvious response, running more passes, cannot fix it. Refresh the three
source-dir files from `_build` after any structural edit.

## 4. Final measured state

Two clean passes after the aux refresh:

```
PASS1 EXIT=0   PASS2 EXIT=0
warnings: none | Overfull 0 | Undefined control 0
Undefined citations 0 | Undefined references 0
```

Hashes taken now, not carried from an earlier note:

```
Kodro_Dissertation.pdf                  pages= 59 bytes=1115505 sha256=294103b92657dcd2...
_build/Kodro_Dissertation.pdf           pages= 59 bytes=1115505 sha256=294103b92657dcd2...
_build/current/Kodro_Dissertation.pdf   pages= 50 bytes=1040175 sha256=fc7ef349b3520f28...
```

Full digest of the canonical PDF:
`294103b92657dcd23579c8a5972f0e597fff04c9eaa4a1a82f7fc40fb08bd9dd`.

The canonical PDF and `_build/Kodro_Dissertation.pdf` are byte-identical, which
is what mandate rule 6 requires of a generated artefact and its source build.
Rendered checks: `??` appears 0 times in the extracted text; Table 8.1 renders
on PDF sheet 52 with all nine rows present; both BCS bibliography entries render
on sheet 56.

This supersedes the compile block in
`.kodro/ca2-evidence/2026-08-14-test-suite-evidence.md`, which recorded 59 pages
at 1,111,967 bytes and sha `5344b0aa...`. That file is left exactly as it is: it
was true when written and it is the record of that state.

## 5. Open, and not caused by this work

`_build/current/Kodro_Dissertation.pdf` is a **50**-page snapshot, last touched
by commit `ac381c6`. Its aux does not contain `bcs2020`, so it predates this
work. The canonical PDF is **59** pages against `docs/GPT_HANDOFF.md:40` (the
line beginning "- File: docs/dissertation/Kodro_Dissertation.tex"), which says
"EXACTLY 50 pages (hard limit)".

The table did not cause this. The PDF was 59 pages before the edit (sha
`5344b0aa`) and is 59 pages after: the nine rows absorbed into existing
whitespace. The gap is pre-existing, is already logged as audit **HIGH 4**, and
turns entirely on which of three readings the real brief means: 48 body pages,
50 arabic-numbered pages, or 59 sheets in the file. Nobody in this repository
has seen the brief. `docs/ca2/CLAIM_LEDGER.md` item 8 forbids stating the page
limit as settled, and that stands.

Added 15 August, later the same day: "48 body pages" above counts the References
section as body, which is what `CA2_INTEGRITY_AUDIT_2026-08-14.md:360` (the row
`| Body only, Chapter 1 through References | 48 printed pages |`) means by
"Chapter 1 through References". Excluding references the body is 46, because
references occupy printed pages 47 and 48. Stating 48 without saying which of
the two it is had already produced a wrong row in `docs/ca2/BRIEF_VERIFIED.md`
and a wrong line in `docs/ca2/FINAL_CHECKLIST.md`, both corrected. The three
readings and the conclusion are unaffected.

Both line numbers in this file were re-resolved on 15 August 2026 and both had
drifted. `GPT_HANDOFF.md:34` became `:40` when a dated staleness disclaimer was
inserted above it earlier the same day. `CA2_INTEGRITY_AUDIT_2026-08-14.md:235`
became `:360` across three later commits, `ebe629e`, `c0e6382` and `ca91ae6`,
plus the HIGH 4 rewrite in this same batch. Both were correct at the commit that
wrote them, `0ef8436`, so neither was wrong when written. Both now carry the
quoted line beside the number, because a drifted citation still lands on a line
that exists and the repository citation scan therefore reports it as found and in
range. Range is not correctness. Cite by content as well as by number, and
re-resolve inbound citations after any commit that inserts lines into a cited
file.

## The check is now a tracked gate, and the old figure was wrong

Added 15 August 2026. Everything above was found by hand or by a throwaway
script in a temp directory. The repository had no citation checker of any kind:
`git ls-files | grep -i -E "cite|citation"` returned only this evidence file,
and `ls scripts/` had nothing matching either. Earlier in the same working
session a range-only sweep reported roughly 140 citations with 138 in range,
but that came from a command typed at a prompt and was never written into any
tracked file, so there is no stale figure in the repository to correct. The
problem was the opposite one: a check that had been run and quoted in
conversation, with nothing in the tree that would let anyone run it again.

There is now `scripts/qa_citations.py` with `scripts/qa_citations_allow.txt`.
Run it with `python scripts/qa_citations.py`. It resolves every `path:line` in
tracked Markdown, hard-fails on a target that is untracked or past end of file,
and separately reports anchors that are blank or nothing but a brace, plus paths
that are ambiguous across tracked files. Current result:

    PASS  citations: 148 found across 107 documents, 0 unresolvable,
          0 needing review, 39 waived (1 by line, 1 by file)

That block first read 146, which is what the gate printed just before this
section was written. Writing the section added two more citations to this very
file and made the quoted output wrong inside the same edit. It is a small thing
and it is the whole defect class in miniature: a figure copied out of a real
run, correct at the instant it was pasted, describing a tree that the paste
itself changed. Re-run the command before trusting any count quoted in prose,
including this one.

Three things about that number are worth writing down.

It is 146, not 100, and not 140. The ad-hoc scan I ran on 15 August counted 100
because its extension list omitted `jsx`, so the `hooks.jsx` citation at line
1220 and every other `.jsx` citation fell outside the regex entirely. `git grep -o -E
'[A-Za-z0-9_./-]+\.jsx:[0-9]+' -- '*.md' | wc -l` returns 46, and 100 plus 46 is
146 exactly. So last pass's "content-aware sweep clean" covered 100 of 146
citations and never looked at the other 46. A sweep that skips a file class and
reports clean is not a measurement, and the fact that it was my own sweep, run
specifically to catch this defect class, is the point.

39 citations are waived and therefore unchecked. 38 of them are the whole of
`docs/KODRO_JUDGE_VERDICT.md`, which is a superseded snapshot whose own banner
says every line number in it describes commit `541941d` on 11 July 2026. The
waiver is legitimate but it is a quarter of the corpus, so the gate prints the
file and the count on every run rather than folding it into a total. A waiver
that is not counted out loud becomes an unmeasured region that reads as green.

One real defect fell out of the sweep: `docs/ca2/SCRIPT.md:154` cited `app.py`
by bare basename with a line number, and that basename matches both
`src/robolearn/app.py` and `src/robolearn/web/app.py`, whose line 171 is an
unrelated field. The claim was right and the pointer was not
checkable, in the document that says what to say out loud on an assessed
recording. Fixed to the full path, the same fix already applied to
`docs/ca2/CLAIM_LEDGER.md:192`.

The gate was exercised in both directions, because a check that cannot go red is
not a check. A temporary file citing a missing target, a line past end of file
and a blank anchor produced `2 unresolvable, 1 needing review` and rc=1. The
first attempt at that self-test was itself defective: it cited
`scripts/qa_citations.py`, which was not staged yet and therefore not in `git
ls-files`, so the past-end and bad-anchor branches never ran and the result still
looked conclusive. Only files git already knows about are scanned or accepted as
targets. That limit is written into the script docstring.

## The gate had the same blind spot it was built to find

Added 15 August 2026, later the same day. The gate above shipped reporting `PASS
citations: 148 found`. That number was wrong in the direction that matters: it
was not an overcount, it was a count of the only form the regex could see.

Documents cite several lines of one file in a shorthand that drops the repeated
path, writing the first reference in full and the rest as a bare backticked
colon-and-number. The pattern the gate matched required a filename with an
extension in front of the colon, so every one of those continuations was
invisible to it. Measured rather than guessed: a repo-wide scan for the bare
backticked form returns 129 occurrences. 114 are not citations at all, mostly
port numbers like the one in the evidence-capture instructions, and 15 are real
references into real files that had never once been checked.

So a tool written specifically to catch citation drift shipped with a blind spot
of exactly the shape of the defect it hunts. This is the second time in two days
that has happened in this workstream: the throwaway scan before it omitted the
`jsx` extension and missed 46 citations. The lesson that generalises is not
"remember jsx" or "remember continuations". It is that a checker's coverage is
itself a measurement, and an uncounted region reads as green just as loudly as a
verified one.

The fix resolves a continuation against the nearest full citation earlier on the
same line, which is the convention that makes the shorthand readable to a person
in the first place, and refuses to guess when there is no such citation. Those
refusals are counted and printed rather than dropped, so the summary line now
ends with the number of backticked colon-forms it declined to treat as
citations. Coverage went from 148 to 166.

The new branch was proved to fail before it was trusted. A staged temporary file
citing a real document in full and then continuing past the end of it produced

    FAIL  docs/_selftest_cont.md:2 -> docs/GPT_HANDOFF.md:99999  past end of file (len=64)

with rc=1, which proves both halves at once: the continuation inherited the path
from the full citation before it, and the past-end branch fired on an inherited
path. In the same file a backticked port number with no citation before it
pushed the unanchored count from 114 to 115 instead of being silently resolved
against something. After removing the file the gate returned to green with no
residue.

Three real drifted citations were found and fixed as a direct consequence, and
all three were drifted by the edit made earlier in this same session. Adding a
correction block to `.kodro/autonomy/STATE.md` pushed the fifty-page claim from
line 276 to 297, and the audit that cited it still resolved and still passed,
because a drifted citation lands on a line that exists. Two more in
`docs/dissertation/CA2_INTEGRITY_AUDIT_2026-08-14.md` were written in the
continuation shorthand and so were never examined at all; both moved by four
lines. They are now written as full paths.

The allowlist drifted too, and this is the part worth carrying forward. Its one
line-keyed waiver was pinned to line 338. Inserting two lines above that point
moved the waived citation to 340, so the gate reported the worked example as a
fresh review item while the stale key sat waiving whatever had moved into its
old place. A line-keyed suppression list carries the identical defect as the
citations it suppresses, one level up, and nothing checks it. The entry was
re-pointed to 340 and the file now says so in its header.

## Making a hard failure waivable without making the gate toothless

Recording the section above turned the gate red, which is worth spelling out
because the fix could easily have been the wrong one. The prose quotes the
self-test's literal FAIL output, and that output names a file that was deleted
on purpose and a line number past the end of a real file on purpose. Both are
citations by the gate's own regex. Hard failures were unwaivable by design, on
the reasoning that an unresolvable citation is always wrong.

That invariant was actively harmful here. The only way to get green would have
been to edit quoted tool output, which falsifies a recorded result to satisfy a
checker. So hard failures became waivable per line, and print as WAIVED-BROKEN
rather than disappearing into the waived count.

A relaxation like that has to be proved not to have removed the check. Staging
a fresh document with three unwaived bad citations, one naming a file that does
not exist and two past the end of a real file, one of those in the continuation
shorthand:

```
FAIL  citations: 171 found across 108 documents, 3 unresolvable, 0 needing review, 44 waived (2 by line, 1 by file), 114 backticked `:N` not a citation
SELFTEST_RC=1
```

Three, not two, so the continuation branch reaches the past-end check as well as
the resolve check. After deleting the staged file the gate returns to 168 found,
0 unresolvable, exit 0, and `git status` shows no residue. The waiver is a
statement about two specific lines, not a hole in the failure path.
