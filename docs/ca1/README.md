# COMP702 CA1: Specification and Design Proposal

This folder holds the Continuous Assessment 1 submission for the COMP702 MSc
research project.

- **`RoboLearn_CA1_Vaibhav_Lalwani.pdf`** is the submission document (PDF, the
  format required by Canvas).
- **`report.html`** is the source the PDF is rendered from.
- **`img/`** holds the figures, which are screenshots of the running
  application captured during live use.

## Contents of the proposal

Title page with the statement of ethical compliance, project description, aims
and requirements, key literature and background reading, development and
implementation summary, data sources, testing and evaluation, project ethics
and human participants, the BCS project criteria, a user interface section, a
project plan, a risks and contingency table, a project status and direction
note, and references in Harvard style.

## Rebuilding the PDF

The PDF is produced from `report.html` with a headless browser print:

```
msedge --headless=new --no-pdf-header-footer \
  --print-to-pdf="RoboLearn_CA1_Vaibhav_Lalwani.pdf" report.html
```

All references in the document were checked against their original sources, and
all technical claims describe the system in this repository.
