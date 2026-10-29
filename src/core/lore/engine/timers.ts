/**
 * Derived timer state (Bunzai change 1: timers are derived, never stored). Replaces RoleCall's
 * stateful RuntimeStateManager + per-trigger TriggerActivationState (runtime/state.ts, triggers/
 * special.ts) with a pure function over the caller-supplied fire history: a fresh fire starts
 * `sticky` turns of forced firing, then `cooldown` turns when the entry cannot fire (SillyTavern's
 * sequencing - RoleCall itself runs sticky and cooldown concurrently instead; that RoleCall
 * divergence is recorded, not copied). `delay` blocks while messageCount < entry.delay, independent
 * of fire history (RoleCall arms delay on first key match instead; also not copied, per the plan).
 */
import type { LoreFire } from "./types";

export interface TimersIndex {
  /** entryKey -> nearest (smallest) messagesAgo among its fresh fires */
  freshest: Map<string, number>;
  /** trigger keyword -> nearest messagesAgo it matched anywhere (RoleCall's per-trigger frequency key) */
  keywordFreshest: Map<string, number>;
  /** entryKey fired (any reason) exactly 1 message ago: "was active last turn" */
  activeLastTurn: Set<string>;
  /** entryKey has fired (any reason, any messagesAgo) at least once before */
  everFired: Set<string>;
}

export function timersFrom(recentFires: readonly LoreFire[]): TimersIndex {
  const freshest = new Map<string, number>();
  const keywordFreshest = new Map<string, number>();
  const activeLastTurn = new Set<string>();
  const everFired = new Set<string>();

  for (const fire of recentFires) {
    everFired.add(fire.entryKey);
    if (fire.messagesAgo === 1) activeLastTurn.add(fire.entryKey);

    if (fire.fresh) {
      const seen = freshest.get(fire.entryKey);
      if (seen === undefined || fire.messagesAgo < seen) freshest.set(fire.entryKey, fire.messagesAgo);
    }

    for (const keyword of fire.keywords) {
      const seen = keywordFreshest.get(keyword);
      if (seen === undefined || fire.messagesAgo < seen) keywordFreshest.set(keyword, fire.messagesAgo);
    }
  }

  return { freshest, keywordFreshest, activeLastTurn, everFired };
}

/** A fresh fire within the last `sticky` messages forces firing (no key match needed). */
export function isStickyForced(idx: TimersIndex, entryKey: string, sticky: number): boolean {
  if (sticky <= 0) return false;
  const messagesAgo = idx.freshest.get(entryKey);
  return messagesAgo !== undefined && messagesAgo <= sticky;
}

/** After the sticky window ends, `cooldown` more messages block any firing. */
export function isOnCooldown(idx: TimersIndex, entryKey: string, sticky: number, cooldown: number): boolean {
  if (cooldown <= 0) return false;
  const messagesAgo = idx.freshest.get(entryKey);
  if (messagesAgo === undefined) return false;
  return messagesAgo > sticky && messagesAgo <= sticky + cooldown;
}

/** Messages left before an on-cooldown entry can fire again (explain-only diagnostic). Counts down
 * cooldown, cooldown-1, ..., 1 across the blocked window (inclusive of the last blocked message). */
export function cooldownRemaining(idx: TimersIndex, entryKey: string, sticky: number, cooldown: number): number {
  const messagesAgo = idx.freshest.get(entryKey);
  if (messagesAgo === undefined) return 0;
  return Math.max(0, sticky + cooldown - messagesAgo + 1);
}

/** Messages left in an entry's forced-fire window (explain-only diagnostic). Counts down sticky,
 * sticky-1, ..., 1 the same way the old stickyLeft decrement did. */
export function stickyRemaining(idx: TimersIndex, entryKey: string, sticky: number): number {
  const messagesAgo = idx.freshest.get(entryKey);
  if (messagesAgo === undefined) return 0;
  return Math.max(0, sticky - messagesAgo + 1);
}

/** Bunzai's delay rule: blocked while the scene hasn't reached `delay` messages yet. */
export function isDelayBlocked(delay: number, messageCount: number): boolean {
  return delay > 0 && messageCount < delay;
}

/** Per-trigger frequency (RoleCall triggers/special.ts canTriggerActivate), keyed by keyword since
 * that is what RoleCall records - two entries sharing a keyword share one timer there too. */
export function isTriggerReady(idx: TimersIndex, keyword: string, frequency: number | undefined): boolean {
  if (!frequency || frequency <= 0) return true;
  const messagesAgo = idx.keywordFreshest.get(keyword);
  if (messagesAgo === undefined) return true;
  return messagesAgo >= frequency;
}
