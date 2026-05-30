"use client";

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function Switch({ checked, onChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex-none transition-colors duration-200"
      style={{
        width: 42,
        height: 25,
        borderRadius: 999,
        border: "none",
        padding: 3,
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "var(--accent)" : "var(--surface-3)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        className="block rounded-full transition-transform duration-200"
        style={{
          width: 19,
          height: 19,
          background: checked ? "var(--on-accent)" : "var(--muted)",
          transform: checked ? "translateX(17px)" : "translateX(0)",
        }}
      />
    </button>
  );
}
