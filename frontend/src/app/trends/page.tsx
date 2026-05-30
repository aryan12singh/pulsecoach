"use client";
import { useEffect, useState } from "react";
import { api, handleError } from "@/lib/api";
import type { HealthMetric } from "@/types";
import { fmt } from "@/lib/fmt";
import { Scale, Activity, Bed, Heart, Plus, Check } from "lucide-react";
import { Card, Segmented, Skeleton, Badge, Button, Modal } from "@/components/ui";
import { Field, Input, Select } from "@/components/ui/FormFields";
import Trend from "@/components/ui/Trend";
import LineChart from "@/components/charts/LineChart";
import { toast } from "sonner";
import { LucideIcon } from "lucide-react";

const RANGES = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
];

const TREND_METRICS: Array<{
  key: string; label: string; unit: string; color: string; icon: LucideIcon;
}> = [
  { key: "weight_kg", label: "Weight", unit: "kg", color: "var(--accent-graph)", icon: Scale },
  { key: "bmi", label: "BMI", unit: "", color: "var(--accent-2)", icon: Activity },
  { key: "sleep_hours", label: "Sleep", unit: "h", color: "#9d8bff", icon: Bed },
  { key: "resting_hr", label: "Resting HR", unit: "bpm", color: "var(--success)", icon: Heart },
];

const METRIC_TYPES = [
  { key: "weight_kg", label: "Body weight", unit: "kg" },
  { key: "bmi", label: "BMI", unit: "" },
  { key: "resting_hr", label: "Resting heart rate", unit: "bpm" },
  { key: "sleep_hours", label: "Sleep", unit: "hours" },
];

function trendPct(metrics: HealthMetric[]): number | null {
  if (metrics.length < 2) return null;
  const recent = metrics[metrics.length - 1].value;
  const prev = metrics[Math.max(0, metrics.length - 8)].value;
  if (!prev) return null;
  return Math.round(((recent - prev) / prev) * 100);
}

export default function TrendsPage() {
  const [range, setRange] = useState(30);
  const [metricsByType, setMetricsByType] = useState<Record<string, HealthMetric[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("action") === "add") setShowForm(true);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.metrics.list({ type: "weight_kg", limit: "500" }),
      api.metrics.list({ type: "bmi", limit: "500" }),
      api.metrics.list({ type: "sleep_hours", limit: "500" }),
      api.metrics.list({ type: "resting_hr", limit: "500" }),
    ]).then(([w, b, s, r]) => {
      setMetricsByType({ weight_kg: w, bmi: b, sleep_hours: s, resting_hr: r });
    }).catch((e) => handleError(e, "Failed to load trends")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Trends</h1>
          <p className="text-muted text-sm mt-1.5">Your health metrics over time</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Segmented options={RANGES} value={range} onChange={(v) => setRange(v as number)} />
          <Button icon={Plus} onClick={() => setShowForm(true)}>Add reading</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={280} r={16} />)}
        </div>
      ) : (
        <div className="grid-2 stagger">
          {TREND_METRICS.map((m) => {
            const all = (metricsByType[m.key] || []).slice(-range).map((x) => ({ date: x.date, value: x.value }));
            const trend = trendPct(metricsByType[m.key] || []);
            const latest = all.length ? all[all.length - 1].value : null;
            const invert = m.key !== "sleep_hours";
            const Icon = m.icon;
            return (
              <Card key={m.key}>
                <div className="flex items-center justify-between mb-3.5">
                  <div>
                    <div className="flex items-center gap-2 eyebrow mb-2">
                      <Icon size={14} className="text-faint" />{m.label}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="num text-[28px] font-semibold">
                        {latest == null ? "\u2014" : fmt.num(latest, latest % 1 ? 1 : 0)}
                      </span>
                      <span className="text-muted text-sm">{m.unit}</span>
                      <span className="ml-1"><Trend value={trend} invert={invert} /></span>
                    </div>
                  </div>
                </div>
                <LineChart
                  data={all}
                  height={200}
                  yUnit={" " + m.unit}
                  series={[{ key: "value", color: m.color, label: m.label }]}
                />
              </Card>
            );
          })}
        </div>
      )}

      <MetricFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={load} />
    </div>
  );
}

function MetricFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("weight_kg");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const meta = METRIC_TYPES.find((m) => m.key === type)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setSaving(true);
    try {
      await api.metrics.create({ metric_type: type, value: Number(value), unit: meta.unit });
      toast.success("Metric saved");
      setValue("");
      onClose();
      onSaved();
    } catch {
      toast.error("Failed to save metric");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a health metric"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={submit} disabled={!value || saving}>
            {saving ? "Saving\u2026" : "Save reading"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Field label="Metric">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {METRIC_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label={`Value${meta.unit ? " (" + meta.unit + ")" : ""}`}>
          <Input type="number" step="0.1" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </Field>
      </form>
    </Modal>
  );
}
