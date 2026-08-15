# CA2 brief: what is verified, what is not

Written 14 August 2026. Everything below is split into two lists on purpose.
The first list is safe to plan against. The second list changes the deliverable
if it resolves the other way, and it cannot be resolved from this machine,
because the current brief lives behind a Canvas login and this environment has
no account access and no network path to it.

Read the second list before recording anything.

> **Corrected 15 August 2026.** Two statements above and one in section 1 are
> wrong. The sentence "no account access and no network path to it" is half
> false: the Canvas login is a real blocker, the network is not. The public
> COMP702 material was then fetched and read, which settles where the runtime
> contradiction comes from, overturns "an over-length video can be rejected
> outright", and turns up three deliverables this document lists as unverified.
> The original text is left as written. See **Sourced 15 August 2026** below,
> and read it before acting on sections 1, 2 or 3.

## Verified

| Fact | Value |
|---|---|
| Component | CA2, the assessed demonstration |
| Weight | 15 percent of COMP702 |
| Deadline | 21 August 2026, 17:00 Europe/London |
| Extension | No automatic seven-day extension applies to this component |
| Late submission | Scores zero |
| Q&A | The following week, live, on the submitted artefact |

The consequence of the third and fourth rows together is the only scheduling
rule that matters: there is no soft edge. A recording that exists at 17:05 on
21 August is worth the same as no recording. The capture plan in
`CAPTURE_MANIFEST.md` therefore has a fallback take for every block, and the
fallback takes are recorded first.

## Not verified, and blocking a final decision

### 1. Runtime: 10 minutes or 15

The public COMP702 material contradicts itself. One section states a 10 minute
demonstration; a table on the same material states 15. The 2026 Canvas brief is
the authority and this machine cannot open it.

What has been done about it: `SCRIPT.md` is written as a 9 minute 40 second
master that fits inside the 10 minute reading, with four named expansion blocks
marked `[EXPAND-1]` to `[EXPAND-4]`. If the student confirms 15 minutes, the
four blocks are dropped in and the runtime becomes roughly 14:30. If the student
confirms 10, nothing changes and nothing needs re-recording.

This is the safe direction: an over-length video can be rejected outright, an
under-length one is only a lost opportunity. The master is deliberately built
for the worse case.

**Student action: open the 2026 Canvas CA2 brief and write the confirmed
duration here before recording.**

### 2. Dissertation page limit

The page limit is asserted in this repository only in handoff files that the
author wrote. No brief text stating a limit has been read in this environment.
That is not evidence, and it is recorded as unverified rather than repeated as
fact.

The measured facts about the current PDF, which are evidence:

| Measure | Value |
|---|---|
| Total sheets in the PDF | 59 |
| Front matter, roman numbered | sheets 1 to 9 |
| First arabic page | sheet 10 |
| References | printed pages 47 to 48 |
| Appendix A | printed page 49 |
| Appendix B | printed page 50 |
| Body only, excluding references and appendices | 48 printed pages |
| All arabic-numbered pages | exactly 50 |
| Whole document | 59 sheets |

Three readings of "50 pages" are each defensible against those numbers, and the
document complies under two of them and fails under none, but only because the
strictest reading (59 sheets) has no support in any brief text that has been
read. If the brief counts every sheet including front matter, the document is
over by 9 and needs cutting.

**Student action: read the page-limit clause in the current brief, decide which
of the three counts it means, and record the decision here.**

### 3. Submission mechanics

Not verified from this machine: the accepted file format and size cap for the
video, whether the video is uploaded to Canvas directly or linked, whether a
separate slide deck or written summary is required alongside it, and whether the
Q&A slot is booked by the student or allocated.

None of these change the content of the recording, so they do not block capture.
All of them can invalidate a submission, so they block submission.

## Sourced 15 August 2026

Everything above this line stays as written. This section corrects it.

### The source, and what it is not

```
https://intranet.csc.liv.ac.uk/~ped/COMP702/Overview.html
HTTP 200, 71517 bytes, Last-Modified Wed, 23 Aug 2023 13:52:50 GMT
sha256 98033b96bb3eec9e5d03c96190ac63be12f2163f22a4ca27bf3e95a107a587d5
Page title: "MSc Project (COMP702), summer 2023"
```

**This is the 2023 module page. It is not the 2026 Canvas brief and it does not
replace it.** Its dates are 2023 throughout: the final deadline on it is
Sep-01 5:00pm, against the 21 August 2026 in the verified table above. Anything
below can be overruled by the current brief and none of it is settled.

What it is good for is narrower and still worth having. Until now the runtime
contradiction in section 1 was recorded in this repository with no source at
all. Neither this file nor `FINAL_CHECKLIST.md` said where "10 in one place and
15 in another" came from, so no reader could re-check it. Now they can.

Line numbers below are into the tag-stripped text of that page, reproducible
with the recipe at the end of this section.

### 1 corrected: the contradiction is three-way, and 10 is the majority

| Where | Text |
|---|---|
| L263, provisional timetable, week Aug-28 to Sep-01 | `Video demonstration and presentation (10 minutes) (must be uploaded)` |
| L451, the Final Presentation section's own task statement | `to produce a 10 minute oral presentation (video) and deal with questions raised by your two assessors` |
| L321, the assessment deliverables list | `A 15 minute oral presentation that includes a software demonstration` |
| L260, inside a malformed HTML comment, so not rendered | `15 minutes final presentation (usually in this week) --!>` |

