"use client";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { Workout, WorkoutType, Source } from "@/types";
import { Plus, Dumbbell } from "lucide-react";
import { Card, Segmented, Skeleton, Button, Modal, EmptyState } from "@/components/ui";
import { Field, Input, Select } from "@/components/ui/FormFields";
import WorkoutRow from "@/components/WorkoutRow";
import { toast } from "sonner";

const TYPES: WorkoutType[] = ["strength", "running", "cycling", "walking", "other"];
const SOURCES: Source[] = ["apple_health", "hevy", "manual"];

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("action") === "log") setShowForm(true);
  }, []);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { limit: "100" };
    if (type) params.type = type;
    if (source) params.source = source;
    api.workouts.list(params).then(setWorkouts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [type, source]);

  const filtered = useMemo(
    () => workouts.filter((w) => (!type || w.workout_type === type) && (!source || w.source === source)),
    [workouts, type, source]
  );

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Workouts</h1>
          <p className="text-muted text-sm mt-1.5">{workouts.length} sessions logged</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>Log workout</Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-[18px]">
        <Segmented
          options={[
            { value: "", label: "All" },
            ...TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })),
          ]}
          value={type}
          onChange={(v) => setType(v as string)}
        />
        <Select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
      </div>

      {loading ? (
        <Card>
          <div className="flex flex-col gap-3.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton w="42px" h={42} r={12} />
                <div className="flex-1">
                  <Skeleton w="40%" h={14} style={{ marginBottom: 8 }} />
                  <Skeleton w="24%" h={11} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="No workouts match"
            body="Try clearing a filter, or log a new session."
            action={<Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>Log workout</Button>}
          />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col">
            {filtered.map((w) => <WorkoutRow key={w.id} w={w} />)}
          </div>
        </Card>
      )}

      <WorkoutFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={load} />
    </div>
  );
}

/* ---------- Workout form modal ---------- */
function WorkoutFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(blank());
  const [sets, setSets] = useState<Array<{ exercise_name: string; reps: string; weight: string }>>([]);
  const [saving, setSaving] = useState(false);

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
      if (isStrength && sets.length > 0) {
        body.strength_sets = sets.filter((s) => s.exercise_name).map((s, i) => ({
          exercise_name: s.exercise_name,
          set_number: i + 1,
          reps: s.reps ? Number(s.reps) : null,
          weight: s.weight ? Number(s.weight) : null,
        }));
      }
      await api.workouts.create(body);
      toast.success("Workout logged");
      setF(blank());
      setSets([]);
      onClose();
      onSaved();
    } catch {
      toast.error("Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a workout"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving\u2026" : "Save workout"}
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
