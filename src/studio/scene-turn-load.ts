/**
 * The turn loop's loader: reads everything assembly needs through
 * the stores, so assembly never touches one. The frozen cast, the scene's preset as the library holds
 * it now (ChatStore rule 19) under the scene's own toggles and samplers, the take's live history, its
 * variables, the library's global variables, and the window the scene's connection gives it.
 */
import type { MacroVariable } from "../core/macros";
import type { HistoryMessage } from "../core/assembly/types";
import { windowPrior } from "../core/assembly/message-window";
import type { LoreFire } from "../core/lore/engine";
import type { CharacterBody } from "../entities/character/schema";
import { playedBody } from "../entities/character/variant";
import type { LorebookBody } from "../entities/lorebook/schema";
import type { PersonaBody } from "../entities/persona/schema";
import type { PresetBody } from "../entities/preset/schema";
import type { CastSnapshot, Chat, ChatLore, ChatStore, JsonObject, Message } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { bodyOf, isRecord, str } from "../core/guards";
import { StudioConflictError } from "./atomic-file";
import type { StudioStoreLike } from "./contracts";
import { StudioValidationError } from "./errors";
import { serializer } from "./serial";
import { withDefaults } from "../core/preset/choices";
import { resolveBooks, type ReadLorebook } from "./scene-lore";
import { storyboardsOf } from "./scene-storyboards";
import type { StoryboardsInput } from "../core/assembly/storyboards";

import { WHOLE_BRANCH } from "./scene-branch";
import { sceneGeneration, type SceneGeneration } from "../stage/params/scene";

export type TurnKind = "reply" | "swipe" | "continue";

/** What a turn or a draft reads of a scene: nothing it could write with. */
export type TurnReader = Pick<ChatStore, "getChat" | "lightCastSnapshot" | "readMessages" | "variables" | "swipeTrace" | "summaryOf">;

/** Refused before a turn opens: the scene names a preset the library no longer has. */
export class PresetGoneError extends StudioConflictError {
  constructor() {
    super("this scene's preset is no longer in your library; choose another in the Prompting wing");
  }
}

/** Reads a preset's body from the library, or null when it has none by that id. */
export type ReadPreset = (id: string) => Promise<PresetBody | null>;

/** The library's preset reader: its current body, parsed canonically by the store; a trashed one is gone. */
export function presetReader(store: Pick<StudioStoreLike, "read"> & Partial<Pick<StudioStoreLike, "readBody">>): ReadPreset {
  return async (id) => {
    if (store.readBody) return (await store.readBody("preset", id)) as PresetBody | null;
    const entity = await store.read("preset", id);
    return entity?.kind === "preset" ? (entity.body as PresetBody) : null;
  };
}

export interface LoadedTurn {
  branchId: string;
  character: CharacterBody;
  persona?: PersonaBody;
  /** The scene's preset with its sampler overrides applied; absent without one. */
  preset?: PresetBody;
  /** The scene's own generation parameters and custom request text (stage/params/scene.ts). */
  generation?: SceneGeneration;
  /** The scene's own on/off per preset block. */
  promptToggles?: Record<string, boolean>;
  /** The scene's answers to the preset's choice groups (ChatStore rule 42). */
  choices?: Record<string, unknown>;
  history: HistoryMessage[];
  current: HistoryMessage;
  /** The assistant message a swipe adds a version to, or a continue adds text to. */
  target?: Message;
  localVariables: Map<string, MacroVariable>;
  branchVersion: number;
  /** The tracker Props that are on and what they kept (ChatStore rules 21 and 43); absent when the scene keeps none. */
  trackers?: { entries: NonNullable<Chat["trackers"]>; on: string[] };
  /** The Storyboard Props that are on and the books they read (storyboards.ts); absent when none is on. */
  storyboards?: StoryboardsInput;
  /** The scene's lorebooks (2e-d4 plan step 2); absent when no book applies. */
  lore?: { books: { id: string; name: string; body: LorebookBody }[]; recentFires: LoreFire[] };
}

const toHistory = (m: Message): HistoryMessage => {
  const swipe = m.swipes[m.current]!;
  const g = swipe.generation;
  return { id: m.id, role: m.role, content: swipe.content, at: m.createdAt, ...(g?.thinkingEnd ? { thinkingEnd: g.thinkingEnd } : {}), ...(g?.reasoning ? { reasoning: g.reasoning } : {}) };
};

