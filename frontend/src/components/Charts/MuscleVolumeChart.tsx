"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { MuscleVolume } from "@/types";

export default function MuscleVolumeChart({ data }: { data: MuscleVolume[] }) {
  const points = data.map((m) => ({
    muscle: m.muscle_group,
    volume: Math.round(m.total_volume),
  }));

  if (!points.length)
    return <p className="text-gray-400 text-sm">No strength volume in this window.</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={points} layout="vertical" margin={{ top: 4, right: 16, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis type="category" dataKey="muscle" tick={{ fontSize: 12 }} tickLine={false} width={70} className="capitalize" />
        <Tooltip formatter={(v: number) => [`${v.toLocaleString()} kg·reps`, "Volume"]} />
        <Bar dataKey="volume" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
