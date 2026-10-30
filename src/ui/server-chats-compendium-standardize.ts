/**
 * The Standardize routes under /api/chats/compendium/standardize (04b Track D): the scene's runs and what Revert would take back
 * (a GET the page polls while a run works), start, cancel, dismiss and revert. A run works in the background; these only start it,
 * stop it and read it. Every book change is made by the studio modules through the one book writer; a refusal says why in words
 * the person can act on. Bodies are parsed once here.
 */
import { isActive } from "../core/compendium";
import { str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import { StudioConflictError } from "../studio/errors";
import type { CompendiumDeps } from "../studio/compendium-deps";
import { enqueue } from "../studio/compendium-queue";
import { cancelRun, dismissRun, runsOf, startStandardize } from "../studio/compendium-standardize";
import { revertStandardization, revertable } from "../studio/compendium-standardize-revert";
import { err, json } from "./server-security";

type Body = Record<string, unknown>;

export const STANDARDIZE_PATH = "/api/chats/compendium/standardize";

export async function handleStandardizeRoute(req: Request, url: URL, chats: ChatStore, deps: CompendiumDeps, b: Body | null): Promise<Response | null> {
  const p = url.pathname;
  if (p !== STANDARDIZE_PATH && !p.startsWith(`${STANDARDIZE_PATH}/`)) return null;
  if (req.method === "GET") {
    const chatId = url.searchParams.get("chatId") ?? "";
    if (p !== STANDARDIZE_PATH) return err("not found", 404);
    if (!(await chats.getChat(chatId))) return err("that scene is gone", 404);
    const runs = runsOf(chatId);
    // What Revert would take back is read from the receipts, which a long run makes hundreds; while a run works Revert is refused anyway, so the poll leaves it out.
    if (runs.some(isActive)) return json({ runs });
    const back: Record<string, number> = {};
    for (const r of await revertable(deps, chatId)) for (const id of new Set(r.writes.map((w) => w.bookId))) back[id] = (back[id] ?? 0) + 1;
    return json({ runs, revertable: back });
  }
  if (!b) return null;
  const chatId = str(b["chatId"]);
  const bookId = str(b["bookId"]);
  if (!chatId || !bookId) return err("expected { chatId, bookId }");
  if (p === STANDARDIZE_PATH) {
    const by = b["by"] === "tokens" ? "tokens" : b["by"] === "entries" ? "entries" : null;
    const budget = b["tokenBudget"];
    if (!by || (budget !== undefined && (typeof budget !== "number" || !Number.isFinite(budget)))) return err('expected { chatId, bookId, by: "entries" | "tokens", tokenBudget? }');
    const started = await startStandardize(deps, chatId, bookId, { by, ...(typeof budget === "number" ? { tokenBudget: budget } : {}) });
    return started.ok ? json({ run: started.run }) : err(started.error, started.status);
  }
  if (p === `${STANDARDIZE_PATH}/cancel`) {
    const run = cancelRun(chatId, bookId);
    return run ? json({ run }) : err("there is no run to stop", 404);
  }
  if (p === `${STANDARDIZE_PATH}/dismiss`) return json({ dismissed: dismissRun(chatId, bookId) });
  if (p === `${STANDARDIZE_PATH}/revert`) {
    try {
      return json(await enqueue(chatId, () => revertStandardization(deps, chatId, bookId)));
    } catch (error) {
      if (error instanceof StudioConflictError) return err(error.message, 409);
      throw error;
    }
  }
  return err("not found", 404);
}
