/**
 * Changing who is in a scene without leaving it (ChatStore rules 13 and 26): playing as another
 * persona, and saving the scene's card or persona in the Library and moving the scene onto the saved
 * version. A swap touches this scene only; the default persona is a setting and never moves here. Both
 * refuse while a reply is being written, because that reply's prompt was built from the old cast.
 */
import type { ChatOpening, ChatStore, JsonObject, PersonaStats } from "../stage/contracts/chat-store";
import { breather } from "../stage/store/breather";
import { turnOpenConflict } from "../stage/store/cast-rules";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";
import type { StudioStoreLike } from "./contracts";

import { readChatCast } from "./cast-snapshot";
import { bodyOf } from "../core/guards";
import type { CharacterBody } from "../entities/character/schema";
import { greetingsOf, openScene, personaNameOf, updateSceneCard, type OpenScene } from "./scenes";
import type { CompareSaveResult } from "./store";

/** Whether a reply is open on any live take of the scene: the check a save makes before it writes the Library. */
const turnOpenIn = async (chats: ChatStore, chatId: string): Promise<boolean> => (await chats.resumeIncomplete()).some((turn) => turn.chatId === chatId);

/** Plays the scene as another Library persona, or as none with `personaId: null`. Null when the scene is gone. */
export async function changeScenePersona(
  chats: ChatStore,
  studio: StudioStoreLike,
  input: { chatId: string; personaId: string | null; expectedSnapshotVersion?: number },
): Promise<OpenScene | null> {
  const found = input.personaId === null ? null : await studio.readVersioned("persona", input.personaId);
  if (input.personaId !== null && !found) throw new StudioNotFoundError(`persona "${input.personaId}" is not in the library`);
  const moved = await chats.setPersona(input.chatId, {
    persona: found ? { id: input.personaId!, version: found.version, name: personaNameOf(found.entity) } : null,
    snapshot: found ? (found.entity as unknown as JsonObject) : null,
    expectedSnapshotVersion: input.expectedSnapshotVersion,
  });
  return moved ? openScene(chats, studio, input.chatId) : null;
}

export type SceneMemberSave =
  | { status: "saved"; summary: Extract<CompareSaveResult, { status: "saved" }>["summary"]; scene: OpenScene | null; applied: boolean }
  | { status: "stale" | "missing" };

/**
 * Saves the scene's character or persona through `save` (the editor's own compare-and-save, so a stale
 * save writes nothing), then moves this scene onto the saved version. Other scenes keep their copy and
 * show Update available. `applied` is false when the Library saved but a reply started in between:
 * the scene stays on its old copy and the person presses Update available later.
 */
export async function saveSceneMember(
  chats: ChatStore,
  studio: StudioStoreLike,
  input: { chatId: string; kind: "character" | "persona"; save: () => Promise<CompareSaveResult> },
): Promise<SceneMemberSave | null> {
  const chat = await chats.getChat(input.chatId);
  if (!chat) return null;
  if (await turnOpenIn(chats, chat.id)) throw turnOpenConflict();
  const saved = await input.save();
  if (saved.status !== "saved") return { status: saved.status };
  try {
    const memberId = input.kind === "persona" ? chat.cast.persona?.id : chat.cast.character.id;
    const scene = input.kind === "character" ? await updateSceneCard(chats, studio, chat.id) : memberId ? await changeScenePersona(chats, studio, { chatId: chat.id, personaId: memberId }) : null;
    return { status: "saved", summary: saved.summary, scene, applied: scene !== null };
  } catch (error) {
    if (!(error instanceof StudioConflictError)) throw error;
    return { status: "saved", summary: saved.summary, scene: await openScene(chats, studio, chat.id), applied: false };
  }
}

/** Remembers the person's edits of the scene's greetings, or forgets them with null (ChatStore rule 34). An edit of a greeting the card does not have is refused. */
export async function setSceneOpening(chats: ChatStore, studio: StudioStoreLike, input: { chatId: string; opening: ChatOpening | null }): Promise<OpenScene | null> {
  const chat = await chats.getChat(input.chatId);
  const cast = chat && (await readChatCast(chats, studio, chat, true));
  if (!cast) return null;
  const count = greetingsOf(cast.snapshot.character).length;
  // Shape is the store's to refuse (it takes untrusted input); only an index past the card's greetings is the studio's to know.
  const edits: unknown = input.opening?.edits;
  if (Array.isArray(edits) && edits.some((e: { index?: unknown } | null) => typeof e?.index === "number" && e.index >= count)) throw new StudioValidationError("that greeting does not exist");
  return (await chats.setOpening(input.chatId, input.opening)) ? openScene(chats, studio, input.chatId) : null;
}

/** Plays the scene as one of its character's alt-art variants, or the base card with `null` (ChatStore rule 27). */
export async function setSceneVariant(chats: ChatStore, studio: StudioStoreLike, input: { chatId: string; variantId: string | null }): Promise<OpenScene | null> {
  const chat = await chats.getChat(input.chatId);
  const cast = chat && (await readChatCast(chats, studio, chat, true));
  if (!cast) return null;
  const variants = (bodyOf(cast.snapshot.character) as unknown as CharacterBody).variants ?? [];
  if (input.variantId !== null && !variants.some((v) => v.id === input.variantId)) throw new StudioValidationError("that look is not on this scene's card");
  return (await chats.setVariant(input.chatId, input.variantId)) ? openScene(chats, studio, input.chatId) : null;
}

const backfilled = new WeakSet<ChatStore>();

/**
 * A persona's stats (ChatStore rule 28). The first read in a process also starts the one-time count of
 * scenes that predate the counters, in the background and yielding between scenes, so the answer is
 * immediate and a little low until it finishes.
 */
export async function personaStatsOf(chats: ChatStore, personaId: string): Promise<PersonaStats> {
  if (!backfilled.has(chats)) {
    backfilled.add(chats);
    // One attempt per process: a failure must not make every stats read start the work again. Damaged scenes are set aside inside it.
    void chats.backfillPersonaStats(breather()).catch(() => undefined);
  }
  return chats.personaStats(personaId);
}
