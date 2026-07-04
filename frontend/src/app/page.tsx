"use client";
import { useEffect, useState, useMemo } from "react";
import { api, handleError } from "@/lib/api";
import Link from "next/link";
import { fmt } from "@/lib/fmt";
import type { Workout, GoalStatus, HealthMetric, WeeklySummary } from "@/types";
import {
  Scale, Activity, Heart, Bed, Dumbbell, Flame, Clock, ArrowRight,
  Edit, Plus,
} from "lucide-react";
import { Card, Segmented, Skeleton, Badge, Button, Switch, Modal } from "@/components/ui";
import MetricCard, { MetricCardData } from "@/components/MetricCard";
import WorkoutRow from "@/components/WorkoutRow";
import { GoalRingRow, GoalBarRow } from "@/components/GoalCard";
import LineChart from "@/components/charts/LineChart";
import Sparkline from "@/components/charts/Sparkline";
import { useCountUp } from "@/hooks/useCountUp";

type MetricsByType = Record<string, HealthMetric[]>;

/* ---------- Dashboard prefs ---------- */
interface DashPrefs {
  density: "focused" | "dense";
  cards: { summary: boolean; metrics: boolean; charts: boolean; goals: boolean; recent: boolean };
}

const DEFAULT_PREFS: DashPrefs = {
  density: "focused",
  cards: { summary: true, metrics: true, charts: true, goals: true, recent: true },
};

const CARD_DEFS = [
  { key: "summary" as const, label: "Weekly summary", hint: "Greeting + at-a-glance averages", icon: Activity },
  { key: "metrics" as const, label: "Health metric cards", hint: "Weight, BMI, resting HR, sleep", icon: Heart },
  { key: "charts" as const, label: "Trend charts", hint: "Weight & sleep over time", icon: Activity },
  { key: "goals" as const, label: "Goals", hint: "Rings & progress bars", icon: Activity },
  { key: "recent" as const, label: "Recent workouts", hint: "Your latest sessions", icon: Dumbbell },
];

function loadPrefs(): DashPrefs {
  try {
    const p = JSON.parse(localStorage.getItem("pc_dash_prefs") || "null");
    if (p?.cards) return { ...DEFAULT_PREFS, ...p, cards: { ...DEFAULT_PREFS.cards, ...p.cards } };
  } catch {}
  return DEFAULT_PREFS;
}

