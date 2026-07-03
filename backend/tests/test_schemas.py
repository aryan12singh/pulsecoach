from datetime import datetime, timezone

from schemas import MetricIn, WorkoutIn


def test_metric_in_recorded_at_optional():
    """The manual 'Add reading' form used to 422 because recorded_at was required."""
    m = MetricIn(metric_type="weight_kg", value=72.5, unit="kg")
    assert m.recorded_at is None  # router fills in now()


def test_workout_in_accepts_sets_without_order_fields():
    """The manual workout form sends sets without exercise_order/set_number."""
    w = WorkoutIn(
        workout_type="strength",
        start_at=datetime(2024, 5, 24, 9, 30, tzinfo=timezone.utc),
        duration_mins=45,
        sets=[
            {"exercise_name": "Bench Press", "reps": 8, "weight": 80},
            {"exercise_name": "Bench Press", "reps": 7, "weight": 80},
            {"exercise_name": "Squat", "reps": 5, "weight": 100},
        ],
    )
    assert len(w.sets) == 3
    assert w.sets[0].exercise_order is None
    assert w.sets[0].set_number is None


def test_workout_in_defaults():
    w = WorkoutIn(
        workout_type="running",
        start_at=datetime(2024, 5, 24, 9, 30, tzinfo=timezone.utc),
        duration_mins=30,
    )
    assert w.source.value == "manual"
    assert w.sets == []
