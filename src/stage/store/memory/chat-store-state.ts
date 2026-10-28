/**
 * The memory ChatStore's scene state (rule 17): the deltas each version carries (kept by swipe id, so a fork's copy of a message
 * shares its prefix's deltas without copying them), the deltas a message carries whichever version shows (kept by message id, so
 * they belong to one take and a fork copies them), the tip cache of each branch, and the keyframes. A message's own deltas fold
 * after its shown version's, so they win on that message. Every method that changes what a branch shows calls `refresh` from the first message it changed, so
 * the tip cache is rebuilt in the same synchronous step and no caller can forget it.
 */
import type { Delta, SceneState } from "../../../core/scene-state/types";
import type { ChatStore } from "../../contracts/chat-store";
import { baseState, changed, checkImportedDeltas, rebuildState } from "../scene-state-rules";
import type { ChatRecord, MessageRecord } from "./chat-records";

export interface StateDeps {
  messages: Map<string, MessageRecord>;
  branchOrder: Map<string, string[]>;
  liveChatOfBranch(branchId: string): ChatRecord | null;
}

export interface MemoryState {
  api: Pick<ChatStore, "sceneState" | "sceneStateBefore" | "recordMessageDeltas" | "setBranchBase">;
  /** Rebuilds the branch's tip cache; keyframes at or after `fromSeq` are dropped first. */
  refresh(branchId: string, fromSeq?: number): void;
  /** Forgets a branch's cache and keyframes. */
  drop(branchId: string): void;
  /** Keeps a turn's deltas with the version it stored. */
  stamp(swipeId: string, deltas: readonly Delta[]): void;
  /** Gives a new take its own copy of another's base and rebuilds it. */
  copyBase(fromBranchId: string, toBranchId: string): void;
  /** Gives a copy of a message (a fork's, a restored take's) its own copy of what the original carries. */
  copyMessageDeltas(fromId: string, toId: string): void;
}

export function stateMethods(d: StateDeps): MemoryState {
  const swipeDeltas = new Map<string, Delta[]>();
  const messageDeltas = new Map<string, Delta[]>();
  const bases = new Map<string, SceneState>();
  const tips = new Map<string, SceneState>();
  const keyframes = new Map<string, Map<string, { seq: number; state: SceneState }>>();
  type Shown = { messageId: string; swipeId: string | null };

  /** The versions a branch shows, oldest first: live messages only, each with the version it points at. */
  const shownPath = (branchId: string, beforeSeq = Number.POSITIVE_INFINITY): Shown[] =>
    (d.branchOrder.get(branchId) ?? []).map((id) => d.messages.get(id)!).filter((m) => !m.cut && m.seq < beforeSeq).map((m) => ({ messageId: m.id, swipeId: m.swipes[m.current]!.id }));
  const build = (branchId: string, path: Shown[]) =>
    rebuildState({
      path,
      ...(bases.has(branchId) ? { base: bases.get(branchId)! } : {}),
      keyframes: new Map([...(keyframes.get(branchId) ?? [])].map(([id, k]) => [id, k.state])),
      deltasOf: (shown) => new Map(shown.map((p) => [p.messageId, [...(p.swipeId === null ? [] : (swipeDeltas.get(p.swipeId) ?? [])), ...(messageDeltas.get(p.messageId) ?? [])]])),
    });
  /** The state a message builds from: everything shown before it, and its own message-level deltas. */
  const stateBefore = (branchId: string, m: MessageRecord): SceneState => build(branchId, [...shownPath(branchId, m.seq), { messageId: m.id, swipeId: null }]).state;

  const refresh = (branchId: string, fromSeq = 0): void => {
    const kept = keyframes.get(branchId) ?? new Map();
    for (const [id, k] of kept) if (k.seq >= fromSeq) kept.delete(id);
    const { state, fresh } = build(branchId, shownPath(branchId));
    for (const [id, s] of fresh) kept.set(id, { seq: d.messages.get(id)!.seq, state: s });
    keyframes.set(branchId, kept);
    tips.set(branchId, state);
  };

  return {
    refresh,
    drop: (branchId) => {
      tips.delete(branchId);
      keyframes.delete(branchId);
    },
    stamp: (swipeId, add) => {
      if (add.length > 0) swipeDeltas.set(swipeId, [...(swipeDeltas.get(swipeId) ?? []), ...structuredClone(add)]);
    },
    copyBase: (fromBranchId, toBranchId) => {
      const base = bases.get(fromBranchId);
      if (base) bases.set(toBranchId, structuredClone(base));
      refresh(toBranchId);
    },
    copyMessageDeltas: (fromId, toId) => {
      const own = messageDeltas.get(fromId);
      if (own) messageDeltas.set(toId, structuredClone(own));
    },
    api: {
      async sceneState(branchId) {
        if (!d.liveChatOfBranch(branchId)) return null;
        return structuredClone(tips.get(branchId) ?? build(branchId, shownPath(branchId)).state);
      },

      async sceneStateBefore(branchId, messageId) {
        const m = d.messages.get(messageId);
        if (!m || m.branchId !== branchId || m.cut || !d.liveChatOfBranch(branchId)) return null;
        return structuredClone(stateBefore(branchId, m));
      },

      async setBranchBase(branchId, raw) {
        const deltas = checkImportedDeltas(raw);
        if (!d.liveChatOfBranch(branchId)) return false;
        if (deltas.length === 0) bases.delete(branchId);
        else bases.set(branchId, baseState(deltas));
        refresh(branchId);
        return true;
      },

      async recordMessageDeltas(branchId, messageId, raw) {
        checkImportedDeltas(raw);
        const m = d.messages.get(messageId);
        if (!m || m.branchId !== branchId || m.cut || !d.liveChatOfBranch(branchId)) return false;
        const own = messageDeltas.get(messageId) ?? [];
        const added = changed(stateBefore(branchId, m), checkImportedDeltas(raw));
        if (added.length > 0) {
          messageDeltas.set(messageId, [...own, ...added]);
          refresh(branchId, m.seq);
        }
        return true;
      },
    },
  };
}
