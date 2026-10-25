/**
 * The scene's stored participants, held once per scene so the Cast wing's Participants tab and the message list read the same
 * roster: a change made in the tab recolours the quotes at once. `undefined` is not loaded yet; `null` is loaded and empty.
 */
import { useSyncExternalStore } from "react";
import type { ChatParticipants } from "../../../../stage/contracts/chat-store";

const held = new Map<string, ChatParticipants | null>();
const listeners = new Set<() => void>();

export const heldParticipants = (chatId: string): ChatParticipants | null | undefined => held.get(chatId);

export function holdParticipants(chatId: string, value: ChatParticipants | null): void {
  held.set(chatId, value);
  for (const l of listeners) l();
}

export function useHeldParticipants(chatId: string): ChatParticipants | null | undefined {
  return useSyncExternalStore((l) => { listeners.add(l); return () => void listeners.delete(l); }, () => held.get(chatId), () => undefined);
}
