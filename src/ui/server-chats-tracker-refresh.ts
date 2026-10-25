/**
 * The tracker-refresh route (RoleCall `POST /api/chat/initialize-trackers`): `POST /api/chats/tracker-refresh` asks the scene's model to update one whole legacy tracker from
 * the chat history and answers `{ chatId, module, proposed, diff }`, a proposal the panel shows and the person accepts or discards. It never writes to the scene. The body is
 * read once into a known type; a request that does not fit is a 400, a failed model call is a 502 carrying the provider's category and code (as a draft's is), and an
 * answer that cannot be read is a 409 with the reason, never the tracker's defaults.
 */
import { str } from "../core/guards";
import { ProviderError } from "../stage/contracts/provider";
import type { ChatStore } from "../stage/contracts/chat-store";
import { isTrackerModule } from "../core/trackers";
import { StudioValidationError } from "../studio/errors";
import type { StudioStoreLike } from "../studio/contracts";
import { proposeTrackerRefresh, type TrackerRefreshDeps, type TrackerRefreshInput } from "../studio/scene-tracker-refresh";
import { connect } from "./server-chats-turn";
import { json } from "./server-security";

type Body = Record<string, unknown>;

/** The request body as a TrackerRefreshInput, or a StudioValidationError (a 400) naming what was wrong. */
export function parseTrackerRefresh(b: Body): TrackerRefreshInput {
  const chatId = str(b["chatId"]);
  if (!chatId) throw new StudioValidationError("chatId is required");
  const module = str(b["module"]);
  if (!isTrackerModule(module)) throw new StudioValidationError("module must be a tracker");
  return { chatId, module };
}

/** The tracker-refresh route, or null when the path is not it. */
export async function handleTrackerRefreshRoute(req: Request, p: string, chats: ChatStore, b: Body | null, studio?: StudioStoreLike): Promise<Response | null> {
  if (p !== "/api/chats/tracker-refresh" || req.method !== "POST" || !b) return null;
  const input = parseTrackerRefresh(b);
  const deps: TrackerRefreshDeps = { chats, connect, readCastMember: studio ? (kind, id) => studio.read(kind, id) : undefined, now: Date.now, newId: () => crypto.randomUUID() };
  try {
    return json(await proposeTrackerRefresh(deps, input, req.signal));
  } catch (e) {
    if (e instanceof ProviderError) return json({ error: e.message, code: e.code, category: e.category, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) }, 502);
    throw e;
  }
}
