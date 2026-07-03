from services.ingestion.hevy_csv import parse_csv_file

WORKOUT_CSV = """title,start_time,end_time,exercise_title,set_index,set_type,weight_kg,reps,rpe
Push Day,2024-05-24 09:30:00,2024-05-24 10:30:00,Bench Press,1,normal,80,8,8
Push Day,2024-05-24 09:30:00,2024-05-24 10:30:00,Bench Press,2,normal,80,7,8.5
Push Day,2024-05-24 09:30:00,2024-05-24 10:30:00,Overhead Press,1,warmup,40,10,
Pull Day,2024-05-26 18:00:00,2024-05-26 19:00:00,Barbell Row,1,normal,70,10,7
"""

WORKOUT_CSV_LBS = """title,start_time,end_time,exercise_title,set_index,set_type,weight_lbs,reps,rpe
Push Day,"May 24, 2024, 9:30:00 AM","May 24, 2024, 10:30:00 AM",Bench Press,1,normal,100,8,8
"""

MEASUREMENT_CSV = """date,weight_kg,fat_percent
"24 May 2025, 09:30",72.5,18.2
"25 May 2025, 09:31",72.3,
"""


def test_workout_csv_groups_sets_by_session():
    result = parse_csv_file(WORKOUT_CSV)
    assert len(result.workouts) == 2

    push = next(w for w in result.workouts if "Push Day" in (w.external_id or ""))
    sets = result.strength_sets[push.external_id]
    assert len(sets) == 3
    assert sets[0].exercise_name == "Bench Press"
    assert sets[0].weight == 80
    assert sets[0].reps == 8
    # Second exercise gets the next order index
    ohp = [s for s in sets if s.exercise_name == "Overhead Press"][0]
    assert ohp.exercise_order == 1
    assert ohp.is_warmup is True

    assert push.duration_mins == 60


def test_workout_csv_weight_lbs_converted_to_kg():
    result = parse_csv_file(WORKOUT_CSV_LBS)
    assert len(result.workouts) == 1
    sets = result.strength_sets[result.workouts[0].external_id]
    assert abs(sets[0].weight - 45.359237) < 0.001
    assert sets[0].weight_unit.value == "kg"


def test_measurement_csv_parses_weight_and_bodyfat():
    result = parse_csv_file(MEASUREMENT_CSV)
    assert len(result.workouts) == 0
    types = {m.metric_type for m in result.metrics}
    assert types == {"weight_kg", "body_fat_pct"}
    weight = [m for m in result.metrics if m.metric_type == "weight_kg"]
    assert len(weight) == 2
    assert weight[0].value == 72.5


def test_workout_csv_various_date_formats():
    for date_str in [
        "2024-05-24 09:30:00",
        "2024-05-24T09:30:00",
        "24 May 2024, 09:30",
        "May 24, 2024, 9:30:00 AM",
        "05/24/2024 09:30",
    ]:
        csv_text = (
            "title,start_time,end_time,exercise_title,set_index,weight_kg,reps\n"
            f'W,"{date_str}",,Bench Press,1,80,8\n'
        )
        result = parse_csv_file(csv_text)
        assert len(result.workouts) == 1, f"failed for {date_str!r}"
        assert result.workouts[0].start_at.year == 2024
