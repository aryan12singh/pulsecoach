from models import ComparisonEnum
from services.goal_service import _compute_status


def test_gte_goal_progress():
    pct, status = _compute_status(current=2, target=4, comparison=ComparisonEnum.gte)
    assert pct == 50.0
    assert status == "behind"


def test_gte_goal_completed():
    pct, status = _compute_status(current=4, target=4, comparison=ComparisonEnum.gte)
    assert pct == 100.0
    assert status == "completed"


def test_gte_progress_caps_at_150():
    pct, _ = _compute_status(current=100, target=4, comparison=ComparisonEnum.gte)
    assert pct == 150.0


def test_lte_goal_met_when_under_target():
    pct, status = _compute_status(current=68, target=70, comparison=ComparisonEnum.lte)
    assert pct == 100.0
    assert status == "completed"


def test_lte_goal_overshoot_penalized():
    pct, status = _compute_status(current=77, target=70, comparison=ComparisonEnum.lte)
    assert 0 < pct < 100
    assert status in ("behind", "on_track")


def test_zero_target_does_not_divide_by_zero():
    pct, status = _compute_status(current=5, target=0, comparison=ComparisonEnum.gte)
    assert pct == 100.0
    assert status == "completed"
