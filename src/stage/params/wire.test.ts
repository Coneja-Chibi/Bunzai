/** The pure parameter mapping: what is sent, what is left out, and why. */
import { describe, expect, test } from "bun:test";
import { sentParams, wireParams, accepts } from "./wire";

const support = { min_p: true, seed: "random_seed", clear_thinking: true, frequency_penalty: true, top_k: true } as const;

describe("wireParams", () => {
  test("sends under the declared name and reports what the provider does not take", () => {
    expect(wireParams(support, { min_p: 0.1, seed: 7, tfs: 0.9 })).toEqual({ fields: { min_p: 0.1, random_seed: 7 }, notSent: [{ id: "tfs", why: "unsupported" }] });
  });
  test("a no-op value is not sent, and says so", () => {
    expect(wireParams(support, { min_p: 0, frequency_penalty: 0 }).notSent.map((n) => n.why)).toEqual(["neutral", "neutral"]);
  });
  test("a sub-toggle waits for its parent", () => {
    const parents = { clear_thinking: "enable_thinking" };
    expect(wireParams(support, { clear_thinking: false }, parents).notSent).toEqual([{ id: "clear_thinking", why: "parent-off" }]);
    expect(wireParams(support, { clear_thinking: false, enable_thinking: true }, parents).fields).toEqual({ clear_thinking: false });
  });
  test("a value the provider's shaping cannot use is dropped as unusable", () => {
    expect(wireParams({ stop: { key: "stop", to: () => undefined } }, { stop: ["a"] }).notSent).toEqual([{ id: "stop", why: "unusable" }]);
  });
  test("accepts reads the declaration", () => {
    expect(accepts(support, "seed")).toBe(true);
    expect(accepts(support, "tfs")).toBe(false);
  });
});

describe("sentParams", () => {
  test("the scene's enabled value wins over the preset's typed one, and the typed one still goes out alone", () => {
    expect(sentParams(support, { min_p: 0.05, params: { min_p: 0.2 } }).fields).toEqual({ min_p: 0.2 });
    expect(sentParams(support, { min_p: 0.05 }).fields).toEqual({ min_p: 0.05 });
  });
  test("a parameter that is not in params is not sent", () => {
    expect(sentParams(support, { params: {} })).toEqual({ fields: {}, notSent: [] });
  });
  test("with no declared support only the two penalties go out", () => {
    expect(sentParams(undefined, { frequency_penalty: 0.5, min_p: 0.1 })).toEqual({ fields: { frequency_penalty: 0.5 }, notSent: [{ id: "min_p", why: "unsupported" }] });
  });
});

describe("a parent switch is a condition, not a field", () => {
  test("Enable Thinking lets Clear Thinking through and is itself never listed as left out", () => {
    const parents = { clear_thinking: "enable_thinking" };
    expect(wireParams({ clear_thinking: true }, { enable_thinking: true, clear_thinking: false }, parents)).toEqual({ fields: { clear_thinking: false }, notSent: [] });
    expect(wireParams({ clear_thinking: true }, { clear_thinking: false }, parents).notSent).toEqual([{ id: "clear_thinking", why: "parent-off" }]);
  });
});
