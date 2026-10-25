/** A small interval hook for render-only animation and elapsed-time displays. */
import { useEffect, useState } from "react";

export function useTick(ms: number, active = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((value) => value + 1), ms); // interval-ok: terminal renderer has no browser visibility API; caller supplies active
    return () => clearInterval(timer);
  }, [active, ms]);
  return tick;
}
