/**
 * `POST /api/chats/compendium`: a scene's Compendium choices (ChatStore rule 38), the one writer. The patch is
 * checked by the store, which refuses anything out of range and changes nothing. Filing and receipts have their
 * own routes (server-chats-compendium.ts); this file holds settings only.
 */
import { str } from "../core/guards";
import type { ChatCompendiumPatch, ChatStore } from "../stage/contracts/chat-store";
import { err, json } from "./server-security";

/** The settings route, or null when the path is not it. */
export async function handleCompendiumSettingsRoute(p: string, chats: ChatStore, b: Record<string, unknown>): Promise<Response | null> {
  if (p !== "/api/chats/compendium") return null;
  const chat = await chats.setCompendium(str(b["chatId"]), b["compendium"] as ChatCompendiumPatch);
  return chat ? json(chat) : err("that scene is gone", 404);
}
