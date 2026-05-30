"use client";
import { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { fmt } from "@/lib/fmt";
import Trend from "./Trend";

interface StatProps {
  label: string;
  value: number | string | null;
  unit?: string;
  trend?: number | null;
  invertTrend?: boolean;
  icon?: LucideIcon;
  animate?: boolean;
  dp?: number;
  big?: boolean;
}

export default function Stat({
  label,
  value,
  unit,
  trend,
  invertTrend,
  icon: Icon,
  animate = true,
  dp = 0,
  big = false,
}: StatProps) {
  const numeric = typeof value === "number";
  const shown = animate && numeric ? useCountUp(value, { dp }) : value;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <span className="text-faint"><Icon size={15} /></span>}
        <span className="eyebrow">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="num" style={{ fontSize: big ? 40 : 28, fontWeight: 600, lineHeight: 1 }}>
          {numeric ? fmt.num(shown as number, dp) : (value ?? "\u2014")}
        </span>
        {unit && <span className="text-muted text-sm font-medium">{unit}</span>}
        {trend !== undefined && trend !== null && (
          <span className="ml-auto">
            <Trend value={trend} invert={invertTrend} />
          </span>
        )}
      </div>
    </div>
  );
}
