/**
 * The draft route: `POST /api/chats/draft` runs one
 * of the draft tools (studio/scene-draft.ts) and answers `{ text }`. It never writes to the scene. The body is
 * read once into a known type; a request that does not fit it is a 400, a failed model call is a 502 that
 * carries the provider's category and code (as a turn's "failed" event does), and nothing is ever an empty
 * success. Kept out of server-chats-turn.ts, which is the streaming turn.
 */
import { CUSTOM_INSTRUCTION_MAX, PERSPECTIVES, REWRITE_ACTIONS } from "../core/draft-prompts";
import { str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { StudioValidationError } from "../studio/errors";
import type { SettingsStoreLike, StudioStoreLike } from "../studio/contracts";
import { choiceDefaultsOf, promptBudgetOf } from "./server-scene-readers";
import { runDraft, type DraftDeps, type DraftInput } from "../studio/scene-draft";
import type { ReadPreset } from "../studio/scene-turn-load";
import type { ReadLorebook } from "../studio/scene-lore";
import { connect } from "../kit/providers/scene-connect";
import { providerJson } from "./server-provider-json";

type Body = Record<string, unknown>;

/** A message or a draft is at most this long; a larger body is refused rather than sent to a model. */
const TEXT_MAX = 100_000;

const oneOf = <T extends string>(list: readonly T[], value: unknown, what: string): T => {
  if (typeof value !== "string" || !(list as readonly string[]).includes(value)) throw new StudioValidationError(`${what} must be one of ${list.join(", ")}`);
  return value as T;
};

function text(b: Body, field: string): string {
  const value = b[field];
  if (typeof value !== "string" || value.trim() === "") throw new StudioValidationError(`${field} must be some text`);
  if (value.length > TEXT_MAX) throw new StudioValidationError(`${field} is at most ${TEXT_MAX} characters`);
  return value;
}

/** The request body as a DraftInput, or a StudioValidationError (a 400) naming what was wrong. */
export function parseDraft(b: Body): DraftInput {
  const chatId = str(b["chatId"]);
  if (!chatId) throw new StudioValidationError("chatId is required");
  const kind = oneOf(["impersonate", "polish", "spellcheck", "correct", "rewrite"] as const, b["kind"], "kind");
  switch (kind) {
    case "impersonate": {
      const brief = b["brief"] === undefined ? "" : typeof b["brief"] === "string" ? b["brief"] : null;
      if (brief === null || brief.length > TEXT_MAX) throw new StudioValidationError("brief must be text");
      return { chatId, kind, brief, perspective: b["perspective"] === undefined ? "1st" : oneOf(PERSPECTIVES, b["perspective"], "perspective") };
    }
    case "polish":
    case "spellcheck":
      return { chatId, kind, text: text(b, "text") };
    case "correct":
      return { chatId, kind, text: text(b, "text"), guideId: text(b, "guideId") };
    case "rewrite": {
      const whole = text(b, "text");
      const selected = text(b, "selected");
      if (!whole.includes(selected)) throw new StudioValidationError("selected must be a passage of text");
      const action = oneOf(REWRITE_ACTIONS, b["action"], "action");
      if (action !== "custom") return { chatId, kind, text: whole, selected, action };
      const instruction = typeof b["instruction"] === "string" ? b["instruction"].trim() : "";
      if (!instruction || instruction.length > CUSTOM_INSTRUCTION_MAX) throw new StudioValidationError(`a custom rewrite needs an instruction of 1 to ${CUSTOM_INSTRUCTION_MAX} characters`);
      return { chatId, kind, text: whole, selected, action, instruction };
    }
  }
}

/** The draft route, or null when the path is not it. */
export async function handleDraftRoute(req: Request, p: string, chats: ChatStore, state: StateStore, readPreset: ReadPreset, readLorebook: ReadLorebook, b: Body | null, studio?: StudioStoreLike, settings?: SettingsStoreLike): Promise<Response | null> {
  if (p !== "/api/chats/draft" || req.method !== "POST" || !b) return null;
  const input = parseDraft(b);
  const deps: DraftDeps = { chats, state, connect, readPreset, readLorebook, readLibrary: studio ? (kind, id) => studio.read(kind, id) : undefined, ...(choiceDefaultsOf(settings) ? { choiceDefaults: choiceDefaultsOf(settings)! } : {}), ...(promptBudgetOf(settings) ? { promptBudgetMs: promptBudgetOf(settings)! } : {}), now: Date.now, randomSeed: () => Math.floor(Math.random() * 2 ** 31) };
  return providerJson(() => runDraft(deps, input, req.signal));
}