/** The chat and its frozen cast, read once and only when they agree (the snapshot is at the chat's version); null when the scene or its cast is gone. */
export async function loadCast(chats: TurnReader, chatId: string, readCastMember?: (kind: "character" | "persona", id: string) => Promise<unknown | null>): Promise<{ chat: Chat; snapshot: CastSnapshot } | null> {
  let chat = await chats.getChat(chatId);
  let snapshot: CastSnapshot | null = null;
  for (let attempt = 0; chat && attempt < 2; attempt++) {
    const stored = await chats.lightCastSnapshot(chatId);
    if (stored && stored.snapshotVersion === chat.snapshotVersion) {
      snapshot = stored.snapshot;
      break;
    }
    if (!stored && chat.snapshotVersion === 0 && readCastMember) {
      const character = await readCastMember("character", chat.cast.character.id);
      const persona = chat.cast.persona ? await readCastMember("persona", chat.cast.persona.id) : null;
      const current = await chats.getChat(chatId);
      if (!character || !current || current.snapshotVersion !== 0) {
        chat = current;
        continue;
      }
      chat = current;
      snapshot = { character: character as JsonObject, ...(persona ? { persona: persona as JsonObject } : {}) };
      break;
    }
    if (!stored && chat.snapshotVersion !== 0) break;
    chat = await chats.getChat(chatId);
  }
  return chat && snapshot ? { chat, snapshot } : null;
}

/**
 * A reply answers the take's last message, which must be the person's. A swipe makes a new version
 * of the take's last message, which must be the character's, answering the message before it. A
 * continue (rule 13) targets the same message and answers the same one, but extends this version, so
 * a hidden or blank reply is refused: its text would go into the prompt as the prefill. A draft (scene-draft.ts)
 * answers nothing: the whole take is history and the current message is empty, as an opening's is.
 */
export async function loadTurn(chats: TurnReader, chatId: string, kind: TurnKind | "draft", readPreset: ReadPreset, readLorebook: ReadLorebook, readCastMember?: (kind: "character" | "persona", id: string) => Promise<unknown | null>, choiceDefaults?: (presetId: string) => Promise<Record<string, unknown> | undefined>): Promise<LoadedTurn | null> {
  const cast = await loadCast(chats, chatId, readCastMember);
  if (!cast) return null;
  const { chat, snapshot } = cast;
  let preset: PresetBody | undefined;
  if (chat.preset) {
    const body = await readPreset(chat.preset.id);
    if (!body) throw new PresetGoneError();
    preset = { ...body, samplers: { ...body.samplers, ...chat.preset.samplers } };
  }
  const branchId = chat.activeBranchId;
  const page = await chats.readMessages(branchId, { limit: WHOLE_BRANCH });
  const vars = await chats.variables(branchId);
  if (page.branchVersion === null || !vars) return null;
  const live = page.messages.filter((m) => !m.cut);
  const last = live.at(-1);
  let target: Message | undefined;
  if (kind !== "reply" && kind !== "draft") {
    if (last?.role !== "assistant" || live.length < (kind === "continue" ? 1 : 2)) throw new StudioConflictError(kind === "swipe" ? "there is no reply at the end of this take to make another version of" : "there is no reply at the end of this take to continue");
    if (kind === "continue") {
      if (last.hidden) throw new StudioConflictError("this reply is hidden from the AI; show it before continuing it");
      if (!last.swipes[last.current]!.content.trim()) throw new StudioConflictError("this reply is empty, so there is nothing to continue");
    }
    target = last;
    live.pop();
  }
  // The opening greeting alone has nothing to answer: its turn answers an empty message (rule 13).
  const opening = (kind === "continue" && live.length === 0) || kind === "draft";
  const answered = opening ? undefined : live.pop();
  if (!opening && answered?.role !== "user") throw new StudioConflictError("the take does not end with a message to answer");

  // The scene's chosen alt-art variant is part of the card the prompt is built from (ChatStore rule 27).
  const character = playedBody(bodyOf(snapshot.character) as unknown as CharacterBody, chat.variantId);
  const persona = snapshot.persona ? (bodyOf(snapshot.persona) as unknown as PersonaBody) : undefined;
  // A hidden message is shown to the reader and left out of the prompt, lore scanning included (rule 30); a turn still answers the message it is given.
  // Max Messages cuts the history before lore scans it or the assembler counts it, as RoleCall's worker does.
  // A recap's turn_range is in the take's live indices (greeting 0), hidden messages counted, so each message carries its own (core/assembly/summary-cut.ts).
  const liveIndex = new Map(live.map((m, i) => [m.id, i]));
  const prior = windowPrior(live.filter((m) => !m.hidden), preset?.samplers);
  const lore = await loadLore(chats, character, persona, chat.lore, readLorebook, prior);
  /** The scene's own answers over the person's saved defaults for this preset (core/preset/choices.ts). */
  const storyboards = storyboardsOf(chat, lore?.books);
  const choices = chat.preset ? withDefaults(await choiceDefaults?.(chat.preset.id), chat.regex?.choices?.[chat.preset.id]) : undefined;

  return {
    branchId,
    character,
    ...(persona ? { persona } : {}),
    ...(preset && chat.preset ? { preset, promptToggles: { ...chat.preset.toggles }, ...(choices ? { choices } : {}), generation: sceneGeneration(chat.preset.samplers) } : {}),
    history: prior.map((m) => ({ ...toHistory(m), index: liveIndex.get(m.id)! })),
    current: answered ? toHistory(answered) : { id: target?.id ?? "", role: "user", content: "", at: (target ?? last)?.createdAt ?? 0 },
    ...(target ? { target } : {}),
    localVariables: new Map(Object.entries(vars)),
    branchVersion: page.branchVersion,
    ...(lore ? { lore } : {}),
    ...(chat.trackers && chat.props ? { trackers: { entries: chat.trackers, on: chat.props.on } } : {}),
    ...(storyboards ? { storyboards } : {}),
  };
}

