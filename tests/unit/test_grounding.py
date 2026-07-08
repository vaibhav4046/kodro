"""Tests for the grounding / invention metric (robolearn.grounding)."""

from __future__ import annotations

from robolearn.grounding import FITTED_DEFAULT, check_grounding

# A program that uses only fitted commands and allowed builtins.
_GROUNDED = "for i in range(4):\n    move_forward(1)\n    turn_left(90)\n"
# A program that invents a command the build does not expose.
_INVENTED = "read_gps()\nmove_forward(1)\nactivate_laser()\n"


def test_grounded_program_has_no_invented_symbols() -> None:
    result = check_grounding(_GROUNDED)
    assert result.grounded is True
    assert result.invented == ()
    assert result.syntax_error is None


def test_invented_symbols_are_reported_sorted_and_deduped() -> None:
    result = check_grounding(_INVENTED)
    assert result.grounded is False
    assert result.invented == ("activate_laser", "read_gps")  # sorted, no move_forward


def test_language_builtins_are_not_invented() -> None:
    # range / len / print are the only builtins the sandbox exposes; never invented.
    result = check_grounding("print(len(range(3)))\nmove_forward(1)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_fitted_set_is_per_build() -> None:
    # A build without a distance sensor does not expose read_distance, so a call
    # to it is invented for THAT build even though it is a real default command.
    no_sensor = FITTED_DEFAULT - {"read_distance"}
    result = check_grounding("if read_distance() > 1:\n    move_forward(1)\n", fitted=no_sensor)
    assert result.grounded is False
    assert "read_distance" in result.invented


def test_invented_object_api_is_caught() -> None:
    # A model that calls rover.forward() invented an object the build has no such
    # thing as -- the fitted API is bare functions, no objects. Must be caught.
    result = check_grounding("rover.set_speed(60)\nrover.forward(80)\n")
    assert result.grounded is False
    assert "rover.forward" in result.invented and "rover.set_speed" in result.invented


def test_local_container_methods_are_not_invention() -> None:
    # xs is assigned locally, so xs.append(...) is ordinary Python, not invention.
    result = check_grounding("xs = []\nxs.append(read_distance())\nmove_forward(1)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_dict_and_string_methods_are_not_invention() -> None:
    # Names bound to a dict / string literal expose ordinary container methods.
    code = 'seen = {}\nname = "patrol"\nseen.setdefault(name.upper(), 0)\nmove_forward(1)\n'
    result = check_grounding(code)
    assert result.grounded is True
    assert result.invented == ()


def test_binding_the_base_name_does_not_launder_an_invented_api() -> None:
    # The evasion the metric must resist: assign the object first, then call
    # methods on it. rover is bound to a call result (not a container), so
    # rover.forward()/rover.set_speed() are still flagged as invented.
    code = "rover = spawn_rover()\nrover.set_speed(60)\nrover.forward(80)\n"
    result = check_grounding(code)
    assert result.grounded is False
    assert "rover.forward" in result.invented
    assert "rover.set_speed" in result.invented


def test_binding_base_to_another_name_is_not_exempt() -> None:
    # Aliasing a name to a non-container does not exempt its attribute calls.
    code = "bot = something\nbot.drive(1)\nmove_forward(1)\n"
    result = check_grounding(code)
    assert result.grounded is False
    assert "bot.drive" in result.invented


def test_container_launder_is_caught() -> None:
    # Binding a name to a []/{}/f-string literal must not launder an invented
    # method: launch_missiles is not a real container method, so even though x
    # is container-bound the call is still invention.
    result = check_grounding("x = []\nx.launch_missiles()\nmove_forward(1)\n")
    assert result.grounded is False
    assert "x.launch_missiles" in result.invented


def test_bare_decorator_is_caught() -> None:
    # A bare decorator invokes fly at def time but is not a Call node; it must
    # still be flagged as an invented symbol.
    result = check_grounding("@fly\ndef g():\n    pass\n")
    assert result.grounded is False
    assert "fly" in result.invented


def test_user_defined_helper_is_not_invention() -> None:
    # A function the program defines itself is not invented when called.
    result = check_grounding("def helper():\n    move_forward(1)\nhelper()\n")
    assert result.grounded is True
    assert result.invented == ()


def test_alias_of_fitted_command_is_not_invention() -> None:
    # A single-level alias of a fitted command is ordinary code, not invention.
    result = check_grounding("mv = move_forward\nmv(3)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_syntax_error_is_reported_not_raised() -> None:
    result = check_grounding("move_forward(\n")
    assert result.grounded is False
    assert result.syntax_error is not None
    assert result.invented == ()


def test_is_deterministic() -> None:
    assert check_grounding(_INVENTED) == check_grounding(_INVENTED)


def test_default_fitted_set_matches_rover_api() -> None:
    from robolearn import rover_api

    assert frozenset(rover_api.__all__) == FITTED_DEFAULT
    assert "move_forward" in FITTED_DEFAULT and len(FITTED_DEFAULT) >= 20
