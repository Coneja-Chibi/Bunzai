/**
 * The meter's smaller rules, each pinned because an independent review (2026-09-27) broke it
 * without any test noticing: twin pooling's limits, the stored meter's strictness, the learner's
 * guards, family detection, and the base counter's edges.
 */
import { describe, expect, test } from "bun:test";
import { countFramed, countMessage, countPrompt } from "./base";
import { estimate, newCalibration, observe, observeCache } from "./calibrate";
import { emptyMeter, estimateFor, learn, modelKey, parseMeter, serializeMeter, summaries, type Meter } from "./meter";
import { positiveDefinite } from "./fit";
import { familyOf } from "./priors";
import { trimHistory } from "./trim";
import type { Family } from "./priors";

const base = (total: number) => ({ total, prose: total, code: 0, json: 0, cjk: 0 });
/** A meter holding only one model of another, so its estimate has no twins. */
const emptyMeterWith = (meter: Meter, key: string): Meter => ({ version: 1, models: { [key]: meter.models[key]! } });
const teach = (meter: Meter, key: string, slope: number, overhead: number, n = 20) => {
  for (let i = 0; i < n; i++) {
    const t = 4000 + i * 300;
    learn(meter, key, { sample: { base: base(t), real: Math.round(slope * t + overhead) }, promptTotal: 1 }, i);
  }
};

describe("twins", () => {
  test("only models of one provider and one family pool", () => {
    const meter = emptyMeter();
    teach(meter, modelKey("nanogpt", "qwen-3-235b"), 1.1, 50);
    teach(meter, modelKey("openrouter", "qwen-3-32b"), 1.1, 50);
    teach(meter, modelKey("nanogpt", "deepseek-v4"), 1.1, 50);
    expect(estimateFor(meter, modelKey("nanogpt", "qwen-3-235b"), base(6000), 30).twins).toBe(0);
  });

  test("pooling never narrows the bound below the model's own", () => {
    const meter = emptyMeter();
    const a = modelKey("nanogpt", "qwen-3-235b");
    teach(meter, a, 1.1, 50);
    const alone = estimateFor(meter, a, base(6000), 30).bound;
    // The twin wanders more than the model it pools with: the pooled margin takes the wider.
    const twin = modelKey("nanogpt", "qwen-3-32b");
    for (let i = 0; i < 20; i++) {
      const t = 4000 + i * 300;
      learn(meter, twin, { sample: { base: base(t), real: Math.round((1.1 * t + 60) * (i % 2 ? 1.02 : 0.98)) }, promptTotal: 1 }, i);
    }
    const pooled = estimateFor(meter, a, base(6000), 30);
    expect(pooled.twins).toBe(1);
    expect(pooled.bound).toBeGreaterThanOrEqual(alone);
    const own = estimateFor(emptyMeterWith(meter, a), a, base(6000), 30).spread;
    const theirs = estimateFor(emptyMeterWith(meter, twin), twin, base(6000), 30).spread;
    expect(theirs).toBeGreaterThan(own);
    expect(pooled.spread).toBeGreaterThanOrEqual(theirs);
  });
});

describe("a stored meter is read strictly", () => {
  const stored = () => {
    const meter = emptyMeter();
    teach(meter, "openai|gpt-4o|", 1.0, 20, 3);
    return JSON.parse(serializeMeter(meter)) as { version: 1; models: Record<string, Record<string, unknown>> };
  };
  const refused = (change: (entry: Record<string, unknown>) => void) => {
    const doc = stored();
    change(doc.models["openai|gpt-4o|"]!);
    return parseMeter(JSON.stringify(doc)).discarded;
  };

  test("a family must be a family, never an inherited name", () => {
    for (const family of ["toString", "constructor", "__proto__"]) expect(refused((e) => (e.family = family))).toEqual(["openai|gpt-4o|"]);
  });

  test("every number must be in range", () => {
    expect(refused((e) => (e.spread = -0.45))).toHaveLength(1);
    expect(refused((e) => (e.cacheHitRate = 1.5))).toHaveLength(1);
    expect(refused((e) => (e.rejected = 1.5))).toHaveLength(1);
    expect(refused((e) => ((e.whole as { p: number[] }).p[0] = -1))).toHaveLength(1);
    expect(refused((e) => ((e.whole as { w: number[] }).w[0] = 0))).toHaveLength(1);
    expect(refused((e) => ((e.whole as { n: number }).n = 2.5))).toHaveLength(1);
    expect(refused(() => undefined)).toEqual([]);
  });

  test("a key must name a provider and a model", () => {
    const doc = stored();
    doc.models["|gpt-4o|"] = doc.models["openai|gpt-4o|"]!;
    expect(parseMeter(JSON.stringify(doc)).discarded).toEqual(["|gpt-4o|"]);
  });
});

