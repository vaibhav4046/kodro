# Kodro scheme of work

This scheme uses the 24 lessons that ship with Kodro. It does not add or rename
lessons. Each title below matches a YAML file in
`src/kodro/lessons/library/`.

Cross-checked against `load_library()` on 18 August 2026: 24 lessons on disk, 24
titles listed here, and the four blocks below total 7 + 5 + 4 + 8 = 24. The block
key stages match the library's own tags, which are 3 KS1, 4 KS2, 9 KS3 and 8 KS4
(Block A is the 3 KS1 plus the 4 KS2, Blocks B and C split the 9 KS3, Block D is
the 8 KS4).

Times are planning allowances for one pupil on one device. Add 10 minutes the
first time a class opens the app, or when devices must be shared. A pair can use
one device if the driver and navigator roles swap halfway through.

Kodro scores are practice feedback. They show whether the run met the stated
goals. They are not assessment evidence and do not establish what a pupil
understands.

## At a glance

| Block | Intended use | Shipped lessons | Suggested timetable |
| --- | --- | ---: | --- |
| A. First programs | KS1 and KS2 foundations | 7 | 7 sessions of 30 to 45 minutes |
| B. Routes and decisions | KS3 foundation | 5 | 5 sessions of 45 to 55 minutes |
| C. Control and sensing | KS3 core | 4 | 4 sessions of 50 to 60 minutes |
| D. From patterns to general solutions | KS3 extension and KS4 bridge | 8 | 8 sessions of 50 to 60 minutes |

Block D contains the eight lessons labelled `KS4 stretch` in the source. They
are listed here so all 24 shipped lessons have a place, but they should not be
presented as core KS3 content. In a six-week half-term, choose the lessons that
match the class curriculum and keep the others for extension.

## Block A: First programs

Recommended for KS1 and KS2. The three KS1 lessons begin by watching and
changing one instruction before introducing a turn. The four KS2 lessons then
add repetition, sensor-led selection, debugging and variables.

### Block outcomes

Pupils will:

- explain that a program is an ordered list of instructions;
- predict what a short route will do before running it;
- use repetition to draw a square;
- use a sensor question and selection to avoid an obstacle;
- identify and correct a number, order or indentation error.

| Lesson | Objective | Prior knowledge | Allow |
| --- | --- | --- | ---: |
| `000_watch_it_go`, Watch It, Then Change It | Run one instruction, predict the result, then change one number so the rover travels 2 metres. | None. Read one short instruction with an adult if needed. | 30 minutes |
| `00_first_drive`, Drive to the Flag | Change or repeat `move_forward` so the rover travels 3 metres to the flag. Explain that instructions run from top to bottom. | None. Pupils should be able to read a one-line instruction and change a number. | 35 minutes |
| `00a_turn_the_corner`, Turn the Corner | Arrange drive, quarter-turn and drive instructions in the required order. | Complete Drive to the Flag. Recognise a quarter turn as 90 degrees. | 35 minutes |
| `00b_repeat_square`, Make a Square | Use a `for` loop to repeat a move and a 90 degree turn four times. Explain why repetition is better than four copied blocks. | Complete Drive to the Flag. Know that a square has four equal sides and four right angles. | 45 minutes |
| `00c_look_first`, Look Before You Move | Ask `obstacle_ahead()` before moving and use `if` to turn only when the answer is true. | Complete Make a Square. Recognise a sensor as an input and keep indented code inside an `if`. | 45 minutes |
| `00d_fix_the_turn`, Fix the Broken Program | Observe a collision, locate the wrong turn and correct one command. | Complete Turn the Corner. Understand that debugging means finding and correcting an error. | 35 minutes |
| `16_variables`, One name, used twice | Change one stored distance and explain why both movements change when the variable is used twice. | Complete Sequence. Recognise assignment as giving a value a name. | 45 minutes |

### Suggested teaching sequence

1. Ask pupils to point at the line that will happen first.
2. Predict on paper. Run only after every pair has made a prediction.
3. Change one thing at a time and describe the visible result.
4. Use the lesson goal checklist before looking at the score.
5. Finish with one pupil explaining the program without reading each line
   aloud.

Worksheet: [First programs](worksheet-block-a-first-programs.md)

## Block B: Routes and decisions

Recommended as the first KS3 half-term block. It establishes the command
language, route planning and Boolean selection before loops are introduced.

### Block outcomes

Pupils will:

- write and trace a sequence of function calls;
- use turns and coordinates to plan a route;
- collect a sample at the end of a route;
- use an `if` condition to react to a sensor;
- test a program against visible success criteria.

| Lesson | Objective | Prior knowledge | Allow |
| --- | --- | --- | ---: |
| `01_hello_rover`, Hello, Rover! | Build the exact sequence `move_forward`, `beep`, `log` and make the rover travel at least 1.5 metres. | No Kodro experience required. Pupils should recognise a function call and a string in quotation marks. | 45 minutes |
| `02_move_turn`, Move and turn | Combine movement, a left turn and sample collection to reach the patch at `(4, 4)`. | Complete Hello, Rover! Know that a turn changes heading rather than position. | 50 minutes |
| `03_sequence`, Sequence | Plan and debug a U-shaped route, then collect the sample at the far end. | Complete Move and turn. Trace a program line by line and sketch a route on a grid. | 50 minutes |
| `04_selection`, Selection (if / else) | Use the existing sensor decision and add the action that completes the mission. Explain what `obstacle_ahead(2.0)` asks. | Complete Sequence. Know that a Boolean question is either true or false. | 55 minutes |
| `04a_fix_the_condition`, Fix the Backwards Test | Run a faulty Boolean condition, explain why it is backwards and remove the negation so the rover avoids the obstacle. | Complete Selection. Read `not` as reversing a Boolean value. | 45 minutes |