/**
 * The scene's lorebooks for this turn (2e-d4 plan step 2): only the enabled, present books, and the
 * recent fires their traces recorded on this take, walked back from the message being answered (the
 * swipe target, and the message being answered itself, are already off `live`). `messagesAgo` 1 is
 * the previous reply, matching the engine's own definition. Stops after 50 assistant messages; a
 * trace with no `lore` contributes nothing. Undefined when no book applies, so the turn runs no lore.
 */
async function loadLore(
  chats: TurnReader,
  character: CharacterBody,
  persona: PersonaBody | undefined,
  chatLore: ChatLore | undefined,
  readLorebook: ReadLorebook,
  live: readonly Message[],
): Promise<{ books: { id: string; name: string; body: LorebookBody }[]; recentFires: LoreFire[] } | undefined> {
  const resolved = await resolveBooks(character, persona, chatLore, readLorebook);
  const books = resolved.flatMap((r) => (r.enabled && r.book ? [r.book] : []));
  if (books.length === 0) return undefined;

  const recentFires: LoreFire[] = [];
  let messagesAgo = 0;
  for (let i = live.length - 1; i >= 0 && messagesAgo < 50; i--) {
    const m = live[i]!;
    if (m.role !== "assistant") continue;
    messagesAgo++;
    const trace = await chats.swipeTrace(m.id, m.swipes[m.current]!.id);
    const fires = isRecord(trace?.["lore"]) ? trace["lore"]["fires"] : undefined;
    if (!Array.isArray(fires)) continue;
    for (const f of fires) {
      if (!isRecord(f)) continue;
      recentFires.push({
        entryKey: str(f["entryKey"]),
        messagesAgo,
        fresh: f["fresh"] === true,
        keywords: Array.isArray(f["keywords"]) ? f["keywords"].map(String) : [],
      });
    }
  }
  return { books, recentFires };
}

/**
 * The library's global variables (the StateStore `variables` document): name to value and times,
 * the same shape as a take's. Malformed text is refused, never read as empty, so a turn cannot
 * write over variables it failed to read.
 */
export async function readGlobals(state: Pick<StateStore, "read">): Promise<Map<string, MacroVariable>> {
  const text = await state.read("variables");
  if (text === null) return new Map();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StudioValidationError("the library's global variables could not be read");
  }
  if (!isRecord(parsed)) throw new StudioValidationError("the library's global variables could not be read");
  const out = new Map<string, MacroVariable>();
  for (const [name, v] of Object.entries(parsed as Record<string, unknown>)) {
    const r = v as Partial<MacroVariable> | null;
    if (!isRecord(r) || !("value" in r) || typeof r.createdAt !== "number" || typeof r.updatedAt !== "number") {
      throw new StudioValidationError("the library's global variables could not be read");
    }
    out.set(name, { value: r.value as MacroVariable["value"], createdAt: r.createdAt, updatedAt: r.updatedAt });
  }
  return out;
}

const enqueueGlobalWrite = serializer();

/**
 * Applies an assembly's global diff as RoleCall does: only the names it changed. Writes in this
 * process run one at a time, so two scenes never lose each other's changes to a read-then-write race.
 */
export function writeGlobals(state: StateStore, diff: { set: JsonObject; delete: string[] }, now: number): Promise<void> {
  return enqueueGlobalWrite(async () => {
    if (Object.keys(diff.set).length === 0 && diff.delete.length === 0) return;
    const vars = await readGlobals(state);
    for (const [name, value] of Object.entries(diff.set)) vars.set(name, { value, createdAt: vars.get(name)?.createdAt ?? now, updatedAt: now });
    for (const name of diff.delete) vars.delete(name);
    await state.write("variables", JSON.stringify(Object.fromEntries(vars)));
  });
}
