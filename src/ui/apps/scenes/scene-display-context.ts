/** What a scene page captures once per take-and-version for every showing: the macro seed and clock (ADR-012), and the time-stamp formatter bound to that clock. */
import { useMemo, useRef } from "react";
import type { OpenScene } from "../../../studio/scenes";
import { formatStamp } from "./scene-meta-core";

export interface DisplayContext { randomSeed: number; now: number }

/** A new seed and clock whenever the take or its version changes, the same ones for every render in between. */
export function useDisplayContext(scene: OpenScene | null): DisplayContext {
  const identity = JSON.stringify([scene?.chat.id, scene?.chat.activeBranchId, scene?.branchVersion]);
  const snapshot = useRef<{ identity: string; value: DisplayContext } | null>(null);
  if (snapshot.current?.identity !== identity) snapshot.current = { identity, value: { randomSeed: Math.floor(Math.random() * 2 ** 31), now: Date.now() } };
  return snapshot.current.value;
}

/** Message times formatted against the captured clock, each distinct time once. */
export function useStampOf(context: DisplayContext): (ms: number | undefined) => string {
  return useMemo(() => {
    const now = new Date(context.now);
    const seen = new Map<number, string>();
    return (ms: number | undefined): string => (ms === undefined ? "" : seen.get(ms) ?? (seen.set(ms, formatStamp(ms, now)), seen.get(ms)!));
  }, [context]);
}
