/** Reasoning Effort per wire dialect (reasoning-wire.ts) and where each request builder places it. No network. */
import { describe, expect, test } from "bun:test";
import type { ProviderRequest } from "../contracts/provider";
import { buildAnthropicRequest } from "./anthropic-request";
import { buildWireRequest } from "./openai-compatible-request";
import { claudeThinking, geminiEffort, openAIEffort, openRouterEffort } from "./reasoning-wire";

const req = (model: string, options: ProviderRequest["options"]): ProviderRequest => ({ model, messages: [{ role: "user", content: "hi" }], options });

describe("translations", () => {
  test("Auto sends nothing anywhere", () => {
    expect(openAIEffort("gpt-5", "auto")).toBeUndefined();
    expect(openRouterEffort("auto")).toBeUndefined();
    expect(geminiEffort("gemini-2.5-pro", undefined)).toBeUndefined();
    expect(claudeThinking("claude-sonnet-4-5", "auto", 8000, true)).toBeNull();
  });
  test("OpenAI: reasoning models only, with the levels clamped to what the model takes", () => {
    expect(openAIEffort("gpt-4o", "high")).toBeUndefined();
    expect(openAIEffort("o3", "high")).toBe("high");
    expect(openAIEffort("gpt-5", "minimal")).toBe("minimal");
    expect(openAIEffort("gpt-5.2", "minimal")).toBe("low");
    expect(openAIEffort("gpt-5.2", "xhigh")).toBe("high");
    expect(openAIEffort("gpt-5.4", "xhigh")).toBe("xhigh");
    expect(openAIEffort("gpt-5", "none")).toBeUndefined();
  });
  test("Google: Gemini only, none only on flash, xhigh as high", () => {
    expect(geminiEffort("gemini-2.5-flash", "none")).toBe("none");
    expect(geminiEffort("gemini-2.5-pro", "none")).toBeUndefined();
    expect(geminiEffort("gemini-2.5-pro", "xhigh")).toBe("high");
    expect(geminiEffort("gemma-3", "high")).toBeUndefined();
  });
  test("Anthropic: a budget by share of max_tokens on older models, adaptive on the newest", () => {
    expect(claudeThinking("claude-sonnet-4-5", "medium", 8000, true)).toEqual({ budget: 2000 });
    expect(claudeThinking("claude-sonnet-4-5", "minimal", 8000, true)).toEqual({ budget: 1024 });
    expect(claudeThinking("claude-sonnet-4-5", "xhigh", 100_000, false)).toEqual({ budget: 21_333 });
    expect(claudeThinking("claude-3-5-haiku", "high", 8000, true)).toBeNull();
    expect(claudeThinking("claude-opus-4.6", "high", 8000, true)).toEqual({ adaptive: true, effort: "high" });
    expect(claudeThinking("claude-opus-4-6", "xhigh", 8000, true)).toEqual({ adaptive: true, effort: "max" });
    expect(claudeThinking("claude-opus-5-5", "xhigh", 8000, true)).toEqual({ adaptive: true, effort: "xhigh" });
    expect(claudeThinking("claude-opus-5-5", "none", 8000, true)).toBeNull();
  });
});

