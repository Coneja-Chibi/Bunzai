/**
 * A request to open one library tracker in the Trackers panel, made from a change chip under a reply. The chip opens the Trackers program (program-open.ts) and leaves the tracker's id here, per
 * scene, until the panel takes it: the panel may not be mounted yet when the chip is clicked, so the request waits for it, and each request is taken once (a panel opened later does not re-open a
 * tracker that was asked for a minute ago).
 */
import { useSyncExternalStore } from "react";
import { openProgram } from "../../program-open";

const asked = new Map<string, string>();
const listeners = new Set<() => void>();
const changed = (): void => { for (const l of listeners) l(); };

/** The program the library trackers are drawn in (programs.ts `trackersProgram`). */
export const TRACKERS_PROGRAM = "trackers";

export function requestTrackerOpen(chatId: string, trackerId: string): void {
  asked.set(chatId, trackerId);
  changed();
  openProgram(TRACKERS_PROGRAM);
}

/** The tracker asked for in this scene and not yet taken, or null. */
export function useRequestedTracker(chatId: string): string | null {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => asked.get(chatId) ?? null, () => null);
}

/** The panel has acted on the request. */
export function takeTrackerOpen(chatId: string): void {
  if (asked.delete(chatId)) changed();
}
