/**
 * The memory ChatStore's records (chat-store.ts and chat-store-turns.ts share them): what it keeps
 * for each chat, message, and swipe, and the deep copy it hands out in place of a record.
 */
import type { CastSnapshot, Chat, DirectorState, JsonObject, Message, MessageRole, Swipe } from "../../contracts/chat-store";
import type { PartText } from "../../contracts/content-store";
import type { CutScope } from "../chat-rules";

export interface SwipeRecord extends Swipe {
  /** Every text this swipe had before its current one, oldest first. */
  history: string[];
  /** The prompt trace a committed turn stored with it (spec rule 15); never handed out with the message. */
  trace?: JsonObject;
  /** The Director's snapshot for this version (spec rule 47); never handed out with the message. */
  director?: { version: number; state: DirectorState };
  /** Epoch ms the version was removed (spec rule 32); a removed version stays here, out of every read. */
  cutAt?: number;
}

export interface MessageRecord {
  id: string;
  branchId: string;
  seq: number;
  role: MessageRole;
  swipes: SwipeRecord[];
  current: number;
  createdAt: number;
  /** The persona stamp (spec rule 26); see Message.persona. */
  persona?: Message["persona"];
  /** Hidden from the prompt (spec rule 30). */
  hidden?: true;
  /** `tail` is the branch's last sequence when the cut was made: anything past it came later (rule 11). */
  cut?: { id: string; at: number; scope: CutScope; tail: number };
}

export interface ChatRecord {
  chat: Chat;
  snapshotParts: PartText[];
  /** The snapshot setCast replaced, while revertCast can put it back (spec rule 13). */
  previousSnapshotParts?: PartText[];
  deletedAt: number | null;
  /** The history's source (rule 33), while the scene holds one. */
  source?: string;
}

/** The live versions of a message: positions in `swipes`, oldest first. Public numbers count these only (rule 32). */
export const livePositions = (m: MessageRecord): number[] => m.swipes.flatMap((s, i) => (s.cutAt === undefined ? [i] : []));
/** The public number of the version at `position`: how many live versions come before it. */
export const ordinalOf = (m: MessageRecord, position: number): number => m.swipes.slice(0, position).filter((s) => s.cutAt === undefined).length;
/** A copy of a message for another take: live versions only, `current` kept on the same version (rules 6 and 32). */
export const copyRecord = (m: MessageRecord, id: string, branchId: string, current: number): MessageRecord => {
  const copy: MessageRecord = { ...structuredClone(m), id, branchId };
  copy.swipes = copy.swipes.filter((s) => s.cutAt === undefined);
  copy.current = ordinalOf(m, current);
  return copy;
};

/** Where a take forked: the live messages of its parent up to and including the fork message; null for the original or a fork message that is gone. */
export const forkPositionOf = (b: { parentBranchId: string | null; forkMessageId: string | null }, messages: ReadonlyMap<string, MessageRecord>, order: ReadonlyMap<string, string[]>): number | null => {
  const at = b.forkMessageId === null ? undefined : messages.get(b.forkMessageId);
  if (!at || b.parentBranchId === null) return null;
  return (order.get(b.parentBranchId) ?? []).filter((id) => { const m = messages.get(id)!; return !m.cut && m.seq <= at.seq; }).length;
};

export const publicMessage = (m: MessageRecord): Message => ({
  id: m.id,
  branchId: m.branchId,
  seq: m.seq,
  role: m.role,
  current: ordinalOf(m, m.current),
  createdAt: m.createdAt,
  swipes: m.swipes.filter((s) => s.cutAt === undefined).map(({ history: _history, trace: _trace, director: _director, cutAt: _cutAt, ...swipe }) => structuredClone(swipe)),
  ...(m.persona === undefined ? {} : { persona: m.persona }),
  ...(m.hidden ? { hidden: true as const } : {}),
  ...(m.cut ? { cut: { id: m.cut.id, at: m.cut.at } } : {}),
});
