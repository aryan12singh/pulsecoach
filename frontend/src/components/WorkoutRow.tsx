"use client";
import Link from "next/link";
import { Dumbbell, Bike, Footprints, Activity, Clock, Flame, TrendingUp, ChevronRight } from "lucide-react";
import type { Workout } from "@/types";
import { fmt } from "@/lib/fmt";
import Badge from "./ui/Badge";
import { LucideIcon } from "lucide-react";

const WORKOUT_ICON: Record<string, LucideIcon> = {
  strength: Dumbbell,
  running: Footprints,
  cycling: Bike,
  walking: Footprints,
  other: Activity,
};

const WORKOUT_COLOR: Record<string, string> = {
  strength: "var(--accent-graph)",
  running: "var(--accent-2)",
  cycling: "#9d8bff",
  walking: "var(--success)",
  other: "var(--muted)",
};

export default function WorkoutRow({ w }: { w: Workout }) {
  const tone = WORKOUT_COLOR[w.workout_type] || "var(--muted)";
  const Icon = WORKOUT_ICON[w.workout_type] || Activity;

  return (
    <Link
      href={`/workouts/${w.id}`}
      className="flex items-center gap-4 w-full text-left p-2 rounded-lg transition-colors hover:bg-surface-2"
    >
      <span
        className="w-[42px] h-[42px] rounded-lg flex-none grid place-items-center"
        style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}
      >
        <Icon size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">
            {w.raw_type || w.workout_type}
          </span>
          {w.has_strength_detail && <Badge>strength</Badge>}
        </div>
        <div className="text-muted text-xs mt-0.5">
          {fmt.relDay(w.start_at)} &middot; {w.source.replace("_", " ")}
        </div>
      </div>
      <div className="flex items-center gap-5 flex-none">
        <MiniMetric icon={Clock} value={Math.round(w.duration_mins)} unit="min" />
        {w.active_calories != null && (
          <MiniMetric icon={Flame} value={Math.round(w.active_calories)} unit="kcal" />
        )}
        {w.distance_km != null && (
          <span className="hide-sm">
            <MiniMetric icon={TrendingUp} value={Number(w.distance_km.toFixed(1))} unit="km" />
          </span>
        )}
        <ChevronRight size={16} className="text-faint" />
      </div>
    </Link>
  );
}

function MiniMetric({ icon: Icon, value, unit }: { icon: LucideIcon; value: number; unit: string }) {
  return (
    <div className="flex items-center gap-1 text-muted">
      <Icon size={13} className="text-faint" />
      <span className="num font-semibold text-sm text-text">{value}</span>
      <span className="text-xs">{unit}</span>
    </div>
  );
}
