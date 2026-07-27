# Worksheet block C: Control and sensing

Name: ______________________________  Class: __________________  Date: ______________

For every loop, complete the start, change and stop boxes before pressing Run.

## Lesson 05: Iteration with while-loops

### Task

Use small forward steps and `while not sample_detected():` to find and collect
three samples.

### Loop plan

The loop starts when:

______________________________________________________________________________

Each pass changes:

______________________________________________________________________________

The loop stops when:

______________________________________________________________________________

Plan the three search legs:

| Leg | Turn before searching | Step size | How the loop stops |
| ---: | ---: | ---: | --- |
| 1 | __________ | __________ m | ______________________________ |
| 2 | __________ | __________ m | ______________________________ |
| 3 | __________ | __________ m | ______________________________ |

### Vocabulary

`iteration`  `while`  `condition`  `step size`  `sample_detected`

<div style="page-break-after: always;"></div>

## Lesson 06: Functions

### Task

Define `hop()` once. Make it move, collect and turn. Call it four times so the
rover collects all four samples.

### Decompose the pattern

```python
def hop():
    __________________________________________
    __________________________________________
    __________________________________________

____________________________________________________
____________________________________________________
____________________________________________________
____________________________________________________
```

What changes if `collect_sample()` is outside the function?

______________________________________________________________________________

What stays the same on every call?

______________________________________________________________________________

### Vocabulary

`function`  `definition`  `call`  `decomposition`  `reuse`

<div style="page-break-after: always;"></div>

## Lesson 07: Reading sensors

### Task

Use `read_distance()` in a `while` condition. Stop 1 metre before the wall and
collect the sample.

### Sensor trace

| Sensor reading | Is it greater than 1.0? | Does the loop move? |
| ---: | --- | --- |
| 4.0 m | __________ | __________ |
| 1.5 m | __________ | __________ |
| 1.0 m | __________ | __________ |
| 0.5 m | __________ | __________ |

Why are small movement steps safer here?

______________________________________________________________________________

______________________________________________________________________________

### Vocabulary

`sensor`  `read_distance`  `metre`  `comparison`  `threshold`

<div style="page-break-after: always;"></div>

## Lesson 08: Pathfinding basics

### Task

Reuse `dodge()` on the outward and return journeys. Collect the sample, turn
around and come home without a collision.

### Decomposition plan

| Part | Goal | Reused code |
| --- | --- | --- |
| `dodge()` | __________________________________ | __________________ |
| outward loop | ______________________________ | __________________ |
| collect and turn | __________________________ | __________________ |
| return loop | _______________________________ | __________________ |

Sketch the control flow:

```text
START
  |
  v
______________________________________________
  |
  v
______________________________________________
  |
  v
______________________________________________
  |
  v
HOME
```

Why is one `dodge()` function enough for both directions?

______________________________________________________________________________

______________________________________________________________________________

### Vocabulary

`pathfinding`  `decomposition`  `selection`  `iteration`  `at_base`

## Block reflection

The clearest loop stopping condition I wrote was:

______________________________________________________________________________

The function that saved repeated code was:

______________________________________________________________________________

My program reacted to the world by:

______________________________________________________________________________

