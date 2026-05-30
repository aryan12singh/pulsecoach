"use client";
import { ReactNode, ButtonHTMLAttributes } from "react";
import { LucideIcon } from "lucide-react";

const variants: Record<string, string> = {
  primary: "bg-accent text-on-accent hover:shadow-[0_6px_22px_var(--accent-glow)]",
  ghost: "bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3",
  quiet: "bg-transparent text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: "sm" | "default";
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
}

export default function Button({
  variant = "ghost",
  size,
  icon: Icon,
  iconRight: IconRight,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 border border-transparent rounded-md font-semibold text-sm leading-none whitespace-nowrap transition-all duration-150 active:translate-y-px active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
        size === "sm" ? "px-3 py-[7px] text-xs rounded-sm" : "px-4 py-2.5"
      } ${variants[variant] || variants.ghost} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
      {IconRight && <IconRight size={iconSize} />}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
}

export function IconButton({ icon: Icon, label, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`inline-flex items-center justify-center p-2 rounded-md bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3 transition-all duration-150 ${className}`}
      {...rest}
    >
      <Icon size={18} />
    </button>
  );
}
