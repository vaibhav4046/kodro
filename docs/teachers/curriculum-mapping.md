# Curriculum mapping

All 24 built-in Kodro lessons are mapped to a specific attainment target
in one of three Department for Education documents: **"Computing
programmes of study: Key Stages 1 and 2"** (DfE-00171-2013) for the
entry lessons, **"Computing programmes of study: Key Stages 3 and 4"**
(DfE-00191-2013) for the core, and **"Computer Science GCSE subject
content"** (DfE-00094-2015) for the KS4 stretch lessons.
Computational-thinking concepts follow the BCS
**"Computational Thinking - A Guide for Teachers"** (Csizmadia et
al., 2015).

The table below is a readable short form. The authoritative mapping is the
`curriculum_refs` list inside each lesson YAML, which quotes the attainment
target in full. Title, key stage, terrain and CT concepts in this table were
regenerated from `load_library()` on 15 August 2026; every one of the 24
lessons has a non-empty `curriculum_refs`.

A row here shows curriculum relevance. It is not a claim that one short Kodro
lesson teaches or assesses an entire statutory requirement, and the in-app score
is formative practice feedback rather than a predicted grade.

| Lesson | Title | Key stage | Terrain | CT concepts | Programme of study reference |
| --- | --- | --- | --- | --- | --- |
| `000_watch_it_go` | Watch It, Then Change It | KS1 | Earth | sequence | DfE-00171-2013 KS1 (algorithms implemented as programs; precise instructions) |
| `00_first_drive` | Drive to the Flag | KS1 | Earth | sequence | DfE-00171-2013 KS1 (create and debug simple programs) |
| `00a_turn_the_corner` | Turn the Corner | KS1 | Earth | sequence | DfE-00171-2013 KS1 (create and debug; predict behaviour) |
| `00b_repeat_square` | Make a Square | KS2 | Earth | iteration | DfE-00171-2013 KS2 (sequence, selection and repetition) |
| `00c_look_first` | Look Before You Move | KS2 | Mars | selection | DfE-00171-2013 KS2 (selection; forms of input and output) |
| `00d_fix_the_turn` | Fix the Broken Program | KS2 | Earth | sequence, debugging | DfE-00171-2013 KS2 (detect and correct errors in programs) |
| `01_hello_rover` | Hello, Rover! | KS3 | Earth | sequence | DfE-00191-2013 KS3 AT 4 (textual programming languages) |
| `02_move_turn` | Move and turn | KS3 | Earth | sequence | DfE-00191-2013 KS3 AT 4 (computational abstractions) |
| `03_sequence` | Sequence | KS3 | Earth | sequence | DfE-00191-2013 KS3 AT 4 (sequential composition) |
| `04_selection` | Selection (if / else) | KS3 | Mars | selection | DfE-00191-2013 KS3 AT 7 (Boolean logic) |
| `04a_fix_the_condition` | Fix the Backwards Test | KS3 | Earth | selection, debugging | DfE-00191-2013 KS3 (Boolean logic); BCS 2015 (evaluation and debugging) |
| `05_iteration` | Iteration with while-loops | KS3 | Mars | iteration, selection | DfE-00191-2013 KS3 AT 5 (key algorithms) |
| `06_functions` | Functions | KS3 | Mars | functions, decomposition | DfE-00191-2013 KS3 AT 6 (modular programs) |
| `07_sensors` | Reading sensors | KS3 | Underwater | abstraction, iteration | DfE-00191-2013 KS3 AT 4 (abstractions of physical systems) |
| `08_pathfinding` | Pathfinding basics | KS3 | Mars | iteration, selection, decomposition | DfE-00191-2013 KS3 AT 5; DfE-00094-2015 §2 (algorithms) |
| `09_recursion` | Recursion (KS4 stretch) | KS4 | Space | recursion, functions | DfE-00094-2015 §3 (programming techniques: recursion) |
| `10_optimisation` | Optimisation (KS4 stretch) | KS4 | Mars | algorithmic efficiency, iteration | DfE-00094-2015 §2 (algorithm efficiency) |
| `11_decomposition` | Decomposition (KS4 stretch) | KS4 | Mars | decomposition, functions | DfE-00094-2015 §3 (decompose into subroutines) |
| `12_abstraction` | Abstraction (KS4 stretch) | KS4 | Underwater | abstraction, selection | DfE-00094-2015 §3 (abstraction; sensors as interface) |
| `13_nested_loops` | Nested loops (KS4 stretch) | KS4 | Space | iteration | DfE-00094-2015 §3 (nested iteration) |
| `14_counting` | Counting with a variable (KS4 stretch) | KS4 | Earth | iteration | DfE-00094-2015 §3 (variables; accumulator pattern) |
| `15_parameters` | Functions with parameters (KS4 stretch) | KS4 | Mars | functions | DfE-00094-2015 §3 (subroutines with parameters) |
| `16_variables` | One name, used twice | KS2 | Earth | sequence, abstraction | DfE-00171-2013 KS2 (work with variables); DfE-00191-2013 KS3 (use variables) |
| `17_lists` | A list drives the route | KS4 | Mars | iteration, abstraction | DfE-00094-2015 §2 (data structures: lists); DfE-00191-2013 KS3 (lists) |

The key stage in this table is the single `key_stage` field from the YAML.
`08_pathfinding` is tagged KS3 in source and cites a GCSE reference as a
bridge; it is not dual-tagged.

## Skills coverage matrix

Lesson ids are given in full because `00`, `000` and `00a` are three
different lessons.

| BCS computational-thinking concept | Lessons that exercise it |
| --- | --- |
| Sequence | 000, 00, 00a, 00d, 01, 02, 03, 16 |
| Selection | 00c, 04, 04a, 05, 08, 12 |
| Iteration | 00b, 05, 07, 08, 10, 13, 14, 17 |
| Functions / decomposition | 06, 08, 11, 15 |
| Abstraction | 07, 12, 16, 17 |
| Recursion | 09 |
| Algorithmic efficiency | 10 |
| Debugging | 00d, 04a |

## Where the references live in the source

Each lesson YAML carries its `curriculum_refs` list verbatim in the
`src/robolearn/lessons/library/<id>.yaml` file. The lesson schema in
`src/robolearn/lessons/schema.py` validates that every required
attainment-target field is present at load time; a typo in a YAML key
fails fast (Section 6 of the build spec).

Two test files hold this honest. `tests/unit/test_curriculum_integrity.py`
rejects an invented numbered attainment target, requires every lesson to carry a
checkable reference, and checks that the curriculum report covers every key stage
in the library. `tests/unit/test_docs_match_reality.py` fails if this mapping,
the scheme of work or the answer key omits a shipped lesson.

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
9. `11_decomposition`, `15_parameters` — deepen subroutines: split a
   route into named helper functions, then generalise one of them with a
   `distance` parameter.
10. `12_abstraction` — treat a sensor (`obstacle_ahead()`) as an abstract
    interface so one short program copes with any arrangement.
11. `13_nested_loops`, `14_counting` — nested iteration and the
    count-controlled accumulator pattern complete the iteration strand.
