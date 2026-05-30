"use client";
import { useState, useRef, useEffect } from "react";
import { fmt } from "@/lib/fmt";
import EmptyState from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";

interface BarChartProps {
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  height?: number;
  color?: string;
  horizontal?: boolean;
  unit?: string;
  fmtVal?: (v: number) => string;
}

export default function BarChart({
  data,
  xKey = "label",
  yKey = "value",
  height = 220,
  color = "var(--accent-graph)",
  horizontal = false,
  unit = "",
  fmtVal,
}: BarChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 40);
    return () => clearTimeout(t);
  }, []);

  if (!data || !data.length)
    return <div ref={ref}><EmptyState icon={BarChart3} title="No data" /></div>;

  const max = Math.max(...data.map((d) => d[yKey] as number), 1);

  if (horizontal) {
    return (
      <div ref={ref} className="flex flex-col gap-3.5">
        {data.map((d, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">{d[xKey] as string}</span>
              <span className="num text-muted text-xs">
                {fmtVal ? fmtVal(d[yKey] as number) : fmt.num(d[yKey] as number)}{unit}
              </span>
            </div>
            <div className="h-[9px] rounded-[6px] bg-ring-track overflow-hidden">
              <div
                className="h-full rounded-[6px] transition-all duration-[900ms]"
                style={{
                  width: drawn ? `${((d[yKey] as number) / max) * 100}%` : 0,
                  background: color,
                  transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)",
                  transitionDelay: `${i * 0.06}s`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const H = height;
  const padB = 26, padT = 10, plotH = H - padB - padT;
  const gap = 0.36, n = data.length, bw = (W / n) * (1 - gap);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {data.map((d, i) => {
          const h = ((d[yKey] as number) / max) * plotH;
          const cx = (i + 0.5) * (W / n);
          return (
            <g key={i}>
              <rect
                x={cx - bw / 2}
                y={padT + plotH - (drawn ? h : 0)}
                width={bw}
                height={drawn ? h : 0}
                rx="5"
                fill={(d as Record<string, unknown>).color as string || color}
                style={{
                  transition: `all 0.8s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.05}s`,
                }}
              />
              <text
                x={cx} y={H - 8}
                textAnchor="middle" fontSize="10" fill="var(--faint)" fontFamily="var(--font-body)"
              >
                {d[xKey] as string}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
