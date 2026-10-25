/**
 * How far back `assemble()` must actually look before it is safe to skip the rest of stored history:
 * a cheap, conservative floor on how many of the newest
 * history messages a pre-trim must keep, and a cheap lower bound on a message's token cost, used by
 * `budget-app.ts`'s `fitHistory` to decide how much of the oldest history the macro pass and the real
 * per-message token count never need to touch. Both are pure arithmetic and role comparisons: no
 * macro evaluation, no tokenizer call, so their cost never becomes the thing this file exists to
 * avoid.
 *
 * `minHistoryKeep` only ever over-asks. `buildConversation`, `injectAtDepth` and `appendAtDepth`
 * (conversation.ts) place a depth note, an in-chat block or an append block by counting backward
 * through the *conversational* (user/assistant) messages in the assembled region, which also holds
 * the greeting and the current message; append additionally requires the counted message's role to
 * match the item's own. This counts only over stored history and ignores the greeting's and the
 * current message's free contribution, so the truth is always at least as forgiving as what this
 * returns - it can make a pre-trim keep one turn's worth of messages it strictly did not need, never
 * fewer than it needed.
 */
import type { AssembledRole } from "./types";

const conversational = (role: AssembledRole): boolean => role === "user" || role === "assistant";

/**
 * How many of the newest `roles` (oldest first) must be kept so that at least `depth + 1` of them
 * satisfy `matchRole` (or are merely conversational, when `matchRole` is omitted, for a depth note or
 * an in-chat block). Fewer than `depth + 1` matches exist at all: keeps everything, the same "ran out
 * of history" case `buildConversation`'s overflow bucket and `appendAtDepth`'s "insert new" fallback
 * are already built to answer identically whether or not the earlier messages are on hand.
 */
function keepForDepth(roles: readonly AssembledRole[], depth: number, matchRole?: AssembledRole): number {
  if (depth < 0) return 0;
  let seen = 0;
  for (let i = roles.length - 1; i >= 0; i--) {
    if (matchRole ? roles[i] === matchRole : conversational(roles[i]!)) {
      seen++;
      if (seen > depth) return roles.length - i;
    }
  }
  return roles.length;
}

/** One depth-keyed placement a pre-trim must not cut through: `role` narrows an append item's own
 * role match (conversation.ts's `appendAtDepth` treats anything but "assistant" as "user"); absent,
 * any conversational message counts (depth notes, in-chat blocks). */
export interface DepthPlacement {
  depth: number;
  role?: AssembledRole;
}

/**
 * The fewest of the newest `roles` a pre-trim may drop below, across every depth placement this turn
 * has (card depth notes, the preset's in-chat blocks, append blocks, and any lore hit already folded
 * into those same maps before this runs). 0 when the turn places nothing by depth: the common case,
 * and the one a long plain scene hits on every send.
 */
export function minHistoryKeep(roles: readonly AssembledRole[], placements: readonly DepthPlacement[]): number {
  let min = 0;
  for (const { depth, role } of placements) min = Math.max(min, keepForDepth(roles, depth, role));
  return min;
}
