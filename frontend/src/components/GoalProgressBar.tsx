import type { GoalStatus } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500",
  on_track: "bg-indigo-500",
  ahead: "bg-emerald-500",
  behind: "bg-amber-500",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  on_track: "bg-indigo-100 text-indigo-800",
  ahead: "bg-emerald-100 text-emerald-800",
  behind: "bg-amber-100 text-amber-800",
};

export default function GoalProgressBar({ goal }: { goal: GoalStatus }) {
  const pct = Math.min(goal.percentage_complete, 100);
  const barColor = STATUS_COLORS[goal.status] ?? "bg-gray-400";
  const badgeColor = STATUS_BADGE[goal.status] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800 capitalize">
          {goal.goal_type.replace(/_/g, " ")}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
          {goal.status.replace("_", " ")}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
        <div
          className={`h-2.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{goal.current_value} {goal.target_unit}</span>
        <span>Target: {goal.target_value} {goal.target_unit}</span>
      </div>
    </div>
  );
}