describe("request builders", () => {
  const c = (support: object) => ({ id: "k", baseUrl: "https://x.test/v1", support });
  test("an OpenAI connection sends reasoning_effort for a reasoning model and not for another", () => {
    expect(buildWireRequest(req("gpt-5", { reasoning_effort: "high" }), c({ reasoningEffort: "openai" })).body.reasoning_effort).toBe("high");
    expect(buildWireRequest(req("gpt-4o", { reasoning_effort: "high" }), c({ reasoningEffort: "openai" })).body.reasoning_effort).toBeUndefined();
  });
  test("an OpenRouter connection nests it, a Google one clamps it, a plain one passes it as given", () => {
    const nested = buildWireRequest(req("a/b", { reasoning_effort: "low" }), c({ reasoningEffort: "openrouter" })).body;
    expect(nested).toMatchObject({ reasoning: { effort: "low" } });
    expect(nested.reasoning_effort).toBeUndefined();
    expect(buildWireRequest(req("gemini-2.5-pro", { reasoning_effort: "xhigh" }), c({ reasoningEffort: "gemini" })).body.reasoning_effort).toBe("high");
    expect(buildWireRequest(req("m", { reasoning_effort: "high" }), c({ reasoningEffort: true })).body.reasoning_effort).toBe("high");
    expect(buildWireRequest(req("m", { reasoning_effort: "high" }), c({})).body.reasoning_effort).toBeUndefined();
  });
  test("a connection with no reasoning dialect ignores the level", () => {
    expect(buildWireRequest(req("gpt-5", { reasoning_effort: "high" }), c({ streamUsage: true })).body.reasoning).toBeUndefined();
  });
  test("Anthropic turns the level into a thinking budget and drops the sampling the API refuses with it", () => {
    const { body } = buildAnthropicRequest(req("claude-sonnet-4-5", { reasoning_effort: "medium", max_tokens: 8000, temperature: 0.7, top_p: 0.9, stream: true }), { id: "a", apiKey: "k" });
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 2000 });
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
  });
  test("Anthropic's newest models get adaptive thinking with the effort", () => {
    const { body } = buildAnthropicRequest(req("claude-opus-4-6", { reasoning_effort: "high", max_tokens: 8000 }), { id: "a", apiKey: "k" });
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "high" });
  });
  test("an explicit budget wins over the level, and Auto changes nothing", () => {
    const { body } = buildAnthropicRequest(req("claude-sonnet-4-5", { reasoning_effort: "high", reasoning_budget_tokens: 3000, max_tokens: 8000 }), { id: "a", apiKey: "k" });
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 3000 });
    expect(buildAnthropicRequest(req("claude-sonnet-4-5", { reasoning_effort: "auto", max_tokens: 8000 }), { id: "a", apiKey: "k" }).body.thinking).toBeUndefined();
  });
});

describe("what RoleCall sends on Auto, and Reasoning continuity", () => {
  const conn = { id: "a", apiKey: "k" };
  test("Claude 4.6+ and the 5 series that can think are told not to when no level is set, because an omitted thinking field is the model's choice (RoleCall anthropic.ts:347-361)", () => {
    expect(buildAnthropicRequest(req("claude-opus-4-6", { max_tokens: 8000 }), conn).body.thinking).toEqual({ type: "disabled" });
    expect(buildAnthropicRequest(req("claude-opus-4-6", { reasoning_effort: "none", max_tokens: 8000 }), conn).body.thinking).toEqual({ type: "disabled" });
    expect(buildAnthropicRequest(req("claude-opus-4-6", { reasoning_effort: "low", max_tokens: 8000 }), conn).body.thinking).toEqual({ type: "adaptive" });
    expect(buildAnthropicRequest(req("claude-opus-4-6", { reasoning_budget_tokens: 3000, max_tokens: 8000 }), conn).body.thinking).toEqual({ type: "enabled", budget_tokens: 3000 });
  });
  test("a model that cannot switch thinking off, and older models, are left alone", () => {
    expect(buildAnthropicRequest(req("claude-fable-5-1", { max_tokens: 8000 }), conn).body.thinking).toBeUndefined();
    expect(buildAnthropicRequest(req("claude-sonnet-4-5", { max_tokens: 8000 }), conn).body.thinking).toBeUndefined();
  });
  const history: ProviderRequest["messages"] = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "Hello.", reasoning: { text: "greet", signature: "sig", provider: "anthropic" } },
    { role: "user", content: "and?" },
  ];
  test("an earlier reply's signed thinking goes back as a thinking block while thinking is on, and is dropped when it is off", () => {
    const on = buildAnthropicRequest({ model: "claude-sonnet-4-5", messages: history, options: { reasoning_effort: "medium", max_tokens: 8000 } }, conn).body;
    expect((on.messages as { content: unknown }[])[1]!.content).toEqual([{ type: "thinking", thinking: "greet", signature: "sig" }, { type: "text", text: "Hello." }]);
    const off = buildAnthropicRequest({ model: "claude-sonnet-4-5", messages: history, options: { max_tokens: 8000 } }, conn).body;
    expect((off.messages as { content: unknown }[])[1]!.content).toBe("Hello.");
  });
});
