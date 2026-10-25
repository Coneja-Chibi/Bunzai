/** Frozen-cast reads, with the approved live-card fallback for migration-22 development rows only. */
import type { CastSnapshot, Chat, ChatStore, JsonObject } from "../stage/contracts/chat-store";
import type { StudioStoreLike } from "./contracts";
import { hasPortrait } from "./portrait";
import { isRecord } from "../core/guards";
import { SceneCastMissingError } from "./errors";

const lightMember = (value: unknown): JsonObject => {
  if (!isRecord(value)) throw new Error("legacy cast member is malformed");
  const entity = value;
  const body = entity["body"];
  return {
    ...entity,
    original: null,
    ...(isRecord(body)
      ? { body: { ...body, media: null } }
      : {}),
  } as JsonObject;
};

export async function readChatCast(
  chats: ChatStore,
  studio: StudioStoreLike,
  initial: Chat,
  light = false,
): Promise<{ chat: Chat; snapshot: CastSnapshot; hasPortrait: boolean } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const chat = attempt === 0 ? initial : await chats.getChat(initial.id);
    if (!chat) return null;
    const stored = light ? await chats.lightCastSnapshot(chat.id) : await chats.castSnapshotVersioned(chat.id);
    if (stored && stored.snapshotVersion !== chat.snapshotVersion) continue;
    if (stored) {
      const art = await chats.castPortraitRef(chat.id);
      if (!art || art.snapshotVersion !== stored.snapshotVersion) continue;
      return { chat, snapshot: stored.snapshot, hasPortrait: art.liveCardFallback ? hasPortrait(stored.snapshot.character as never) : !!art.ref };
    }
    if (chat.snapshotVersion !== 0) return null;
    const character = await studio.read("character", chat.cast.character.id);
    if (!character) throw new SceneCastMissingError();
    const persona = chat.cast.persona ? await studio.read("persona", chat.cast.persona.id) : null;
    const snapshot: CastSnapshot = {
      character: character as unknown as CastSnapshot["character"],
      ...(persona ? { persona: persona as unknown as NonNullable<CastSnapshot["persona"]> } : {}),
    };
    const current = await chats.getChat(chat.id);
    if (!current || current.snapshotVersion !== 0) continue;
    const projected = light
      ? { character: lightMember(snapshot.character), ...(snapshot.persona ? { persona: lightMember(snapshot.persona) } : {}) }
      : snapshot;
    return { chat: current, snapshot: projected, hasPortrait: hasPortrait(character as never) };
  }
  return null;
}
