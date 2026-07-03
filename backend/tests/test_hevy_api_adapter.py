from services.ingestion.hevy import HevyAdapter


def _payload(set_fields: dict) -> dict:
    return {
        "workouts": [
            {
                "id": "abc-123",
                "title": "Push Day",
                "start_time": "2024-05-24T09:30:00Z",
                "end_time": "2024-05-24T10:30:00Z",
                "exercises": [
                    {"title": "Bench Press", "sets": [set_fields]},
                ],
            }
        ]
    }


def test_weight_kg_stored_as_kg_even_with_lb_display_unit():
    adapter = HevyAdapter(api_key="x")
    result = adapter.normalize(_payload({"weight_kg": 80.0, "weight_unit": "lb", "reps": 8}))
    sets = result.strength_sets["abc-123"]
    assert sets[0].weight == 80.0
    assert sets[0].weight_unit.value == "kg"


def test_bare_lb_weight_converted():
    adapter = HevyAdapter(api_key="x")
    result = adapter.normalize(_payload({"weight": 100.0, "weight_unit": "lb", "reps": 8}))
    sets = result.strength_sets["abc-123"]
    assert abs(sets[0].weight - 45.359237) < 0.001
    assert sets[0].weight_unit.value == "kg"


def test_workout_envelope():
    adapter = HevyAdapter(api_key="x")
    result = adapter.normalize(_payload({"weight_kg": 60, "reps": 10}))
    assert len(result.workouts) == 1
    w = result.workouts[0]
    assert w.external_id == "abc-123"
    assert w.duration_mins == 60
    assert w.workout_type.value == "strength"
