# Curriculum mapping

Kodro ships 24 lessons: 3 at KS1, 4 at KS2, 9 at KS3 and 8 at KS4.
Each mapping below is taken from the lesson YAML rather than inferred from its
title. The principal sources are the Department for Education Computing
programmes of study (DfE-00171-2013 and DfE-00191-2013), the Computer Science
GCSE subject content (DfE-00094-2015), and the BCS Computational Thinking guide
(Csizmadia et al., 2015).

The mapping shows curriculum relevance, not a claim that one short Kodro lesson
fully teaches or assesses an entire statutory requirement. Kodro scores are
formative practice feedback and are not predicted grades.

| Lesson | Key stage | Terrain | Main concepts | Curriculum connection |
| --- | --- | --- | --- | --- |
| `000_watch_it_go`, Watch It, Then Change It | KS1 | Earth | sequence | Algorithms become programs that follow precise instructions. |
| `00_first_drive`, Drive to the Flag | KS1 | Earth | sequence | Create and debug a simple program; predict its behaviour. |
| `00a_turn_the_corner`, Turn the Corner | KS1 | Earth | sequence | Create and debug a simple program; reason about its route. |
| `00b_repeat_square`, Make a Square | KS2 | Earth | iteration | Design and debug a program using sequence and repetition. |
| `00c_look_first`, Look Before You Move | KS2 | Mars | selection, input | Use selection and a sensor input to control behaviour. |
| `00d_fix_the_turn`, Fix the Broken Program | KS2 | Earth | sequence, debugging | Detect and correct an error by reasoning about the observed run. |
| `16_variables`, One name, used twice | KS2 | Earth | variables, abstraction | Work with a variable and use its stored value in more than one instruction. |
| `01_hello_rover`, Hello, Rover! | KS3 | Earth | sequence | Use a textual language to solve a computational problem. |
| `02_move_turn`, Move and turn | KS3 | Earth | sequence, modelling | Use a computational abstraction to model movement in a physical system. |
| `03_sequence`, Sequence | KS3 | Earth | sequence | Compose textual instructions into a complete route. |
| `04_selection`, Selection (if / else) | KS3 | Mars | selection, Boolean logic | Use Boolean logic to select an action. |
| `04a_fix_the_condition`, Fix the Backwards Test | KS3 | Earth | selection, debugging | Evaluate and correct a faulty Boolean condition. |
| `05_iteration`, Iteration with while-loops | KS3 | Mars | iteration, selection | Apply an iterative algorithm and reason about termination. |
| `06_functions`, Functions | KS3 | Mars | functions, decomposition | Develop a modular textual program using a function. |
| `07_sensors`, Reading sensors | KS3 | Underwater | abstraction, data, iteration | Use sensor data as an abstraction of a physical system. |
| `08_pathfinding`, Pathfinding basics | KS3 | Mars | iteration, selection, decomposition | Compose control structures into a traversal algorithm. |
| `09_recursion`, Recursion | KS4 | Space | recursion, functions | Trace recursion and identify the base case. |
| `10_optimisation`, Optimisation | KS4 | Mars | algorithms, evaluation | Compare alternative routes and reason about efficiency. |
| `11_decomposition`, Decomposition | KS4 | Mars | decomposition, functions | Split a problem into sub-problems implemented as functions. |
| `12_abstraction`, Abstraction | KS4 | Underwater | abstraction, selection | Use a sensor interface to hide environmental detail. |
| `13_nested_loops`, Nested loops | KS4 | Space | nested iteration | Compose nested loops to cover a two-dimensional pattern. |
| `14_counting`, Counting with a variable | KS4 | Earth | variables, iteration | Use assignment and an accumulator within iteration. |
| `15_parameters`, Functions with parameters | KS4 | Mars | functions, parameterisation | Generalise a function by supplying different arguments. |
| `17_lists`, A list drives the route | KS4 | Mars | lists, iteration, abstraction | Store route data in a list and traverse it with a loop. |

## Skills coverage matrix

| Computational-thinking or programming concept | Lessons that exercise it |
| --- | --- |
| Sequence and prediction | `000_watch_it_go`, `00_first_drive`, `00a_turn_the_corner`, `00d_fix_the_turn`, `01_hello_rover`, `02_move_turn`, `03_sequence` |
| Debugging and evaluation | `00d_fix_the_turn`, `04a_fix_the_condition`, `10_optimisation` |
| Selection and Boolean logic | `00c_look_first`, `04_selection`, `04a_fix_the_condition`, `05_iteration`, `08_pathfinding`, `12_abstraction` |
| Iteration | `00b_repeat_square`, `05_iteration`, `07_sensors`, `08_pathfinding`, `10_optimisation`, `13_nested_loops`, `14_counting`, `17_lists` |
| Functions, decomposition and parameters | `06_functions`, `08_pathfinding`, `09_recursion`, `11_decomposition`, `15_parameters` |
| Variables and data structures | `16_variables`, `14_counting`, `17_lists` |
| Abstraction and physical-system modelling | `02_move_turn`, `07_sensors`, `11_decomposition`, `12_abstraction`, `16_variables`, `17_lists` |

## Where the evidence lives

Every lesson YAML carries its full `curriculum_refs` list in
`src/robolearn/lessons/library/`. The schema validates required fields, while
`tests/unit/test_curriculum_integrity.py` rejects invented numbered attainment
targets and checks coverage across every key stage. The teacher-document gate
also fails if this mapping, the scheme of work or the answer key omits a shipped
lesson.

## Suggested progression

1. Begin with the three KS1 watch, change and turn lessons.
2. Use the four KS2 lessons for repetition, sensor input, debugging and a first
   variable.
3. Teach the nine KS3 lessons from sequences through selection, iteration,
   functions, sensing and pathfinding, placing the debugging lesson immediately
   after selection.
4. Use the eight KS4 lessons selectively for recursion, optimisation,
   decomposition, abstraction, nested iteration, accumulators, parameters and
   lists.

The detailed timing, prerequisites and classroom evidence suggestions are in
the [scheme of work](scheme-of-work.md). Verified programs are in the
[teacher answer key](answer-key.md).