describe("the learner's guards", () => {
  test("the per-class fit is used only while it misses less", () => {
    const cal = newCalibration("qwen", 0);
    cal.byClass.n = 50;
    cal.whole.n = 50;
    cal.classSpread = 0.2;
    cal.spread = 0.01;
    expect(estimate(cal, base(1000)).source).toBe("learned");
    cal.classSpread = 0.005;
    expect(estimate(cal, base(1000)).source).toBe("by-class");
  });

  test("no estimate falls below the smallest plausible ratio", () => {
    const cal = newCalibration("openai", 0);
    cal.whole.w = [0.1, 0, 0];
    expect(estimate(cal, base(10_000)).mid).toBeGreaterThanOrEqual(8000);
  });

  test("a fit that turns non-finite is reset, not kept", () => {
    const cal = newCalibration("openai", 0);
    cal.whole.p[0] = Number.POSITIVE_INFINITY;
    expect(observe(cal, { base: base(1000), real: 1000 }, 1)).toBe("rejected");
    expect(cal.whole.n).toBe(0);
    expect(Number.isFinite(cal.whole.p[0])).toBe(true);
  });

  test("a detected tokenizer change loosens the fit so it re-learns", () => {
    const cal = newCalibration("openai", 0);
    for (let i = 0; i < 30; i++) observe(cal, { base: base(5000 + i * 100), real: 5000 + i * 100 + 20 }, i);
    const tight = cal.whole.p[0]!;
    let outcome = "";
    for (let i = 0; i < 10 && outcome !== "drift"; i++) outcome = observe(cal, { base: base(5000), real: 9000 }, 100 + i);
    expect(outcome).toBe("drift");
    expect(cal.whole.p[0]!).toBeGreaterThan(tight * 5);
  });

  test("the cache hit rate is a running average of what was served from cache", () => {
    const cal = newCalibration("deepseek", 0);
    observeCache(cal, 800, 1000);
    expect(cal.cacheHitRate).toBeCloseTo(0.8, 6);
    observeCache(cal, 0, 1000);
    expect(cal.cacheHitRate).toBeCloseTo(0.64, 6);
    expect(cal.cacheSamples).toBe(2);
  });

  test("summaries list the most recently used model first", () => {
    const meter = emptyMeter();
    learn(meter, "a|old|", { sample: { base: base(100), real: 110 }, promptTotal: 110 }, 1);
    learn(meter, "b|new|", { sample: { base: base(100), real: 110 }, promptTotal: 110 }, 5);
    expect(summaries(meter).map((s) => s.key)).toEqual(["b|new|", "a|old|"]);
  });
});

describe("families and the base counter", () => {
  test("Claude before Opus 4.7 keeps the older tokenizer", () => {
    expect(familyOf("claude-3-5-sonnet-20241022")).toBe("claude-legacy");
    expect(familyOf("claude-sonnet-4-20250514")).toBe("claude-legacy");
    expect(familyOf("claude-haiku-4-5")).toBe("claude-legacy");
    expect(familyOf("claude-opus-4-7")).toBe("claude");
    expect(familyOf("anthropic/claude-opus-5-5")).toBe("claude");
    expect(familyOf("gpt-4-turbo")).toBe("openai-legacy");
    expect(familyOf("gpt-4o")).toBe("openai");
    expect(familyOf("mystery-model")).toBe("unknown");
  });

  test("special-token text is counted as text, several tokens, not one special token", () => {
    expect(countMessage("<|endoftext|>").total).toBeGreaterThan(1);
  });

  test("a count handed out cannot change what the cache holds", () => {
    const fresh = countMessage("the same message thrice").total;
    const fromCache = countMessage("the same message thrice");
    fromCache.total += 1000;
    expect(countMessage("the same message thrice").total).toBe(fresh);
  });

  test("trimming leaves room for the reply", () => {
    const history = [1000, 1000, 1000, 1000];
    expect(trimHistory({ fixed: 1000, history, window: 6000, reserve: 0, chunk: 1 }).drop).toBe(0);
    expect(trimHistory({ fixed: 1000, history, window: 6000, reserve: 2500, chunk: 1 }).drop).toBe(2);
  });
});

