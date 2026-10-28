/**
 * Whether the library holds any tracker, read from the piece store the app already keeps current (ctx.pieces: its listing follows the studio's change events, so a tracker made in the
 * Workbench shows here without a reload or a read of our own). The Trackers program is reachable while it does, so a scene that links none and has no built-in on can still add its first,
 * and unchecking the last one does not strand the person.
 */
import { useSyncExternalStore } from "react";
import type { PieceStore } from "../../../../../_shared/piece-store";

export function useLibraryHasTrackers(pieces: PieceStore | undefined): boolean {
  const listing = useSyncExternalStore((cb) => pieces?.subscribeList(cb) ?? (() => undefined), () => pieces?.listSnapshot(), () => undefined);
  return listing?.some((p) => p.kind === "tracker") ?? false;
}
