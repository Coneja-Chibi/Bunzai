/**
 * Generate and Refresh for one tracker item (RoleCall `app/api/chat/generate-tracker-item/route.ts`): one question to the scene's own model, built from the last ten
 * messages by core/trackers/generate.ts, answered as one JSON item, read once at this boundary with at most one repair (the Compendium's `askJson`, the same seam
 * Reconcile Recent Scene uses). It only PROPOSES: the scene is read through a reader that cannot write, so nothing here stores the item; the panel shows it and
 * the person accepts or discards it. An answer that stays unreadable is an error with a reason where RoleCall files a made-up default item as if it had worked.
 */
import { genSpecOf } from "../core/trackers";
import { HISTORY_WINDOW, ITEM_MAX_TOKENS, ITEM_TEMPERATURE, itemMessages, parseItem, repairItem } from "../core/trackers/generate";
import { isRecord } from "../core/guards";
import { TRACKER_MODULES, type TrackerModule } from "../stage/contracts/chat-tracker-types";
import type { Chat, ChatStore } from "../stage/contracts/chat-store";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";
import { askJson, type Ask } from "./compendium-ask";

import { names, type DraftDeps } from "./scene-draft";
import { NoConnectionError } from "./scene-turn";

export interface TrackerItemDeps extends Pick<DraftDeps, "connect" | "readLibrary"> { chats: DraftDeps["chats"] & Pick<ChatStore, "readMessagesBefore"> }

export interface TrackerItemInput {
  chatId: string;
  module: TrackerModule;
  /** Which kind of item the module makes (its variant), when it makes more than one (the Creature Codex: a species or a creature). */
  variant?: string;
  action: "generate" | "refresh";
  /** Generate: the name the item is made for. */
  itemName?: string;
  userGuide?: string;
  /** Refresh: the item as it is now. */
  existing?: unknown;
}

/**
 * Generate and Refresh only propose, so they run at the draft tier (scene-tiers.ts) and refuse to run if the table ever puts them higher; a tier that is not read from
 * the table is a comment, not a control. `tiers` is the table, a parameter so a test can raise one.
 */
export function draftOnly(action: "tracker.generate" | "tracker.refresh", tiers: Readonly<Record<string, string>> = SCENE_ACTION_TIERS): void {
  if (tiers[action] !== "draft") throw new StudioValidationError(`${action} is not a draft action, and this only proposes`);
}

export const NAME_MAX = 120;
export const GUIDE_MAX = 1_000;
const EXISTING_MAX = 50_000;

/** The module's Sub-features the person switched on, from the scene's tracker settings. */
function subsOf(chat: Chat, module: TrackerModule): Record<string, boolean> {
  return Object.fromEntries(Object.entries(chat.trackers?.[module]?.subs ?? {}).filter(([, v]) => v)) as Record<string, boolean>;
}

export async function proposeTrackerItem(deps: TrackerItemDeps, input: TrackerItemInput, signal?: AbortSignal): Promise<{ item: unknown }> {
  draftOnly("tracker.generate");
  if (!TRACKER_MODULES.includes(input.module)) throw new StudioValidationError("that is not a tracker");
  const spec = genSpecOf(input.module, input.variant);
  if (!spec) throw new StudioValidationError("that tracker does not generate items");
  const name = input.itemName?.trim() ?? "";
  if (input.action === "generate" && (name === "" || name.length > NAME_MAX)) throw new StudioValidationError(`give the item a name of up to ${NAME_MAX} characters`);
  if (input.action === "refresh" && (!isRecord(input.existing) || JSON.stringify(input.existing).length > EXISTING_MAX)) throw new StudioValidationError("refresh needs the item as it is now");
  if ((input.userGuide?.length ?? 0) > GUIDE_MAX) throw new StudioValidationError(`the guide is at most ${GUIDE_MAX} characters`);
  const chat = await deps.chats.getChat(input.chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  if (!chat.connection) throw new NoConnectionError();
  const connected = await deps.connect(chat.connection);
  if (!connected) throw new NoConnectionError("this scene's connection is gone from Kit; pick another in the AI wing");
  const who = await names(deps, input.chatId);
  const page = await deps.chats.readMessagesBefore(chat.activeBranchId, { limit: HISTORY_WINDOW, liveOnly: true });
  const transcript = [...page.messages].sort((a, b) => a.seq - b.seq).map((m) => ({ role: m.role, content: m.swipes[m.current]?.content ?? "" }));
  const messages = itemMessages(spec, {
    action: input.action,
    ...(name ? { itemName: name } : {}),
    ...(input.userGuide?.trim() ? { userGuide: input.userGuide.trim() } : {}),
    ...(input.action === "refresh" ? { existing: input.existing } : {}),
    characterName: who.character,
    personaName: who.player,
    transcript,
    subs: subsOf(chat, input.module),
  });
  const request: Ask = { model: chat.connection.model, options: { temperature: ITEM_TEMPERATURE, max_tokens: spec.maxTokens ?? ITEM_MAX_TOKENS }, ...(signal ? { signal } : {}) };
  const read = await askJson(connected, request, messages, parseItem(spec), repairItem);
  if (!read.ok) throw new StudioConflictError(read.error);
  return { item: read.value };
}
