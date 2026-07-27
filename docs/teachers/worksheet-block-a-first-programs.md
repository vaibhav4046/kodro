# Worksheet block A: First programs

Name: ______________________________  Class: __________________  Date: ______________

Predict before you press Run. Change one thing at a time. Use the result on
screen to decide what to try next.

## 1. Drive to the Flag

### Task

The rover starts with:

```python
move_forward(1)
```

The flag is 3 metres straight ahead. Change the number or add another line so
the rover reaches it.

### Plan on paper

How far will each line move?

| Line | Instruction | Distance after this line |
| ---: | --- | ---: |
| 1 | ____________________________________ | __________ m |
| 2 | ____________________________________ | __________ m |
| 3 | ____________________________________ | __________ m |

My prediction:

______________________________________________________________________________

______________________________________________________________________________

### After the run

- [ ] The rover travelled at least 3 metres.
- [ ] The rover did not collide.
- [ ] I can point to the first instruction and the last instruction.

One change I made and what it did:

______________________________________________________________________________

______________________________________________________________________________

### Vocabulary

| Word | Meaning |
| --- | --- |
| forward | Go straight ahead, the way the rover is facing. |
| program | A list of steps for the rover to do, one after another. |
| sequence | Instructions carried out in order, from top to bottom. |

<div style="page-break-after: always;"></div>

## 2. Make a Square

### Task

One side of the route is:

```python
move_forward(2)
turn_right(90)
```

Put these two instructions inside a loop so the rover repeats them four times
and draws a square.

### Plan on paper

Draw the route. Put an arrow on each side to show the rover's direction.

```text








```

Complete the trace:

| Loop pass | Distance moved | Turn | New direction |
| ---: | ---: | ---: | --- |
| 1 | ______ m | ______ degrees | __________________ |
| 2 | ______ m | ______ degrees | __________________ |
| 3 | ______ m | ______ degrees | __________________ |
| 4 | ______ m | ______ degrees | __________________ |

Write the loop header:

```python
____________________________________________________
    move_forward(2)
    turn_right(90)
```

### After the run

- [ ] The repeated lines are indented.
- [ ] The rover made four sides.
- [ ] The rover did not collide.
- [ ] I can explain why a loop is useful here.

### Vocabulary

| Word | Meaning |
| --- | --- |
| loop | A way to repeat the same steps again and again, without writing them out each time. |
| repeat | Do something more than once. |
| turn | Spin the rover to face a new direction, measured in degrees. |
| indent | Move code to the right to show that it belongs inside a loop or decision. |

<div style="page-break-after: always;"></div>

## 3. Look Before You Move

### Task

The starter drives straight into a rock:

```python
move_forward(3)
```

Ask `obstacle_ahead()` first. If the answer is true, turn left before the rover
moves.

### Plan on paper

Complete the decision:

```text
Is there an obstacle ahead?

YES: _________________________________________________________________________

NO:  _________________________________________________________________________

Then: ________________________________________________________________________
```

Write the program shape. Use words or Python:

```python
if __________________________________________:
    __________________________________________
______________________________________________
```

Why must the final move stay outside the `if`?

______________________________________________________________________________

______________________________________________________________________________

### After the run

- [ ] The rover asked the sensor before moving.
- [ ] The turn is indented inside the `if`.
- [ ] The final move happens after the decision.
- [ ] The rover travelled at least 2.5 metres without a collision.

### Vocabulary

| Word | Meaning |
| --- | --- |
| sensor | A part that lets the rover measure the world around it, like its eyes. |
| if | Do something only when a question is true. |
| obstacle | A rock or wall in the way that the rover must not hit. |
| Boolean | A value that can only be true or false. |

## Block reflection

Circle one:

I can trace a sequence:  not yet / with help / by myself

I can use a loop:  not yet / with help / by myself

I can use a sensor decision:  not yet / with help / by myself

The most useful debugging step was:

______________________________________________________________________________

