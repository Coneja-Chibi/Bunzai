/**
 * The loadout routes: the scene's live settings (read from the store, never from the open
 * scene, which the lore and props wings do not refresh), the loadout library (studio/loadouts.ts), and a receipt's
 * save, finish and undo. Everything is checked once, in studio/loadout-record.ts.
 */
import { randomUUID } from "node:crypto";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { deleteLoadout, finishReceipt, latestOpenReceipt, listLoadouts, markUndone, restoreLoadout, saveLoadout, saveReceipt } from "../studio/loadouts";
import { err, json, requireStringField } from "./server-security";

type Body = Record<string, unknown>;

/** The writes that name one loadout or receipt: the field that names it, and the work. */
const ACTIONS: Record<string, { key: "id" | "code"; run: (state: StateStore, value: string, b: Body) => Promise<unknown> }> = {
  "/api/chats/loadouts/delete": { key: "id", run: async (state, id) => ({ deleted: await deleteLoadout(state, id, Date.now()) }) },
  "/api/chats/loadouts/restore": { key: "id", run: (state, id) => restoreLoadout(state, id) },
  "/api/chats/loadouts/receipt-finish": { key: "code", run: (state, code, b) => finishReceipt(state, code, b["rows"]) },
  "/api/chats/loadouts/receipt-undone": { key: "code", run: (state, code) => markUndone(state, code, Date.now()) },
};

/** The loadout routes, or null when the path is not one of them. */
export async function handleLoadoutRoute(req: Request, url: URL, chats: ChatStore, state: StateStore, b: Body | null): Promise<Response | null> {
  const p = url.pathname;
  if (req.method === "GET") {
    if (p !== "/api/chats/settings" && p !== "/api/chats/loadouts" && p !== "/api/chats/loadouts/receipt") return null;
    if (p === "/api/chats/loadouts") return json(await listLoadouts(state, url.searchParams.get("removed") === "1"));
    const chatId = url.searchParams.get("chatId") ?? "";
    if (!chatId) return err("expected ?chatId=");
    if (p === "/api/chats/loadouts/receipt") return json(await latestOpenReceipt(state, chatId, Date.now()));
    const chat = await chats.getChat(chatId);
    if (!chat) return err("that scene is gone", 404);
    const { connection, preset, lore, props, prompting, backdrop, regex, finalCut } = chat;
    return json({ connection, preset, lore, props, prompting, backdrop, regex, finalCut, persona: chat.cast.persona?.id ?? null });
  }
  if (!b) return null;
  if (p === "/api/chats/loadouts/save") return json(await saveLoadout(state, b["loadout"], Date.now(), randomUUID));
  if (p === "/api/chats/loadouts/receipt") return json(await saveReceipt(state, b["receipt"], Date.now()));
  const action = ACTIONS[p];
  if (!action) return null;
  const value = requireStringField(b, action.key);
  return value instanceof Response ? value : json(await action.run(state, value, b));
}
