"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import type { HealthMetric } from "@/types";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SleepChart({ data }: { data: HealthMetric[] }) {
  const points = data.map((m) => ({ date: fmt(m.date), sleep: m.value }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} tickLine={false} />
        <Tooltip formatter={(v: number) => [`${v} hrs`, "Sleep"]} />
        <ReferenceLine y={7} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Goal", fontSize: 10 }} />
        <Bar dataKey="sleep" fill="#818cf8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
