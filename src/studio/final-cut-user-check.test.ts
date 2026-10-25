/**
 * The safety check on the person's own message (RoleCall's validator pass with "check user messages"): only when Final Cut is on and a
 * live safety pass asks for it, only an error stops the send, and only when that pass is set to Block. Warnings never stop a send.
 */
import { describe, expect, test } from "bun:test";
import { createPass } from "../core/final-cut/pass";
import type { Chat } from "../stage/contracts/chat-store";
import { StudioValidationError } from "./errors";
import { checkUserMessage } from "./final-cut-user-check";

const LEAK = "hello __FC_PROTECTED_1_CODE__ there";
const chat = (passes: unknown, on = true): Chat =>
  ({ id: "c", finalCut: { ...(on ? { on: true as const } : {}), passes } }) as unknown as Chat;
const safety = (over: Record<string, unknown>) => [{ ...createPass("validator", 0), applyToUserMessages: true, failureMode: "block", ...over }];

describe("checkUserMessage", () => {
  test("a leaked protected placeholder stops the send when the safety check is on, set to check my messages, and set to Block", () => {
    expect(() => checkUserMessage(chat(safety({})), LEAK)).toThrow(StudioValidationError);
    expect(() => checkUserMessage(chat(safety({})), LEAK)).toThrow("A protected syntax placeholder leaked into visible text.");
  });
  test("it lets the message through when anything in that chain is off", () => {
    expect(() => checkUserMessage(chat(safety({}), false), LEAK)).not.toThrow();
    expect(() => checkUserMessage(chat(safety({ applyToUserMessages: false })), LEAK)).not.toThrow();
    expect(() => checkUserMessage(chat(safety({ enabled: false })), LEAK)).not.toThrow();
    expect(() => checkUserMessage(chat(safety({ failureMode: "fallback" })), LEAK)).not.toThrow();
    expect(() => checkUserMessage({ id: "c" } as Chat, LEAK)).not.toThrow();
  });
  test("a warning (an unclosed code fence) never stops a send", () => {
    expect(() => checkUserMessage(chat(safety({})), "```js\nnope")).not.toThrow();
  });
});
