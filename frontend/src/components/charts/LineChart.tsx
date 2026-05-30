"use client";
import { useState, useRef, useEffect } from "react";
import { fmt } from "@/lib/fmt";
import EmptyState from "@/components/ui/EmptyState";
import { TrendingUp } from "lucide-react";

interface Series {
  key: string;
  color: string;
  label?: string;
}

interface LineChartProps {
  data: Record<string, unknown>[];
  series?: Series[];
  height?: number;
  xKey?: string;
  area?: boolean;
  yUnit?: string;
  animate?: boolean;
}

function useMeasure() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, n = 4) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step)
    ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export default function LineChart({
  data,
  series,
  height = 220,
  xKey = "date",
  area = true,
  yUnit = "",
  animate = true,
}: LineChartProps) {
  const [ref, W] = useMeasure();
  const series_ = series || [{ key: "value", color: "var(--accent-graph)" }];
  const H = height;
  const padL = 38, padR = 14, padT = 14, padB = 26;
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(!animate);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 30);
    return () => clearTimeout(t);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div ref={ref} style={{ height }}>
        <EmptyState icon={TrendingUp} title="No data yet" body="Log readings to see this trend." />
      </div>
    );
  }

  const all: number[] = [];
  series_.forEach((s) =>
    data.forEach((d) => {
      const v = d[s.key];
      if (v != null && !isNaN(v as number)) all.push(v as number);
    })
  );
  let min = Math.min(...all);
  let max = Math.max(...all);
  const ticks = niceTicks(min, max, 4);
  min = ticks[0];
  max = ticks[ticks.length - 1];
  const plotW = Math.max(W - padL - padR, 10);
  const plotH = H - padT - padB;
  const x = (i: number) =>
    padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) =>
    padT + plotH - ((v - min) / (max - min || 1)) * plotH;

  const linePath = (key: string) =>
    data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[key] as number)}`).join(" ");
  const areaPath = (key: string) =>
    `${linePath(key)} L${x(data.length - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z`;

  const hd = hover != null ? data[hover] : null;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0, bd = Infinity;
          data.forEach((_, i) => {
            const dd = Math.abs(x(i) - px);
            if (dd < bd) { bd = dd; best = i; }
          });
          setHover(best);
        }}
      >
        <defs>
          {series_.map((s, si) => (
            <linearGradient key={si} id={`grad-${si}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL} x2={W - padR} y1={y(t)} y2={y(t)}
              stroke="var(--grid)" strokeWidth="1"
            />
            <text
              x={padL - 8} y={y(t) + 4}
              textAnchor="end" fontSize="10" fill="var(--faint)" fontFamily="var(--font-body)"
            >
              {fmt.num(t, t % 1 ? 1 : 0)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) ? (
            <text
              key={i} x={x(i)} y={H - 8}
              textAnchor="middle" fontSize="10" fill="var(--faint)" fontFamily="var(--font-body)"
            >
              {fmt.date(d[xKey] as string)}
            </text>
          ) : null
        )}
        {series_.map((s, si) => (
          <g key={si}>
            {area && (
              <path
                d={areaPath(s.key)}
                fill={`url(#grad-${si}-${s.key})`}
                opacity={drawn ? 1 : 0}
                style={{ transition: "opacity 0.6s ease 0.3s" }}
              />
            )}
            <path
              d={linePath(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={drawn ? 0 : 1}
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </g>
        ))}
        {hd && series_.map((s, si) => {
          const val = hd[s.key];
          return val != null ? (
            <circle
              key={si}
              cx={x(hover!)}
              cy={y(val as number)}
              r="4.5"
              fill="var(--surface)"
              stroke={s.color}
              strokeWidth="2.5"
            />
          ) : null;
        })}
        {hd && (
          <line
            x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + plotH}
            stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3"
          />
        )}
      </svg>
      {hd && (
        <div
          className="absolute top-1.5 pointer-events-none bg-surface-3 border border-border-strong rounded-[10px] px-2.5 py-[7px] shadow-card whitespace-nowrap"
          style={{
            left: `${Math.min(Math.max((x(hover!) / W) * 100, 8), 78)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="text-faint text-[10px] mb-0.5">
            {fmt.date(hd[xKey] as string, { weekday: "short", month: "short", day: "numeric" })}
          </div>
          {series_.map((s, si) => {
            const val = hd[s.key] as number;
            return (
              <div key={si} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-muted">{s.label || ""}</span>
                <span className="num font-semibold ml-auto">
                  {fmt.num(val, val % 1 ? 1 : 0)}{yUnit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
