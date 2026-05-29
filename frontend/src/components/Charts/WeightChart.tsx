"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { HealthMetric } from "@/types";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WeightChart({ data }: { data: HealthMetric[] }) {
  const points = data.map((m) => ({ date: fmt(m.date), weight: m.value }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} tickLine={false} />
        <Tooltip formatter={(v: number) => [`${v} kg`, "Weight"]} />
        <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
