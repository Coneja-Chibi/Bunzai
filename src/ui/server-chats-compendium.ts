/**
 * The Compendium's routes under /api/chats/compendium (04b C1): the scene's receipts for Activity, Undo and File again, the take's
 * Undo, Clear feed (a watermark, never a delete), and Reconcile's list and its MIRROR and KEEP. Every book change goes through the
 * studio modules and the one book writer; nothing here writes a book. Each call joins the scene's lane, so it is ordered with the
 * filing passes that may be running. Bodies are parsed once here.
 */
import { str } from "../core/guards";
import type { ReconcilePair } from "../core/compendium";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import type { StudioStoreLike } from "../studio/contracts";
import type { CompendiumDeps } from "../studio/compendium-deps";
import { fileReply } from "../studio/compendium-filing";
import { enqueue } from "../studio/compendium-queue";
import { lockedBooks } from "../studio/compendium-standardize";
import { reconcileApply, reconcileList } from "../studio/compendium-reconcile";
import { undoAll, undoableReceipts, undoReceipt } from "../studio/compendium-undo";
import { libraryStateFor } from "../studio/library-content";
import { handleCompendiumAiRoute } from "./server-chats-compendium-ai";
import { handleStandardizeRoute } from "./server-chats-compendium-standardize";
import { connect } from "../kit/providers/scene-connect";
import { err, json } from "./server-security";

type Body = Record<string, unknown>;

/** The deps every Compendium pass runs with, or null when this library cannot patch books. */
export function compendiumDepsFor(chats: ChatStore, state: StateStore, store: StudioStoreLike | undefined): CompendiumDeps | null {
  if (!store?.comparePatch) return null;
  return { chats, state, store, connect, readLibrary: (kind, id) => store.read(kind, id), now: Date.now, newId: () => crypto.randomUUID() };
}

/** The same deps from the open library alone, for a route that has the store but not its state. */
export function compendiumDepsOf(chats: ChatStore, store: StudioStoreLike): CompendiumDeps | null {
  const state = libraryStateFor(store.studioPath());
  return state ? compendiumDepsFor(chats, state, store) : null;
}

const pairsOf = (raw: unknown): ReconcilePair[] | null => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return null;
  const out = raw.map((p) => (typeof p === "object" && p !== null ? { sourceEntryId: str((p as Body)["sourceEntryId"]), targetEntryId: str((p as Body)["targetEntryId"]) } : null));
  return out.every((p) => p && p.sourceEntryId && p.targetEntryId) ? (out as ReconcilePair[]) : null;
};

export async function handleCompendiumRoute(req: Request, url: URL, chats: ChatStore, deps: CompendiumDeps | null, b: Body | null): Promise<Response | null> {
  const p = url.pathname;
  if (!p.startsWith("/api/chats/compendium/")) return null;
  if (!deps) return err("book writes are unavailable", 501);
  const ai = await handleCompendiumAiRoute(req, url, chats, deps, b);
  if (ai) return ai;
  const standardize = await handleStandardizeRoute(req, url, chats, deps, b);
  if (standardize) return standardize;
  if (req.method === "GET") {
    const chatId = url.searchParams.get("chatId") ?? "";
    if (p === "/api/chats/compendium/receipts") {
      const chat = await chats.getChat(chatId);
      if (!chat) return err("that scene is gone", 404);
      const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
      const before = url.searchParams.get("before") ?? undefined;
      const branchId = url.searchParams.get("branchId") ?? undefined;
      const receipts = await chats.listReceipts(chatId, { ...(branchId ? { branchId } : {}), ...(before ? { before } : {}), ...(limit === undefined ? {} : { limit }) });
      return json({ receipts, feedClearedAt: chat.compendium?.feedClearedAt ?? 0 });
    }
    if (p === "/api/chats/compendium/reconcile") return json({ rows: await reconcileList(deps, chatId, url.searchParams.get("bookId") ?? "") });
    return err("not found", 404);
  }
  if (!b) return null;
  const chatId = str(b["chatId"]);
  // While a Standardize run works on a book its edits are paused (RoleCall's lock banner): Reconcile and Undo write to books the run is rewriting.
  const paused = (bookId?: string): Response | null =>
    (bookId === undefined ? lockedBooks(chatId).length > 0 : lockedBooks(chatId).includes(bookId)) ? err("Standardization in progress. Edits are paused to avoid clobbering work in flight", 409) : null;
  if (p === "/api/chats/compendium/undo" || p === "/api/chats/compendium/undo-take") { const stop = paused(); if (stop) return stop; }
  if (p === "/api/chats/compendium/undo") return json(await enqueue(chatId, () => undoReceipt(deps, chatId, str(b["receiptId"]))));
  if (p === "/api/chats/compendium/undo-take") {
    const branchId = str(b["branchId"]);
    return json(await enqueue(chatId, async () => undoAll(deps, chatId, await undoableReceipts(deps, chatId, branchId, () => true))));
  }
  if (p === "/api/chats/compendium/clear-feed") {
    const chat = await chats.setCompendium(chatId, { feedClearedAt: Date.now() });
    return chat ? json({ feedClearedAt: chat.compendium?.feedClearedAt ?? 0 }) : err("that scene is gone", 404);
  }
  if (p === "/api/chats/compendium/file-again") {
    const r = await chats.receipt(str(b["receiptId"]));
    if (!r || r.chatId !== chatId || r.kind !== "filing" || !r.messageId || !r.swipeId) return err("that is not a filing to repeat", 404);
    const page = await chats.readMessagesBefore(r.branchId, { limit: 200 });
    const at = page.messages.findIndex((m) => m.id === r.messageId);
    const reply = page.messages[at];
    const swipe = reply?.swipes.find((s) => s.id === r.swipeId);
    if (!reply || !swipe) return err("that reply or version is no longer on the take", 404);
    const covered = page.messages.slice(0, at).filter((m) => m.role === "user").slice(-1).map((m) => m.swipes[m.current]?.content ?? "");
    const filed = await enqueue(chatId, () => fileReply(deps, { chatId, branchId: r.branchId, messageId: reply.id, swipeId: swipe.id, reply: swipe.content, covered }, { again: true }));
    return filed ? json(filed) : err("the Compendium or filing is switched off for this scene", 409);
  }
  if (p === "/api/chats/compendium/reconcile") {
    const pairs = pairsOf(b["pairs"]);
    if (!pairs || (b["action"] !== "mirror" && b["action"] !== "keep") || !str(b["bookId"])) return err("expected { chatId, bookId, action: \"mirror\" | \"keep\", pairs: [{ sourceEntryId, targetEntryId }] }");
    const stop = paused(str(b["bookId"]));
    if (stop) return stop;
    return json(await enqueue(chatId, () => reconcileApply(deps, chatId, str(b["bookId"]), b["action"] as "mirror" | "keep", pairs)));
  }
  return err("not found", 404);
}
