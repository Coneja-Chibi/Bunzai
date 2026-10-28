/**
 * `rebuild`: the scene state after the versions shown along a path (oldest first), from the nearest keyframe (or else the take's base) and the
 * deltas of the versions after it. It also names the keyframes the walk passed (every KEYFRAME_EVERY shown messages)
 * that no one had kept, so a store can keep them. Pure: a store hands in what it holds and writes back what is returned;
 * the keyframes it hands in are never changed.
 */
import { foldInto } from "./fold";
import { KEYFRAME_EVERY, type Delta, type SceneState, type SlotDef } from "./types";

/** A shown message and the version it shows; `swipeId` is null for the message alone (what comes before a new version of it builds from its own message-level deltas, not its versions'). */
export interface ShownVersion { messageId: string; swipeId: string | null }

export interface RebuildInput {
  path: readonly ShownVersion[];
  /** What the take starts with, before any message (an import's variables); nothing when it has none. Used when no keyframe is. */
  base?: SceneState;
  /** Kept states by message id; each is the state after that message and is valid for this path. */
  keyframes: ReadonlyMap<string, SceneState>;
  /** What each message of the path adds, by message id, in fold order: its shown version's deltas first, then the message's own (so they win on that message), each in the order written. A message with none may be missing. */
  deltasOf(path: readonly ShownVersion[]): ReadonlyMap<string, readonly Delta[]>;
  slotOf(id: string): SlotDef | undefined;
}

export function rebuild(input: RebuildInput): { state: SceneState; fresh: [string, SceneState][] } {
  const { path } = input;
  let start = path.length - 1;
  while (start >= 0 && !input.keyframes.has(path[start]!.messageId)) start--;
  // The walk changes this state in place, copying each slot once; a keyframe it passes is kept as a copy.
  const state: SceneState = { ...(start >= 0 ? input.keyframes.get(path[start]!.messageId)! : input.base) };
  const copied = new Set<string>();
  const rest = path.slice(start + 1);
  const deltas = input.deltasOf(rest);
  const fresh: [string, SceneState][] = [];
  rest.forEach((v, i) => {
    const own = deltas.get(v.messageId);
    if (own?.length) foldInto(state, own, input.slotOf, copied);
    if ((start + 1 + i + 1) % KEYFRAME_EVERY === 0) fresh.push([v.messageId, structuredClone(state)]);
  });
  return { state, fresh };
}
