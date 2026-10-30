/**
 * Refresh from chat history for one whole tracker (RoleCall `POST /api/chat/initialize-trackers`): one question to the scene's own model, built from the last twenty
 * messages and the opening one (sliced here, once) and from the tracker as it is now, answered as the tracker's new state, read once at this boundary with at most one
 * repair (the same `askJson` seam Generate and Refresh use for an item). It only PROPOSES: the scene is read through a reader that cannot write, so nothing here stores
 * the state; the panel shows what would change and the person accepts or discards it. A provider failure or an answer that stays unreadable is an error with a
 * reason, where RoleCall resets the tracker to its defaults and calls it done.
 */
import { isTrackerModule, parseTrackerData, refreshSpecOf, trackerDataIn } from "../core/trackers";
import { diffModule, parseRefresh, refreshMessages, REFRESH_TEMPERATURE, type ModuleDiff, type Skipped } from "../core/trackers/refresh";
import { MODULE_REFRESH_WINDOW, repairItem, type Line } from "../core/trackers/generate";
import type { TrackerModule } from "../stage/contracts/chat-tracker-types";
import type { ChatStore, Message } from "../stage/contracts/chat-store";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";
import { askJson, type Ask } from "./compendium-ask";

import { names, type DraftDeps } from "./scene-draft";
import { NoConnectionError } from "./scene-turn";
import { draftOnly } from "./scene-tracker-item";

export interface TrackerRefreshDeps extends Pick<DraftDeps, "connect" | "readLibrary" | "now"> {
  chats: DraftDeps["chats"] & Pick<ChatStore, "readMessagesBefore" | "readMessages" | "sceneState">;
  newId: () => string;
}

export interface TrackerRefreshInput { chatId: string; module: TrackerModule }

/** The proposal: the module's whole next state, what it changes, and the entries of the answer that were left out (each with its reason). `chatId` is the scene it was asked of, so a panel can drop an answer that arrives after the person left. */
export interface TrackerRefresh { chatId: string; module: TrackerModule; proposed: unknown; diff: ModuleDiff; skipped: Skipped[] }

const lineOf = (m: Message): Line => ({ role: m.role, content: m.swipes[m.current]?.content ?? "" });

/** The twenty newest live messages and the opening one, oldest first, taken once: the opening is not repeated when the twenty already hold it. */
async function windowOf(chats: TrackerRefreshDeps["chats"], branchId: string): Promise<Line[]> {
  const tail = await chats.readMessagesBefore(branchId, { limit: MODULE_REFRESH_WINDOW, liveOnly: true });
  const opening = (await chats.readMessages(branchId, { limit: 1 })).messages.find((m) => !m.cut);
  const recent = [...tail.messages].sort((a, b) => a.seq - b.seq);
  const all = opening && !recent.some((m) => m.id === opening.id) ? [opening, ...recent] : recent;
  return all.filter((m) => m.role !== "system").map(lineOf);
}

export async function proposeTrackerRefresh(deps: TrackerRefreshDeps, input: TrackerRefreshInput, signal?: AbortSignal): Promise<TrackerRefresh> {
  draftOnly("tracker.refresh");
  const spec = isTrackerModule(input.module) ? refreshSpecOf(input.module) : undefined;
  if (!spec) throw new StudioValidationError("that tracker does not refresh from chat history");
  const chat = await deps.chats.getChat(input.chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  if (!chat.connection) throw new NoConnectionError();
  const connected = await deps.connect(chat.connection);
  if (!connected) throw new NoConnectionError("this scene's connection is gone from Kit; pick another in the AI wing");
  const transcript = await windowOf(deps.chats, chat.activeBranchId);
  if (transcript.length === 0) throw new StudioConflictError("this scene has no messages to refresh from yet");
  const who = await names(deps, input.chatId);
  const subs = chat.trackers?.[input.module]?.subs ?? {};
  // The tracker as the take's tip shows it, with the scene's sub-feature switches.
  const data = trackerDataIn(input.module, (await deps.chats.sceneState(chat.activeBranchId)) ?? {}, subs);
  const messages = refreshMessages(spec, { characterName: who.character, personaName: who.player, transcript, current: spec.rows(data), subs });
  const request: Ask = { model: chat.connection.model, options: { temperature: REFRESH_TEMPERATURE, max_tokens: spec.maxTokens }, ...(signal ? { signal } : {}) };
  const env = { id: deps.newId, now: deps.now() };
  const read = await askJson(connected, request, messages, parseRefresh(spec, data, env, (state) => parseTrackerData(input.module, state)), repairItem);
  if (!read.ok) throw new StudioConflictError(read.error);
  return { chatId: input.chatId, module: input.module, proposed: read.value.state, diff: diffModule(spec, data, read.value.state), skipped: read.value.skipped };
}
