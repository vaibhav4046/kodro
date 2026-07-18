# Low-risk ethics application draft

## Status

`ETHICS_PENDING`

This document supports an application. It is not an ethics approval, exemption or
institutional decision. The University of Liverpool states that research involving
human participants or personal data should receive approval before it begins.

## Project details

- Student researcher: [name and student ID]
- Programme: [MSc programme]
- School or department: [school]
- Supervisor: [name and University email]
- Proposed study dates: [start] to [end]
- Location: [approved room or approved remote arrangement]
- Funding or incentives: None proposed

## Project summary

The study investigates whether structured deterministic evidence helps adults
diagnose faults in a simulated robot controller compared with console output alone.
Participants complete three short programming tasks in Kodro. The two conditions
use the same simulator, program and mission. Only the diagnostic information shown
to the participant differs. The study records mission success, completion time,
incorrect edits, collisions, confidence, task ease and optional comments.

No physical robot is used. The Companion and all generative AI features are disabled
during sessions. No webcam, microphone, keystroke logger or screen recording is used.

## Participants and recruitment

Recruit 10 to 15 adults aged 18 or older using an approved convenience sample.
Recruitment wording will state that participation is voluntary, has no effect on
grades or employment, and can be declined without giving a reason. The researcher
will not recruit people whose grades, employment or supervision they control.

Minors, people unable to consent and members of the Kodro development team are
excluded. No deception is used.

## Procedure

1. Provide the approved participant information sheet in advance where practicable.
2. Confirm eligibility and written or approved digital consent.
3. Assign a pseudonymous code and the next counterbalanced sequence.
4. Run a neutral practice task that is not analysed.
5. Run three ten-minute missions according to the task script.
6. Collect the two rating items and optional comments.
7. Explain the study comparison and remind the participant of the withdrawal route.

The expected session duration is 45 to 55 minutes.

## Risks and mitigation

| Risk | Likelihood and severity | Mitigation |
|---|---|---|
| Frustration from a failed task | Possible, minor | Tasks are time-limited; participants may pause or stop; the facilitator avoids evaluative language. |
| Screen or posture fatigue | Possible, minor | Short tasks, seated setup, optional breaks and immediate withdrawal. |
| Feeling judged on programming skill | Possible, minor | Materials state that the interface is being evaluated, not the participant. Experience is not scored as ability. |
| Confidentiality breach | Unlikely, potentially moderate | Pseudonymous outcome data, separate consent log, encrypted University storage and restricted access. |
| Power differential | Avoidable | Exclude anyone whose grades, job or supervision are controlled by the researcher. |

No physical, clinical, financial or sensitive-topic procedure is involved. If a
participant becomes uncomfortable, the session stops and their data is handled
according to their withdrawal choice.

## Data protection and management

The outcome CSV contains only a study code, condition sequence, mission outcomes,
ratings and coded notes. It contains no name, email or student number. The consent
and status log is stored separately. Free-text comments are reviewed promptly to
remove accidentally disclosed identifiers.

Files are stored only on encrypted University-managed storage. Access is limited to
the student researcher and supervisor. No raw participant data is uploaded to an
AI, cloud model, public repository or product telemetry service. Kodro itself runs
locally and does not require an account.

The proposed retention period is 12 months after degree award, followed by secure
deletion. This period must be confirmed against departmental and University policy
before ethics submission. The participant may request withdrawal until seven days
after their session or the stated dataset-lock date, whichever comes first. After
de-identification and dataset lock, removal may no longer be practicable. The final
approved wording controls.

The University research privacy notice describes research processing as a task in
the public interest. Ethical consent to participate remains separate and voluntary.

## Dissemination

Aggregated results may appear in the MSc dissertation, viva materials and a project
repository. No participant will be named. Small-cell quotations will be paraphrased
or withheld if they could identify a person. The anonymised row-level dataset will
not be made public by default.

## Ethics checklist status

| Checklist area | Draft status | Remaining action |
|---|---|---|
| Informed consent | NEEDS_ACTION | Replace placeholders and use the latest approved University templates. |
| Privacy and data protection | NEEDS_ACTION | Confirm storage path, retention period and withdrawal date with supervisor. |
| Risk assessment | PASS DRAFT | Supervisor and committee review required. |
| Vulnerable populations | PASS DRAFT | Adults only; power-differential exclusion specified. |
| Institutional requirements | NEEDS_ACTION | Submit through the ethics online system and obtain approval. |
| Data management plan | NEEDS_ACTION | Confirm final instruments, storage and data-lock procedure. |

Under the experiment-agent checklist, unresolved consent, privacy and institutional
items keep the study at `ETHICS_PENDING`. Recruitment and collection must not begin.

## Official guidance consulted

- [University research ethics](https://www.liverpool.ac.uk/research/research-environment/ethics/)
- [Ethics online application system](https://www.liverpool.ac.uk/research/research-environment/ethics/applying-for-ethics-approval/ethics-online-system/)
- [Policies and participant-document guidance](https://www.liverpool.ac.uk/research/research-environment/ethics/policies-and-guidance/)
- [Ethical and legal research data management](https://www.liverpool.ac.uk/library/research-data-management/essentials/ethical-and-legal/)
- [Research privacy notice](https://www.liverpool.ac.uk/legal/data_protection/privacy-notices/research-privacy-notice/)
