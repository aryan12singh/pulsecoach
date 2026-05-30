"use client";
import { Dumbbell, Activity, Scale, Bed, Target, Edit, Trash2 } from "lucide-react";
import type { GoalStatus } from "@/types";
import { fmt } from "@/lib/fmt";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import Ring from "./ui/Ring";
import { LucideIcon } from "lucide-react";

const GOAL_META: Record<string, { label: string; icon: LucideIcon }> = {
  sessions_per_week: { label: "Sessions / week", icon: Dumbbell },
  total_volume_weekly: { label: "Weekly strength volume", icon: Activity },
  weight_target: { label: "Body weight target", icon: Scale },
  sleep_avg_hours: { label: "Average sleep", icon: Bed },
};

export function goalLabel(g: GoalStatus) {
  return GOAL_META[g.goal_type]?.label || g.goal_type.replace(/_/g, " ");
}
export function goalIcon(g: GoalStatus): LucideIcon {
  return GOAL_META[g.goal_type]?.icon || Target;
}

const STATUS_TONE: Record<string, string> = {
  completed: "success",
  ahead: "success",
  on_track: "accent",
  behind: "caution",
};
const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  ahead: "Ahead",
  on_track: "On track",
  behind: "Behind",
};
const TONE_COLOR: Record<string, string> = {
  success: "var(--success)",
  accent: "var(--accent-graph)",
  caution: "var(--caution)",
};

interface GoalCardProps {
  g: GoalStatus;
  onEdit?: (g: GoalStatus) => void;
  onDelete?: (g: GoalStatus) => void;
  compact?: boolean;
}

export default function GoalCard({ g, onEdit, onDelete, compact }: GoalCardProps) {
  const tone = STATUS_TONE[g.status] || "accent";
  const toneColor = TONE_COLOR[tone] || "var(--accent-graph)";
  const dir = g.comparison === "gte" ? "\u2265" : "\u2264";
  const isRange = g.metric_scope === "health_metric";
  const Icon = goalIcon(g);

  const header = (
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2">
        <span className="text-faint"><Icon size={15} /></span>
        <span className="font-display font-semibold text-[15px]">{goalLabel(g)}</span>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              className="p-[7px] rounded-md bg-transparent text-muted hover:text-text hover:bg-surface-2 transition-colors"
              aria-label="Edit goal"
              onClick={() => onEdit(g)}
            >
              <Edit size={15} />
            </button>
          )}
          {onDelete && (
            <button
              className="p-[7px] rounded-md bg-transparent text-muted hover:text-danger hover:bg-surface-2 transition-colors"
              aria-label="Delete goal"
              onClick={() => onDelete(g)}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (isRange) {
    // Bar for range metrics (weight, sleep)
    const pct = Math.min(g.percentage_complete, 115);
    return (
      <Card hover pad>
        {header}
        <div className="flex items-baseline gap-2 my-3">
          <span className="num text-[30px] font-semibold">
            {fmt.num(g.current_value, g.current_value % 1 ? 1 : 0)}
          </span>
          <span className="text-muted text-sm">{g.target_unit}</span>
          <span className="text-muted text-sm ml-auto">
            target {dir} {fmt.num(g.target_value, g.target_value % 1 ? 1 : 0)}
          </span>
        </div>
        <div className="h-2.5 rounded-[6px] bg-ring-track overflow-hidden">
          <div
            className="h-full rounded-[6px] transition-[width] duration-1000"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: toneColor,
              transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)",
            }}
          />
        </div>
        <div className="mt-3">
          <Badge tone={tone} dot>{STATUS_LABEL[g.status]}</Badge>
        </div>
      </Card>
    );
  }

  // Ring for percentage goals
  return (
    <Card hover pad className="flex gap-[18px] items-center">
      <Ring
        value={g.percentage_complete}
        size={compact ? 84 : 96}
        stroke={compact ? 8 : 9}
        color={toneColor}
      >
        <div className="text-center">
          <div className="num font-semibold leading-none" style={{ fontSize: compact ? 19 : 22 }}>
            {g.percentage_complete}<span className="text-xs">%</span>
          </div>
        </div>
      </Ring>
      <div className="flex-1 min-w-0">
        {header}
        <div className="flex items-baseline gap-2 my-1.5">
          <span className="num text-[22px] font-semibold">
            {fmt.num(g.current_value, g.current_value % 1 ? 1 : 0)}
          </span>
          <span className="text-muted text-sm">
            / {dir} {fmt.num(g.target_value, g.target_value % 1 ? 1 : 0)} {g.target_unit}
          </span>
        </div>
        <Badge tone={tone} dot>{STATUS_LABEL[g.status]}</Badge>
      </div>
    </Card>
  );
}

/* Compact goal rows for dashboard sidebar */
export function GoalRingRow({ g }: { g: GoalStatus }) {
  const tone = STATUS_TONE[g.status] || "accent";
  const c = TONE_COLOR[tone] || "var(--accent-graph)";
  const dir = g.comparison === "gte" ? "\u2265" : "\u2264";
  const Icon = goalIcon(g);

  return (
    <div className="flex items-center gap-3">
      <Ring value={g.percentage_complete} size={58} stroke={7} color={c} glow={false}>
        <span className="num text-sm font-semibold">{g.percentage_complete}</span>
      </Ring>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Icon size={14} className="text-faint" />
          <span className="text-sm font-medium">{goalLabel(g)}</span>
        </div>
        <div className="text-muted text-xs">
          {fmt.num(g.current_value)} / {dir} {fmt.num(g.target_value)} {g.target_unit}
        </div>
      </div>
    </div>
  );
}

export function GoalBarRow({ g }: { g: GoalStatus }) {
  const tone = STATUS_TONE[g.status] || "accent";
  const c = TONE_COLOR[tone] || "var(--accent-graph)";
  const dir = g.comparison === "gte" ? "\u2265" : "\u2264";
  const Icon = goalIcon(g);
  const pct = Math.min(g.percentage_complete, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-faint" />
          <span className="text-sm font-medium">{goalLabel(g)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="num text-[17px] font-semibold">
            {fmt.num(g.current_value, g.current_value % 1 ? 1 : 0)}
          </span>
          <span className="text-muted text-xs">{g.target_unit}</span>
        </div>
      </div>
      <div className="h-[9px] rounded-[6px] bg-ring-track overflow-hidden relative">
        <div
          className="h-full rounded-[6px] transition-[width] duration-1000"
          style={{
            width: `${pct}%`,
            background: c,
            transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)",
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <Badge tone={tone} dot>{STATUS_LABEL[g.status]}</Badge>
        <span className="text-faint text-xs">
          target {dir} {fmt.num(g.target_value, g.target_value % 1 ? 1 : 0)} {g.target_unit}
        </span>
      </div>
    </div>
  );
}
