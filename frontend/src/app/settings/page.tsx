"use client";
import { useEffect, useRef, useState } from "react";
import { api, handleError } from "@/lib/api";
import type { SettingsResponse, SettingsUpdate, ImportJob } from "@/types";
import { Card, Button } from "@/components/ui";
import Switch from "@/components/ui/Switch";
import { Field, Input } from "@/components/ui/FormFields";
import {
  Activity, Dumbbell, HeartPulse, Bot,
  CheckCircle2, XCircle, Loader2, Upload,
} from "lucide-react";
import { toast } from "sonner";

// ── Status chip ────────────────────────────────────────────────────────────────

function StatusChip({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${
        ok
          ? "bg-green-500/10 text-green-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  );
}

// ── Integration card ───────────────────────────────────────────────────────────

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
  testResult: { ok: boolean; message: string } | null;
  testing: boolean;
  onTest: () => void;
  testLabel?: string;
}

function IntegrationCard({
  title, description, icon, enabled, onToggle, children,
  testResult, testing, onTest, testLabel = "Test connection",
}: IntegrationCardProps) {
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-surface-3 grid place-items-center text-accent">
            {icon}
          </span>
          <div>
            <div className="font-semibold text-sm text-text">{title}</div>
            <div className="text-xs text-muted mt-0.5">{description}</div>
          </div>
        </div>
        <Switch checked={enabled} onChange={onToggle} />
      </div>

      {enabled && (
        <>
          {children && <div className="flex flex-col gap-3">{children}</div>}
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" variant="ghost" onClick={onTest} disabled={testing}>
              {testing ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              {testLabel}
            </Button>
            {testResult && (
              <StatusChip ok={testResult.ok} label={testResult.message} />
            )}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Import drop-zone ───────────────────────────────────────────────────────────

interface ImportZoneProps {
  label: string;
  hint: string;
  accept: string;
  onFile: (f: File) => Promise<{ job_id: string }>;
}

function ImportZone({ label, hint, accept, onFile }: ImportZoneProps) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pollJob(id: string) {
    try {
      const j = await api.ingest.jobStatus(id);
      setJob(j);
      if (j.status === "running" || j.status === "pending") {
        setTimeout(() => pollJob(id), 1500);
      } else {
        setBusy(false);
        if (j.status === "done" && j.result) {
          const r = j.result;
          toast.success(
            `Import complete — Added ${r.workouts_added} workouts, ${r.sets_added} sets, ${r.metrics_added} metrics; skipped ${r.workouts_skipped_dupe} dupes`
          );
        } else if (j.status === "error") {
          toast.error(`Import failed: ${j.error}`);
        }
      }
    } catch {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setJob({ status: "pending", progress: 0, result: null, error: null });
    try {
      const { job_id } = await onFile(file);
      pollJob(job_id);
    } catch (e) {
      handleError(e, "Upload failed");
      setBusy(false);
      setJob(null);
    }
  }

  return (
    <div className="border border-dashed border-border rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold text-text">{label}</div>
          <div className="text-xs text-muted mt-0.5">{hint}</div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3 disabled:opacity-50 transition-all"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {busy ? "Importing…" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFile(file);
              e.target.value = "";
            }
          }}
        />
      </div>

      {(job?.status === "running" || job?.status === "pending") && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Loader2 size={12} className="animate-spin" /> Processing…
        </div>
      )}

      {job?.status === "done" && job.result && (
        <div className="mt-3 text-xs text-muted">
          Added <span className="text-text font-semibold">{job.result.workouts_added}</span> workouts,{" "}
          <span className="text-text font-semibold">{job.result.sets_added}</span> sets,{" "}
          <span className="text-text font-semibold">{job.result.metrics_added}</span> metrics;
          skipped <span className="text-text font-semibold">{job.result.workouts_skipped_dupe}</span> duplicates
          {job.result.errors.length > 0 && (
            <span className="text-red-400"> · {job.result.errors.length} row errors</span>
          )}
        </div>
      )}

      {job?.status === "error" && (
        <div className="mt-3 text-xs text-red-400">{job.error}</div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<SettingsUpdate>({});
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string } | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.settings.get().then((s) => {
      setSettings(s);
    }).catch((e) => handleError(e, "Failed to load settings"));
  }, []);

  function patch(update: Partial<SettingsUpdate>) {
    setDraft((d) => ({ ...d, ...update }));
  }

  function val(key: keyof SettingsResponse): boolean | string | null {
    if (key in draft) return (draft as Record<string, unknown>)[key] as string | null;
    return settings?.[key] ?? null;
  }

  function boolVal(key: keyof SettingsResponse): boolean {
    const d = (draft as Record<string, unknown>)[key];
    if (d !== undefined) return d as boolean;
    return (settings?.[key] as boolean) ?? false;
  }

  function strVal(key: keyof SettingsResponse): string {
    const d = (draft as Record<string, unknown>)[key];
    if (d !== undefined) return (d as string) ?? "";
    return (settings?.[key] as string) ?? "";
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.settings.update(draft);
      setSettings(updated);
      setDraft({});
      toast.success("Settings saved");
    } catch (e) {
      handleError(e, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function testIntegration(name: string) {
    // Save pending changes first
    if (Object.keys(draft).length > 0) await save();
    setTesting((t) => ({ ...t, [name]: true }));
    try {
      const result = await api.settings.test(name);
      setTestResults((r) => ({ ...r, [name]: result }));
    } catch (e) {
      setTestResults((r) => ({ ...r, [name]: { ok: false, message: "Request failed" } }));
    } finally {
      setTesting((t) => ({ ...t, [name]: false }));
    }
  }

  const hasDraft = Object.keys(draft).length > 0;

  return (
    <main className="max-w-container mx-auto px-6 py-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Settings</h1>
          <p className="text-muted text-sm mt-1">Manage integrations and data imports</p>
        </div>
        {hasDraft && (
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            Save changes
          </Button>
        )}
      </div>

      {/* Integrations */}
      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-muted tracking-wide uppercase">Integrations</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Hevy */}
          <IntegrationCard
            title="Hevy"
            description="Sync workouts via the Hevy API (requires Pro)"
            icon={<Dumbbell size={18} />}
            enabled={boolVal("hevy_enabled")}
            onToggle={(v) => patch({ hevy_enabled: v })}
            testResult={testResults["hevy"] ?? null}
            testing={testing["hevy"] ?? false}
            onTest={() => testIntegration("hevy")}
          >
            <Field label="API key">
              <Input
                type="password"
                placeholder={settings?.hevy_api_key ?? "Enter Hevy API key"}
                onChange={(e) => patch({ hevy_api_key: e.target.value })}
              />
            </Field>
          </IntegrationCard>

          {/* Strava */}
          <IntegrationCard
            title="Strava"
            description="Connect via OAuth to sync activities"
            icon={<Activity size={18} />}
            enabled={boolVal("strava_enabled")}
            onToggle={(v) => patch({ strava_enabled: v })}
            testResult={testResults["strava"] ?? null}
            testing={testing["strava"] ?? false}
            onTest={() => testIntegration("strava")}
            testLabel="Test OAuth token"
          >
            <Field label="Client ID">
              <Input
                value={strVal("strava_client_id")}
                placeholder="Enter client ID"
                onChange={(e) => patch({ strava_client_id: e.target.value })}
              />
            </Field>
            <Field label="Client secret">
              <Input
                type="password"
                placeholder={settings?.strava_client_secret ?? "Enter client secret"}
                onChange={(e) => patch({ strava_client_secret: e.target.value })}
              />
            </Field>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010"}/ingest/strava/connect`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent-graph transition-colors"
            >
              Connect Strava account →
            </a>
          </IntegrationCard>

          {/* Apple Health */}
          <IntegrationCard
            title="Apple Health"
            description="Receive push data via Health Auto Export webhook"
            icon={<HeartPulse size={18} />}
            enabled={true}
            onToggle={() => {}}
            testResult={testResults["apple_health"] ?? null}
            testing={testing["apple_health"] ?? false}
            onTest={() => testIntegration("apple_health")}
            testLabel="Check webhook"
          >
            <Field label="Webhook secret (optional)">
              <Input
                type="password"
                placeholder={settings?.webhook_secret ?? "Leave blank to accept all"}
                onChange={(e) => patch({ webhook_secret: e.target.value })}
              />
            </Field>
          </IntegrationCard>

          {/* AI Coaching */}
          <IntegrationCard
            title="AI Coaching"
            description="Chat-based coaching powered by Claude"
            icon={<Bot size={18} />}
            enabled={boolVal("coaching_enabled")}
            onToggle={(v) => patch({ coaching_enabled: v })}
            testResult={testResults["coaching"] ?? null}
            testing={testing["coaching"] ?? false}
            onTest={() => testIntegration("coaching")}
          >
            <Field label="Anthropic API key">
              <Input
                type="password"
                placeholder={settings?.anthropic_api_key ?? "sk-ant-…"}
                onChange={(e) => patch({ anthropic_api_key: e.target.value })}
              />
            </Field>
            <Field label="Model (optional)">
              <Input
                value={strVal("claude_model")}
                placeholder="Leave blank to use default"
                onChange={(e) => patch({ claude_model: e.target.value })}
              />
            </Field>
          </IntegrationCard>

        </div>
      </section>

      {/* Import data */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold text-sm text-muted tracking-wide uppercase">Import data</h2>
          <p className="text-xs text-muted mt-1">
            Bulk-import your full history. Re-uploading the same file is safe — duplicates are skipped.
          </p>
        </div>

        <Card className="p-5 flex flex-col gap-5">
          <ImportZone
            label="Apple Health export"
            hint="Health app → profile picture → Export All Health Data → export.zip"
            accept=".zip,.xml"
            onFile={(f) => api.ingest.importAppleHealth(f)}
          />
          <ImportZone
            label="Hevy CSV"
            hint="Hevy → Profile → Settings → Export & Import Data → workout CSV or measurements CSV"
            accept=".csv"
            onFile={(f) => api.ingest.importHevy(f)}
          />
          <ImportZone
            label="Strava archive"
            hint="strava.com → Settings → My Account → Download or Delete → Get Started → Request your archive (.zip)"
            accept=".zip,.csv"
            onFile={(f) => api.ingest.importStrava(f)}
          />
          <p className="text-xs text-faint">
            Note: Strava strength set detail is not reliably included in the bulk export. Strength data should come from Hevy.
          </p>
        </Card>
      </section>
    </main>
  );
}
