# Extending the lesson library

A lesson is a single YAML file under
[`src/robolearn/lessons/library/`](../../src/robolearn/lessons/library/). The
schema is defined in
[`src/robolearn/lessons/schema.py`](../../src/robolearn/lessons/schema.py)
and the loader validates every file with Pydantic before the application
boots.

This page is filled in Task 8 of the build plan once the schema lands. It
will document each top-level key (`id`, `title`, `key_stage`, `ct_concepts`,
`curriculum_refs`, `prereqs`, `terrain`, `intro`, `starter_code`,
`allowed_constructs`, `max_lines`, `world`, `success_criteria`, `hints`).
