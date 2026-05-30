import { ReactNode } from "react";

const toneClasses: Record<string, string> = {
  accent: "bg-accent-soft text-accent-graph border-transparent",
  success: "bg-success-soft text-success border-transparent",
  caution: "bg-caution-soft text-caution border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

interface BadgeProps {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
  className?: string;
}

export default function Badge({ children, tone = "", dot = false, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.02em] px-2.5 py-1 rounded-full border ${
        toneClasses[tone] || "bg-surface-2 text-muted border-border"
      } ${className}`}
    >
      {dot && <span className="w-[7px] h-[7px] rounded-full bg-current" />}
      {children}
    </span>
  );
}
