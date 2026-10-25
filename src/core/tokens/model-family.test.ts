/**
 * Pins classifyModelId/claudeVersion before cache.ts, priors.ts, and assembly/request.ts fold their
 * own regex onto these. B12: the fable/mythos Claude rename used to be invisible to the pricing/
 * backend classifier and to the prefill check (which used a bare `indexOf("claude")` gate), so a
 * fable/mythos request could be built with a trailing-assistant prefill that model line actually
 * refuses. Every fable/mythos case below is the regression.
 */
import { describe, expect, test } from "bun:test";
import { classifyModelId, claudeVersion } from "./model-family";

describe("claudeVersion", () => {
  test("parses major/minor off a plain or prefixed claude id", () => {
    expect(claudeVersion("claude-opus-4.6")).toEqual({ major: 4, minor: 6 });
    expect(claudeVersion("anthropic/claude-opus-4-6")).toEqual({ major: 4, minor: 6 });
    expect(claudeVersion("claude-3-5-sonnet")).toEqual({ major: 3, minor: 5 });
  });

  test("a long ISO-date suffix is never misread as the minor version", () => {
    expect(claudeVersion("claude-opus-4-20250514")).toEqual({ major: 4, minor: 0 });
  });

  test("B12: fable and mythos parse as Claude-family, newest tier, with no digits of their own", () => {
    expect(claudeVersion("fable-5-1")).toEqual({ major: 5, minor: 0 });
    expect(claudeVersion("mythos-preview")).toEqual({ major: 5, minor: 0 });
  });

  test("not Claude-family at all -> null", () => {
    expect(claudeVersion("gpt-5")).toBeNull();
    expect(claudeVersion("deepseek-chat")).toBeNull();
  });
});

describe("classifyModelId", () => {
  test("B12: fable and mythos classify as anthropic's current-tier family, not unknown", () => {
    expect(classifyModelId("fable-5-1")).toBe("claude");
    expect(classifyModelId("mythos-preview")).toBe("claude");
  });

  test("a pre-4.7 claude id is the legacy tokenizer family", () => {
    expect(classifyModelId("claude-3-5-sonnet")).toBe("claude-legacy");
    expect(classifyModelId("claude-opus-4.6")).toBe("claude-legacy");
  });

  test("4.7 and newer, including claude-5 and aggregator-prefixed ids, are current", () => {
    expect(classifyModelId("claude-opus-4.7")).toBe("claude");
    expect(classifyModelId("claude-sonnet-5")).toBe("claude");
    expect(classifyModelId("anthropic/claude-opus-5-5")).toBe("claude");
  });

  test("B12: qwen's qwq and dashscope aliases are recognized (cache.ts's old table missed them)", () => {
    expect(classifyModelId("qwq-32b")).toBe("qwen");
    expect(classifyModelId("dashscope/qwen-max")).toBe("qwen");
  });

  test("the other common families", () => {
    expect(classifyModelId("deepseek-chat")).toBe("deepseek");
    expect(classifyModelId("gpt-5")).toBe("openai");
    expect(classifyModelId("gpt-4")).toBe("openai-legacy");
    expect(classifyModelId("gemini-2.5-pro")).toBe("gemini");
    expect(classifyModelId("meta-llama/llama-4-scout")).toBe("llama");
    expect(classifyModelId("mystery-7b")).toBe("unknown");
  });
});
