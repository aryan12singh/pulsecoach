interface SkeletonProps {
  w?: string | number;
  h?: number;
  r?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({ w = "100%", h = 16, r = 8, className = "", style }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${className}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer"
        style={{
          background: "linear-gradient(90deg, transparent, var(--grid), transparent)",
        }}
      />
    </div>
  );
}
