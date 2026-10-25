/**
 * The meter document: learning creates a model's entry and estimates use it, keys keep routed
 * backends apart, twins pool, a stored document round-trips and refuses a bad entry by name, and
 * nothing of the prompt's text is ever written (token-meter rule 11).
 */
import { describe, expect, test } from "bun:test";
import { countPrompt } from "./base";
import { estimatePart } from "./calibrate";
import { emptyMeter, estimateFor, learn, modelKey, parseMeter, partFor, readKey, reset, serializeMeter, summaries } from "./meter";

const base = (total: number) => ({ total, prose: total, code: 0, json: 0, cjk: 0 });

describe("meter", () => {
  test("a reply creates the model's entry, and later estimates use what it learned", () => {
    const meter = emptyMeter();
    const key = modelKey("openrouter", "anthropic/claude-opus-5-5");
    expect(estimateFor(meter, key, base(10_000), 0).source).toBe("prior");
    for (let i = 0; i < 12; i++) learn(meter, key, { sample: { base: base(8000 + i * 500), real: Math.round(1.3 * (8000 + i * 500) + 200) }, promptTotal: 1, cacheRead: 0 }, i);
    const e = estimateFor(meter, key, base(10_000), 20);
    expect(e.source).toBe("learned");
    expect(Math.abs(e.mid - 13_200) / 13_200).toBeLessThan(0.03);
  });

  test("the routed backend is part of the key, so two tokenizers never blend", () => {
    expect(modelKey("openrouter", "auto", "anthropic/claude-sonnet-5")).not.toBe(modelKey("openrouter", "auto", "openai/gpt-5.5"));
    expect(modelKey("OpenAI", "gpt-4o", "gpt-4o")).toBe("openai|gpt-4o|");
  });

  test("before a reply names its backend, a turn reads the entry last taught for the model it asks for", () => {
    const meter = emptyMeter();
    expect(readKey(meter, "openrouter", "auto")).toBe(modelKey("openrouter", "auto"));
    learn(meter, modelKey("openrouter", "auto", "anthropic/claude-sonnet-5"), { sample: { base: base(3000), real: 3900 }, promptTotal: 3900 }, 10);
    learn(meter, modelKey("openrouter", "auto", "openai/gpt-5.5"), { sample: { base: base(3000), real: 3100 }, promptTotal: 3100 }, 20);
    learn(meter, modelKey("openrouter", "autopilot", "x"), { sample: { base: base(3000), real: 3000 }, promptTotal: 3000 }, 30);
    expect(readKey(meter, "openrouter", "auto")).toBe(modelKey("openrouter", "auto", "openai/gpt-5.5"));
  });

  test("two models of one provider whose fits agree pool as twins", () => {
    const meter = emptyMeter();
    const a = modelKey("nanogpt", "qwen-3-235b");
    const b = modelKey("nanogpt", "qwen-3-32b");
    for (let i = 0; i < 20; i++) {
      const t = 4000 + i * 300;
      learn(meter, a, { sample: { base: base(t), real: Math.round(1.1 * t + 50) }, promptTotal: 1 }, i);
      learn(meter, b, { sample: { base: base(t), real: Math.round(1.1 * t + 60) }, promptTotal: 1 }, i);
    }
    expect(estimateFor(meter, a, base(6000), 30).twins).toBe(1);
    expect(summaries(meter).map((s) => s.twins)).toEqual([1, 1]);
    // A message's part pools the same way: no narrower than either twin's own.
    const part = partFor(meter, a, base(500), 30);
    expect(part.samples).toBe(40);
    expect(part.bound).toBe(Math.max(estimatePart(meter.models[a]!, base(500)).bound, estimatePart(meter.models[b]!, base(500)).bound));
  });

  test("a stored meter round-trips, and a damaged entry is dropped by name", () => {
    const meter = emptyMeter();
    const key = modelKey("deepseek", "deepseek-chat");
    learn(meter, key, { sample: { base: base(3000), real: 3300 }, promptTotal: 3300, cacheRead: 2000 }, 5);
    const text = serializeMeter(meter);
    expect(parseMeter(text)).toEqual({ meter, discarded: [] });
    const damaged = JSON.parse(text) as { models: Record<string, { whole: { w: unknown[] } }> };
    damaged.models[key]!.whole.w = ["x", 1];
    damaged.models["not-a-key"] = damaged.models[key]!;
    // An entry carrying a field the meter does not know is not the meter's: refused, not half-trusted.
    const valid = (JSON.parse(text) as { models: Record<string, object> }).models[key]!;
    damaged.models["x|y|"] = { ...valid, note: "stray" } as never;
    expect(parseMeter(JSON.stringify(damaged)).discarded.sort()).toEqual([key, "not-a-key", "x|y|"].sort());
    expect(parseMeter("{not json").discarded).toEqual(["(the whole document: not JSON)"]);
    expect(parseMeter(null)).toEqual({ meter: emptyMeter(), discarded: [] });
  });

  test("nothing of the prompt's text is ever stored", () => {
    const meter = emptyMeter();
    const secret = "Zephyrine walked the brass rail at midnight";
    const counted = countPrompt([secret, secret]);
    learn(meter, modelKey("openai", "gpt-4o"), { sample: { base: counted, real: counted.total + 10 }, promptTotal: counted.total + 10 }, 1);
    const stored = serializeMeter(meter);
    // The distinctive words: short ones such as "at" also spell field names like updatedAt.
    for (const word of secret.split(" ").filter((w) => w.length >= 5)) expect(stored.includes(word)).toBe(false);
  });

  test("reset forgets one model or all of them", () => {
    const meter = emptyMeter();
    learn(meter, "a|m|", { sample: { base: base(100), real: 110 }, promptTotal: 110 }, 1);
    learn(meter, "b|m|", { sample: { base: base(100), real: 110 }, promptTotal: 110 }, 1);
    reset(meter, "a|m|");
    expect(Object.keys(meter.models)).toEqual(["b|m|"]);
    reset(meter);
    expect(meter.models).toEqual({});
  });
});
