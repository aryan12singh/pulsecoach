"use client";
import { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

interface FieldProps {
  label?: string;
  children: ReactNode;
  hint?: string;
  full?: boolean;
}

export function Field({ label, children, hint, full }: FieldProps) {
  return (
    <label className="block" style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      {label && (
        <span className="text-xs text-muted font-semibold tracking-[0.02em] mb-1.5 block">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="text-faint text-xs mt-1 block">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full bg-surface-2 text-text border border-border rounded-md px-3 py-2.5 text-sm font-[inherit] transition-all duration-150 placeholder:text-faint focus:outline-none focus:border-accent-graph focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:bg-surface"
      {...props}
    />
  );
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full bg-surface-2 text-text border border-border rounded-md px-3 py-2.5 text-sm font-[inherit] transition-all duration-150 appearance-none bg-no-repeat pr-8 focus:outline-none focus:border-accent-graph focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:bg-surface"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23808a98' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundPosition: "right 12px center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}
