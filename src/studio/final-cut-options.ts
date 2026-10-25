/**
 * The request options of one pass (RoleCall lib/post-gen-actions/service.ts:356-399): its temperature (or the pass type's own), how many
 * tokens it may write, and the one tool it must call. Reasoning models can spend 16,000 tokens thinking before they write, so the floor
 * is high; one cap, 64,000, applies whether the number was chosen or worked out (RoleCall accepts 128,000 in the panel and silently
 * retries at 64,000).
 */
import { MAX_OUTPUT_TOKENS, temperatureOf, type FinalCutPass } from "../core/final-cut/pass";
import type { ToolSpec } from "../core/final-cut/tools";
import type { ProviderOptions } from "../stage/contracts/provider";

const FLOOR = 16_000;

export function passModelOptions(pass: FinalCutPass, inputLength: number, tool: ToolSpec | null): ProviderOptions {
  const chosen = pass.maxOutputTokens;
  return {
    temperature: temperatureOf(pass.temperature, pass.type),
    max_tokens: chosen && chosen > 0 ? Math.min(chosen, MAX_OUTPUT_TOKENS) : Math.min(Math.max(Math.ceil(inputLength / 3), FLOOR), MAX_OUTPUT_TOKENS),
    ...(tool ? { tools: [tool.tool], tool_choice: { type: "function" as const, function: { name: tool.name } } } : {}),
  };
}
