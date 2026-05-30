"use client";
import { useEffect, useState } from "react";
import { api, handleError } from "@/lib/api";
import type { AppConfig, AnalyticsSummary, StrengthProgressPoint } from "@/types";
import { fmt } from "@/lib/fmt";
import { Trophy, Dumbbell, Activity, ShieldCheck, BarChart3 } from "lucide-react";
import { Card, Segmented, Skeleton, Badge, EmptyState } from "@/components/ui";
import { Select } from "@/components/ui/FormFields";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";

const RANGES = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1y" },
];

const SEV_TONE: Record<string, "success" | "caution" | "danger"> = {
  ok: "success",
  caution: "caution",
  high: "danger",
};
const SEV_LABEL: Record<string, string> = {
  ok: "OK",
  caution: "Watch",
  high: "Alert",
};
const SEV_COLOR: Record<string, string> = {
  ok: "var(--success)",
  caution: "var(--caution)",
  high: "var(--danger)",
};

export default function AnalyticsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState("");
  const [metric, setMetric] = useState<"top_weight" | "total_volume">("top_weight");
  const [prog, setProg] = useState<StrengthProgressPoint[]>([]);
  const [progLoading, setProgLoading] = useState(false);

  useEffect(() => {
    api.config().then(setConfig).catch((e) => handleError(e, "Failed to load config")).finally(() => setConfigLoading(false));
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ex = p.get("exercise");
    if (ex) setExercise(ex);
  }, []);

  useEffect(() => {
    if (!config?.analytics_enabled) return;
    setLoading(true);
    api.analytics.summary(range).then(setData).catch((e) => handleError(e, "Failed to load analytics")).finally(() => setLoading(false));
  }, [range, config]);

  // Derive exercise names from PRs
  const exerciseNames = data?.prs.map((p) => p.exercise_name) || [];

  // Auto-select first exercise
  useEffect(() => {
    if (!exercise && exerciseNames.length > 0) setExercise(exerciseNames[0]);
  }, [data]);

  // Load progression when exercise changes
  useEffect(() => {
    if (!exercise) return;
    setProgLoading(true);
    api.strength.progress(exercise).then(setProg).catch((e) => { handleError(e, "Failed to load strength progression"); setProg([]); }).finally(() => setProgLoading(false));
  }, [exercise]);

  if (configLoading) {
    return (
      <div className="animate-fade-up">
        <div className="mb-6">
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Analytics</h1>
        </div>
        <div className="grid-2-1">
          <Skeleton h={320} r={16} />
          <Skeleton h={320} r={16} />
        </div>
      </div>
    );
  }

  if (!config?.analytics_enabled) {
    return (
      <div className="animate-fade-up">
        <div className="mb-6">
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Analytics</h1>
        </div>
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Analytics disabled"
            body="Contact your admin to enable analytics."
          />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-up">
        <div className="mb-6">
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Analytics</h1>
        </div>
        <div className="grid-2-1">
          <Skeleton h={320} r={16} />
          <Skeleton h={320} r={16} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const muscleData = data.muscle_volume.map((m) => ({
    label: m.muscle_group,
    value: m.total_volume,
  }));

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Analytics</h1>
          <p className="text-muted text-sm mt-1.5">Personal records, training load & strength progression</p>
        </div>
        <Segmented options={RANGES} value={range} onChange={(v) => setRange(v as number)} />
      </div>

      {/* Training load flags */}
      <span className="eyebrow block mb-3">Training load & recovery</span>
      <div className="grid-4 stagger mb-7">
        {data.overtraining.length === 0 ? (
          <Card><EmptyState icon={ShieldCheck} title="Not enough data" body="Keep training to see load analysis." /></Card>
        ) : (
          data.overtraining.map((f) => {
            const c = SEV_COLOR[f.level] || "var(--muted)";
            return (
              <Card
                key={f.metric}
                style={{
                  borderColor: f.level !== "ok" ? `color-mix(in srgb, ${c} 40%, var(--border))` : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="eyebrow" style={{ maxWidth: 130, lineHeight: 1.4 }}>
                    {f.metric.replace(/_/g, " ")}
                  </span>
                  <Badge tone={SEV_TONE[f.level]} dot>
                    {SEV_LABEL[f.level]}
                  </Badge>
                </div>
                <div className="num text-[30px] font-semibold mb-2">
                  {typeof f.value === "number" ? fmt.num(f.value, f.value % 1 ? 1 : 0) : f.value}
                </div>
                <p className="text-muted text-xs leading-relaxed">{f.message}</p>
              </Card>
            );
          })
        )}
      </div>

      {/* Progression + muscle volume */}
      <div className="grid-2-1 mb-7">
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <span className="font-display font-semibold text-[15px]">Strength progression</span>
            <div className="flex items-center gap-2 flex-wrap">
              {exerciseNames.length > 0 && (
                <Select
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                  style={{ width: "auto" }}
                >
                  {exerciseNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              )}
              <Segmented
                options={[
                  { value: "top_weight", label: "Top set" },
                  { value: "total_volume", label: "Volume" },
                ]}
                value={metric}
                onChange={(v) => setMetric(v as "top_weight" | "total_volume")}
              />
            </div>
          </div>
          {progLoading ? (
            <Skeleton h={260} r={8} />
          ) : prog.length < 2 ? (
            <EmptyState icon={Dumbbell} title="Not enough history" body="Log this lift a few more times to see progression." />
          ) : (
            <LineChart
              data={prog.map((p) => ({ date: p.date, value: p[metric] }))}
              height={260}
              yUnit={metric === "top_weight" ? " kg" : ""}
              series={[{ key: "value", color: "var(--accent-graph)", label: metric === "top_weight" ? "Top weight" : "Volume" }]}
            />
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-semibold text-[15px]">Muscle volume</span>
            <Badge>{data.window_days} days</Badge>
          </div>
          <BarChart
            data={muscleData}
            xKey="label"
            yKey="value"
            horizontal
            unit=" kg\u00B7r"
            fmtVal={(v) => fmt.num(v)}
          />
        </Card>
      </div>

      {/* Personal records */}
      <span className="eyebrow block mb-3">Personal records</span>
      {data.prs.length === 0 ? (
        <Card><EmptyState icon={Trophy} title="No PRs yet" body="Log strength workouts with sets to see your personal records." /></Card>
      ) : (
        <div className="grid-4 stagger">
          {data.prs.map((p) => (
            <Card
              key={p.exercise_name}
              hover
              className="cursor-pointer"
              onClick={() => setExercise(p.exercise_name)}
            >
              <div className="flex items-center justify-between mb-3.5">
                <span
                  className="w-9 h-9 rounded-[11px] grid place-items-center"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-graph)" }}
                >
                  <Trophy size={18} />
                </span>
                {p.is_recent_pr && <Badge tone="success" dot>New PR</Badge>}
              </div>
              <div className="num text-[28px] font-semibold">
                {fmt.num(p.best_weight)}
                <span className="text-muted text-sm font-normal ml-1">{p.best_weight_unit}</span>
              </div>
              <div className="text-[13px] font-medium mt-1">{p.exercise_name}</div>
              <div className="text-muted text-xs mt-0.5">
                Est. 1RM: {fmt.num(p.best_est_1rm)} {p.best_weight_unit} &middot; {fmt.relDay(p.best_weight_date)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