describe("round-three guards (independent review, 2026-09-27)", () => {
  test("a report far below any real tokenizer is refused at any sample count, and the meter still reloads", () => {
    const meter = emptyMeter();
    const key = modelKey("local", "llama-3");
    expect(learn(meter, key, { sample: { base: base(20_000), real: 100 }, promptTotal: 100 }, 1)).toBe("rejected");
    for (let i = 0; i < 5; i++) learn(meter, key, { sample: { base: base(20_000 + i * 100), real: 21_000 + i * 105 }, promptTotal: 1 }, 2 + i);
    expect(estimateFor(meter, key, base(20_000), 10).bound).toBeLessThan(40_000);
    expect(parseMeter(serializeMeter(meter)).discarded).toEqual([]);
  });

  test("one report far above the prediction cannot push the spread past 1", () => {
    const cal = newCalibration("openai", 0);
    observe(cal, { base: base(1000), real: 50_000 }, 1);
    expect(cal.spread).toBeLessThanOrEqual(1);
    expect(cal.classSpread).toBeLessThanOrEqual(1);
  });

  test("pooling keeps the wider bound whichever twin is the noisier", () => {
    const meter = emptyMeter();
    const noisy = modelKey("nanogpt", "qwen-3-235b");
    const clean = modelKey("nanogpt", "qwen-3-32b");
    for (let i = 0; i < 20; i++) {
      const t = 4000 + i * 300;
      learn(meter, noisy, { sample: { base: base(t), real: Math.round((1.1 * t + 60) * (i % 2 ? 1.02 : 0.98)) }, promptTotal: 1 }, i);
    }
    teach(meter, clean, 1.1, 50);
    const alone = estimateFor(emptyMeterWith(meter, noisy), noisy, base(6000), 30).bound;
    expect(estimateFor(meter, clean, base(6000), 30).bound).toBeGreaterThanOrEqual(alone);
  });

  test("a stored negative sample count is refused", () => {
    const meter = emptyMeter();
    teach(meter, "openai|gpt-4o|", 1.0, 20, 3);
    const doc = JSON.parse(serializeMeter(meter)) as { models: Record<string, { whole: { n: number } }> };
    doc.models["openai|gpt-4o|"]!.whole.n = -1;
    expect(parseMeter(JSON.stringify(doc)).discarded).toEqual(["openai|gpt-4o|"]);
  });

  test("the per-message framing is counted: a chat of 500 short messages is not undercounted before any reply", () => {
    const texts = Array.from({ length: 500 }, (_, i) => `ok ${i}`);
    const truth = texts.reduce((n, t) => n + countMessage(t).total, 0) + 4 * texts.length;
    expect(estimate(newCalibration("openai", 0), countPrompt(texts)).bound).toBeGreaterThanOrEqual(truth);
    expect(countFramed("ok 1").total).toBe(countMessage("ok 1").total + 4);
  });

  test("old evidence fades: a ratio that creeps slowly is tracked, not averaged away", () => {
    const cal = newCalibration("openai", 0);
    for (let i = 0; i < 300; i++) {
      const b = 5000 + (i % 7) * 900;
      const ratio = 1.0 + (0.25 * i) / 300;
      observe(cal, { base: base(b), real: Math.round(ratio * b + 40) }, i);
    }
    const truth = 1.25 * 8000 + 40;
    // The lag of a forgetting window of about 67 replies on this creep; with no forgetting it is ~12%.
    expect(Math.abs(estimate(cal, base(8000)).mid - truth) / truth).toBeLessThan(0.06);
  });

  test("learned weights stay where a real tokenizer can be", () => {
    const cal = newCalibration("qwen", 0);
    cal.byClass.w[1] = -5;
    observe(cal, { base: base(3000), real: 3300 }, 1);
    expect(Math.min(...cal.byClass.w.slice(0, 4))).toBeGreaterThanOrEqual(0.3);
  });

  test("a covariance that is not positive definite is repaired, never kept", () => {
    const cal = newCalibration("openai", 0);
    cal.whole.p = [1, 2, 0, 2, 1, 0, 0, 0, 1];
    observe(cal, { base: base(3000), real: 3100 }, 1);
    expect(positiveDefinite(cal.whole.p, 3)).toBe(true);
  });
});

