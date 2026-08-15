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
work. The canonical PDF is **59** pages against `docs/GPT_HANDOFF.md:34`, which
says "EXACTLY 50 pages (hard limit)".

The table did not cause this. The PDF was 59 pages before the edit (sha
`5344b0aa`) and is 59 pages after: the nine rows absorbed into existing
whitespace. The gap is pre-existing, is already logged as audit **HIGH 4**, and
turns entirely on which of three readings the real brief means: 48 body pages,
50 arabic-numbered pages, or 59 sheets in the file. Nobody in this repository
has seen the brief. `docs/ca2/CLAIM_LEDGER.md` item 8 forbids stating the page
limit as settled, and that stands.

Added 15 August, later the same day: "48 body pages" above counts the References
section as body, which is what `CA2_INTEGRITY_AUDIT_2026-08-14.md:235` means by
"Chapter 1 through References". Excluding references the body is 46, because
references occupy printed pages 47 and 48. Stating 48 without saying which of
the two it is had already produced a wrong row in `docs/ca2/BRIEF_VERIFIED.md`
and a wrong line in `docs/ca2/FINAL_CHECKLIST.md`, both corrected. The three
readings and the conclusion are unaffected.
