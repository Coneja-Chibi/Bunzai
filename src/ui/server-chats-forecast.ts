/**
 * The forecast route (rc-parity 08, the Context wing's Next send): `POST /api/chats/forecast` answers the request a send of `draft` would build (studio/scene-forecast.ts).
 * It never writes to the scene and asks no model. The body is read once into a known type; a request that does not fit it is a 400, a scene with no usable connection is the
 * same 409 a send gets, and nothing is ever an empty success. A POST because the draft is the person's own words and does not belong in a URL.
 */
import { str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { StudioValidationError } from "../studio/errors";
import type { SettingsStoreLike, StudioStoreLike } from "../studio/contracts";
import { forecastRequest, type ForecastDeps } from "../studio/scene-forecast";
import type { ReadPreset } from "../studio/scene-turn-load";
import type { ReadLorebook } from "../studio/scene-lore";
import { choiceDefaultsOf } from "./server-scene-readers";
import { connect } from "./server-chats-turn";
import { json } from "./server-security";

type Body = Record<string, unknown>;

/** A draft is at most this long; a larger body is refused rather than assembled. */
const DRAFT_MAX = 100_000;

/** The forecast route, or null when the path is not it. */
export async function handleForecastRoute(req: Request, p: string, chats: ChatStore, state: StateStore, readPreset: ReadPreset, readLorebook: ReadLorebook, b: Body | null, studio?: StudioStoreLike, settings?: SettingsStoreLike): Promise<Response | null> {
  if (p !== "/api/chats/forecast" || req.method !== "POST" || !b) return null;
  const chatId = str(b["chatId"]);
  if (!chatId) throw new StudioValidationError("chatId is required");
  const draft = b["draft"];
  if (typeof draft !== "string" || draft.length > DRAFT_MAX) throw new StudioValidationError(`draft must be text of at most ${DRAFT_MAX} characters`);
  const deps: ForecastDeps = { chats, state, connect, readPreset, readLorebook, readCastMember: studio ? (kind, id) => studio.read(kind, id) : undefined, ...(choiceDefaultsOf(settings) ? { choiceDefaults: choiceDefaultsOf(settings)! } : {}), now: Date.now, randomSeed: () => Math.floor(Math.random() * 2 ** 31) };
  return json(await forecastRequest(deps, { chatId, draft }));
}