### Suggested teaching sequence

Use one grid square to represent 1 metre. Make pupils annotate heading after
each turn. In Selection, ask them to say which indented lines run when the
condition is true and which lines are skipped when it is false.

Worksheet: [Routes and decisions](worksheet-block-b-routes-decisions.md)

## Block C: Control and sensing

Recommended as the second KS3 half-term block. These lessons combine the three
main control structures and move from fixed routes to programs that respond to
the world.

### Block outcomes

Pupils will:

- use a loop condition that makes progress and eventually stops;
- define and call a reusable function;
- interpret a distance sensor value in metres;
- combine iteration, selection and decomposition in one route;
- explain why a sensor-led solution is less brittle than a fixed list of moves.

| Lesson | Objective | Prior knowledge | Allow |
| --- | --- | --- | ---: |
| `05_iteration`, Iteration with while-loops | Use `while` and small forward steps to find and collect three samples. | Complete Selection. Understand that a loop needs a condition and that its body must change the situation. | 60 minutes |
| `06_functions`, Functions | Put move, collect and turn into `hop()`, then call the function four times. | Complete Iteration. Identify a repeated pattern and follow indentation inside `def`. | 50 minutes |
| `07_sensors`, Reading sensors | Read distance in a `while` condition, stop before the wall and collect the sample. | Complete Iteration. Compare numbers and interpret `>` as greater than. | 50 minutes |
| `08_pathfinding`, Pathfinding basics | Reuse `dodge()` inside an outward and return loop so the rover collects the sample and comes home without a collision. | Complete Functions and Selection. Use `while`, `if`, `else` and a function call independently. | 60 minutes |

### Suggested teaching sequence

For each loop, pupils should complete three sentences before running:

1. It starts when...
2. Each pass changes...
3. It stops when...

For Pathfinding, colour the function definition, the outward loop and the
return loop as three separate sub-problems.

Worksheet: [Control and sensing](worksheet-block-c-control-sensing.md)

## Block D: From patterns to general solutions

Use this as KS3 extension or a bridge into KS4. Every lesson in this block is
tagged `KS4 stretch` in the source.

### Block outcomes

Pupils will:

- identify a recursive base case;
- compare route costs and choose a shorter ordering;
- decompose a route into named subroutines;
- treat a sensor as an abstract interface;
- use nested iteration and an accumulator;
- generalise a function with a parameter.
- store route data in a list and traverse it with a loop.

| Lesson | Objective | Prior knowledge | Allow |
| --- | --- | --- | ---: |
| `09_recursion`, Recursion (KS4 stretch) | Trace a function that calls itself with a smaller value and explain how the base case stops it. | Complete Functions. Follow a function parameter, subtraction and `return`. | 55 minutes |
| `10_optimisation`, Optimisation (KS4 stretch) | Compare sample orderings, keep a route within the stated step and battery limits, and return to base. | Complete Pathfinding. Add route distances and compare two algorithms for the same task. | 60 minutes |
| `11_decomposition`, Decomposition (KS4 stretch) | Split a patrol into named legs and call both helpers in the correct order. | Complete Functions. Explain why a meaningful function name helps testing and reading. | 50 minutes |
| `12_abstraction`, Abstraction (KS4 stretch) | Replace blind movement with a sensor decision so the program responds to the environment. | Complete Reading sensors. Use `while`, `if`, `else` and a Boolean sensor call. | 55 minutes |
| `13_nested_loops`, Nested loops (KS4 stretch) | Put a row sweep inside an outer loop so the rover covers two rows and collects six samples. | Complete Iteration. Trace one complete inner loop before moving to the next outer pass. | 60 minutes |
| `14_counting`, Counting with a variable (KS4 stretch) | Use an accumulator in a `while` loop and stop when the count reaches three. | Complete Iteration. Assign a value, update it and compare it with a target. | 50 minutes |
| `15_parameters`, Functions with parameters (KS4 stretch) | Add a `distance` parameter to `hop()` and call one function with three different values. | Complete Functions. Distinguish a parameter in a definition from an argument in a call. | 50 minutes |
| `17_lists`, A list drives the route | Correct a list of three distances while leaving the loop unchanged, showing how data can describe a route. | Complete Iteration and One name, used twice. Read a list and trace a `for` loop over its values. | 50 minutes |

### Suggested teaching sequence

This block does not need to be taught in numeric order. A practical order is:

1. Decomposition
2. Functions with parameters
3. Abstraction
4. Counting with a variable
5. Nested loops
6. Recursion
7. A list drives the route
8. Optimisation

That order moves from familiar functions to more demanding tracing and
evaluation. Optimisation works well as the final open comparison.

Worksheet: [General solutions](worksheet-block-d-general-solutions.md)

## Evidence to collect

Use lightweight classroom evidence alongside the in-app result:

- the pupil's route sketch or trace table;
- one prediction written before Run;
- one changed line with a sentence explaining its effect;
- a short verbal explanation of the stopping condition or function;
- the final program file if the school needs a record.

Do not treat the numeric Kodro score as a predicted grade. The simulation is
kinematic and has not been validated against a physical robot.

## Related material

- [First lesson card](first-lesson-card.md)
- [Answer key](answer-key.md)
- [Getting started](getting-started.md)
- [Curriculum mapping](curriculum-mapping.md)
- [Pupil API cheatsheet](../pupils/api-cheatsheet.md)
