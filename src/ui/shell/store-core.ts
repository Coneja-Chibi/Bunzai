/**
 * Shell store pure helpers - the Workbench recents map's parse + merge (functional core for
 * shell/store.ts). No DOM, no fetch, no zustand: unit-tested directly.
 */

import { keyOf, paneKeyOf } from "../_shared/piece-key";
import { isRecord, presentNum } from "../../core/guards";

// Piece identity moved to _shared/piece-key so apps can use it without touching shell modules.
export { keyOf, paneKey, paneKeyOf } from "../_shared/piece-key";

/** Fail-closed reader: only "key" -> finite-number pairs survive an untrusted persisted blob. */
export function parseRecents(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = presentNum(v);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

/** The two visible pane keys: `activeKey` is the primary (left) pane, `splitKey` the piece pinned
 * beside it ("" = no split). Invariant everywhere: splitKey !== activeKey. */
export interface PaneKeys {
  activeKey: string;
  splitKey: string;
}

/** Focusing a piece keeps both panes visible: focusing the split piece swaps the panes instead of
 * collapsing to a doubled view (the invariant would break); focusing anything else lands it in the
 * primary pane and leaves the split pinned. */
export function focusKeys(cur: PaneKeys, focused: string): PaneKeys {
  if (focused === cur.activeKey) return cur;
  if (focused === cur.splitKey) return { activeKey: cur.splitKey, splitKey: cur.activeKey };
  return { activeKey: focused, splitKey: cur.splitKey };
}

/** Closing a piece: the split slot empties when its piece closes; a closed primary promotes the
 * split piece into the primary pane; otherwise `fallback` (first remaining piece, "" when none)
 * takes the primary. */
export function removeKeys(cur: PaneKeys, removed: string, fallback: string): PaneKeys {
  if (removed === cur.splitKey) return { activeKey: cur.activeKey, splitKey: "" };
  if (removed !== cur.activeKey) return cur;
  if (cur.splitKey) return { activeKey: cur.splitKey, splitKey: "" };
  return { activeKey: fallback, splitKey: "" };
}

/** Pinning a piece beside the primary: pinning the primary itself is a no-op (a piece cannot sit
 * beside itself); with no primary yet the piece becomes the primary instead of a lone split. */
export function besideKeys(cur: PaneKeys, pinned: string): PaneKeys {
  if (!cur.activeKey) return { activeKey: pinned, splitKey: "" };
  if (pinned === cur.activeKey) return cur;
  return { activeKey: cur.activeKey, splitKey: pinned };
}

/** Stamp the given keys as opened at `now`, pruned to the newest `cap` entries (bounded map). */
export function bumpRecents(
  existing: Record<string, number>,
  keys: string[],
  now: number,
  cap: number,
): Record<string, number> {
  const merged = { ...existing };
  for (const k of keys) merged[k] = now;
  const kept = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap);
  return Object.fromEntries(kept);
}

/** The whole recents ritual as one settings patch (parse the persisted blob, stamp `keys`, prune):
 * every open path (send, open, open-beside) applies exactly this, extracted once. */
export function recentsPatch(
  recentsRaw: unknown,
  recentsKey: string,
  keys: string[],
  now: number,
  cap: number,
): Record<string, unknown> {
  return { [recentsKey]: bumpRecents(parseRecents(recentsRaw), keys, now, cap) };
}

/** "Latest request wins": `next()` hands out a token before a request starts; `isLatest()` is true
 * only while no later token has been handed out since - so a slower, older response can never
 * overwrite a newer one (studioCount's race between use-boot.ts and StatusBar.tsx). The same pattern
 * store.ts already inlines for settingsMutationVersion, factored out here because studioCount needs
 * it from two separate callers instead of one.
 *
 * A REJECTED newest request is not this guard's problem: it never calls `isLatest` at all, because
 * there is no result to apply. The displayed value (studioCount) is therefore whatever the last
 * request that actually SUCCEEDED set it to, newest-first or not - a failing fetch never has anything
 * to overwrite it with, by construction, not because this guard special-cases failure. Both callers
 * (use-boot.ts's finishBoot, StatusBar.tsx) only ever call `setStudioCount` from a `.then`, never a
 * `.catch`. */
export function createLatestGuard(): { next: () => number; isLatest: (token: number) => boolean } {
  let seq = 0;
  return { next: () => ++seq, isLatest: (token) => token === seq };
}

/** A minimal piece identity for press-queue ops (the queue stores full summaries; ops key on these). */
export interface PieceRef {
  id: string;
  kind: string;
}

interface PanePiece extends PieceRef {
  params?: { focusEntry?: string };
}

/** Remove one exact pane and reconcile active, split, and entity-level dirty state. */
export function removePieceState<T extends PanePiece>(args: {
  openPieces: readonly T[];
  activeKey: string;
  splitKey: string;
  dirtyPieces: Record<string, boolean>;
  id: string;
  kind: string;
  focusEntry?: string;
}): {
  openPieces: T[];
  activeKey: string;
  splitKey: string;
  dirtyPieces: Record<string, boolean>;
} | null {
  const want = paneKeyOf({
    id: args.id,
    kind: args.kind,
    params: args.focusEntry ? { focusEntry: args.focusEntry } : undefined,
  });
  const exact = args.openPieces.findIndex((piece) => paneKeyOf(piece) === want);
  const index = exact >= 0
    ? exact
    : args.openPieces.findIndex((piece) => piece.id === args.id && piece.kind === args.kind);
  if (index < 0) return null;
  const removedKey = paneKeyOf(args.openPieces[index]!);
  const openPieces = [...args.openPieces.slice(0, index), ...args.openPieces.slice(index + 1)];
  const dirtyPieces = { ...args.dirtyPieces };
  if (!openPieces.some((piece) => piece.id === args.id && piece.kind === args.kind)) {
    delete dirtyPieces[keyOf(args.id, args.kind)];
  }
  return {
    openPieces,
    ...removeKeys(
      { activeKey: args.activeKey, splitKey: args.splitKey },
      removedKey,
      openPieces[0] ? paneKeyOf(openPieces[0]) : "",
    ),
    dirtyPieces,
  };
}

/** Merge a staged batch into the press queue, deduped by kind:id, existing order preserved. */
export function stagePressBatch<T extends PieceRef>(queue: readonly T[], batch: readonly T[]): T[] {
  const have = new Set(queue.map((p) => `${p.kind}:${p.id}`));
  const fresh = batch.filter((p) => {
    const k = `${p.kind}:${p.id}`;
    if (have.has(k)) return false;
    have.add(k);
    return true;
  });
  return fresh.length === 0 ? [...queue] : [...queue, ...fresh];
}

/** Drop one piece from the press queue. */
export function unstagePressPiece<T extends PieceRef>(queue: readonly T[], id: string, kind: string): T[] {
  return queue.filter((p) => !(p.id === id && p.kind === kind));
}