function trendPct(metrics: HealthMetric[]): number | null {
  if (metrics.length < 2) return null;
  const recent = metrics[metrics.length - 1].value;
  const prev = metrics[Math.max(0, metrics.length - 8)].value;
  if (!prev) return null;
  return Math.round(((recent - prev) / prev) * 100);
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [goals, setGoals] = useState<GoalStatus[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [metricsByType, setMetricsByType] = useState<MetricsByType>({});
  const [prefs, setPrefs] = useState<DashPrefs>(DEFAULT_PREFS);
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    Promise.all([
      api.workouts.weeklySummary().catch((e) => { handleError(e, "Failed to load weekly summary"); return null; }),
      api.goals.list().catch((e) => { handleError(e, "Failed to load goals"); return []; }),
      api.workouts.list({ limit: "10" }).catch((e) => { handleError(e, "Failed to load workouts"); return []; }),
      api.metrics.list({ type: "weight_kg", limit: "60" }).catch((e) => { handleError(e, "Failed to load weight data"); return []; }),
      api.metrics.list({ type: "bmi", limit: "60" }).catch((e) => { handleError(e, "Failed to load BMI data"); return []; }),
      api.metrics.list({ type: "resting_hr", limit: "60" }).catch((e) => { handleError(e, "Failed to load heart rate data"); return []; }),
      api.metrics.list({ type: "sleep_hours", limit: "60" }).catch((e) => { handleError(e, "Failed to load sleep data"); return []; }),
    ]).then(([s, g, w, weight, bmi, hr, sleep]) => {
      setSummary(s);
      setGoals(g);
      setWorkouts(w);
      setMetricsByType({ weight_kg: weight, bmi, resting_hr: hr, sleep_hours: sleep });
      setLoading(false);
    });
  }, []);

  const savePrefs = (next: DashPrefs) => {
    setPrefs(next);
    localStorage.setItem("pc_dash_prefs", JSON.stringify(next));
  };
  const setDensity = (d: "focused" | "dense") => savePrefs({ ...prefs, density: d });
  const setCard = (key: string, val: boolean) =>
    savePrefs({ ...prefs, cards: { ...prefs.cards, [key]: val } });

  const metricCards: MetricCardData[] = useMemo(() => {
    const m = metricsByType;
    const last = (k: string) => { const a = m[k] || []; return a.length ? a[a.length - 1].value : null; };
    const t = (k: string) => trendPct(m[k] || []);
    return [
      { key: "weight_kg", label: "Weight", unit: "kg", icon: Scale, value: last("weight_kg"), trend: t("weight_kg"), invert: true, spark: m.weight_kg || [] },
      { key: "bmi", label: "BMI", unit: "", icon: Activity, value: last("bmi"), trend: t("bmi"), invert: true, spark: m.bmi || [] },
      { key: "resting_hr", label: "Resting HR", unit: "bpm", icon: Heart, value: last("resting_hr"), trend: t("resting_hr"), invert: true, spark: m.resting_hr || [] },
      { key: "sleep_hours", label: "Avg Sleep", unit: "hrs", icon: Bed, value: last("sleep_hours"), trend: t("sleep_hours"), invert: false, spark: m.sleep_hours || [], dp: 1 },
    ];
  }, [metricsByType]);

  const weightData = (metricsByType.weight_kg || []).map((m) => ({ date: m.date, value: m.value }));
  const sleepData = (metricsByType.sleep_hours || []).map((m) => ({ date: m.date, value: m.value }));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const isEmpty =
    workouts.length === 0 &&
    goals.length === 0 &&
    Object.values(metricsByType).every((arr) => arr.length === 0);

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-semibold text-[30px] tracking-[-0.02em]">Dashboard</h1>
          <p className="text-muted text-sm mt-1.5">
            {prefs.density === "focused"
              ? "Focused \u2014 one featured trend, goals on the side"
              : "Dense \u2014 every metric at a glance"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Segmented
            options={[
              { value: "focused", label: "Focused" },
              { value: "dense", label: "Dense" },
            ]}
            value={prefs.density}
            onChange={(v) => setDensity(v as "focused" | "dense")}
          />
          <Button icon={Edit} onClick={() => setCustomizing(true)}>Customize</Button>
          <Link href="/workouts?action=log">
            <Button variant="primary" icon={Plus}>Log workout</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <DashSkeleton />
      ) : isEmpty ? (
        <OnboardingHero />
      ) : prefs.density === "focused" ? (
        <FocusedView
          cards={metricCards}
          summary={summary}
          weightData={weightData}
          sleepData={sleepData}
          workouts={workouts}
          goals={goals}
          greeting={greeting}
          show={prefs.cards}
        />
      ) : (
        <DenseView
          cards={metricCards}
          summary={summary}
          weightData={weightData}
          workouts={workouts}
          goals={goals}
          show={prefs.cards}
          metricsByType={metricsByType}
        />
      )}

      <CustomizeModal
        open={customizing}
        onClose={() => setCustomizing(false)}
        prefs={prefs}
        setCard={setCard}
        setDensity={setDensity}
      />
    </div>
  );
}

