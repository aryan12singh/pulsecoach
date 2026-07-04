"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WorkoutDetail, WorkoutType } from "@/types";
import { Plus } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { Field, Input, Select } from "@/components/ui/FormFields";
import { toast } from "sonner";

const TYPES: WorkoutType[] = ["strength", "running", "cycling", "walking", "other"];

interface SetRow {
  exercise_name: string;
  reps: string;
  weight: string;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function blank() {
  return {
    workout_type: "strength",
    raw_type: "",
    date: new Date().toISOString().slice(0, 16),
    duration_mins: "45",
    active_calories: "",
    avg_heart_rate: "",
    distance_km: "",
  };
}

function fromWorkout(w: WorkoutDetail) {
  return {
    workout_type: w.workout_type,
    raw_type: w.raw_type ?? "",
    date: toLocalInput(w.start_at),
    duration_mins: String(w.duration_mins),
    active_calories: w.active_calories != null ? String(w.active_calories) : "",
    avg_heart_rate: w.avg_heart_rate != null ? String(w.avg_heart_rate) : "",
    distance_km: w.distance_km != null ? String(w.distance_km) : "",
  };
}

function setsFromWorkout(w: WorkoutDetail): SetRow[] {
  return [...w.strength_sets]
    .sort((a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number)
    .map((s) => ({
      exercise_name: s.exercise_name,
      reps: s.reps != null ? String(s.reps) : "",
      weight: s.weight != null ? String(s.weight) : "",
    }));
}

export default function WorkoutFormModal({
  open,
  onClose,
  onSaved,
  editing = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: WorkoutDetail | null;
}) {
  const [f, setF] = useState(blank());
  const [sets, setSets] = useState<SetRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setF(fromWorkout(editing));
      setSets(setsFromWorkout(editing));
    } else {
      setF(blank());
      setSets([]);
    }
  }, [open, editing]);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const isStrength = f.workout_type === "strength";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        workout_type: f.workout_type,
        raw_type: f.raw_type || null,
        start_at: new Date(f.date).toISOString(),
        end_at: null,
        duration_mins: Number(f.duration_mins),
        active_calories: f.active_calories ? Number(f.active_calories) : null,
        avg_heart_rate: f.avg_heart_rate ? Number(f.avg_heart_rate) : null,
        max_heart_rate: null,
        distance_km: f.distance_km ? Number(f.distance_km) : null,
      };
      // Backend field is `sets`; exercise_order/set_number derived server-side.
      // When editing, always send it so removals persist (replaces all sets).
      const cleaned = sets
        .filter((s) => s.exercise_name)
        .map((s) => ({
          exercise_name: s.exercise_name,
          reps: s.reps ? Number(s.reps) : null,
          weight: s.weight ? Number(s.weight) : null,
        }));
      if (editing) {
        body.sets = isStrength ? cleaned : [];
        await api.workouts.update(editing.id, body);
        toast.success("Workout updated");
      } else {
        if (isStrength && cleaned.length > 0) body.sets = cleaned;
        await api.workouts.create(body);
        toast.success("Workout logged");
      }
      onClose();
      onSaved();
    } catch {
      toast.error(editing ? "Failed to update workout" : "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit workout" : "Log a workout"}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Save workout"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <Select value={f.workout_type} onChange={(e) => set("workout_type", e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </Field>
        <Field label="Name (optional)">
          <Input placeholder="e.g. Push Day" value={f.raw_type} onChange={(e) => set("raw_type", e.target.value)} />
        </Field>
        <Field label="Date & time">
          <Input type="datetime-local" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Duration (min)">
          <Input type="number" min="1" value={f.duration_mins} onChange={(e) => set("duration_mins", e.target.value)} />
        </Field>
        <Field label="Calories (kcal)">
          <Input type="number" placeholder="optional" value={f.active_calories} onChange={(e) => set("active_calories", e.target.value)} />
        </Field>
        <Field label="Avg heart rate (bpm)">
          <Input type="number" placeholder="optional" value={f.avg_heart_rate} onChange={(e) => set("avg_heart_rate", e.target.value)} />
        </Field>
        {!isStrength && (
          <Field label="Distance (km)">
            <Input type="number" step="0.1" placeholder="optional" value={f.distance_km} onChange={(e) => set("distance_km", e.target.value)} />
          </Field>
        )}
        {isStrength && (
          <div className="col-span-2">
            <div className="flex items-center justify-between my-1 mb-2.5">
              <span className="eyebrow">Sets (optional)</span>
              <Button
                size="sm"
                icon={Plus}
                type="button"
                onClick={() => setSets((s) => [...s, { exercise_name: "", reps: "", weight: "" }])}
              >
                Add set
              </Button>
            </div>
            {sets.length === 0 && (
              <p className="text-faint text-xs">No sets added. Add exercise sets to track strength detail.</p>
            )}
            <div className="flex flex-col gap-2">
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Exercise"
                    value={s.exercise_name}
                    onChange={(e) => setSets((prev) => prev.map((x, idx) => idx === i ? { ...x, exercise_name: e.target.value } : x))}
                    style={{ flex: 2 }}
                  />
                  <Input
                    type="number"
                    placeholder="Reps"
                    value={s.reps}
                    onChange={(e) => setSets((prev) => prev.map((x, idx) => idx === i ? { ...x, reps: e.target.value } : x))}
                    style={{ flex: 1 }}
                  />
                  <Input
                    type="number"
                    placeholder="kg"
                    value={s.weight}
                    onChange={(e) => setSets((prev) => prev.map((x, idx) => idx === i ? { ...x, weight: e.target.value } : x))}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    aria-label="Remove set"
                    className="p-2 rounded-md text-muted hover:text-danger hover:bg-surface-2 transition-colors"
                    onClick={() => setSets((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
