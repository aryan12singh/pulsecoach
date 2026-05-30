import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "var(--accent)",
        "accent-graph": "var(--accent-graph)",
        "on-accent": "var(--on-accent)",
        "accent-2": "var(--accent-2)",
        success: "var(--success)",
        caution: "var(--caution)",
        danger: "var(--danger)",
        "accent-soft": "var(--accent-soft)",
        "success-soft": "var(--success-soft)",
        "caution-soft": "var(--caution-soft)",
        "danger-soft": "var(--danger-soft)",
        "ring-track": "var(--ring-track)",
        grid: "var(--grid)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["56px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h1: ["34px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        h2: ["24px", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        h3: ["18px", { lineHeight: "1.4", letterSpacing: "-0.02em" }],
        body: ["15px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.5" }],
        xs: ["11px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "22px",
        full: "999px",
      },
      boxShadow: {
        card: "var(--shadow)",
        "card-lg": "var(--shadow-lg)",
      },
      maxWidth: {
        container: "1180px",
      },
      spacing: {
        "s-1": "4px",
        "s-2": "8px",
        "s-3": "12px",
        "s-4": "16px",
        "s-5": "20px",
        "s-6": "24px",
        "s-8": "32px",
        "s-10": "40px",
        "s-12": "48px",
        "s-16": "64px",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.97)" },
        },
        "modal-in": {
          from: { opacity: "0", transform: "translateY(16px) scale(0.98)" },
        },
        fade: {
          from: { opacity: "0" },
        },
        blink: {
          "0%, 60%, 100%": { opacity: "0.25" },
          "30%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        shimmer: "shimmer 1.4s infinite",
        "toast-in": "toast-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "modal-in": "modal-in 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)",
        fade: "fade 0.2s ease",
        blink: "blink 1.2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
