from services.ingestion.apple_health import _METRIC_MAP, AppleHealthAdapter


def test_basal_temperature_is_not_mapped_to_body_fat():
    assert "basal_body_temperature" not in _METRIC_MAP


def test_workout_distance_units():
    adapter = AppleHealthAdapter()
    payload = {
        "data": {
            "workouts": [
                {
                    "name": "Outdoor Run",
                    "start": "2024-03-15 07:00:00 +0000",
                    "end": "2024-03-15 07:30:00 +0000",
                    "distance": {"qty": 5000, "units": "m"},
                },
                {
                    "name": "Outdoor Run",
                    "start": "2024-03-16 07:00:00 +0000",
                    "end": "2024-03-16 07:30:00 +0000",
                    "distance": {"qty": 3.1, "units": "mi"},
                },
                {
                    "name": "Outdoor Run",
                    "start": "2024-03-17 07:00:00 +0000",
                    "end": "2024-03-17 07:30:00 +0000",
                    "distance": {"qty": 5.0, "units": "km"},
                },
            ],
            "metrics": [],
        }
    }
    result = adapter.normalize(payload)
    assert len(result.workouts) == 3
    assert result.workouts[0].distance_km == 5.0
    assert abs(result.workouts[1].distance_km - 4.989) < 0.01
    assert result.workouts[2].distance_km == 5.0
    assert all(w.workout_type.value == "running" for w in result.workouts)


def test_metrics_normalized():
    adapter = AppleHealthAdapter()
    payload = {
        "data": {
            "workouts": [],
            "metrics": [
                {
                    "name": "weight_body_mass",
                    "units": "kg",
                    "data": [{"date": "2024-03-15 08:00:00 +0000", "qty": 72.5}],
                }
            ],
        }
    }
    result = adapter.normalize(payload)
    assert len(result.metrics) == 1
    assert result.metrics[0].metric_type == "weight_kg"
    assert result.metrics[0].value == 72.5
