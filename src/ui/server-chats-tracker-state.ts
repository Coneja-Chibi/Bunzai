/**
 * The Props trackers' state routes (studio/tracker-state.ts). `GET /api/chats/tracker-state?chatId=` answers each module's data at the take's tip, the update lines and the version a write must name
 * back; read only. `POST /api/chats/tracker-state` writes one or more modules in one step, as the person (anything they click or accept, a Refresh included). Ids and the module list are parsed once at this boundary; a take that moved on, or a turn running
 * in the scene, is a 409, data that is not a state of the module is a 400, a scene or take that is gone is a 404.
 */
import { isRecord, str } from "../core/guards";
import { sceneRuntimeFor } from "./server-scene-runtime";
import { isTrackerModule } from "../core/trackers";
import type { ChatStore, JsonValue } from "../stage/contracts/chat-store";
import { StudioNotFoundError, StudioValidationError } from "../studio/errors";
import { readTrackerStates, writeTrackerStates, type TrackerWrite, type TrackerWriteInput } from "../studio/tracker-state";
import { json, ROUTE_ID as ID } from "./server-security";

const idOf = (v: unknown, name: string): string => {
  const id = str(v);
  if (!ID.test(id)) throw new StudioValidationError(`${name} must be an id`);
  return id;
};

const BODY_KEYS = ["chatId", "branchId", "messageId", "expectedVersion", "writes"];
const WRITE_KEYS = ["module", "data", "base"];

/** The request body as a TrackerWriteInput, or a StudioValidationError (a 400) naming what was wrong. */
export function parseTrackerWrite(b: Record<string, unknown>): TrackerWriteInput {
  const unknownKey = Object.keys(b).find((k) => !BODY_KEYS.includes(k));
  if (unknownKey !== undefined) throw new StudioValidationError(`unknown field: ${unknownKey}`);
  const version = b["expectedVersion"];
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) throw new StudioValidationError("expectedVersion must be a whole number");
  const list = b["writes"];
  if (!Array.isArray(list) || list.length === 0) throw new StudioValidationError("writes must name at least one tracker");
  const writes = list.map((w): TrackerWrite => {
    const extra = isRecord(w) ? Object.keys(w).find((k) => !WRITE_KEYS.includes(k)) : undefined;
    if (extra !== undefined) throw new StudioValidationError(`unknown field in a write: ${extra}`);
    if (!isRecord(w) || typeof w["module"] !== "string" || !isTrackerModule(w["module"]) || w["data"] === undefined) throw new StudioValidationError("a write needs a tracker module and its data (or null to clear it)");
    return { module: w["module"], data: w["data"] as JsonValue | null, ...(w["base"] === undefined ? {} : { base: w["base"] as JsonValue | null }) };
  });
  if (new Set(writes.map((w) => w.module)).size !== writes.length) throw new StudioValidationError("a tracker may be named once in a write");
  return { chatId: idOf(b["chatId"], "chatId"), branchId: idOf(b["branchId"], "branchId"), messageId: idOf(b["messageId"], "messageId"), writes, expectedVersion: version };
}

/** The two routes, or null when the path is not one of them. */
export async function handleTrackerStateRoute(req: Request, url: URL, chats: ChatStore, now: () => number, b: Record<string, unknown> | null): Promise<Response | null> {
  if (url.pathname !== "/api/chats/tracker-state") return null;
  if (req.method === "GET") {
    const chat = await chats.getChat(idOf(url.searchParams.get("chatId"), "chatId"));
    const found = chat ? await readTrackerStates(chats, chat, chat.activeBranchId) : null;
    if (!found) throw new StudioNotFoundError("that scene is gone");
    return json(found);
  }
  return req.method === "POST" && b ? json(await writeTrackerStates(sceneRuntimeFor(chats), chats, parseTrackerWrite(b), now)) : null;
}
