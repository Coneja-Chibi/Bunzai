/**
 * The summary routes (rc-parity 08, the Context wing's Memory tab; RoleCall `api/user/chats/[characterId]/summary` and its `prompts` route): `GET /api/chats/summary` answers the saved settings, the active take's text and
 * how far it reaches, and whether a run is going; `POST /api/chats/summary-settings` changes the settings (ChatStore rule 45) and answers the same state; `POST /api/chats/summary` saves the person's own text;
 * `POST /api/chats/summary-backfill` rebuilds the text from the whole take and answers the new state, or the sentence that says why it could not (409). Bodies are parsed once into known types.
 */
import { isRecord, str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import { StudioNotFoundError, StudioValidationError } from "../studio/errors";
import type { StudioStoreLike } from "../studio/contracts";
import { backfill, saveSummaryText, summaryState } from "../studio/scene-summary";
import { connect } from "./server-chats-turn";
import { err, json } from "./server-security";

type Body = Record<string, unknown>;

async function stateOr404(chats: ChatStore, chatId: string): Promise<Response> {
  const state = await summaryState(chats, chatId);
  return state ? json(state) : err("that scene is gone", 404);
}

/** The summary routes, or null when the path is not one of them. */
export async function handleSummaryRoute(req: Request, url: URL, chats: ChatStore, studio: StudioStoreLike | undefined, b: Body | null): Promise<Response | null> {
  const p = url.pathname;
  if (req.method === "GET" && p === "/api/chats/summary") return stateOr404(chats, url.searchParams.get("chatId") ?? "");
  if (req.method !== "POST" || !b || !p.startsWith("/api/chats/summary")) return null;
  const chatId = str(b["chatId"]);
  if (!chatId) throw new StudioValidationError("chatId is required");
  if (p === "/api/chats/summary-settings") {
    if (!isRecord(b["patch"])) throw new StudioValidationError("patch must be an object");
    if (!(await chats.setSummarySettings(chatId, b["patch"] as never))) throw new StudioNotFoundError("that scene does not exist");
    return stateOr404(chats, chatId);
  }
  if (p === "/api/chats/summary") {
    if (typeof b["text"] !== "string") throw new StudioValidationError("text must be text");
    await saveSummaryText(chats, chatId, b["text"]);
    return stateOr404(chats, chatId);
  }
  if (p === "/api/chats/summary-backfill") {
    await backfill({ chats, connect, readCastMember: studio ? (kind, id) => studio.read(kind, id) : undefined }, chatId, req.signal);
    return stateOr404(chats, chatId);
  }
  return null;
}
