"use client";
import { ArrowUp, ArrowDown } from "lucide-react";

interface TrendProps {
  value: number | null | undefined;
  invert?: boolean;
  suffix?: string;
}

export default function Trend({ value, invert = false, suffix = "%" }: TrendProps) {
  if (value == null || isNaN(value))
    return <span className="text-faint text-xs">{"\u2014"}</span>;

  const up = value > 0;
  const good = invert ? !up : up;
  const color =
    value === 0
      ? "text-faint"
      : good
      ? "text-success"
      : "text-danger";

  return (
    <span className={`flex items-center gap-0.5 text-xs font-bold ${color}`}>
      {value !== 0 &&
        (up ? <ArrowUp size={13} strokeWidth={2.6} /> : <ArrowDown size={13} strokeWidth={2.6} />)}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}
