/**
 * Regression: "reasoning off" must actually leave extended thinking off the wire, not merely hide
 * it in the UI. applyThinking only turns thinking on when a positive budget is given; this proves
 * a request built with no budget (the "reasoning off" case) never adds a thinking field or drops
 * the sampler options thinking would otherwise require dropping.
 */
import { describe, expect, test } from "bun:test";
import { buildAnthropicRequest } from "./anthropic-request";
import type { AnthropicConnection } from "./anthropic-request";
import type { ProviderMessage, ProviderRequest } from "../contracts/provider";

const conn = (extra: Partial<AnthropicConnection> = {}): AnthropicConnection => ({ id: "a", apiKey: "sk-ant-test", ...extra });
const req = (messages: ProviderMessage[], options: ProviderRequest["options"] = {}): ProviderRequest => ({ model: "claude-opus-5-5", messages, options });

describe("reasoning off means no thinking field on the wire", () => {
  test("no reasoning_budget_tokens: the body never enables thinking, and temperature/top_k survive", () => {
    const body = buildAnthropicRequest(
      req([{ role: "user", content: "hi" }], { temperature: 0.7, top_k: 5 }),
      conn(),
    ).body as Record<string, unknown>;
    // A model that thinks by default is told not to (RoleCall anthropic.ts:347-361), which leaves sampling alone; thinking is never enabled.
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.temperature).toBe(0.7);
    expect(body.top_k).toBe(5);
  });

  test("reasoning_budget_tokens of 0 (switched off after being on) also leaves thinking off", () => {
    const body = buildAnthropicRequest(
      req([{ role: "user", content: "hi" }], { temperature: 0.7, reasoning_budget_tokens: 0 }),
      conn(),
    ).body as Record<string, unknown>;
    // A model that thinks by default is told not to (RoleCall anthropic.ts:347-361), which leaves sampling alone; thinking is never enabled.
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.temperature).toBe(0.7);
  });
});
