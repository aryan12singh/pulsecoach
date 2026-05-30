"use client";
import { useState, useEffect, useRef } from "react";

export function useCountUp(
  target: number | null | undefined,
  { dur = 900, dp = 0 } = {}
): number {
  const [v, setV] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (target == null || isNaN(target)) {
      setV(target ?? 0);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(target * e);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, dur]);

  return dp ? Math.round(v * 10 ** dp) / 10 ** dp : Math.round(v);
}