/* ============ First-run onboarding ============ */
function OnboardingHero() {
  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(700px 260px at 85% -20%, var(--accent-soft), transparent 70%)" }}
      />
      <div className="relative max-w-[560px] py-6">
        <span className="eyebrow">Welcome to PulseCoach</span>
        <h2 className="font-display font-semibold text-[26px] mt-2 mb-3">
          Your dashboard is empty — let&apos;s fix that.
        </h2>
        <p className="text-muted text-sm leading-relaxed mb-6">
          Import your full history from Apple Health, Hevy or Strava in one upload,
          connect a live integration, or just log your first workout by hand.
          Everything stays in your own database.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/settings">
            <Button variant="primary" icon={ArrowRight}>Import your data</Button>
          </Link>
          <Link href="/workouts?action=log">
            <Button icon={Plus}>Log a workout</Button>
          </Link>
          <Link href="/goals?action=add">
            <Button icon={Edit}>Set a goal</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ============ Focused View ============ */
function FocusedView({
  cards, summary, weightData, sleepData, workouts, goals, greeting, show,
}: {
  cards: MetricCardData[];
  summary: WeeklySummary | null;
  weightData: Array<{ date: string; value: number }>;
  sleepData: Array<{ date: string; value: number }>;
  workouts: Workout[];
  goals: GoalStatus[];
  greeting: string;
  show: DashPrefs["cards"];
}) {
  const [range, setRange] = useState(30);
  const sliced = weightData.slice(-range);

  return (
    <div className="flex flex-col gap-5 stagger">
      {/* Hero summary */}
      {show.summary && summary && (
        <Card className="relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(620px 200px at 92% -10%, var(--accent-soft), transparent 70%)" }}
          />
          <div className="relative">
            <span className="eyebrow">
              {fmt.date(new Date(), { weekday: "long", month: "long", day: "numeric" })}
            </span>
            <h2 className="font-display font-semibold text-[26px] mt-1.5 mb-[18px]">{greeting}.</h2>
            <div className="flex flex-wrap gap-6" style={{ rowGap: 16 }}>
              <WeekStatItem icon={Dumbbell} label="Sessions" value={summary.sessions_count} unit="this wk" />
              <WeekStatItem icon={Flame} label="Calories" value={summary.total_calories} unit="kcal" />
              <WeekStatItem icon={Clock} label="Avg Duration" value={summary.avg_duration_mins} unit="min" />
              <WeekStatItem icon={Heart} label="Avg Heart Rate" value={summary.avg_heart_rate} unit="bpm" />
            </div>
          </div>
        </Card>
      )}

      {/* Spotlight + Rail */}
      <div className="grid-spotlight">
        <div className="flex flex-col gap-5 min-w-0">
          {show.charts && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-semibold text-[15px]">Weight trend</span>
                <Segmented
                  options={[{ value: 7, label: "7d" }, { value: 30, label: "30d" }]}
                  value={range}
                  onChange={(v) => setRange(v as number)}
                />
              </div>
              <LineChart
                data={sliced}
                height={260}
                yUnit=" kg"
                series={[{ key: "value", color: "var(--accent-graph)", label: "Weight" }]}
              />
            </Card>
          )}
          {show.metrics && (
            <div className="grid-2">
              {cards.map((d) => <MetricCard key={d.key} d={d} />)}
            </div>
          )}
          {show.recent && <RecentWorkoutsCard workouts={workouts} />}
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          {show.goals && goals.length > 0 && <SmartGoalsCard goals={goals} />}
          {show.charts && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-semibold text-[15px]">Sleep</span>
              </div>
              <LineChart
                data={sleepData.slice(-range)}
                height={170}
                yUnit=" h"
                series={[{ key: "value", color: "var(--accent-2)", label: "Sleep" }]}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Dense View ============ */
function DenseView({
  cards, summary, weightData, workouts, goals, show, metricsByType,
}: {
  cards: MetricCardData[];
  summary: WeeklySummary | null;
  weightData: Array<{ date: string; value: number }>;
  workouts: Workout[];
  goals: GoalStatus[];
  show: DashPrefs["cards"];
  metricsByType: MetricsByType;
}) {
  const kpis: Array<{
    label: string; value: number | null; unit: string;
    icon: typeof Dumbbell; spark: Array<{ value: number }>;
    dp?: number; trend?: number | null; invert?: boolean;
  }> = [];

  if (show.summary && summary) {
    kpis.push(
      { label: "Sessions", value: summary.sessions_count, unit: "/wk", icon: Dumbbell, spark: [] },
      { label: "Volume", value: summary.total_strength_volume, unit: "kg\u00B7r", icon: Activity, spark: [] },
      { label: "Calories", value: summary.total_calories, unit: "kcal", icon: Flame, spark: [] },
      { label: "Avg HR", value: summary.avg_heart_rate, unit: "bpm", icon: Heart, spark: metricsByType.resting_hr || [] },
    );
  }
  if (show.metrics) {
    kpis.push(...cards.map((c) => ({
      label: c.label, value: c.value, unit: c.unit, icon: c.icon,
      spark: c.spark, dp: c.dp, trend: c.trend, invert: c.invert,
    })));
  }

  return (
    <div className="flex flex-col gap-5 stagger">
      {kpis.length > 0 && (
        <div className="grid-kpi">
          {kpis.map((k, i) => (
            <Card key={i} hover>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 eyebrow">
                  <k.icon size={13} className="text-faint" />
                  {k.label}
                </span>
                {k.trend != null && <span className="text-xs font-bold text-muted">{k.trend > 0 ? "+" : ""}{k.trend}%</span>}
              </div>
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="num text-[24px] font-semibold">
                    {k.value == null ? "\u2014" : fmt.num(k.value, k.dp || 0)}
                  </span>
                  <span className="text-muted text-xs">{k.unit}</span>
                </div>
                <Sparkline data={k.spark} width={56} height={24} color="var(--accent-graph)" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid-2-1">
        {show.charts && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-semibold text-[15px]">Weight trend</span>
              <Badge tone="accent">30 days</Badge>
            </div>
            <LineChart
              data={weightData}
              yUnit=" kg"
              series={[{ key: "value", color: "var(--accent-graph)", label: "Weight" }]}
            />
          </Card>
        )}
        {show.goals && goals.length > 0 && <SmartGoalsCard goals={goals} />}
      </div>

      {show.recent && <RecentWorkoutsCard workouts={workouts} limit={6} />}
    </div>
  );
}

/* ============ Shared sub-components ============ */
function WeekStatItem({ icon: Icon, label, value, unit }: { icon: typeof Dumbbell; label: string; value: number | null; unit: string }) {
  const shown = useCountUp(value, {});
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="flex items-center gap-2 eyebrow mb-2">
        <Icon size={13} className="text-faint" />
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="num text-[26px] font-semibold">{value == null ? "\u2014" : fmt.num(shown)}</span>
        <span className="text-muted text-xs">{unit}</span>
      </div>
    </div>
  );
}

function SmartGoalsCard({ goals }: { goals: GoalStatus[] }) {
  const rings = goals.filter((g) => g.metric_scope !== "health_metric");
  const bars = goals.filter((g) => g.metric_scope === "health_metric");

  return (
    <Card>
      <div className="flex items-center justify-between mb-3.5">
        <span className="eyebrow">Goals</span>
        <Link href="/goals">
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text transition-colors">
            Manage <ArrowRight size={14} />
          </button>
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {rings.map((g) => <GoalRingRow key={g.id} g={g} />)}
        {rings.length > 0 && bars.length > 0 && <hr className="border-border" />}
        {bars.map((g) => <GoalBarRow key={g.id} g={g} />)}
      </div>
    </Card>
  );
}

function RecentWorkoutsCard({ workouts, limit = 5 }: { workouts: Workout[]; limit?: number }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-display font-semibold text-[15px]">Recent workouts</span>
        <Link href="/workouts">
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text transition-colors">
            All <ArrowRight size={14} />
          </button>
        </Link>
      </div>
      <div className="flex flex-col">
        {workouts.slice(0, limit).map((w) => <WorkoutRow key={w.id} w={w} />)}
      </div>
    </Card>
  );
}

/* ============ Skeleton ============ */
function DashSkeleton() {
  return (
    <div>
      <Skeleton h={118} r={16} style={{ width: "100%", marginBottom: 20 }} />
      <div className="grid-spotlight">
        <div className="flex flex-col gap-4">
          <Skeleton h={320} r={16} />
          <Skeleton h={180} r={16} />
        </div>
        <Skeleton h={360} r={16} />
      </div>
    </div>
  );
}

/* ============ Customize Modal ============ */
function CustomizeModal({
  open, onClose, prefs, setCard, setDensity,
}: {
  open: boolean;
  onClose: () => void;
  prefs: DashPrefs;
  setCard: (key: string, val: boolean) => void;
  setDensity: (d: "focused" | "dense") => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customize dashboard"
      footer={
        <>
          <span className="text-faint text-xs">Saved automatically</span>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="mb-[22px]">
        <span className="text-xs text-muted font-semibold tracking-[0.02em] mb-1.5 block">Density</span>
        <Segmented
          options={[
            { value: "focused", label: "Focused" },
            { value: "dense", label: "Dense" },
          ]}
          value={prefs.density}
          onChange={(v) => setDensity(v as "focused" | "dense")}
        />
      </div>
      <span className="text-xs text-muted font-semibold tracking-[0.02em] mb-1 block">Cards shown</span>
      <div className="flex flex-col gap-1">
        {CARD_DEFS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="flex items-center justify-between py-3 border-t border-border">
              <div className="flex items-center gap-3">
                <span className="w-[34px] h-[34px] rounded-[10px] grid place-items-center bg-surface-2 text-muted">
                  <Icon size={16} />
                </span>
                <div>
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-faint text-xs">{c.hint}</div>
                </div>
              </div>
              <Switch checked={prefs.cards[c.key]} onChange={(v) => setCard(c.key, v)} />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
