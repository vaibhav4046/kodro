# Curriculum mapping

Every built-in RoboLearn lesson is mapped to a specific attainment
target in the Department for Education **"Computing programmes of
study: Key Stages 3 and 4"** (DfE-00191-2013) and, for the KS4
stretch lessons, the **"Computer Science GCSE subject content"**
(DfE-00094-2015). Computational-thinking concepts follow the BCS
**"Computational Thinking — A Guide for Teachers"** (Csizmadia et
al., 2015).

| Lesson | Title | Key stage | Terrain | CT concepts | Programme of study reference |
| --- | --- | --- | --- | --- | --- |
| `01_hello_rover` | Hello, Rover! | KS3 | Earth | sequence | DfE-00191-2013 KS3 AT 4 (textual programming languages) |
| `02_move_turn` | Move and turn | KS3 | Earth | sequence | DfE-00191-2013 KS3 AT 4 (computational abstractions) |
| `03_sequence` | Sequence | KS3 | Earth | sequence | DfE-00191-2013 KS3 AT 4 (sequential composition) |
| `04_selection` | Selection (if / else) | KS3 | Mars | selection | DfE-00191-2013 KS3 AT 7 (Boolean logic) |
| `05_iteration` | Iteration with while-loops | KS3 | Mars | iteration, selection | DfE-00191-2013 KS3 AT 5 (key algorithms) |
| `06_functions` | Functions | KS3 | Mars | functions, decomposition | DfE-00191-2013 KS3 AT 6 (modular programs) |
| `07_sensors` | Reading sensors | KS3 | Underwater | abstraction, iteration | DfE-00191-2013 KS3 AT 4 (abstractions of physical systems) |
| `08_pathfinding` | Pathfinding basics | KS3 / KS4 | Mars | iteration, selection, decomposition | DfE-00191-2013 KS3 AT 5; DfE-00094-2015 §2 (algorithms) |
| `09_recursion` | Recursion (stretch) | KS4 | Space | recursion, functions | DfE-00094-2015 §3 (programming techniques: recursion) |
| `10_optimisation` | Optimisation (stretch) | KS4 | Mars | algorithmic efficiency, iteration | DfE-00094-2015 §2 (algorithm efficiency) |

## Skills coverage matrix

| BCS computational-thinking concept | Lessons that exercise it |
| --- | --- |
| Sequence | 01, 02, 03 |
| Selection | 04, 05, 08 |
| Iteration | 05, 07, 08, 10 |
| Functions / decomposition | 06, 08 |
| Abstraction | 07 |
| Recursion | 09 |
| Algorithmic efficiency | 10 |

## Where the references live in the source

Each lesson YAML carries its `curriculum_refs` list verbatim in the
`src/robolearn/lessons/library/<id>.yaml` file. The lesson schema in
`src/robolearn/lessons/schema.py` validates that every required
attainment-target field is present at load time; a typo in a YAML key
fails fast (Section 6 of the build spec).

## Recommended teaching order

KS3 introductory unit (typically two 50-minute lessons each):

1. `01_hello_rover` — sit pupils in front of the simulator, walk them
   through the three locked-in API calls (`move_forward`, `beep`,
   `log`). Discuss "sequence".
2. `02_move_turn`, `03_sequence` — add `turn_left` / `turn_right`,
   then a U-shaped path with `collect_sample`.
3. `04_selection` — introduce `if / else` and the
   `obstacle_ahead()` sensor.
4. `05_iteration` — `while` loops; emphasise the loop body must make
   progress (the hint engine's `while_no_progress` rule is the
   teaching cue when pupils get it wrong).
5. `06_functions` — wrap a repeating pattern in `def`.
6. `07_sensors` — combine iteration with `read_distance()`; teach the
   value of reading sensor output rather than guessing.
7. `08_pathfinding` — synthesises selection, iteration and
   decomposition; bridges to GCSE.

KS4 stretch:

8. `09_recursion`, `10_optimisation` — single-period each. The
   recursion lesson focuses on the base case; the optimisation lesson
   asks pupils to compare two orderings and pick the cheaper.
