import { api } from "@/lib/api";
import StrengthSetsTable from "@/components/StrengthSetsTable";
import Link from "next/link";

function fmtDt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function WorkoutDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workout = await api.workouts.get(Number(id));

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/workouts" className="text-indigo-600 text-sm hover:underline">← Back to workouts</Link>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1 capitalize">
          {workout.raw_type || workout.workout_type}
        </h1>
        <p className="text-sm text-gray-500 mb-4">{fmtDt(workout.start_at)}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Stat label="Duration" value={`${Math.round(workout.duration_mins)} min`} />
          {workout.active_calories != null && (
            <Stat label="Calories" value={`${Math.round(workout.active_calories)} kcal`} />
          )}
          {workout.avg_heart_rate != null && (
            <Stat label="Avg HR" value={`${Math.round(workout.avg_heart_rate)} bpm`} />
          )}
          {workout.distance_km != null && (
            <Stat label="Distance" value={`${workout.distance_km.toFixed(1)} km`} />
          )}
        </div>

        {workout.has_strength_detail && workout.strength_sets.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Sets</h2>
            <StrengthSetsTable sets={workout.strength_sets} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-800">{value}</p>
    </div>
  );
}
