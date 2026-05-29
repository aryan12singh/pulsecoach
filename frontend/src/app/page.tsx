import { api } from "@/lib/api";
import MetricCard from "@/components/MetricCard";
import GoalProgressBar from "@/components/GoalProgressBar";
import WorkoutList from "@/components/WorkoutList";
import WeightChart from "@/components/Charts/WeightChart";
import SleepChart from "@/components/Charts/SleepChart";
import VolumeChart from "@/components/Charts/VolumeChart";

export default async function Dashboard() {
  const [summary, metricSummary, goals, workouts, weightData, sleepData] = await Promise.all([
    api.workouts.weeklySummary().catch(() => null),
    api.metrics.summary().catch(() => []),
    api.goals.list().catch(() => []),
    api.workouts.list({ limit: "10" }).catch(() => []),
    api.metrics.list({ type: "weight_kg", limit: "30" }).catch(() => []),
    api.metrics.list({ type: "sleep_hours", limit: "30" }).catch(() => []),
  ]);

  const metricMap = Object.fromEntries(metricSummary.map((m) => [m.metric_type, m]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Health metric cards */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            label="Weight"
            value={metricMap["weight_kg"]?.latest_value ?? null}
            unit="kg"
            trend={metricMap["weight_kg"]?.trend}
          />
          <MetricCard
            label="BMI"
            value={metricMap["bmi"]?.latest_value ?? null}
            trend={metricMap["bmi"]?.trend}
          />
          <MetricCard
            label="Resting HR"
            value={metricMap["resting_hr"]?.latest_value ?? null}
            unit="bpm"
            trend={metricMap["resting_hr"]?.trend}
          />
          <MetricCard
            label="Avg Sleep"
            value={metricMap["sleep_hours"]?.latest_value ?? null}
            unit="hrs"
            trend={metricMap["sleep_hours"]?.trend}
          />
        </div>
      </section>

      {/* Weekly workout summary */}
      {summary && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">This Week</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="Sessions" value={summary.sessions_count} unit="/ wk" />
            <MetricCard label="Calories" value={Math.round(summary.total_calories)} unit="kcal" />
            <MetricCard label="Avg Duration" value={Math.round(summary.avg_duration_mins)} unit="min" />
            <MetricCard
              label="Avg Heart Rate"
              value={summary.avg_heart_rate ? Math.round(summary.avg_heart_rate) : null}
              unit="bpm"
            />
          </div>
        </section>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Goals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {goals.map((g) => <GoalProgressBar key={g.id} goal={g} />)}
          </div>
        </section>
      )}

      {/* Charts */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Trends</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Weight (kg)</p>
            <WeightChart data={weightData} />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Sleep (hrs)</p>
            <SleepChart data={sleepData} />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Weekly Calories Burned</p>
            <VolumeChart workouts={workouts} />
          </div>
        </div>
      </section>

      {/* Recent workouts */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Workouts</h2>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <WorkoutList workouts={workouts} />
        </div>
      </section>
    </div>
  );
}
