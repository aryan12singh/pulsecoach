"use client";
import { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { fmt } from "@/lib/fmt";
import Card from "./ui/Card";
import Trend from "./ui/Trend";
import Sparkline from "./charts/Sparkline";

export interface MetricCardData {
  key: string;
  label: string;
  unit: string;
  icon: LucideIcon;
  value: number | null;
  trend: number | null;
  invert: boolean;
  spark: Array<{ value: number }>;
  dp?: number;
}

interface MetricCardProps {
  d: MetricCardData;
  compact?: boolean;
}

export default function MetricCard({ d, compact }: MetricCardProps) {
  const v = useCountUp(d.value, { dp: d.dp || 0 });
  const Icon = d.icon;

  return (
    <Card hover>
      <div className="flex items-center justify-between" style={{ marginBottom: compact ? 8 : 12 }}>
        <span className="flex items-center gap-2 eyebrow">
          <Icon size={14} className="text-faint" />
          {d.label}
        </span>
        <Trend value={d.trend} invert={d.invert} />
      </div>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="num font-semibold leading-none" style={{ fontSize: compact ? 26 : 32 }}>
            {fmt.num(v, d.dp || 0)}
          </span>
          {d.unit && <span className="text-muted text-sm">{d.unit}</span>}
        </div>
        <Sparkline
          data={d.spark}
          color={d.invert ? "var(--accent-2)" : "var(--accent-graph)"}
          width={compact ? 70 : 92}
          height={compact ? 28 : 34}
        />
      </div>
    </Card>
  );
}
