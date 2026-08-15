# Extending the lesson library

A lesson is a single YAML file under `src/robolearn/lessons/library/`. The
schema is defined in `src/robolearn/lessons/schema.py` and the loader validates
every file with Pydantic before the application boots. There is no registry and
no index file: `load_library()` globs `*.yaml` in that directory and sorts by
file name, which is why the bundled lessons carry a numeric prefix (`00a_`,
`01_`, `02_`). Drop a valid YAML in and it appears; the numeric prefix is the
only thing controlling where.

Validation is strict. `model_config = ConfigDict(extra="forbid")` on every
model means an unknown or misspelled key is an error, not a silently ignored
line. A file that fails validation raises at load time rather than producing a
half-populated lesson.

## Top-level keys

| Key | Type | Required | Constraint |
| --- | --- | --- | --- |
| `id` | string | yes | non-empty; conventionally matches the file name |
| `title` | string | yes | non-empty; shown in the lesson list |
| `key_stage` | `KS1` \| `KS2` \| `KS3` \| `KS4` | yes | |
| `ct_concepts` | list | yes | at least one, from the fixed set below |
| `curriculum_refs` | list of strings | no | entries must be non-blank |
| `prereqs` | list of lesson ids | no | entries must be non-blank |
| `terrain` | `earth` \| `mars` \| `underwater` \| `space` | yes | parsed straight into the `Terrain` enum |
| `intro` | string | yes | non-empty; the brief the pupil reads |
| `starter_code` | string | yes | non-empty; pre-filled in the editor |
| `allowed_constructs` | list | yes | at least one, from the fixed set below |
| `max_lines` | int | yes | greater than zero |
| `world` | mapping | yes | see below |
| `success_criteria` | list | no | see below |
| `hints` | mapping | no | `on_failure` and `on_success` lists |
| `reading_age` | int | no | 4 to 18; KS1 and KS2 lessons set this low |
| `glossary` | map of term to definition | no | both halves must be non-blank |
| `solution_code` | string | no | non-empty; one worked solution |

`ct_concepts` accepts `sequence`, `selection`, `iteration`, `functions`,
`decomposition`, `abstraction`, `recursion`, `algorithmic_efficiency` and
`debugging`.

`allowed_constructs` accepts `assignment`, `arithmetic`, `comparison`, `for`,
`function_call`, `function_def`, `if`, `logical`, `recursion`, `return` and
`while`.

## The world block

```yaml
world:
  base: [1.0, 1.0]        # required, the rover start and return point
  samples:                 # optional, collectible positions
    - [2.0, 3.0]
  obstacles:               # optional
    - {x: 3.0, y: 1.0, r: 0.4}   # r must be greater than zero
  width: 6.0               # optional, default 10.0, must be positive
  height: 6.0              # optional, default 10.0, must be positive
```

## Success criteria

`success_criteria` is a list of one-key mappings. Each entry sets exactly one
of these fields, and an entry that sets none of them is rejected.

| Field | Meaning | Constraint |
| --- | --- | --- |
| `samples_collected` | minimum samples picked up | greater than zero |
| `max_battery_used` | battery ceiling | zero or more |
| `no_collisions` | boolean | |
| `uses_construct` | one construct name that must appear and be live | from the construct set |
| `returns_to_base` | boolean | |
| `max_steps` | step ceiling | zero or more |
| `min_distance_travelled` | minimum distance | greater than zero |
| `calls_in_order` | function names that must be called in this relative order | at least one, all non-blank |

Two of those minimums are deliberately `gt=0` rather than `ge=0`. The grader
tests `collected < required` and `travelled < minimum`, so a criterion of zero
is satisfied by every program ever written, including an empty one. A lesson
carrying such a criterion looks assessed and is not, which is worse than
carrying no criterion at all.

`calls_in_order` exists for the same reason. Without it, `01_hello_rover` told
the pupil to call three functions in order and then passed a program with two
of them deleted.

## Grading

`grade()` walks the criteria and returns `passed`, a per-criterion `reasons`
list for anything that failed, and a score of `100 - 20 * failures`, floored at
zero. A lesson with more than five criteria can therefore only ever score zero
once six of them fail, which is worth knowing before writing a long list.

## Worked solutions

`solution_code` is revealed only after every hint has been used. It is not
decoration and it is not optional in practice:
`tests/unit/test_lesson_solutions.py` runs every worked solution through the
Python grader and fails if any of them does not pass. The browser half of the
same guarantee is `scripts/qa_grader.mjs`, which runs the same solutions
through `lesson-grader.jsx`. Both must agree. A lesson whose own solution does
not score 100 cannot be finished by anybody, and no amount of re-reading the
criteria surfaces that.

## After adding a lesson

The desktop app reads the YAML library directly over the pywebview bridge. The
static web build has no bridge and fetches `lessons.json` instead, so a new
lesson is invisible in the browser until that file is regenerated:

```bash
python scripts/export_lessons.py
```

The export reuses the bridge's own serialiser, so the two paths cannot drift in
shape, and the output is deterministic: sorted keys, fixed indentation, LF
newlines, trailing newline. Running it twice on an unchanged library produces
byte-identical output. `tests/unit/test_lessons_export.py` fails until the
export is re-run, which is the gate that catches a forgotten regeneration.

## Checking your work

```bash
python -c "from robolearn.lessons.schema import load_library; print(len(load_library()))"
python -m pytest tests/unit/test_lesson_schema.py tests/unit/test_lesson_solutions.py tests/unit/test_lessons_export.py
node scripts/qa_grader.mjs
```
