/**
 * The Trackers panel's two routes for the library trackers a scene links. `GET /api/chats/library-trackers?chatId=` answers each tracker with its value at the take's tip and the reply that
 * last changed it (studio/scene-trackers.ts), read only. `POST /api/chats/tracker-edit` is the person's own edit of one: the branch, the tip message, the tracker id, the same update the
 * `update_trackers` tool takes and the branch version the page read (studio/tracker-edit.ts); it answers the trackers as they now stand. Ids are parsed once at this boundary, as the
 * changes route does; a take that moved on since the page read it (a stale version, or a message that is no longer the tip) or a turn running in the scene is a 409, a tracker the scene does not use is a 400, a scene or take that is gone is a 404.
 */
import { isRecord, str } from "../core/guards";
import { sceneRuntimeFor } from "./server-scene-runtime";
import type { ChatStore } from "../stage/contracts/chat-store";
import { StudioNotFoundError, StudioValidationError } from "../studio/errors";
import type { ReadTracker } from "../studio/library-trackers";
import { sceneTrackers } from "../studio/scene-trackers";
import { editSceneTracker, type TrackerEditInput } from "../studio/tracker-edit";
import { json, ROUTE_ID as ID } from "./server-security";

const idOf = (v: unknown, name: string): string => {
  const id = str(v);
  if (!ID.test(id)) throw new StudioValidationError(`${name} must be an id`);
  return id;
};

/** The request body as a TrackerEditInput, or a StudioValidationError (a 400) naming what was wrong. Only the tool's own keys of an update are kept; the core judges what they ask for. */
export function parseTrackerEdit(b: Record<string, unknown>): TrackerEditInput {
  const update = b["update"];
  if (!isRecord(update)) throw new StudioValidationError("update must be an object");
  const version = b["expectedVersion"];
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) throw new StudioValidationError("expectedVersion must be a whole number");
  const unknown = Object.keys(update).filter((k) => k !== "row" && k !== "remove" && k !== "set");
  if (unknown.length > 0) throw new StudioValidationError(`Unknown keys: ${unknown.join(", ")}.`);
  return { chatId: idOf(b["chatId"], "chatId"), branchId: idOf(b["branchId"], "branchId"), messageId: idOf(b["messageId"], "messageId"), trackerId: idOf(b["trackerId"], "trackerId"), update, expectedVersion: version };
}

/** The two routes, or null when the path is not one of them. */
export async function handleLibraryTrackersRoute(req: Request, url: URL, chats: ChatStore, read: ReadTracker | undefined, now: () => number, b: Record<string, unknown> | null): Promise<Response | null> {
  if (req.method === "GET" && url.pathname === "/api/chats/library-trackers") {
    const chat = await chats.getChat(idOf(url.searchParams.get("chatId"), "chatId"));
    const found = chat ? await sceneTrackers(chats, read, chat) : null;
    if (!found) throw new StudioNotFoundError("that scene is gone");
    return json(found);
  }
  if (req.method === "POST" && url.pathname === "/api/chats/tracker-edit" && b) return json(await editSceneTracker(sceneRuntimeFor(chats), chats, read, parseTrackerEdit(b), now));
  return null;
}
