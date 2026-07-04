import os
import tempfile

from services.ingestion.apple_health_file import AppleHealthFileAdapter

EXPORT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
 <Record type="HKQuantityTypeIdentifierBodyMass" unit="lb" value="160"
   startDate="2024-03-15 08:00:00 +0000" endDate="2024-03-15 08:00:00 +0000"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" unit="kg" value="72.5"
   startDate="2024-03-16 08:00:00 +0000" endDate="2024-03-16 08:00:00 +0000"/>
 <Record type="HKQuantityTypeIdentifierBodyFatPercentage" unit="%" value="0.182"
   startDate="2024-03-15 08:01:00 +0000" endDate="2024-03-15 08:01:00 +0000"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis"
   value="HKCategoryValueSleepAnalysisAsleepCore"
   startDate="2024-03-15 23:30:00 +0000" endDate="2024-03-16 03:30:00 +0000"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis"
   value="HKCategoryValueSleepAnalysisAsleepREM"
   startDate="2024-03-16 03:30:00 +0000" endDate="2024-03-16 06:00:00 +0000"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis"
   value="HKCategoryValueSleepAnalysisAwake"
   startDate="2024-03-16 06:00:00 +0000" endDate="2024-03-16 06:30:00 +0000"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32.5"
   totalDistance="3.1" totalDistanceUnit="mi" totalEnergyBurned="285"
   totalEnergyBurnedUnit="kcal"
   startDate="2024-03-15 07:00:00 +0000" endDate="2024-03-15 07:32:30 +0000"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining"
   duration="55" startDate="2024-03-16 18:00:00 +0000" endDate="2024-03-16 18:55:00 +0000"/>
</HealthData>
"""


def _parse(xml: str):
    fd, path = tempfile.mkstemp(suffix=".xml")
    with os.fdopen(fd, "w") as f:
        f.write(xml)
    try:
        return AppleHealthFileAdapter().parse_file(path)
    finally:
        os.remove(path)


def test_workouts_parsed_with_unit_conversion():
    result = _parse(EXPORT_XML)
    assert len(result.workouts) == 2

    run = next(w for w in result.workouts if w.workout_type.value == "running")
    assert run.duration_mins == 32.5
    assert abs(run.distance_km - 3.1 * 1.60934) < 0.001
    assert run.active_calories == 285

    strength = next(w for w in result.workouts if w.workout_type.value == "strength")
    assert strength.duration_mins == 55


def test_body_mass_lb_converted_and_bodyfat_scaled():
    result = _parse(EXPORT_XML)
    weights = [m for m in result.metrics if m.metric_type == "weight_kg"]
    assert len(weights) == 2
    lb_row = next(m for m in weights if m.recorded_at.day == 15)
    assert abs(lb_row.value - 160 * 0.45359237) < 0.01
    kg_row = next(m for m in weights if m.recorded_at.day == 16)
    assert kg_row.value == 72.5

    fat = next(m for m in result.metrics if m.metric_type == "body_fat_pct")
    assert abs(fat.value - 18.2) < 0.001  # 0-1 scaled to percent


def test_sleep_intervals_aggregate_to_one_night():
    result = _parse(EXPORT_XML)
    sleep = [m for m in result.metrics if m.metric_type == "sleep_hours"]
    assert len(sleep) == 1
    # 4h core + 2.5h REM; the Awake interval is excluded
    assert abs(sleep[0].value - 6.5) < 0.01
    # Post-midnight sleep attributes to the previous calendar night
    assert sleep[0].date.day == 15
