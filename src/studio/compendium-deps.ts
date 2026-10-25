/**
 * What the Compendium's passes need from the app and how they find a scene's books (04b D8): the books the scene reads (its
 * character's, its persona's, the ones added to it), each with the access the person gave it. Filing writes only where
 * `canWrite` holds; the book list is the one `resolveBooks` gives a turn, so the pass and the reply agree on what the scene reads.
 */
import { bodyOf } from "../core/guards";
import { accessOf, canRead, canWrite, readBook, type CompendiumEntry } from "../core/compendium";
import type { CharacterBody } from "../entities/character/schema";
import { playedBody } from "../entities/character/variant";
import type { LorebookEntry } from "../entities/lorebook/schema";
import type { PersonaBody } from "../entities/persona/schema";
import type { Chat, ChatConnection, ChatStore } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { lorebookReader, resolveBooks } from "./scene-lore";
import type { Connected } from "./scene-turn";
import { loadCast } from "./scene-turn-load";
import type { BookStore } from "./world-book-writer";

export interface CompendiumDeps {
  chats: ChatStore;
  state: Pick<StateStore, "read">;
  store: BookStore;
  connect(connection: ChatConnection): Promise<Connected | null>;
  readCastMember?(kind: "character" | "persona", id: string): Promise<unknown | null>;
  now(): number;
  newId(): string;
}

export interface SceneBook {
  id: string;
  name: string;
  access: ReturnType<typeof accessOf>;
  readable: boolean;
  writable: boolean;
  entries: LorebookEntry[];
  view: CompendiumEntry[];
}

/** The scene's switched-on books that exist in the library, with the person's access to each; null when the scene or its cast is gone. */
export async function sceneBooks(deps: CompendiumDeps, chatId: string): Promise<{ chat: Chat; books: SceneBook[] } | null> {
  const cast = await loadCast(deps.chats, chatId, deps.readCastMember);
  if (!cast) return null;
  const character = playedBody(bodyOf(cast.snapshot.character) as unknown as CharacterBody, cast.chat.variantId);
  const persona = cast.snapshot.persona ? (bodyOf(cast.snapshot.persona) as unknown as PersonaBody) : undefined;
  const resolved = await resolveBooks(character, persona, cast.chat.lore, lorebookReader(deps.store));
  const books = resolved.flatMap((r): SceneBook[] => {
    if (!r.enabled || !r.book) return [];
    const access = accessOf(cast.chat.compendium, r.id);
    const entries = r.book.body.entries;
    return [{ id: r.id, name: r.book.name, access, readable: canRead(access), writable: canWrite(access), entries, view: readBook(entries) }];
  });
  return { chat: cast.chat, books };
}
