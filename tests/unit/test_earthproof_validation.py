import pytest

from kodro.earthproof import Interval, Scenario, compare


def test_interval_and_scenario_validation_edges():
    with pytest.raises(ValueError):
        Interval(-1, 0, 1)
    with pytest.raises(ValueError):
        Interval.point(1).scale(-1)
    with pytest.raises(ValueError):
        Scenario.from_mapping({"name": "missing"})


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        (
            {
                "name": "bad avoided",
                "average_power_w": {"low": 1, "central": 1, "high": 1},
                "runtime_hours": {"low": 1, "central": 1, "high": 1},
                "physical_prototypes_avoided": True,
            },
            "must be an integer",
        ),
        (
            {
                "name": "fractional avoided",
                "average_power_w": {"low": 1, "central": 1, "high": 1},
                "runtime_hours": {"low": 1, "central": 1, "high": 1},
                "physical_prototypes_avoided": 1.5,
            },
            "must be an integer",
        ),
        (
            {
                "name": "bad sources",
                "average_power_w": {"low": 1, "central": 1, "high": 1},
                "runtime_hours": {"low": 1, "central": 1, "high": 1},
                "evidence_sources": "not-a-list",
            },
            "must be a list",
        ),
    ],
)
def test_mapping_validation_rejects_ambiguous_inputs(raw, message):
    with pytest.raises(ValueError, match=message):
        Scenario.from_mapping(raw)


def test_zero_energy_baseline_does_not_divide_by_zero():
    result = compare(
        Scenario("zero", Interval.point(0), Interval.point(1)),
        Scenario("candidate", Interval.point(1), Interval.point(1)),
    )
    assert result["central_operating_energy_change_percent"] is None
