/**
 * The Compendium's model-built tree routes under /api/chats/compendium (04b Track D3): read a book's stored layout, build one with
 * the Compendium's model, move an entry in it, and take the newest back; and Import chat history: start a run, read its state, cancel it, undo it. Bodies are parsed once here; every change joins the
 * scene's lane, so a build, a move and a filing of one scene run one after another. Nothing here writes a book. Reached from
 * `handleCompendiumRoute`, which owns the prefix and the deps check.
 */
import { str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { CompendiumDeps } from "../studio/compendium-deps";
import { enqueue } from "../studio/compendium-queue";
import { cancelIngest, latestRun, startIngest, undoIngest } from "../studio/compendium-ingest";
import { buildCompendiumTree, moveEntryInTree, undoCompendiumTree } from "../studio/compendium-tree";
import { err, json } from "./server-security";

type Body = Record<string, unknown>;

export async function handleCompendiumAiRoute(req: Request, url: URL, chats: ChatStore, deps: CompendiumDeps, b: Body | null): Promise<Response | null> {
  const p = url.pathname;
  if (req.method === "GET") {
    if (p === "/api/chats/compendium/ingest") {
      const id = url.searchParams.get("chatId") ?? "";
      const chat = await chats.getChat(id);
      return chat ? json({ total: await chats.countMessages(chat.activeBranchId), run: latestRun(id) }) : err("that scene is gone", 404);
    }
    if (p !== "/api/chats/compendium/tree") return null;
    const chatId = url.searchParams.get("chatId") ?? "";
    if (!(await chats.getChat(chatId))) return err("that scene is gone", 404);
    return json({ tree: await chats.currentTree(chatId, url.searchParams.get("bookId") ?? "") });
  }
  if (!b) return null;
  const chatId = str(b["chatId"]);
  const bookId = str(b["bookId"]);
  if (p === "/api/chats/compendium/ingest-start") return json({ run: await startIngest(deps, { chatId, bookId, from: Number(b["from"]), to: Number(b["to"]) }) });
  if (p === "/api/chats/compendium/ingest-cancel") return json({ cancelled: cancelIngest(chatId, str(b["runId"])) });
  if (p === "/api/chats/compendium/ingest-undo") return json(await undoIngest(deps, chatId, str(b["runId"])));
  if (p === "/api/chats/compendium/tree-build") return json(await buildCompendiumTree(deps, chatId, bookId));
  if (p === "/api/chats/compendium/tree-undo") return json(await enqueue(chatId, () => undoCompendiumTree(deps, chatId, bookId)));
  if (p === "/api/chats/compendium/tree-move") {
    const entryId = str(b["entryId"]);
    const nodeId = str(b["nodeId"]);
    if (!entryId || !nodeId) return err("expected { chatId, bookId, entryId, nodeId }");
    return json({ tree: await enqueue(chatId, () => moveEntryInTree(deps, chatId, bookId, entryId, nodeId)) });
  }
  return null;
}
