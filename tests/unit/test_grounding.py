"""Tests for the grounding / invention metric (kodro.grounding)."""

from __future__ import annotations

from kodro.grounding import FITTED_DEFAULT, check_grounding

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


def test_nested_def_does_not_launder_a_top_level_call() -> None:
    # Scope-blindness evasion: fly is defined ONLY inside helper's scope, then
    # called at module scope where it is NOT visible. A name laundered through an
    # inner scope must still be flagged as invented.
    code = "def helper():\n    def fly():\n        pass\nfly()\n"
    result = check_grounding(code)
    assert result.grounded is False
    assert "fly" in result.invented


def test_helper_visible_from_an_enclosing_scope_is_not_invention() -> None:
    # The counterpart guard: a helper defined in the enclosing scope IS visible
    # to a sibling inner scope, so calling it there is not a false positive.
    code = (
        "def outer():\n"
        "    def helper():\n"
        "        move_forward(1)\n"
        "    def runner():\n"
        "        helper()\n"
        "    runner()\n"
        "outer()\n"
    )
    result = check_grounding(code)
    assert result.grounded is True
    assert result.invented == ()


def test_lambda_bound_helper_call_is_not_invention() -> None:
    # A name bound to a lambda is a callable the program defines, so calling it
    # is ordinary code, not invention.
    result = check_grounding("f = lambda: move_forward(1)\nf()\n")
    assert result.grounded is True
    assert result.invented == ()


def test_multi_level_alias_is_not_invention() -> None:
    # Aliases chained through several name = name steps resolve to a fitted
    # command, so the final call is grounded.
    result = check_grounding("a = move_forward\nb = a\nb(3)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_attribute_call_on_a_fitted_command_is_invention() -> None:
    # A fitted command is a bare function, not an object: an attribute call whose
    # method is not a real builtin-type method invents an attribute surface and
    # must be flagged, exactly like rover.forward().
    result = check_grounding("move_forward.foo()\n")
    assert result.grounded is False
    assert "move_forward.foo" in result.invented


def test_attribute_call_on_a_builtin_name_is_invention() -> None:
    # The same closes the launder-through-a-builtin evasion: hiding an invented
    # method behind a builtin name does not exempt it.
    result = check_grounding("range.launch_missiles()\n")
    assert result.grounded is False
    assert "range.launch_missiles" in result.invented


def test_real_builtin_method_on_a_known_base_is_not_invention() -> None:
    # The one exemption, locked so it cannot silently drift: a REAL builtin-type
    # method (here the str method upper) on a KNOWN base -- a fitted/builtin name
    # -- is a known symbol, not an invented one, so it is not flagged. An unknown
    # method on the same base (previous test) still is.
    result = check_grounding("print.upper()\n")
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
    from kodro import rover_api

    assert frozenset(rover_api.__all__) == FITTED_DEFAULT
    assert "move_forward" in FITTED_DEFAULT and len(FITTED_DEFAULT) >= 20


# --- Genuinely-bound locals must not be misreported as invented (false positives
# that would inflate the headline invention_rate). Each form below binds a name
# by iteration/context/unpacking, so a bare or method call on it is ordinary code.


def test_for_loop_target_bare_call_is_not_invention() -> None:
    # A name bound by a for-loop is a real local; calling it is not invention.
    result = check_grounding("for f in [move_forward]:\n    f(1)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_for_loop_target_method_call_is_not_invention() -> None:
    # A method call on a for-loop variable is ordinary code (the base is a bound
    # local of unknown type), even for a method that is not a container method.
    result = check_grounding("xs = []\nfor x in xs:\n    x.foo()\nmove_forward(1)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_for_loop_unpacking_targets_are_not_invention() -> None:
    # Tuple unpacking in a for-loop binds both names locally.
    result = check_grounding("items = []\nfor a, b in items:\n    a.step()\n    b()\n")
    assert result.grounded is True
    assert result.invented == ()


def test_with_as_target_is_not_invention() -> None:
    # A `with ... as name` binding is a real local; method and bare calls on it
    # are ordinary code, not invention.
    code = "def cm():\n    return None\nwith cm() as h:\n    h.read()\n    h()\n"
    result = check_grounding(code)
    assert result.grounded is True
    assert result.invented == ()


def test_except_as_target_is_not_invention() -> None:
    # An `except ... as name` binding is a real local.
    code = "try:\n    move_forward(1)\nexcept Exception as err:\n    err.log()\n"
    result = check_grounding(code)
    assert result.grounded is True
    assert result.invented == ()


def test_comprehension_variable_method_call_is_not_invention() -> None:
    # The comprehension loop variable is a bound local; its method calls are not
    # invented symbols the program invented (the task's canonical case).
    result = check_grounding("xs = []\nout = [x.foo() for x in xs]\nmove_forward(1)\n")
    assert result.grounded is True
    assert result.invented == ()


def test_comprehension_variants_bind_their_targets() -> None:
    # set/dict/generator comprehensions and multi-target generators all bind.
    code = (
        "xs = []\n"
        "items = []\n"
        "s = {x.foo() for x in xs}\n"
        "d = {k: v.bar() for k, v in items}\n"
        "g = [y() for y in xs]\n"
    )
    result = check_grounding(code)
    assert result.grounded is True
    assert result.invented == ()


def test_tuple_unpacking_to_call_binds_locals() -> None:
    # `(x, y) = f()` binds x and y as real locals, so a method or bare call on
    # them is not invention -- unlike a single `rover = spawn()` (see
    # test_binding_the_base_name_does_not_launder_an_invented_api), which stays
    # flagged. Unpacking a call result is a genuine binding, not that evasion.
    code = "def f():\n    return 1, 2\n(x, y) = f()\nx.run()\ny()\n"
    result = check_grounding(code)
    assert result.grounded is True
    assert result.invented == ()


def test_starred_unpacking_target_is_not_invention() -> None:
    # A starred capture (`a, *rest = ...`) binds rest as a real local.
    result = check_grounding("a, *rest = move_forward, turn_left, turn_right\nrest.pop()\n")
    assert result.grounded is True
    assert result.invented == ()


def test_unpacking_to_literal_containers_exempts_container_methods() -> None:
    # `a, b = [], {}` makes a a list and b a dict (matched positionally), so real
    # container methods on them are ordinary code.
    code = "a, b = [], {}\na.append(1)\nb.setdefault(1, 2)\nmove_forward(1)\n"
    result = check_grounding(code)
    assert result.grounded is True
    assert result.invented == ()


def test_unpacking_container_launder_is_still_caught() -> None:
    # The launder guard survives unpacking: a is positionally a list, but
    # launch_missiles is not a real container method, so it stays invention --
    # the literal-container base is method-restricted, never any-method exempt.
    result = check_grounding("a, b = [], {}\na.launch_missiles()\n")
    assert result.grounded is False
    assert "a.launch_missiles" in result.invented
