/**
 * What a committed reply does to the tracker Props that keep time (ChatStore rule 43): the Spellbook's cast is spent by the reply that carried it, and its
 * cooldowns count down on every other reply. Best-effort and after the commit, like the meter's lesson: a reply never fails over a tracker, and a reply that did
 * not commit changes nothing, so a retry carries the same cast. RoleCall counts nothing down at all (tickCooldowns is only reachable from its /btw agent).
 */
import { dataAfterReply, hasAfterReply, injectionsOf } from "../core/trackers";
import { TRACKER_MODULES, TRACKER_PROP_PREFIX, type TrackerModule } from "../stage/contracts/chat-tracker-types";
import type { ChatStore, JsonValue } from "../stage/contracts/chat-store";
import type { LoadedTurn } from "./scene-turn-load";

/** The modules whose note rides this turn's request, by the same rule the assembler uses to put it there. */
export function carriedBy(loaded: Pick<LoadedTurn, "trackers" | "history" | "current">): ReadonlySet<TrackerModule> {
  if (!loaded.trackers) return new Set();
  const turn = loaded.history.filter((m) => m.role === "user").length + (loaded.current.content === "" ? 0 : 1);
  return new Set(injectionsOf(loaded.trackers.entries, loaded.trackers.on, turn).map((i) => i.module));
}

export async function trackersAfterReply(chats: Pick<ChatStore, "getChat" | "setTracker">, chatId: string, carried: ReadonlySet<TrackerModule>): Promise<void> {
  const chat = await chats.getChat(chatId);
  if (!chat?.trackers || !chat.props) return;
  for (const module of TRACKER_MODULES) {
    const entry = chat.trackers[module];
    if (!entry || !hasAfterReply(module) || !chat.props.on.includes(`${TRACKER_PROP_PREFIX}${module}`)) continue;
    const next = dataAfterReply(module, entry.data, carried.has(module));
    if (next !== undefined) await chats.setTracker(chatId, module, { data: next as JsonValue });
  }
}
