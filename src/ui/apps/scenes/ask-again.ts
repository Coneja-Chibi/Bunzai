/** When a scene offers "Ask again for a reply": the take ends on a user message, nothing runs, nothing is held (turn-loop rule: a stop with no text stores nothing, so a take can end on you). */
import type { Message } from "../../../stage/contracts/chat-store";

export function canAskAgain(input: { lastRole: Message["role"] | null; busy: boolean; connected: boolean; held: boolean }): boolean {
  return input.lastRole === "user" && input.connected && !input.busy && !input.held;
}
