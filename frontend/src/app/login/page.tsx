"use client";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, Loader2, LogIn } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { Field, Input } from "@/components/ui/FormFields";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const from = params.get("from");
        window.location.href = from && from.startsWith("/") ? from : "/";
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.detail || `Login failed (${res.status})`);
      setBusy(false);
    } catch {
      setError("Could not reach the server");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <div className="w-full max-w-[380px] animate-fade-up">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span className="w-[38px] h-[38px] rounded-[11px] bg-accent grid place-items-center shadow-[0_4px_16px_var(--accent-glow)]">
            <Activity size={22} className="text-on-accent" strokeWidth={2.6} />
          </span>
          <span className="font-display font-bold text-[22px] tracking-[-0.02em]">PulseCoach</span>
        </div>
        <Card>
          <h1 className="font-display font-semibold text-[18px] mb-1">Welcome back</h1>
          <p className="text-muted text-sm mb-5">Enter your password to unlock your dashboard.</p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Password">
              <Input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            {error && <p className="text-danger text-xs -mt-1">{error}</p>}
            <Button type="submit" variant="primary" icon={busy ? Loader2 : LogIn} disabled={busy || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
        <p className="text-faint text-xs text-center mt-4">
          Self-hosted — your data never leaves your server.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
