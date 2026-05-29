"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AppConfig } from "@/types";

const base = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
const active = "bg-indigo-700 text-white";
const inactive = "text-indigo-100 hover:bg-indigo-600";

export default function Nav() {
  const path = usePathname();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
  }, []);

  const cls = (href: string) =>
    `${base} ${path === href ? active : inactive}`;

  async function handleHevySync() {
    setSyncing(true);
    try {
      await api.hevy.sync();
      alert("Hevy sync complete");
    } catch {
      alert("Hevy sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleStravaSync() {
    setSyncing(true);
    try {
      await api.strava.sync();
      alert("Strava sync complete");
    } catch {
      alert("Strava sync failed — connect Strava first");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <nav className="bg-indigo-600 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <span className="text-white font-bold text-lg mr-4">PulseCoach</span>
            <Link href="/" className={cls("/")}>Dashboard</Link>
            <Link href="/workouts" className={cls("/workouts")}>Workouts</Link>
            <Link href="/trends" className={cls("/trends")}>Trends</Link>
            <Link href="/goals" className={cls("/goals")}>Goals</Link>
            {config?.analytics_enabled !== false && (
              <Link href="/analytics" className={cls("/analytics")}>Analytics</Link>
            )}
            {config?.coaching_enabled && (
              <Link href="/coach" className={cls("/coach")}>Coach</Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {config?.strava_enabled && (
              <>
                <a
                  href={api.strava.connectUrl()}
                  className="text-xs bg-white text-orange-600 font-semibold px-3 py-1.5 rounded-md hover:bg-orange-50"
                >
                  Connect Strava
                </a>
                <button
                  onClick={handleStravaSync}
                  disabled={syncing}
                  className="text-xs bg-white text-orange-600 font-semibold px-3 py-1.5 rounded-md hover:bg-orange-50 disabled:opacity-50"
                >
                  {syncing ? "Syncing…" : "Sync Strava"}
                </button>
              </>
            )}
            {config?.hevy_enabled && (
              <button
                onClick={handleHevySync}
                disabled={syncing}
                className="text-xs bg-white text-indigo-700 font-semibold px-3 py-1.5 rounded-md hover:bg-indigo-50 disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync Hevy"}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
