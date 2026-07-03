"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, handleError } from "@/lib/api";
import type { WorkoutDetail as WD, StrengthSet } from "@/types";
import { fmt } from "@/lib/fmt";
import {
  ArrowLeft, ArrowRight, Clock, Flame, Heart, Zap,
  TrendingUp, Activity, Dumbbell, Bike, Footprints, Trash2,
} from "lucide-react";
import { Card, Badge, Skeleton, Button, Modal } from "@/components/ui";
import { LucideIcon } from "lucide-react";
import { toast } from "sonner";

const WORKOUT_ICON: Record<string, LucideIcon> = {
  strength: Dumbbell, running: Footprints, cycling: Bike, walking: Footprints, other: Activity,
};
const WORKOUT_COLOR: Record<string, string> = {
  strength: "var(--accent-graph)", running: "var(--accent-2)", cycling: "#9d8bff",
  walking: "var(--success)", other: "var(--muted)",
};

export default function WorkoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [workout, setWorkout] = useState<WD | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = Number(params.id);
    if (!id) return;
    api.workouts.get(id).then(setWorkout).finally(() => setLoading(false));
  }, [params.id]);

  async function handleDelete() {
    if (!workout) return;
    setDeleting(true);
    try {
      await api.workouts.delete(workout.id);
      toast.success("Workout deleted");
      router.push("/workouts");
    } catch (e) {
      handleError(e, "Failed to delete workout");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-up max-w-[820px]">
        <Skeleton h={360} r={16} />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="animate-fade-up max-w-[820px]">
        <Card>
          <div className="text-center py-10 text-muted">Workout not found</div>
        </Card>
      </div>
    );
  }

  const tone = WORKOUT_COLOR[workout.workout_type] || "var(--muted)";
  const Icon = WORKOUT_ICON[workout.workout_type] || Activity;
  const sets = workout.strength_sets || [];
  const byExercise: Record<string, StrengthSet[]> = {};
  sets.forEach((s) => {
    (byExercise[s.exercise_name] = byExercise[s.exercise_name] || []).push(s);
  });
  const volume = sets.reduce((s, x) => s + (x.reps || 0) * (x.weight || 0), 0);

  return (
    <div className="animate-fade-up max-w-[820px]">
      <Link href="/workouts" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text transition-colors mb-[18px]">
        <ArrowLeft size={16} /> Workouts
      </Link>

      <div className="flex flex-col gap-[18px] stagger">
        <Card>
          <div className="flex items-center gap-4 mb-[22px]">
            <span
              className="w-[54px] h-[54px] rounded-[15px] flex-none grid place-items-center"
              style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}
            >
              <Icon size={26} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-semibold text-h2 capitalize">
                  {workout.raw_type || workout.workout_type}
                </h1>
                {workout.has_strength_detail && <Badge tone="accent">strength</Badge>}
              </div>
              <p className="text-muted text-sm mt-1">{fmt.dateTime(workout.start_at)} &middot; {workout.source.replace("_", " ")}</p>
            </div>
            <button
              aria-label="Delete workout"
              className="p-2 rounded-md text-muted hover:text-danger hover:bg-surface-2 transition-colors"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
            <DetailStat icon={Clock} label="Duration" value={Math.round(workout.duration_mins)} unit="min" />
            {workout.active_calories != null && <DetailStat icon={Flame} label="Calories" value={Math.round(workout.active_calories)} unit="kcal" />}
            {workout.avg_heart_rate != null && <DetailStat icon={Heart} label="Avg HR" value={Math.round(workout.avg_heart_rate)} unit="bpm" />}
            {workout.max_heart_rate != null && <DetailStat icon={Zap} label="Max HR" value={Math.round(workout.max_heart_rate)} unit="bpm" />}
            {workout.distance_km != null && <DetailStat icon={TrendingUp} label="Distance" value={Number(workout.distance_km.toFixed(1))} unit="km" />}
            {volume > 0 && <DetailStat icon={Activity} label="Volume" value={volume} unit={"kg\u00B7r"} />}
          </div>
        </Card>

        {workout.has_strength_detail && sets.length > 0 && (
          <Card>
            <span className="eyebrow mb-3.5 block">Sets</span>
            <div className="flex flex-col gap-[18px]">
              {Object.keys(byExercise).map((name) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-semibold text-sm">{name}</span>
                    <Link href={`/analytics?exercise=${encodeURIComponent(name)}`}>
                      <button className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text transition-colors">
                        Progression <ArrowRight size={14} />
                      </button>
                    </Link>
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Set", "Reps", "Weight", "RPE", ""].map((h) => (
                          <th key={h} className="text-left text-xs uppercase tracking-[0.08em] text-faint font-semibold px-3 pb-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byExercise[name].map((s) => (
                        <tr key={s.id} className="hover:bg-surface-2">
                          <td className="px-3 py-[11px] border-t border-border text-sm num text-muted">{s.set_number}</td>
                          <td className="px-3 py-[11px] border-t border-border text-sm num">{s.reps ?? "\u2014"}</td>
                          <td className="px-3 py-[11px] border-t border-border text-sm num">{s.weight != null ? `${s.weight} ${s.weight_unit}` : "\u2014"}</td>
                          <td className="px-3 py-[11px] border-t border-border text-sm num text-muted">{s.rpe ?? "\u2014"}</td>
                          <td className="px-3 py-[11px] border-t border-border text-sm">{s.is_warmup && <Badge>warm-up</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete workout?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-muted text-sm">
          This permanently removes the workout{sets.length > 0 ? ` and its ${sets.length} sets` : ""}.
          If it came from an integration, re-syncing or re-importing will bring it back.
        </p>
      </Modal>
    </div>
  );
}

function DetailStat({ icon: Icon, label, value, unit }: { icon: LucideIcon; label: string; value: number; unit: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 eyebrow mb-2">
        <Icon size={13} className="text-faint" />{label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="num text-[24px] font-semibold">{fmt.num(value)}</span>
        <span className="text-muted text-xs">{unit}</span>
      </div>
    </div>
  );
}
