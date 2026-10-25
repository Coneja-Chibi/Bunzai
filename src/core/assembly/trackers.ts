/**
 * The trackers' block of the request (RoleCall `worker.ts:2426-2461`, `immersion-context.ts:480-486`): the state of every tracker Prop that is
 * on, as one system message headed "### Current Game State (Immersion Trackers)", after the guides and before the conversation. A tracker
 * that is off adds nothing however much it kept (VVS-825); one whose AI Context is Never, or not due this turn, adds nothing either.
 *
 * RoleCall never sends this to the narrator: its client sends `immersionInjection: "dm_only"` and the worker injects for `"always"` only
 * (useChatMessageHandlers.ts:900-901, jobs/immersion-injection.ts:6), so with the Story Director off a tracker changes nothing the model
 * reads. Here the narrator reads what the person keeps, which is what that dead branch and its test intend.
 */
import { TRACKER_PROP_PREFIX, type ChatTrackers } from "../../stage/contracts/chat-tracker-types";
import { PROMPT_ORDER, contextDue, injectionsOf, trackerLines } from "../trackers";
import type { Block } from "./conversation";

export const TRACKERS_HEADER = "### Current Game State (Immersion Trackers)";

export interface TrackersInput {
  /** What the scene kept, per module (ChatStore rule 43). */
  entries: ChatTrackers;
  /** The scene's switched-on Props (rule 21); a tracker is on when `tracker-<module>` is here. */
  on: readonly string[];
}

/** The block's text for this turn, or "" when no tracker has anything to say. `turn` counts the user messages including the one being answered. */
export function trackersText(input: TrackersInput | undefined, turn: number): string {
  if (!input) return "";
  const lines = PROMPT_ORDER.flatMap((module) => {
    if (!input.on.includes(`${TRACKER_PROP_PREFIX}${module}`)) return [];
    const entry = input.entries[module];
    return contextDue(entry?.context, turn) ? trackerLines(module, entry?.data) : [];
  });
  return lines.length === 0 ? "" : `${TRACKERS_HEADER}\n\n${lines.join("\n")}`;
}

/** The notes tracker Props hold for this reply (the Spellbook's cast, RoleCall's spellCastInjection, worker.ts:2463), each its own system message after the block. */
export const injectionTexts = (input: TrackersInput | undefined, turn: number): string[] => (input ? injectionsOf(input.entries, input.on, turn).map((i) => i.text) : []);

/** The request with a prop's block placed: after the leading system messages and the guides' block (and any block placed before it), in front of the conversation. */
export function placeBlock(blocks: readonly Block[], text: string, kind: "trackers" | "storyboards"): Block[] {
  let at = 0;
  while (at < blocks.length && blocks[at]!.role === "system") at++;
  return [...blocks.slice(0, at), { role: "system", content: text, source: { kind } }, ...blocks.slice(at)];
}
