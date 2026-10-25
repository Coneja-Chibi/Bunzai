/**
 * The recall side of `GET /api/chats/trace` (04b D4): the turn's stored `recall` section (studio/compendium-recall.ts, counts and
 * titles only) with each entry's book named from the scene's books now, so TrackHare can list what the Compendium recalled beside
 * what the lore engine fired. The selector's reason for an entry comes from the same section; it is shown here and never sent to the
 * narrator. A trace older than recall has no section and answers null.
 */
import { isRecord, str } from "../core/guards";
import type { CharacterBody } from "../entities/character/schema";
import type { PersonaBody } from "../entities/persona/schema";
import type { Chat } from "../stage/contracts/chat-store";
import { resolveBooks, type ReadLorebook } from "../studio/scene-lore";
import { splitEntryKey } from "../studio/scene-turn-trace";
import type { TraceRecall, TraceRecallHit } from "./app-contract-scenes";

const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord) : []);
const STATUSES = ["recalled", "empty", "skipped", "failed"] as const;

export async function buildRecall(readLorebook: ReadLorebook, character: CharacterBody, persona: PersonaBody | undefined, chat: Chat, section: Record<string, unknown>): Promise<TraceRecall> {
  const books = await resolveBooks(character, persona, chat.lore, readLorebook);
  const names = new Map(books.flatMap((r) => (r.book ? [[r.id, r.book.name] as const] : [])));
  const reasons = new Map(list(section["selected"]).map((s) => [str(s["entryKey"]), str(s["reason"])]));
  const hit = (h: Record<string, unknown>): TraceRecallHit => {
    const { bookId, entryId } = splitEntryKey(str(h["entryKey"]));
    return { bookId, entryId, bookName: names.get(bookId) ?? bookId, title: str(h["title"]) || entryId, tokens: typeof h["tokens"] === "number" ? h["tokens"] : 0, reason: reasons.get(str(h["entryKey"])) ?? "" };
  };
  const status = STATUSES.find((s) => s === section["status"]) ?? "failed";
  return {
    status,
    ...(typeof section["reason"] === "string" ? { reason: section["reason"] } : {}),
    ...(typeof section["model"] === "string" ? { model: section["model"] } : {}),
    calls: typeof section["calls"] === "number" ? section["calls"] : 0,
    cached: section["cached"] === true,
    injected: list(section["injected"]).map(hit),
    cut: list(section["cut"]).map(hit),
    alreadyPlaced: Array.isArray(section["alreadyPlaced"]) ? section["alreadyPlaced"].length : 0,
  };
}
