/**
 * The Story Director's routes (plan 15 step 4): `GET /api/chats/director` answers the panel (the take's story state at its tip, the settings, the version an edit must send back);
 * `POST /api/chats/director-edit` makes one edit (scene-director-edit.ts) guarded by that version and answers the panel again, or 409 when the story moved on; `POST /api/chats/director-settings`
 * changes the scene's Director settings (ChatStore rule 47) and answers the panel; `POST /api/chats/director-tracker-undo` writes a tracker back to before the last update a reply made to it (plan 16). Bodies are parsed once into known types.
 */
import { isRecord, str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import { StudioNotFoundError, StudioValidationError } from "../studio/errors";
import { isTrackerModule } from "../core/trackers";
import { editDirector, readDirectorPanel, undoDirectorTracker } from "../studio/scene-director-edit";
import { connect } from "./server-chats-turn";
import { json } from "./server-security";

type Body = Record<string, unknown>;

/** The Director routes, or null when the path is not one of them. */
export async function handleDirectorRoute(req: Request, url: URL, chats: ChatStore, now: () => number, b: Body | null): Promise<Response | null> {
  const p = url.pathname;
  if (req.method === "GET" && p === "/api/chats/director") return json(await readDirectorPanel({ chats, connect }, url.searchParams.get("chatId") ?? "", url.searchParams.has("at") ? { at: url.searchParams.get("at") ?? "" } : {}));
  if (req.method !== "POST" || !b || !p.startsWith("/api/chats/director")) return null;
  const chatId = str(b["chatId"]);
  if (!chatId) throw new StudioValidationError("chatId is required");
  if (p === "/api/chats/director-edit") {
    const version = b["expectedVersion"];
    if (version !== null && typeof version !== "number") throw new StudioValidationError("expectedVersion must be a number or null");
    return json(await editDirector({ chats, connect, now }, chatId, b["edit"], version));
  }
  if (p === "/api/chats/director-tracker-undo") {
    const module = str(b["module"]);
    const messageId = str(b["messageId"]);
    if (!module || !isTrackerModule(module)) throw new StudioValidationError("module must be a tracker module");
    if (!messageId) throw new StudioValidationError("messageId is required");
    return json(await undoDirectorTracker({ chats, connect, now }, chatId, module, messageId));
  }
  if (p === "/api/chats/director-settings") {
    if (!isRecord(b["patch"])) throw new StudioValidationError("patch must be an object");
    if (!(await chats.setDirectorSettings(chatId, b["patch"] as never))) throw new StudioNotFoundError("that scene does not exist");
    return json(await readDirectorPanel({ chats, connect }, chatId));
  }
  return null;
}
