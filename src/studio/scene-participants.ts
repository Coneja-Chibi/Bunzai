/**
 * RECONCILE RECENT SCENE for the Cast wing's Participants tab (RoleCall `app/api/chat/[chatId]/participants/reconcile/route.ts`): one
 * model-charged check of the newest N messages of the scene's take, asked of the scene's own model through `askJson` (one JSON answer,
 * at most one repair). It only PROPOSES; RoleCall writes straight away, here nothing is stored until the person confirms, and the
 * confirmed run is one `run` id on the stored participants, so Undo retires exactly what it added.
 * A malformed answer or a provider failure is an error and proposes nothing. Apply and Undo join the scene's lane.
 */
import { chunkMessages, parseReconcile, propose, reconcileMessages, repairReconcile, RECONCILE_MAX_MESSAGES, type Proposal } from "../core/participants/reconcile";
import type { Chat } from "../stage/contracts/chat-store";
import { StudioConflictError, StudioNotFoundError } from "./errors";
import { bodyOf, optStr, recOr } from "../core/guards";

import { loadCast } from "./scene-turn-load";
import { askJson, type Ask } from "./compendium-ask";
import type { CompendiumDeps } from "./compendium-deps";
import { enqueue } from "./compendium-queue";

export type ParticipantDeps = Pick<CompendiumDeps, "chats" | "connect" | "newId">;

const TEMPERATURE = 0.1;

/** Every name the roster holds, retired included, the card's and the persona's too: what a proposal must not repeat. The names come from the scene's frozen cast. */
async function rosterNames(deps: ParticipantDeps, chat: Chat): Promise<{ name: string; kind: string }[]> {
  const cast = await loadCast(deps.chats, chat.id);
  const nameOf = (piece: unknown, key: "identity" | null): string => optStr(key ? recOr(bodyOf(piece)[key])["name"] : bodyOf(piece)["name"])?.trim() ?? "";
  const own = chat.participants?.people.flatMap((p) => (p.name ? [{ name: p.name, kind: p.kind }] : [])) ?? [];
  const card = nameOf(cast?.snapshot.character, "identity") || chat.cast.character.name || "";
  const player = (cast?.snapshot.persona ? nameOf(cast.snapshot.persona, null) : "") || chat.cast.persona?.name || "";
  return [{ name: card, kind: "card" }, { name: player, kind: "player" }, ...own].filter((r) => r.name !== "");
}

export async function proposeParticipants(deps: ParticipantDeps, chatId: string, count: number, signal?: AbortSignal): Promise<Proposal & { messages: number }> {
  if (!Number.isInteger(count) || count < 1 || count > RECONCILE_MAX_MESSAGES) throw new StudioConflictError(`pick 1 to ${RECONCILE_MAX_MESSAGES} messages`);
  const chat = await deps.chats.getChat(chatId);
  if (!chat) throw new StudioNotFoundError("that scene is gone");
  if (!chat.connection) throw new StudioConflictError("this scene has no connection to reconcile with");
  const connected = await deps.connect(chat.connection);
  if (!connected) throw new StudioConflictError("the connection is gone from Kit");
  const page = await deps.chats.readMessagesBefore(chat.activeBranchId, { limit: count, liveOnly: true });
  const texts = [...page.messages].sort((a, b) => a.seq - b.seq).map((m) => m.swipes[m.current]?.content ?? "").filter((t) => t.trim() !== "");
  if (texts.length === 0) throw new StudioConflictError("there are no recent messages to reconcile");
  const roster = await rosterNames(deps, chat);
  const ask: Ask = { model: chat.connection.model, options: { temperature: TEMPERATURE, max_tokens: 700 }, ...(signal ? { signal } : {}) };
  const answers: { name: string; description: string | null }[][] = [];
  for (const chunk of chunkMessages(texts)) {
    const read = await askJson(connected, ask, reconcileMessages(chunk, roster), parseReconcile, repairReconcile);
    if (!read.ok) throw new StudioConflictError(read.error);
    answers.push(read.value);
  }
  return { ...propose(answers, roster.map((r) => r.name)), messages: texts.length };
}

/** Stores the confirmed candidates as one run. They are checked again against the roster as it is now; what is left of them is added, or nothing. */
export function applyParticipants(deps: ParticipantDeps, chatId: string, people: readonly { name: string; description: string | null }[]): Promise<{ run: string | null; added: number; chat: Chat }> {
  return enqueue(chatId, async () => {
    const chat = await deps.chats.getChat(chatId);
    if (!chat) throw new StudioNotFoundError("that scene is gone");
    const left = propose([people], (await rosterNames(deps, chat)).map((r) => r.name)).candidates;
    if (left.length === 0) return { run: null, added: 0, chat };
    const run = deps.newId();
    const next = await deps.chats.updateParticipants(chatId, { op: "add", run, people: left.map((c) => ({ name: c.name, ...(c.description ? { description: c.description } : {}) })) });
    if (!next) throw new StudioNotFoundError("that scene is gone");
    return { run, added: left.length, chat: next };
  });
}

/** Retires everything a confirmed run added. */
export function undoParticipantRun(deps: ParticipantDeps, chatId: string, run: string): Promise<Chat> {
  return enqueue(chatId, async () => {
    const next = await deps.chats.updateParticipants(chatId, { op: "undo", run });
    if (!next) throw new StudioNotFoundError("that scene is gone");
    return next;
  });
}
