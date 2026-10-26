/**
 * A value read from a host route once on mount and again on `reload`. The reply is untrusted: `accept` checks its shape once,
 * here, and a reply that fails it reads as null like a failed read (a row then shows no value rather than a made-up one or a crash).
 */
import { useCallback, useEffect, useState } from "react";

export function useLoaded<T>(load: () => Promise<unknown>, accept: (value: unknown) => value is T): { value: T | null; reload(): void } {
  const [value, setValue] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  // `load` and `accept` are module-level or stable closures over the app context; the tick is the only trigger.
  useEffect(() => {
    let live = true;
    load().then((v) => { if (live) setValue(accept(v) ? v : null); }, () => { if (live) setValue(null); });
    return () => { live = false; };
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { value, reload };
}

/** A reply that is a list. */
export const isList = <T,>(value: unknown): value is T[] => Array.isArray(value);
