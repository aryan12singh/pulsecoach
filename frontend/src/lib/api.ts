import type {
  AppConfig, AnalyticsSummary, ChatMessage, GoalStatus, HealthMetric, MonthlySummary,
  MetricSummaryItem, StrengthProgressPoint, Workout, WorkoutDetail,
  WeeklySummary, Goal, SettingsResponse, SettingsUpdate, TestResult, ImportJob,
} from "@/types";
import { toast } from "sonner";

export function handleError(error: unknown, context: string = "Operation failed") {
  console.error(context, error);
  toast.error(error instanceof Error ? `${context}: ${error.message}` : context);
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
const BASE = API_BASE;

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE + path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${path} → ${res.status}`);
}

async function _postFile<T = { job_id: string }>(path: string, fieldName: string, file: File): Promise<T> {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(BASE + path, { method: "POST", body: form });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  config: () => get<AppConfig>("/config"),

  workouts: {
    list: (params?: Record<string, string>) => get<Workout[]>("/workouts", params),
    get: (id: number) => get<WorkoutDetail>(`/workouts/${id}`),
    weeklySummary: () => get<WeeklySummary>("/workouts/summary/weekly"),
    monthlySummary: () => get<MonthlySummary>("/workouts/summary/monthly"),
    create: (body: unknown) => post<Workout>("/workouts", body),
  },

  strength: {
    progress: (exercise: string) =>
      get<StrengthProgressPoint[]>("/strength/progress", { exercise }),
  },

  metrics: {
    list: (params?: Record<string, string>) => get<HealthMetric[]>("/metrics", params),
    summary: () => get<MetricSummaryItem[]>("/metrics/summary"),
    create: (body: unknown) => post<HealthMetric>("/metrics", body),
  },

  goals: {
    list: () => get<GoalStatus[]>("/goals"),
    create: (body: unknown) => post<Goal>("/goals", body),
    update: (id: number, body: unknown) => put<Goal>(`/goals/${id}`, body),
    delete: (id: number) => del(`/goals/${id}`),
  },

  coaching: {
    chat: (message: string) => post<ChatMessage>("/coaching/chat", { message }),
    history: () => get<ChatMessage[]>("/coaching/history"),
  },

  hevy: {
    sync: () => post("/ingest/hevy/sync", {}),
  },

  strava: {
    connectUrl: () => `${API_BASE}/ingest/strava/connect`,
    sync: () => post("/ingest/strava/sync", {}),
  },

  analytics: {
    summary: (windowDays = 30) =>
      get<AnalyticsSummary>("/analytics/summary", { window_days: String(windowDays) }),
  },

  settings: {
    get: () => get<SettingsResponse>("/settings"),
    update: (body: SettingsUpdate) => put<SettingsResponse>("/settings", body),
    test: (integration: string) =>
      post<TestResult>(`/settings/test/${integration}`, {}),
  },

  ingest: {
    importAppleHealth: (file: File) => _postFile<{ job_id: string }>("/ingest/apple-health/import", "file", file),
    importHevy: (file: File) => _postFile<{ job_id: string }>("/ingest/hevy/import", "file", file),
    importStrava: (file: File) => _postFile<{ job_id: string }>("/ingest/strava/import", "file", file),
    jobStatus: (id: string) => get<ImportJob>(`/ingest/jobs/${id}`),
  },
};
