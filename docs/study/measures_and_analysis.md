# Measures and pre-specified analysis

## Dataset unit

One row represents one participant completing one mission. A complete session has
three rows. The analysis dataset contains no direct identifier.

## Outcome definitions

- `success`: 1 only when the mission's frozen acceptance check passes before the
  ten-minute limit; otherwise 0.
- `duration_s`: seconds from prompt completion to success or timeout. A timeout is
  recorded as 600 with `success=0`.
- `wrong_edits`: submitted program revisions before the successful revision or
  timeout. Formatting-only changes count if submitted.
- `collisions`: collision metric in the final submitted live run or proof. Record
  the source consistently for the frozen protocol.
- `proof_runs`: number of five-seed proof executions. It must be 0 in condition C.
- `confidence_1_5`: participant response after the mission.
- `ease_1_7`: participant response after the mission.
- `protocol_deviation`: 1 when the facilitator or product departs from the script.

## Exclusions and missingness

1. Do not delete a failed mission.
2. Exclude a row from the primary comparison only for a documented technical failure
   that prevents the assigned condition being delivered.
3. Retain excluded rows in the CSV with an exclusion reason.
4. Do not impute success, time, edit, confidence or ease values.
5. Report participant counts, trial counts, exclusions and missing values separately.

## Primary analysis

For each condition, report mission successes over attempted missions and the success
proportion. Then calculate each participant's success proportion in E minus their
success proportion in C. Report the mean paired difference, median paired difference,
range and a deterministic 95 percent bootstrap interval. An exact two-sided sign-flip
permutation value may be reported as exploratory only.

## Secondary analysis

Use the same participant-level paired summaries for duration, wrong edits, collision
burden and ratings. Duration summaries include successful trials only, while failure
and timeout counts remain alongside them. Report condition medians because time and
count outcomes may be skewed.

Mission-level tables are mandatory so condition effects are not confused with one
easier mission. Programming experience is descriptive only at this sample size.

## Interpretation rules

- Do not convert this pilot into a claim of classroom efficacy or learning gain.
- Do not claim real-world robot validity or safety.
- Do not describe a non-significant value as proof of no effect.
- Do not describe a small p value without the effect estimate and uncertainty.
- Do not replace human results with synthetic persona output.
- Mark all post-hoc analyses clearly and keep them outside the primary result.

## Reproducible analysis command

Validate the empty template:

```text
python docs/study/analyse_study.py docs/study/data_collection_template.csv --check-template
```

Analyse a locked copy after collection:

```text
python docs/study/analyse_study.py path/to/locked_data.csv --out-dir path/to/results
```

The script refuses to create numerical findings from an empty template.
