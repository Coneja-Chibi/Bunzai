/**
 * Regression: a tokenizer-family matcher that matches specific model names has to be hand-extended
 * release after release (Qwen3, Qwen3.5, Kimi K2/K2.5, Mistral V7 Tekken, Grok OSS). Bunraku's
 * familyOf matches by substring instead, so a newer point release of a known family should
 * classify correctly without an edit here; this is the regression guard for that property.
 */
import { describe, expect, test } from "bun:test";
import { familyOf } from "./priors";

describe("newer point releases of a known model family still classify", () => {
  test("Qwen and Kimi point releases not seen before still match their family", () => {
    expect(familyOf("qwen-3.5-235b")).toBe("qwen");
    expect(familyOf("kimi-k2.5")).toBe("kimi");
    expect(familyOf("moonshotai/kimi-k2.5")).toBe("kimi");
  });

  test("Mistral's named variants and Grok's open-weight release still match their family", () => {
    expect(familyOf("mistral-v7-tekken")).toBe("mistral");
    expect(familyOf("grok-4-oss")).toBe("grok");
    expect(familyOf("x-ai/grok-code-fast-1")).toBe("grok");
  });
});
