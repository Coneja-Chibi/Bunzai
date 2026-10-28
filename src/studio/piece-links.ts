/**
 * Where a library piece is linked: the live scenes whose prompting names it, in the list the piece's kind names in the kind hub (`promptingList` in its
 * kind.ts: a tracker's `trackers`, a tool's `tools`). It reads only the scenes' settings through the store's own scene list (no message is read), leaves
 * out a deleted scene (the store keeps those in its graveyard, apart), and has no cap: every scene that links the piece is named. Read-only.
 */
import type { KindDescriptor } from "../entities/_shared/kind-descriptor";
import { KINDS } from "../generated/kinds";
import type { ChatStore } from "../stage/contracts/chat-store";

export interface LinkedScene { chatId: string; title: string }

/** The kinds a scene links, as the hub says. */
const HUB: readonly KindDescriptor[] = KINDS;
export const linkableKinds = (): string[] => HUB.filter((k) => k.promptingList !== undefined).map((k) => k.id);

/** The scenes that link the piece, or null when the kind is not one a scene links. */
export async function scenesLinking(chats: Pick<ChatStore, "listChats">, kind: string, id: string): Promise<LinkedScene[] | null> {
  const list = HUB.find((k) => k.id === kind)?.promptingList;
  if (list === undefined) return null;
  const { chats: live } = await chats.listChats();
  return live.filter((c) => c.prompting?.[list]?.includes(id)).map((c) => ({ chatId: c.id, title: c.title }));
}
