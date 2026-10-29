/**
 * What a reply does to the tracker Props that keep time (ChatStore rule 43): the Spellbook's cast is spent by the reply that carried it, and its cooldowns count down on every
 * other reply. Computed in the turn from the state the reply was built on and added to the deltas the checkpoint holds, so `commitTurn` stamps it on the reply's version with the
 * rest: a regenerate builds from the state before the reply it replaces and so ticks once, a cut takes the tick with the reply, and a reply that does not commit changes nothing,
 * so a retry carries the same cast. RoleCall counts nothing down at all (tickCooldowns is only reachable from its /btw agent).
 */
import { afterReplyDeltas, injectionsOf } from "../core/trackers";
import type { Delta } from "../core/scene-state/types";
import type { ChatTrackers, TrackerModule } from "../stage/contracts/chat-tracker-types";
import type { LoadedTurn } from "./scene-turn-load";

/**
 * A cast rides only the NEXT reply. The person records a cast on the newest message, so when that message is a reply being given a new version (or continued), the cast on it is not
 * this reply's: the reply's prompt and its tick leave it alone, and it stays pending for the reply after. The one place the carried set and the tick start from is the entries the turn
 * loaded, so the cast is taken out of them here, once.
 */
export function leaveCastsOnTarget(entries: ChatTrackers, onTarget: readonly Delta[]): ChatTrackers {
  const cast = onTarget.some((d) => d.slot === "tracker.spellbook" && d.path[0] === "pendingCast" && !d.removed);
  const book = entries.spellbook;
  if (!cast || !book || typeof book.data !== "object" || book.data === null || Array.isArray(book.data)) return entries;
  const { pendingCast: _held, ...rest } = book.data as Record<string, unknown>;
  return { ...entries, spellbook: { ...book, data: rest as never } };
}

/** The modules whose note rides this turn's request, by the same rule the assembler uses to put it there. */
export function carriedBy(loaded: Pick<LoadedTurn, "trackers" | "history" | "current">): ReadonlySet<TrackerModule> {
  if (!loaded.trackers) return new Set();
  const turn = loaded.history.filter((m) => m.role === "user").length + (loaded.current.content === "" ? 0 : 1);
  return new Set(injectionsOf(loaded.trackers.entries, loaded.trackers.on, turn).map((i) => i.module));
}

/** The deltas a landed reply makes in the Props that keep time; none when the scene has no Props. */
export function tickDeltas(loaded: Pick<LoadedTurn, "trackers" | "history" | "current">, at: number): Delta[] {
  return loaded.trackers ? afterReplyDeltas(loaded.trackers.entries, loaded.trackers.on, carriedBy(loaded), at) : [];
}
