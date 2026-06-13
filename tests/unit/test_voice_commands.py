"""Deterministic offline voice-to-rover command parsing."""

from __future__ import annotations

import pytest

from robolearn.ai.voice_commands import parse_voice_command


@pytest.mark.parametrize(
    ("phrase", "expected"),
    [
        ("go forward three", "move_forward(3)"),
        ("move forward", "move_forward(1)"),
        ("forwards 5", "move_forward(5)"),
        ("go straight ahead two", "move_forward(2)"),
        ("back up", "move_backward(1)"),
        ("reverse 2", "move_backward(2)"),
        ("turn left ninety", "turn_left(90)"),
        ("turn left", "turn_left(90)"),
        ("turn right 45", "turn_right(45)"),
        ("set speed 80", "set_speed(80)"),
        ("go faster", "set_speed(60)"),
        ("scan the area", "scan()"),
        ("beep", "beep(1)"),
        ("collect the sample", "collect_sample()"),
        ("wait two", "wait(2)"),
        ("stop", "set_speed(0)"),
        ("say hello world", 'say("hello world")'),
    ],
)
def test_known_phrases_map_to_rover_lines(phrase: str, expected: str) -> None:
    assert parse_voice_command(phrase) == expected


def test_back_takes_priority_over_a_stray_forward_word() -> None:
    assert parse_voice_command("go backward") == "move_backward(1)"


@pytest.mark.parametrize("phrase", ["", "   ", "banana helicopter", "tell me a joke"])
def test_unrecognised_phrases_return_none(phrase: str) -> None:
    assert parse_voice_command(phrase) is None


def test_digits_and_number_words_both_work() -> None:
    assert parse_voice_command("forward 7") == "move_forward(7)"
    assert parse_voice_command("forward seven") == "move_forward(7)"


def test_empty_say_is_rejected() -> None:
    assert parse_voice_command("say ") is None
