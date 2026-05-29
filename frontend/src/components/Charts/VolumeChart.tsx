"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Workout } from "@/types";

interface WeekData {
  week: string;
  volume: number;
  sessions: number;
}

function getWeek(dt: string) {
  const d = new Date(dt);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function VolumeChart({ workouts }: { workouts: Workout[] }) {
  const byWeek: Record<string, WeekData> = {};
  for (const w of workouts) {
    const wk = getWeek(w.start_at);
    if (!byWeek[wk]) byWeek[wk] = { week: wk, volume: 0, sessions: 0 };
    byWeek[wk].sessions += 1;
    byWeek[wk].volume += w.active_calories ?? 0;
  }
  const points = Object.values(byWeek).slice(-8);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} />
        <Tooltip formatter={(v: number) => [`${Math.round(v)} kcal`, "Calories"]} />
        <Bar dataKey="volume" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
