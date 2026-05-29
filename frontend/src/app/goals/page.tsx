"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import GoalProgressBar from "@/components/GoalProgressBar";
import type { GoalStatus, Comparison, Window, MetricScope } from "@/types";

const BLANK = {
  goal_type: "",
  metric_scope: "workout" as MetricScope,
  target_value: 0,
  target_unit: "",
  comparison: "gte" as Comparison,
  window: "weekly" as Window,
  deadline: "",
  notes: "",
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalStatus[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

  const load = () => api.goals.list().then(setGoals).catch(() => {});

  useEffect(() => { load(); }, []);

  function field(k: string, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.goals.create({
        ...form,
        target_value: Number(form.target_value),
        deadline: form.deadline || null,
      });
      setForm({ ...BLANK });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    await api.goals.delete(id);
    await load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ Add Goal"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">New Goal</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">Goal type (e.g. sessions_per_week)</span>
              <input required className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm" value={form.goal_type} onChange={(e) => field("goal_type", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Scope</span>
              <select className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.metric_scope} onChange={(e) => field("metric_scope", e.target.value)}>
                <option value="workout">Workout</option>
                <option value="strength">Strength</option>
                <option value="health_metric">Health Metric</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Target value</span>
              <input required type="number" step="any" className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm" value={form.target_value} onChange={(e) => field("target_value", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Unit</span>
              <input required className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm" value={form.target_unit} onChange={(e) => field("target_unit", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Comparison</span>
              <select className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.comparison} onChange={(e) => field("comparison", e.target.value)}>
                <option value="gte">≥ (at least)</option>
                <option value="lte">≤ (at most)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Window</span>
              <select className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.window} onChange={(e) => field("window", e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="all_time">All time</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Deadline (optional)</span>
              <input type="date" className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm" value={form.deadline} onChange={(e) => field("deadline", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Notes</span>
              <input className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={(e) => field("notes", e.target.value)} />
            </label>
          </div>
          <button type="submit" disabled={saving} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save Goal"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.map((g) => (
          <div key={g.id} className="relative">
            <GoalProgressBar goal={g} />
            <button
              onClick={() => remove(g.id)}
              className="absolute top-4 right-4 text-xs text-gray-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {goals.length === 0 && !showForm && (
        <p className="text-gray-500 text-sm">No active goals. Add one to start tracking.</p>
      )}
    </div>
  );
}