describe("round-three guards, continued", () => {
  test("a miss is measured against the larger count, so even a fit at the top of its range keeps the spread within 1", () => {
    const cal = newCalibration("openai", 0);
    cal.whole.w = [20, 0, 0];
    cal.byClass.w = [20, 20, 20, 20, 0, 0];
    observe(cal, { base: base(1000), real: 1000 }, 1);
    expect(cal.spread).toBeLessThanOrEqual(1);
    expect(cal.classSpread).toBeLessThanOrEqual(1);
  });

  test("a stored covariance that is not positive definite is refused", () => {
    const meter = emptyMeter();
    teach(meter, "openai|gpt-4o|", 1.0, 20, 3);
    const doc = JSON.parse(serializeMeter(meter)) as { models: Record<string, { whole: { p: number[] } }> };
    doc.models["openai|gpt-4o|"]!.whole.p = [1e-4, 1, 0, 1, 1e-4, 0, 0, 0, 1];
    expect(parseMeter(JSON.stringify(doc)).discarded).toEqual(["openai|gpt-4o|"]);
  });
});

describe("round-four guards (independent review, 2026-09-27)", () => {
  test("a new model's wildly high report waits for a second opinion, and a repeated one is learned", () => {
    const cal = newCalibration("claude", 0);
    expect(observe(cal, { base: base(10_000), real: 200_000 }, 1)).toBe("rejected");
    expect(observe(cal, { base: base(10_000), real: 200_000 }, 2)).toBe("rejected");
    expect(cal.whole.n).toBe(0);
    expect(observe(cal, { base: base(10_000), real: 200_000 }, 3)).not.toBe("rejected");
    expect(cal.whole.n).toBe(1);
  });

  test("a tokenizer that counts under o200k still learns, and its estimate stays at the safe floor", () => {
    const cal = newCalibration("qwen", 0);
    for (let i = 0; i < 30; i++) observe(cal, { base: base(8000 + i * 200), real: Math.round(0.6 * (8000 + i * 200)) }, i);
    expect(cal.whole.n).toBe(30);
    expect(cal.whole.w[0]!).toBeLessThan(0.75);
    expect(estimate(cal, base(10_000)).mid).toBe(8000);
  });
});

describe("round-five guards: the bound must not overcount either (independent review, 2026-09-27)", () => {
  test("a new or young model's bound stays within a sendable multiple of its midpoint", () => {
    const families: Family[] = ["openai", "qwen", "gemini", "claude", "unknown"];
    for (const family of families) {
      for (const n of [0, 1, 3]) {
        const cal = newCalibration(family, 0);
        for (let i = 0; i < n; i++) observe(cal, { base: base(20_000 + i * 5000), real: Math.round((20_000 + i * 5000) * 1.2) }, i);
        for (const size of [2000, 10_000, 30_000]) {
          const e = estimate(cal, base(size));
          // Lockout only threatens prompts big enough to near the window; a short prompt fits either way.
          const cap = size >= 10_000 ? 2.6 : 4;
          expect({ family, n, size, ok: e.bound / e.mid <= cap }).toEqual({ family, n, size, ok: true });
        }
      }
    }
  });

  test("a new model's first send fits: the prompts that used to be refused as overflowing", () => {
    const first = (family: Family, fixedBase: number, window: number) => {
      const cal = newCalibration(family, 0);
      const fixed = estimate(cal, base(fixedBase)).bound;
      const history = [base(40), base(40)].map((b) => estimate(cal, b).bound);
      return trimHistory({ fixed, history, window, reserve: 1000, chunk: 4 });
    };
    expect(first("unknown", 6000, 128_000).overflow).toBe(false);
    expect(first("unknown", 3000, 32_000).overflow).toBe(false);
    expect(first("claude", 25_000, 200_000).overflow).toBe(false);
    expect(first("gemini", 30_000, 128_000).overflow).toBe(false);
  });

  test("a stored overhead below the floor is refused", () => {
    const meter = emptyMeter();
    teach(meter, "openai|gpt-4o|", 1.0, 20, 3);
    const doc = JSON.parse(serializeMeter(meter)) as { models: Record<string, { whole: { w: number[] } }> };
    doc.models["openai|gpt-4o|"]!.whole.w[1] = -6000;
    expect(parseMeter(JSON.stringify(doc)).discarded).toEqual(["openai|gpt-4o|"]);
  });
});
