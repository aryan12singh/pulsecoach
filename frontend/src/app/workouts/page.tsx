"use client";
import { useEffect, useState, useMemo } from "react";
import { api, handleError } from "@/lib/api";
import type { Workout, WorkoutType, Source } from "@/types";
import { Plus, Dumbbell } from "lucide-react";
import { Card, Segmented, Skeleton, Button, EmptyState } from "@/components/ui";
import { Select } from "@/components/ui/FormFields";
import WorkoutRow from "@/components/WorkoutRow";
import WorkoutFormModal from "@/components/WorkoutFormModal";

const TYPES: WorkoutType[] = ["strength", "running", "cycling", "walking", "other"];
const SOURCES: Source[] = ["apple_health", "hevy", "strava", "manual"];

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
    api.workouts.list(params).then(setWorkouts).catch((e) => handleError(e, "Failed to load workouts")).finally(() => setLoading(false));
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
