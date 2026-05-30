"use client";

interface SparklineProps {
  data: Array<{ value: number } | number>;
  color?: string;
  width?: number;
  height?: number;
  area?: boolean;
}

export default function Sparkline({
  data,
  color = "var(--accent-graph)",
  width = 96,
  height = 32,
  area = true,
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const vals = data.map((d) => (typeof d === "number" ? d : d.value));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (i / (vals.length - 1)) * width;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {area && (
        <path
          d={`${line} L${width},${height} L0,${height} Z`}
          fill={color}
          opacity="0.12"
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(vals.length - 1)}
        cy={y(vals[vals.length - 1])}
        r="2.6"
        fill={color}
      />
    </svg>
  );
}
