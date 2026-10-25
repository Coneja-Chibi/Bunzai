/**
 * Which lorebooks a scene reads (plan step 1): the
 * character's knowledge refs, then the persona's, then the scene's own added books, each id kept
 * once by its first source, switched on unless the scene's `lore.off` names it. A book the library
 * no longer has is `book: null` and is skipped by the turn, never a refusal; the routes report it
 * as missing.
 */
import type { CharacterBody } from "../entities/character/schema";
import type { LorebookBody } from "../entities/lorebook/schema";
import type { PersonaBody } from "../entities/persona/schema";
import type { ChatLore } from "../stage/contracts/chat-store";
import type { StudioStoreLike } from "./contracts";
import { createStoredLoreInput } from "../core/lore/engine/stored-input";

export type ReadLorebook = (id: string) => Promise<{ id: string; name: string; body: LorebookBody } | null>;

/** The library's lorebook reader: its current body, parsed canonically by the store; a trashed one is gone. */
export function lorebookReader(store: Pick<StudioStoreLike, "read"> & Partial<Pick<StudioStoreLike, "readBody" | "readBodyVersioned">>): ReadLorebook {
  return async (id) => {
    if (store.readBodyVersioned) {
      const stored = await store.readBodyVersioned("lorebook", id);
      return stored ? createStoredLoreInput(id, stored.body as LorebookBody, stored.revision) : null;
    }
    if (store.readBody) {
      const body = await store.readBody("lorebook", id) as LorebookBody | null;
      return body ? { id, name: body.name, body } : null;
    }
    const entity = await store.read("lorebook", id);
    return entity?.kind === "lorebook" ? { id, name: entity.body.name, body: entity.body } : null;
  };
}

export interface ResolvedBook {
  id: string;
  source: "character" | "persona" | "scene";
  enabled: boolean;
  book: { id: string; name: string; body: LorebookBody } | null;
}

/**
 * Order: the character's knowledge refs, then the persona's, then the scene's own added books; each
 * id kept once, by its first source. `character.worldName` (a link by name, not by canonical id) is
 * out of scope for this step.
 */
export async function resolveBooks(
  character: CharacterBody,
  persona: PersonaBody | undefined,
  lore: ChatLore | undefined,
  read: ReadLorebook,
): Promise<ResolvedBook[]> {
  const off = new Set(lore?.off ?? []);
  const seen = new Set<string>();
  const ordered: { id: string; source: ResolvedBook["source"] }[] = [];
  const add = (ids: readonly string[] | undefined, source: ResolvedBook["source"]) => {
    for (const id of ids ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push({ id, source });
    }
  };
  add(character.knowledgeRefs, "character");
  add(persona?.knowledgeRefs, "persona");
  add(lore?.added, "scene");

  return Promise.all(
    ordered.map(async ({ id, source }): Promise<ResolvedBook> => ({
      id,
      source,
      enabled: !off.has(id),
      book: await read(id),
    })),
  );
}
