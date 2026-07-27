# Worksheet block B: Routes and decisions

Name: ______________________________  Class: __________________  Date: ______________

Use one grid square for 1 metre. Label the rover's heading after every turn.
Write a prediction before each run.

## Lesson 01: Hello, Rover!

### Task

Keep these three calls in order:

1. `move_forward`
2. `beep`
3. `log`

Change the movement so the rover travels at least 1.5 metres.

### Plan

```python
____________________________________________________
____________________________________________________
____________________________________________________
```

Why does the order matter?

______________________________________________________________________________

______________________________________________________________________________

### Vocabulary

`sequence`  `function call`  `argument`  `string`  `console`

<div style="page-break-after: always;"></div>

## Lesson 02: Move and turn

### Task

Start at `(1, 1)`. Reach the sample at `(4, 4)` and collect it.

### Route plan

```text
 y
 6 | .  .  .  .  .  .
 5 | .  .  .  .  .  .
 4 | .  .  .  S  .  .
 3 | .  .  .  .  .  .
 2 | .  .  .  .  .  .
 1 | R  .  .  .  .  .
   +-------------------
     1  2  3  4  5  6   x
```

| Step | Instruction | Position | Heading |
| ---: | --- | --- | --- |
| 1 | __________________________ | __________ | __________ |
| 2 | __________________________ | __________ | __________ |
| 3 | __________________________ | __________ | __________ |
| 4 | __________________________ | __________ | __________ |

Which instruction actually picks up the sample?

______________________________________________________________________________

### Vocabulary

`heading`  `coordinate`  `turn`  `sample`  `collect`

<div style="page-break-after: always;"></div>

## Lesson 03: Sequence

### Task

Drive a U-shaped route and collect the sample at the far end. The last movement
in the starter is too short.

### Trace the starter

| Line | What happens | Position after the line | Heading |
| ---: | --- | --- | --- |
| 1 | __________________________ | __________ | __________ |
| 2 | __________________________ | __________ | __________ |
| 3 | __________________________ | __________ | __________ |
| 4 | __________________________ | __________ | __________ |
| 5 | __________________________ | __________ | __________ |
| 6 | __________________________ | __________ | __________ |

The line I will change: __________

Old value: __________  New value: __________

My reason:

______________________________________________________________________________

### Vocabulary

`sequence`  `trace`  `debug`  `distance`  `position`

<div style="page-break-after: always;"></div>

## Lesson 04: Selection (if / else)

### Task

The starter already detects the rock and drives around it. It finishes on the
sample patch but does not pick the sample up. Add the missing action.

### Decision plan

Complete the sentence:

`obstacle_ahead(2.0)` is true when ___________________________________________

______________________________________________________________________________

Shade or underline the instructions that belong inside the `if`:

```python
if obstacle_ahead(2.0):
    turn_left(90)
    move_forward(1)
    turn_right(90)
    move_forward(4)
    turn_right(90)
    move_forward(1)
```

The final action I need is:

```python
____________________________________________________
```

### Vocabulary

`selection`  `condition`  `Boolean`  `if`  `sensor`

## Block reflection

One route I could predict before running:

______________________________________________________________________________

One bug I found by tracing:

______________________________________________________________________________

One sentence that explains selection:

______________________________________________________________________________

