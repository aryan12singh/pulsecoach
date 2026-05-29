"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import WorkoutList from "@/components/WorkoutList";
import type { Workout, WorkoutType, Source } from "@/types";

const TYPES: WorkoutType[] = ["strength", "running", "cycling", "walking", "other"];
const SOURCES: Source[] = ["apple_health", "hevy", "manual"];

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: "100" };
    if (type) params.type = type;
    if (source) params.source = source;
    api.workouts.list(params).then(setWorkouts).finally(() => setLoading(false));
  }, [type, source]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Workouts</h1>

      <div className="flex gap-3 flex-wrap">
        <select
          className="border rounded-lg px-3 py-2 text-sm bg-white"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm bg-white"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : (
          <WorkoutList workouts={workouts} />
        )}
      </div>
    </div>
  );
}
