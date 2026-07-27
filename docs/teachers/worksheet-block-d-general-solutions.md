# Worksheet block D: General solutions

Name: ______________________________  Class: __________________  Date: ______________

These are KS4 stretch lessons. Use this sheet to compare algorithms, trace
state and explain how a solution has been generalised.

## Lesson 09: Recursion

### Task and trace

The function calls itself with `step - 0.5`. Complete the trace.

| Call | `step` | Is `step < 0.5`? | Action |
| ---: | ---: | --- | --- |
| 1 | 3.0 | __________ | ______________________________ |
| 2 | 2.5 | __________ | ______________________________ |
| 3 | 2.0 | __________ | ______________________________ |
| 4 | 1.5 | __________ | ______________________________ |
| 5 | 1.0 | __________ | ______________________________ |
| 6 | 0.5 | __________ | ______________________________ |
| 7 | 0.0 | __________ | ______________________________ |

The base case is:

______________________________________________________________________________

Vocabulary: `recursion`  `base case`  `parameter`  `return`  `call stack`

<div style="page-break-after: always;"></div>

## Lesson 10: Optimisation

### Task

Compare at least two sample orderings. Choose a route that collects all three
samples, returns to base and stays inside the lesson limits.

| Ordering | Estimated distance | Run result | Keep or reject |
| --- | ---: | --- | --- |
| __________________ | __________ m | __________________ | __________ |
| __________________ | __________ m | __________________ | __________ |
| __________________ | __________ m | __________________ | __________ |

Why is your chosen route better?

______________________________________________________________________________

Vocabulary: `optimisation`  `algorithm`  `efficiency`  `constraint`  `comparison`

<div style="page-break-after: always;"></div>

## Lesson 11: Decomposition

### Task

Use one helper for each route leg, then call both helpers in order.

| Helper | One job it performs | How you test it |
| --- | --- | --- |
| `leg_one()` | __________________________ | __________________________ |
| `leg_two()` | __________________________ | __________________________ |

Call order:

```python
____________________________________________________
____________________________________________________
```

Vocabulary: `decomposition`  `sub-problem`  `helper`  `function`  `call`

<div style="page-break-after: always;"></div>

## Lesson 12: Abstraction

### Task

Use `obstacle_ahead(1.5)` so the program asks the world before choosing whether
to move or turn.

```text
Sensor says TRUE
Action: ______________________________________________________________________

Sensor says FALSE
Action: ______________________________________________________________________
```

What detail does the sensor hide from the program?

______________________________________________________________________________

Vocabulary: `abstraction`  `interface`  `sensor`  `selection`  `complexity`

<div style="page-break-after: always;"></div>

## Lesson 13: Nested loops

### Task and trace

Use an outer loop for rows and an inner loop for columns.

| Outer pass | Inner passes | Samples collected so far | Reposition action |
| ---: | ---: | ---: | --- |
| 1 | __________ | __________ | ______________________________ |
| 2 | __________ | __________ | ______________________________ |

Why does the inner loop finish before the outer loop continues?

______________________________________________________________________________

Vocabulary: `nested loop`  `outer loop`  `inner loop`  `row`  `column`

<div style="page-break-after: always;"></div>

## Lesson 14: Counting with a variable

### Task and trace

Update `count` once per collected sample.

| Loop pass | `count` before | Sample collected? | `count` after |
| ---: | ---: | --- | ---: |
| 1 | 0 | __________ | __________ |
| 2 | __________ | __________ | __________ |
| 3 | __________ | __________ | __________ |

What happens if `count = count + 1` is outside the loop?

______________________________________________________________________________

Vocabulary: `variable`  `assignment`  `accumulator`  `condition`  `iteration`

<div style="page-break-after: always;"></div>

## Lesson 15: Functions with parameters

### Task

Change `hop()` so distance is an input. Call it with the three gaps between
samples.

```python
def hop(____________________):
    move_forward(____________________)
    collect_sample()

hop(__________)
hop(__________)
hop(__________)
```

| Term | Example from your program |
| --- | --- |
| parameter | ______________________________ |
| argument | ______________________________ |
| function call | ______________________________ |

Vocabulary: `parameter`  `argument`  `generalise`  `function`  `reuse`

## Block reflection

The solution I generalised most effectively was:

______________________________________________________________________________

The strongest comparison evidence I used was:

______________________________________________________________________________

The concept I still need to practise is:

______________________________________________________________________________

