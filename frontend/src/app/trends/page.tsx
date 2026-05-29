"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import WeightChart from "@/components/Charts/WeightChart";
import SleepChart from "@/components/Charts/SleepChart";
import type { HealthMetric } from "@/types";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export default function TrendsPage() {
  const [range, setRange] = useState(30);
  const [weight, setWeight] = useState<HealthMetric[]>([]);
  const [bmi, setBmi] = useState<HealthMetric[]>([]);
  const [sleep, setSleep] = useState<HealthMetric[]>([]);
  const [hr, setHr] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const from = daysAgo(range);
    const p = { from, limit: "500" };
    Promise.all([
      api.metrics.list({ ...p, type: "weight_kg" }),
      api.metrics.list({ ...p, type: "bmi" }),
      api.metrics.list({ ...p, type: "sleep_hours" }),
      api.metrics.list({ ...p, type: "resting_hr" }),
    ]).then(([w, b, s, r]) => {
      setWeight(w); setBmi(b); setSleep(s); setHr(r);
    }).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trends</h1>
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

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Weight (kg)">
            <WeightChart data={weight} />
          </ChartCard>
          <ChartCard title="BMI">
            <WeightChart data={bmi} />
          </ChartCard>
          <ChartCard title="Sleep (hrs)">
            <SleepChart data={sleep} />
          </ChartCard>
          <ChartCard title="Resting HR (bpm)">
            <WeightChart data={hr} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>
      {children}
    </div>
  );
}
