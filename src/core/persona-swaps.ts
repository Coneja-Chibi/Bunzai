/** The "you now play X" lines of a transcript, derived from each user message's persona stamp (ChatStore rule 26). Pure. */
import type { Message } from "../stage/contracts/chat-store";

/**
 * The "you now play X" lines of a transcript: one before each user message whose persona differs from
 * the previous user message's. Derived from the stamps, never stored. A message with no stamp (written
 * before stamps existed) says nothing about who wrote it, so it neither starts nor ends a change. A
 * `null` name means the person stopped playing a persona.
 */
export function personaSwaps(messages: readonly Message[]): Map<string, string | null> {
  const marks = new Map<string, string | null>();
  let before: { id: string | null } | undefined;
  for (const m of messages) {
    if (m.role !== "user" || m.cut || m.persona === undefined) continue;
    const now = { id: m.persona?.id ?? null };
    if (before && before.id !== now.id) marks.set(m.id, m.persona?.name ?? null);
    before = now;
  }
  return marks;
}
