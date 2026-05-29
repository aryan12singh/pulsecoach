"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import MuscleVolumeChart from "@/components/Charts/MuscleVolumeChart";
import type { AnalyticsSummary } from "@/types";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

const LEVEL_STYLE: Record<string, string> = {
  ok: "bg-green-50 border-green-200 text-green-800",
  caution: "bg-amber-50 border-amber-200 text-amber-800",
  high: "bg-red-50 border-red-200 text-red-800",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AnalyticsPage() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.analytics.summary(range).then(setData).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                range === r.days
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 border hover:bg-gray-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <>
          {/* Overtraining */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recovery & Load</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.overtraining.map((f) => (
                <div key={f.metric} className={`rounded-xl border p-4 ${LEVEL_STYLE[f.level] ?? "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {f.metric.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs font-bold uppercase">{f.level}</span>
                  </div>
                  <p className="text-sm">{f.message}</p>
                </div>
              ))}
              {data.overtraining.length === 0 && (
                <p className="text-gray-400 text-sm">Not enough training history yet.</p>
              )}
            </div>
          </section>

          {/* Muscle volume */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Volume by Muscle Group ({data.window_days}d)
            </h2>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <MuscleVolumeChart data={data.muscle_volume} />
            </div>
          </section>

          {/* PRs */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Personal Records</h2>
            <div className="bg-white rounded-xl shadow-sm p-5 overflow-x-auto">
              {data.prs.length === 0 ? (
                <p className="text-gray-400 text-sm">No strength sets recorded yet.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase border-b">
                    <tr>
                      <th className="pb-2 pr-4">Exercise</th>
                      <th className="pb-2 pr-4">Top Weight</th>
                      <th className="pb-2 pr-4">Est. 1RM</th>
                      <th className="pb-2 pr-4">Achieved</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.prs.map((pr) => (
                      <tr key={pr.exercise_name}>
                        <td className="py-2 pr-4 font-medium text-gray-800">{pr.exercise_name}</td>
                        <td className="py-2 pr-4">{pr.best_weight} {pr.best_weight_unit}</td>
                        <td className="py-2 pr-4">{pr.best_est_1rm} {pr.best_weight_unit}</td>
                        <td className="py-2 pr-4 text-gray-500">{fmt(pr.best_weight_date)}</td>
                        <td className="py-2">
                          {pr.is_recent_pr && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              recent PR
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