So one document says 10 twice in running text and 15 once in the deliverables
list. The original entry said "one section states a 10 minute demonstration; a
table on the same material states 15", which had the right substance and the
wrong shape: 10 is in a table and in prose, 15 is in a bulleted list.

The 9:40 master with four expansion blocks was already the right call and it
does not change. Its justification does, below.

### 1 corrected: "rejected outright" is wrong

The document says an over-length video "can be rejected outright". Nothing on
the source page supports that. What it says (L379 to L381):

```
the marker(s) may decide to penalise the student with 5 marks out of 100 if the
presentation is in excess of the reserved time (excluding any time spent on
questions from the markers).

Penalties will not reduce the mark below the pass mark for the assessment. Work
assessed below the pass mark will not be further penalized for exceeding a
presentation time limit or the electronic submission in an incorrect format.
```

Discretionary, capped at 5 marks out of 100, floored at the pass mark, and
questions from markers are explicitly excluded from the clock. That is a real
penalty and a much smaller one than rejection.

Note what the same clause says outright rejection *does* apply to (L381):

```
The use of a compression format other than ZIP poses a serious risk that your
work may not be marked at all. If we cannot decompress it, then we cannot read
it!
```

The severe risk on this page is the container format, not the runtime. The
conclusion in section 1 survives, the reason given for it does not.

### 3 corrected: three of the "not verified" items have a 2023 answer

Section 3 lists "whether a separate slide deck or written summary is required
alongside it" as unverified. On the source page it is not optional. The Final
Presentation component (L317 to L323):

```
Final Presentation (15% of the mark)
A single zip file containing:
  A short report in pdf format (recommended approx 5 pages A4),
  A set of presentation slides in pdf format,
  A 15 minute oral presentation that includes a software demonstration
This is marked by the first and the second supervisor.
The Q&A meeting should be arranged with your first supervisor (normally) in the
week after submission.
```

Three things follow, and each is a 2023 statement that the student must check
against the 2026 brief rather than act on directly.

- **A PDF slide deck and a roughly 5 page PDF report are deliverables, not
  extras.** Neither exists in this repository. `SCRIPT.md`, `STORYBOARD.md` and
  `CAPTURE_MANIFEST.md` all assume the video is the artefact.
- **One ZIP, not three uploads**, submitted through the Coursework Submission
  System at `https://sam.csc.liv.ac.uk/COMP/Submissions.pl?strModule=COMP702`
  (L310), which is not Canvas.
- **The Q&A is arranged by the student with the first supervisor**, not
  allocated (L323, L265: `5-10 minute Q A live discussion and walkthrough with
  supervisors`). The verified table's "the following week" matches.

Written material has a typography rule too (L302, L303):

```
use a font size of at least 10pt and at most 12pt for the main body of the text
... The line spacing should be 1 or 1.5.
```

**Student action: confirm from the 2026 brief whether slides and a short report
are required. If they are, they are two deliverables that do not exist yet and
the 21 August deadline covers them as well as the video.**

### 2: a data point, and it does not settle anything

The page states the dissertation guideline twice (L326, L503):

```
A written dissertation document in pdf format (approx 15 to 25 pages A4 plus
references and appendices),

to produce and submit a dissertation for your project (approximately 15 to 25
pages A4 plus references and appendices).
```

Read this carefully before doing anything with it.

- The word is "approx" and "approximately", not "maximum". It is a guideline in
  the same list as the "recommended approx 5 pages A4" report.
- It is 2023 material.
- It conflicts with the "50 pages maximum" the author recorded in the handoff
  files, and it conflicts in the direction that matters: the current document is
  48 printed body pages excluding references and appendices, which is roughly
  double the top of that range.

That is a conflict worth resolving and it is not resolved here. The measured
table in section 2 is unchanged and still correct. What has changed is that the
"50" in the handoff files is no longer the only number in play, and the two
cannot both describe the same rule.

**Student action unchanged, and now more pointed: read the page-limit clause in
the current brief. If the 2026 rule is also "approximately 15 to 25 pages plus
references and appendices", the dissertation is long by a wide margin and that
is a content decision, not a formatting one.**

### Reproducing

```bash
curl -sSL https://intranet.csc.liv.ac.uk/~ped/COMP702/Overview.html -o ov.html
sha256sum ov.html
python3 -c "import re,html,sys; t=re.sub(r'<(script|style)[^>]*>.*?</\1>','',open('ov.html',encoding='utf-8',errors='replace').read(),flags=re.S|re.I); t=re.sub(r'<[^>]+>',' ',t); t=html.unescape(t); t=re.sub(r'[ \t\r\xa0]+',' ',t); print('\n'.join(l.strip() for l in t.split('\n') if l.strip()))" > ov.txt
grep -n "15 minute\|10 minutes\|marks out of 100\|15 to 25 pages" ov.txt
```

The page was reachable because this environment has network access through
`curl`. Four earlier documents in this repository asserted the opposite, and
the preamble of this one was the fifth. Search engines are gated here, which is
a different thing: `html.duckduckgo.com` and `lite.duckduckgo.com` answer HTTP
202 with an anti-bot page and `bing.com/search` returns results that only exist
after JavaScript runs. Direct URL fetches work. This page was found by probing
candidate URLs, not by searching.

## What this document is not

It is not permission to submit. Submission to Canvas, uploading the
dissertation, and any message to a supervisor are student actions and are
outside what has been done here.
