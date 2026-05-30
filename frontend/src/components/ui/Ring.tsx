"use client";
import { ReactNode } from "react";
import { useCountUp } from "@/hooks/useCountUp";

interface RingProps {
  value?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: string;
  sublabel?: string;
  children?: ReactNode;
  cap?: number;
  glow?: boolean;
}

export default function Ring({
  value = 0,
  size = 132,
  stroke = 11,
  color = "var(--accent-graph)",
  track = "var(--ring-track)",
  label,
  sublabel,
  children,
  cap = 100,
  glow = true,
}: RingProps) {
  const pct = useCountUp(Math.min(value, cap), { dur: 1100 });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(pct, cap) / 100;
  const off = c * (1 - frac);
  const over = value > 100;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", display: "block" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--success)" : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{
            filter: glow
              ? `drop-shadow(0 0 8px ${over ? "var(--success-soft)" : "var(--accent-glow)"})`
              : "none",
            transition: "stroke 0.4s",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {children || (
          <div>
            <div
              className="num"
              style={{
                fontSize: size * 0.22,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {Math.round(pct)}
              <span style={{ fontSize: size * 0.12 }}>%</span>
            </div>
            {label && <div className="eyebrow mt-1">{label}</div>}
            {sublabel && (
              <div className="text-muted text-xs mt-0.5">{sublabel}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
