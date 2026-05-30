"use client";

interface Option {
  value: string | number;
  label: string;
}

interface SegmentedProps {
  options: (string | Option)[];
  value: string | number;
  onChange: (v: string | number) => void;
}

export default function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div className="inline-flex bg-surface-2 border border-border rounded-md p-[3px] gap-0.5" role="tablist">
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        return (
          <button
            key={String(val)}
            role="tab"
            aria-selected={value === val}
            className={`border-none font-semibold text-xs px-3 py-1.5 rounded-sm transition-all duration-150 ${
              value === val
                ? "bg-surface-3 text-text shadow-card"
                : "bg-transparent text-muted hover:text-text"
            }`}
            onClick={() => onChange(val)}
          >
            {lab}
          </button>
        );
      })}
    </div>
  );
}
