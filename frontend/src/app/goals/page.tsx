"use client";
import { useEffect, useState, useMemo } from "react";
import { api, handleError } from "@/lib/api";
import type { GoalStatus, Comparison, Window, MetricScope } from "@/types";
import { Plus, Target, Check, Activity, Trash2 } from "lucide-react";
import { Card, Skeleton, Button, Modal, EmptyState } from "@/components/ui";
import { Field, Input, Select } from "@/components/ui/FormFields";
import Stat from "@/components/ui/Stat";
import GoalCard, { goalLabel } from "@/components/GoalCard";
import { toast } from "sonner";

const GOAL_TYPES = [
  { key: "sessions_per_week", label: "Sessions / week", scope: "workout" as MetricScope, unit: "sessions", cmp: "gte" as Comparison, window: "weekly" as Window },
  { key: "total_volume_weekly", label: "Weekly strength volume", scope: "strength" as MetricScope, unit: "kg\u00B7reps", cmp: "gte" as Comparison, window: "weekly" as Window },
  { key: "weight_target", label: "Body weight target", scope: "health_metric" as MetricScope, unit: "kg", cmp: "lte" as Comparison, window: "all_time" as Window },
  { key: "sleep_avg_hours", label: "Average sleep", scope: "health_metric" as MetricScope, unit: "hrs", cmp: "gte" as Comparison, window: "weekly" as Window },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GoalStatus | null>(null);
  const [confirm, setConfirm] = useState<GoalStatus | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("action") === "new" || p.get("action") === "add") setShowForm(true);
  }, []);

  const load = () => {
    setLoading(true);
    api.goals.list().then(setGoals).catch((e) => handleError(e, "Failed to load goals")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const done = goals.filter((g) => g.status === "completed").length;
    const avg = goals.length ? Math.round(goals.reduce((s, g) => s + g.percentage_complete, 0) / goals.length) : 0;
    return { done, avg, total: goals.length };
  }, [goals]);

  function openEdit(g: GoalStatus) {
    setEditing(g);
    setShowForm(true);
  }

  async function handleDelete() {
    if (!confirm) return;
    try {
      await api.goals.delete(confirm.id);
      toast.success("Goal deleted");
      setConfirm(null);
      load();
    } catch {
      toast.error("Failed to delete goal");
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Goals</h1>
          <p className="text-muted text-sm mt-1.5">Targets across training, strength & health</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setShowForm(true); }}>Add goal</Button>
      </div>

      {loading ? (
        <div className="grid-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={150} r={16} />)}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="No active goals"
            body="Set a target to start tracking your progress — sessions per week, strength volume, body weight, or sleep."
            action={<Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setShowForm(true); }}>Add your first goal</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid-3 mb-5">
            <Card><Stat label="Active goals" value={summary.total} icon={Target} animate={false} /></Card>
            <Card><Stat label="Completed" value={summary.done} icon={Check} animate={false} /></Card>
            <Card><Stat label="Avg progress" value={summary.avg} unit="%" icon={Activity} /></Card>
          </div>
          <div className="grid-2 stagger">
            {goals.map((g) => (
              <GoalCard key={g.id} g={g} onEdit={openEdit} onDelete={setConfirm} />
            ))}
          </div>
        </>
      )}

      <GoalFormModal
        open={showForm}
        editing={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={load}
      />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Delete goal?"
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-muted text-sm">
          This will remove &ldquo;{confirm && goalLabel(confirm)}&rdquo; from your tracked goals. You can always create it again.
        </p>
      </Modal>
    </div>
  );
}

/* ---------- Goal form modal ---------- */
function GoalFormModal({ open, editing, onClose, onSaved }: {
  open: boolean;
  editing: GoalStatus | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState(init(null));
  const [saving, setSaving] = useState(false);

  function init(ed: GoalStatus | null) {
    if (ed) return {
      goal_type: ed.goal_type,
      target_value: String(ed.target_value),
      target_unit: ed.target_unit,
      comparison: ed.comparison,
      window: ed.window,
      metric_scope: ed.metric_scope,
      deadline: ed.deadline || "",
      notes: ed.notes || "",
    };
    const d = GOAL_TYPES[0];
    return {
      goal_type: d.key,
      target_value: "",
      target_unit: d.unit,
      comparison: d.cmp,
      window: d.window,
      metric_scope: d.scope,
      deadline: "",
      notes: "",
    };
  }

  useEffect(() => {
    if (open) setF(init(editing));
  }, [open, editing]);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  function pickType(key: string) {
    const d = GOAL_TYPES.find((g) => g.key === key)!;
    setF((s) => ({ ...s, goal_type: key, target_unit: d.unit, comparison: d.cmp, window: d.window, metric_scope: d.scope }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.target_value) return;
    setSaving(true);
    try {
      const body = {
        goal_type: f.goal_type,
        metric_scope: f.metric_scope,
        target_value: Number(f.target_value),
        target_unit: f.target_unit,
        comparison: f.comparison,
        window: f.window,
        deadline: f.deadline || null,
        notes: f.notes || null,
      };
      if (editing) {
        await api.goals.update(editing.id, body);
        toast.success("Goal updated");
      } else {
        await api.goals.create(body);
        toast.success("Goal created");
      }
      onClose();
      onSaved();
    } catch {
      toast.error("Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit goal" : "New goal"}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={submit} disabled={!f.target_value || saving}>
            {saving ? "Saving\u2026" : editing ? "Save changes" : "Create goal"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Goal type">
            <Select value={f.goal_type} onChange={(e) => pickType(e.target.value)} disabled={!!editing}>
              {GOAL_TYPES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Target value">
          <Input type="number" step="any" autoFocus value={f.target_value} onChange={(e) => set("target_value", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Unit">
          <Input value={f.target_unit} onChange={(e) => set("target_unit", e.target.value)} />
        </Field>
        <Field label="Comparison">
          <Select value={f.comparison} onChange={(e) => set("comparison", e.target.value)}>
            <option value="gte">&ge; at least</option>
            <option value="lte">&le; at most</option>
          </Select>
        </Field>
        <Field label="Window">
          <Select value={f.window} onChange={(e) => set("window", e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="all_time">All time</option>
          </Select>
        </Field>
        <Field label="Deadline (optional)">
          <Input type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Summer cut" />
        </Field>
      </form>
    </Modal>
  );
}
