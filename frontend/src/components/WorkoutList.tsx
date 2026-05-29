import type { Workout } from "@/types";
import Link from "next/link";

const TYPE_ICON: Record<string, string> = {
  strength: "🏋",
  running: "🏃",
  cycling: "🚴",
  walking: "🚶",
  other: "⚡",
};

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WorkoutList({ workouts }: { workouts: Workout[] }) {
  if (!workouts.length)
    return <p className="text-gray-500 text-sm">No workouts yet.</p>;

  return (
    <div className="divide-y divide-gray-100">
      {workouts.map((w) => (
        <Link
          key={w.id}
          href={`/workouts/${w.id}`}
          className="flex items-center gap-4 py-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
        >
          <span className="text-2xl">{TYPE_ICON[w.workout_type] ?? "⚡"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 capitalize">
              {w.raw_type || w.workout_type}
            </p>
            <p className="text-xs text-gray-500">{fmt(w.start_at)}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>{Math.round(w.duration_mins)} min</p>
            {w.active_calories != null && <p>{Math.round(w.active_calories)} kcal</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
