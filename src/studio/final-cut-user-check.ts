/**
 * The safety check on the person's own message, before it is saved (RoleCall's validator pass with "check user messages"). The chain is
 * Final Cut on, a live safety pass that asks for user messages, and that pass set to Block; then an error-level issue stops the send
 * with its words. Warnings never stop a send. It runs on the server so no client can skip it.
 */
import { activePasses } from "../core/final-cut/pass";
import { validateText } from "../core/final-cut/validate";
import type { Chat } from "../stage/contracts/chat-store";
import { StudioValidationError } from "./errors";

export function checkUserMessage(chat: Pick<Chat, "finalCut">, text: string): void {
  if (!chat.finalCut?.on) return;
  const pass = activePasses(chat.finalCut.passes).find((p) => p.type === "validator" && p.applyToUserMessages === true && p.failureMode === "block");
  if (!pass) return;
  const error = validateText(text).find((i) => i.severity === "error");
  if (error) throw new StudioValidationError(`Your message was not sent. ${error.message}`);
}
