# Kodro human evaluation package

## Material Passport

- Origin Skill: experiment-agent
- Origin Mode: plan
- Origin Date: 2026-07-18
- Verification Status: UNVERIFIED
- Version Label: kodro_study_pack_v1

This folder contains a complete draft protocol for evaluating whether Kodro's
deterministic evidence helps people diagnose and correct robot-controller faults
more effectively than console output alone.

## Current status

`ETHICS_PENDING`

No participant has been recruited, consented, observed or measured. The files
are study materials, not study results. Recruitment and data collection must not
start until the student, supervisor and the University of Liverpool ethics
process have approved the final documents.

The University states that projects involving human participants or personal
data require ethics approval before data collection. Applications are made in
its online ethics system, with a supervisor sign-off route for students:

- [University research ethics](https://www.liverpool.ac.uk/research/research-environment/ethics/)
- [Ethics online system](https://www.liverpool.ac.uk/research/research-environment/ethics/applying-for-ethics-approval/ethics-online-system/)
- [Policies, guidance and participant templates](https://www.liverpool.ac.uk/research/research-environment/ethics/policies-and-guidance/)
- [Research data ethical and legal guidance](https://www.liverpool.ac.uk/library/research-data-management/essentials/ethical-and-legal/)
- [University research privacy notice](https://www.liverpool.ac.uk/legal/data_protection/privacy-notices/research-privacy-notice/)

## Package contents

- `study_protocol.md`: research design, variables, sampling and analysis
- `ethics_draft.md`: low-risk ethics application draft and checklist status
- `participant_information_sheet.md`: plain-language participant information
- `consent_form.md`: consent record
- `task_script.md`: standard facilitator script and three missions
- `measures_and_analysis.md`: outcome definitions and pre-specified analysis
- `data_collection_template.csv`: one row per participant and mission
- `participant_log_template.csv`: separate consent and study-status log
- `analyse_study.py`: standard-library analysis that refuses an empty template

## Required human actions

1. Replace every square-bracket placeholder with approved project details.
2. Confirm the departmental ethics route and retention period with the supervisor.
3. Use the latest University participant information and consent templates when
   submitting, copying approved wording into these drafts where required.
4. Submit through the University ethics system and obtain approval before contact
   with prospective participants.
5. Recruit 10 to 15 adults, collect consent, run the sessions and enter only the
   pre-specified data.
6. Run `python docs/study/analyse_study.py data.csv --out-dir results` only after
   the dataset is complete and locked.

Synthetic personas, local language models and automated judge panels may continue
to find software defects. They are not participants and cannot fill this evidence
gap.
