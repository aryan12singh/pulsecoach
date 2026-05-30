"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import type { AppConfig } from "@/types";
import { toast } from "sonner";
import {
  Activity, LayoutDashboard, Dumbbell, TrendingUp, Target,
  BarChart3, Bot, Sun, Moon, Plus, RefreshCw, Menu, X,
  Heart, Zap, Settings,
  LucideIcon,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { href: "/workouts", label: "Workouts", icon: Dumbbell, id: "workouts" },
  { href: "/trends", label: "Trends", icon: TrendingUp, id: "trends" },
  { href: "/goals", label: "Goals", icon: Target, id: "goals" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, id: "analytics" },
  { href: "/coach", label: "Coach", icon: Bot, id: "coach", flag: "coaching_enabled" as const },
  { href: "/settings", label: "Settings", icon: Settings, id: "settings" },
];

export default function Nav() {
  const path = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    const close = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [addOpen]);

  const visibleNav = NAV_ITEMS.filter((n) => {
    if (!n.flag) return true;
    return config?.[n.flag];
  });

  async function syncHevy() {
    setSyncing(true);
    try {
      await api.hevy.sync();
      toast.success("Hevy sync complete - workouts up to date");
    } catch {
      toast.error("Hevy sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const isActive = (href: string) => {
    if (href === "/") return path === "/";
    return path.startsWith(href);
  };

  return (
    <nav
      className="sticky top-0 z-[60] border-b border-border"
      style={{
        backdropFilter: "blur(14px) saturate(140%)",
        background: "color-mix(in srgb, var(--bg) 78%, transparent)",
      }}
    >
      <div className="max-w-container mx-auto px-6 flex items-center justify-between h-[60px]">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-accent grid place-items-center shadow-[0_4px_16px_var(--accent-glow)]">
              <Activity size={18} className="text-on-accent" strokeWidth={2.6} />
            </span>
            <span className="font-display font-bold text-[18px] tracking-[-0.02em]">
              PulseCoach
            </span>
          </Link>
          <div className="nav-desktop flex items-center gap-1 ml-3">
            {visibleNav.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                className={`relative px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                  isActive(n.href)
                    ? "text-text after:content-[''] after:absolute after:left-3 after:right-3 after:bottom-[-1px] after:h-0.5 after:bg-accent-graph after:rounded-sm"
                    : "text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {config?.strava_enabled && (
            <a
              href={api.strava.connectUrl()}
              className="nav-desktop text-xs font-semibold text-accent hover:text-accent-graph transition-colors"
            >
              Connect Strava
            </a>
          )}

          {config?.hevy_enabled && (
            <button
              onClick={syncHevy}
              disabled={syncing}
              className="nav-desktop inline-flex items-center gap-2 px-3 py-[7px] rounded-md text-xs font-semibold bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3 disabled:opacity-50 transition-all"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing\u2026" : "Sync Hevy"}
            </button>
          )}

          {/* Add menu */}
          <div ref={addRef} className="relative">
            <button
              onClick={() => setAddOpen((s) => !s)}
              className="nav-desktop inline-flex items-center gap-2 px-4 py-[7px] rounded-md text-xs font-semibold bg-accent text-on-accent hover:shadow-[0_6px_22px_var(--accent-glow)] transition-all"
            >
              <Plus size={14} /> Add
            </button>
            <button
              onClick={() => setAddOpen((s) => !s)}
              className="nav-mobile inline-flex items-center justify-center p-2 rounded-md bg-accent text-on-accent"
              aria-label="Add"
            >
              <Plus size={18} />
            </button>
            {addOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[210px] p-1.5 bg-surface border border-border rounded-lg shadow-card-lg z-[70]">
                <NavMenuItem href="/workouts?action=log" icon={Dumbbell} label="Log workout" onClick={() => setAddOpen(false)} />
                <NavMenuItem href="/trends?action=add" icon={Heart} label="Log health metric" onClick={() => setAddOpen(false)} />
                <NavMenuItem href="/goals?action=add" icon={Target} label="New goal" onClick={() => setAddOpen(false)} />
              </div>
            )}
          </div>

          {mounted && (
            <button
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="inline-flex items-center justify-center p-2 rounded-md bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3 transition-all"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          <button
            className="nav-mobile inline-flex items-center justify-center p-2 rounded-md bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3 transition-all"
            aria-label="Menu"
            onClick={() => setMenuOpen((s) => !s)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="nav-mobile border-t border-border p-3 flex flex-col gap-1">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-md text-sm font-semibold transition-colors ${
                  isActive(n.href) ? "text-text bg-surface-2" : "text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <Icon size={18} /> {n.label}
              </Link>
            );
          })}
          {config?.hevy_enabled && (
            <button
              onClick={() => { syncHevy(); setMenuOpen(false); }}
              className="flex items-center gap-3 px-3.5 py-3 rounded-md text-sm font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <RefreshCw size={18} /> Sync Hevy
            </button>
          )}
          {config?.strava_enabled && (
            <a
              href={api.strava.connectUrl()}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-3 rounded-md text-sm font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <Zap size={18} /> Connect Strava
            </a>
          )}
        </div>
      )}
    </nav>
  );
}

function NavMenuItem({
  href, icon: Icon, label, onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[9px] text-sm font-medium text-text hover:bg-surface-2 transition-colors"
    >
      <Icon size={17} className="text-faint" /> {label}
    </Link>
  );
}
