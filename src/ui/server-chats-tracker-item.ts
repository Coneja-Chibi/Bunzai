/**
 * The tracker-item route (RoleCall `POST /api/chat/generate-tracker-item`): `POST /api/chats/tracker-item` asks the scene's model for one item of a legacy tracker
 * and answers `{ item }`, a proposal the panel shows and the person accepts or discards. It never writes to the scene. The body is read once into a known type; a
 * request that does not fit is a 400, a failed model call is a 502 carrying the provider's category and code (as a draft's is), and an answer that cannot be
 * read is a 409 with the reason, never a default item.
 */
import { str } from "../core/guards";
import { ProviderError } from "../stage/contracts/provider";
import type { ChatStore } from "../stage/contracts/chat-store";
import { isTrackerModule } from "../core/trackers";
import { StudioValidationError } from "../studio/errors";
import type { StudioStoreLike } from "../studio/contracts";
import { proposeTrackerItem, type TrackerItemDeps, type TrackerItemInput } from "../studio/scene-tracker-item";
import { connect } from "./server-chats-turn";
import { json } from "./server-security";

type Body = Record<string, unknown>;

/** The request body as a TrackerItemInput, or a StudioValidationError (a 400) naming what was wrong. */
export function parseTrackerItem(b: Body): TrackerItemInput {
  const chatId = str(b["chatId"]);
  if (!chatId) throw new StudioValidationError("chatId is required");
  const module = str(b["module"]);
  if (!isTrackerModule(module)) throw new StudioValidationError("module must be a tracker");
  if (b["action"] !== "generate" && b["action"] !== "refresh") throw new StudioValidationError("action must be generate or refresh");
  for (const field of ["itemName", "userGuide", "variant"]) if (b[field] !== undefined && typeof b[field] !== "string") throw new StudioValidationError(`${field} must be text`);
  return {
    chatId, module, action: b["action"],
    ...(typeof b["itemName"] === "string" ? { itemName: b["itemName"] } : {}),
    ...(typeof b["userGuide"] === "string" ? { userGuide: b["userGuide"] } : {}),
    ...(typeof b["variant"] === "string" ? { variant: b["variant"] } : {}),
    ...(b["existing"] !== undefined ? { existing: b["existing"] } : {}),
  };
}

/** The tracker-item route, or null when the path is not it. */
export async function handleTrackerItemRoute(req: Request, p: string, chats: ChatStore, b: Body | null, studio?: StudioStoreLike): Promise<Response | null> {
  if (p !== "/api/chats/tracker-item" || req.method !== "POST" || !b) return null;
  const input = parseTrackerItem(b);
  const deps: TrackerItemDeps = { chats, connect, readCastMember: studio ? (kind, id) => studio.read(kind, id) : undefined };
  try {
    return json(await proposeTrackerItem(deps, input, req.signal));
  } catch (e) {
    if (e instanceof ProviderError) return json({ error: e.message, code: e.code, category: e.category, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) }, 502);
    throw e;
  }
}
