from services.ingestion.strava_csv import parse_csv_content

CSV = """Activity ID,Activity Date,Activity Type,Elapsed Time,Distance,Calories,Average Heart Rate
11111,"Jan 15, 2024, 07:30:00 AM",Run,1800,5.2,320,155
22222,"Jan 16, 2024, 06:00:00 PM",Weight Training,3600,,410,132
"""


def test_parses_activities_with_api_compatible_external_id():
    result = parse_csv_content(CSV)
    assert len(result.workouts) == 2
    run = result.workouts[0]
    # Same key the OAuth API adapter uses -> CSV + API imports dedupe
    assert run.external_id == "11111"
    assert run.workout_type.value == "running"
    assert run.duration_mins == 30
    assert run.distance_km == 5.2
    assert run.active_calories == 320


def test_type_mapping_weight_training():
    result = parse_csv_content(CSV)
    strength = result.workouts[1]
    assert strength.workout_type.value == "strength"
    assert strength.distance_km is None


def test_rows_without_id_or_date_are_skipped():
    csv_text = "Activity ID,Activity Date,Activity Type,Elapsed Time\n,,Run,100\n33333,not-a-date,Run,100\n"
    result = parse_csv_content(csv_text)
    assert result.workouts == []
