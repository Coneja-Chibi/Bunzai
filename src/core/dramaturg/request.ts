/** The Dramaturg's input estimate includes message framing, echoed calls and tool definitions on every round. */
import type { ProviderMessage, ProviderToolDefinition } from "../../stage/contracts/provider";
import { countPrompt, countText } from "../tokens";

export function dramaturgInputTokens(messages: readonly ProviderMessage[], tools: readonly ProviderToolDefinition[] = []): number {
  return countPrompt(messages.map((message) => JSON.stringify(message))).total + (tools.length ? countText(JSON.stringify(tools)) : 0);
}
