# KodroBench v0.1 leaderboard (5 tasks, 10 seeds)

Lower invention_rate is better (program stays within the build's command set); higher success@N is better. dev/heldout split the same task set by whether it was visible while iterating (see kodro.kodrobench.Task). Generated from results JSON.

| Model | success@N | invention_rate | dev succ | heldout succ | dev inv | heldout inv | collision | syntax_err | gen_err |
|---|---|---|---|---|---|---|---|---|---|
| gemma3:4b | 0.24 | 0.00 | 0.07 | 0.50 | 0.00 | 0.00 | 0.56 | 0.20 | 0 |
| deterministic | 0.22 | 0.00 | 0.03 | 0.50 | 0.00 | 0.00 | 1.24 | 0.00 | 0 |
| gemma3:1b | 0.02 | 0.00 | 0.03 | 0.00 | 0.00 | 0.00 | 0.18 | 0.20 | 0 |
| llama3.2:3b | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1.44 | 0.00 | 1 |
| kodro-fast:latest | 0.00 | 0.60 | 0.00 | 0.00 | 0.33 | 1.00 | 0.00 | 0.40 | 0 |
| kodro-coder:latest | 0.00 | 1.00 | 0.00 | 0.00 | 1.00 | 1.00 | 0.00 | 0.00 | 0 |
