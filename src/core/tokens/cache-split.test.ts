/**
 * Learning from the cached part of a reply. The provider's cached count measures an earlier, smaller slice of the same prompt, a
 * second point that can separate the fit's slope from its overhead. It is only as good as the match
 * of that count to a slice, so the scenario here is the independent review's (round 5): each turn the
 * provider hits a varying older entry, and the meter matches it using its own, possibly biased,
 * estimates. A breakpoint cache is matched to its marks; an automatic cache only to where the prompt
 * stops matching the previous request, and only by a confident meter. Nothing may push a bound under
 * the truth.
 */
import { describe, expect, test } from "bun:test";
import { mulberry32 } from "../lore/rng";
import type { BaseCount } from "./base";
import { cachedPart, cacheRulesFor, type CacheRules } from "./cache";
import { estimate, newCalibration, observe, type CachedPart } from "./calibrate";
import type { Family } from "./priors";

const prose = (total: number): BaseCount => ({ total, prose: total, code: 0, json: 0, cjk: 0 });
const breakpoint = cacheRulesFor("anthropic", "claude-sonnet-5");
const automatic = cacheRulesFor("openai", "gpt-5");

/** One simulated chat of 60 same-size prompts; returns the bound's margins and how parts were matched. */
function chat(opts: {
  family: Family;
  slope: number;
  overhead: number;
  rules: CacheRules;
  spacing: number;
  withParts: boolean;
  seed: number;
  /** The provider's hit ends between marks, which a breakpoint cache should never do: a robustness check. */
  offBoundary?: boolean;
  /** Overhead that sits after the cached part. */
  endOverhead?: number;
}) {
  const rand = mulberry32(opts.seed);
  const cal = newCalibration(opts.family, 0);
  let accepted = 0;
  let wrong = 0;
  for (let i = 0; i < 60; i++) {
    const b = 20_000 + Math.floor((rand() * 2 - 1) * 300);
    const real = Math.round(opts.slope * b + opts.overhead);
    let cached: CachedPart | undefined;
    if (opts.withParts) {
      const marks = Array.from({ length: Math.floor(18_000 / opts.spacing) }, (_, k) => (k + 1) * opts.spacing);
      const hit = marks[Math.floor(marks.length * (0.5 + 0.5 * rand())) - 1]! + (opts.offBoundary ? Math.floor(rand() * opts.spacing * 0.8) : 0);
      const trueCount = opts.slope * hit + opts.overhead - (opts.endOverhead ?? 0);
      const cacheRead = opts.rules.mode === "breakpoint" ? Math.round(trueCount) : Math.floor(trueCount / 128) * 128;
      cached = cachedPart(
        opts.rules,
        marks.map((m) => {
          const e = estimate(cal, prose(m));
          return { base: prose(m), estimate: e.mid, uncertainty: e.bound - e.mid };
        }),
        cacheRead,
      );
      if (cached) {
        accepted++;
        if (cached.base.total !== hit) wrong++;
      }
    }
    observe(cal, { base: prose(b), real, ...(cached ? { cached } : {}) }, i);
  }
  const margin = (x: number) => (estimate(cal, prose(x)).bound - (opts.slope * x + opts.overhead)) / (opts.slope * x + opts.overhead);
  const miss = (x: number) => Math.abs(estimate(cal, prose(x)).mid - (opts.slope * x + opts.overhead)) / (opts.slope * x + opts.overhead);
  return { accepted, wrong, m3: margin(3000), m20: margin(20_000), m60: margin(60_000), miss3: miss(3000) };
}

const models: [Family, number, number][] = [
  ["claude", 1.3, 900],
  ["unknown", 1.8, 900],
  ["openai", 1.0, 3000],
];

describe("learning from the cached part", () => {
  test("an automatic cache's count offered at many marks is never used: it takes the one place the prompt stopped matching", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(chat({ family: "claude", slope: 1.3, overhead: 900, rules: automatic, spacing: 400, withParts: true, seed }).accepted).toBe(0);
    }
  });

  test("with hits on varying older marks, matched by the meter's own estimates, no bound goes under the truth", () => {
    for (const [family, slope, overhead] of models) {
      for (const spacing of [100, 400, 2000]) {
        for (const offBoundary of [false, true]) {
          for (let seed = 1; seed <= 20; seed++) {
            const r = chat({ family, slope, overhead, rules: breakpoint, spacing, withParts: true, seed, offBoundary });
            expect({ family, spacing, offBoundary, seed, ok: r.m3 >= 0 && r.m20 >= 0 && r.m60 >= 0 }).toEqual({ family, spacing, offBoundary, seed, ok: true });
          }
        }
      }
    }
  });

  test("overhead after the cached part does not push a bound under the truth", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = chat({ family: "openai", slope: 1.0, overhead: 3000, rules: breakpoint, spacing: 2000, withParts: true, seed, endOverhead: 1500 });
      expect(r.m3 >= 0 && r.m20 >= 0 && r.m60 >= 0).toBe(true);
    }
  });

  test("well-separated marks, matched cleanly, make a small prompt's estimate better, never worse", () => {
    let accepted = 0;
    let wrong = 0;
    let withMiss = 0;
    let withoutMiss = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const on = chat({ family: "openai", slope: 1.0, overhead: 3000, rules: breakpoint, spacing: 2000, withParts: true, seed });
      const off = chat({ family: "openai", slope: 1.0, overhead: 3000, rules: breakpoint, spacing: 2000, withParts: false, seed });
      accepted += on.accepted;
      wrong += on.wrong;
      withMiss += on.miss3;
      withoutMiss += off.miss3;
    }
    expect(accepted).toBeGreaterThan(0);
    expect(wrong).toBe(0);
    expect(withMiss).toBeLessThan(withoutMiss);
  });

  test("a part is evidence, not a reply, and one that cannot be a part of this prompt is ignored", () => {
    const weights = (cached?: CachedPart) => {
      const cal = newCalibration("openai", 0);
      observe(cal, { base: prose(10_000), real: 10_050, ...(cached ? { cached } : {}) }, 1);
      return { w: cal.whole.w.join(","), n: cal.whole.n };
    };
    const plain = weights();
    expect(weights({ base: prose(12_000), real: 12_000, sd: 0 })).toEqual(plain);
    expect(weights({ base: prose(5000), real: 11_000, sd: 0 })).toEqual(plain);
    expect(weights({ base: prose(5000), real: 100, sd: 0 })).toEqual(plain);
    const used = weights({ base: prose(5000), real: 5050, sd: 0 });
    expect(used.w).not.toBe(plain.w);
    expect(used.n).toBe(1);
  });
});

describe("cachedPart", () => {
  const at = (total: number, estimate: number, uncertainty: number) => ({ base: prose(total), estimate, uncertainty });

  test("a count within a mark's uncertainty, clearly apart from the others, is that mark's exact measurement", () => {
    expect(cachedPart(breakpoint, [at(1000, 1300, 50), at(4000, 5200, 100)], 5250)).toEqual({ base: prose(4000), real: 5250, sd: 0 });
  });

  test("a breakpoint count is refused off every mark, between two marks the uncertainty cannot tell apart, or when nothing was cached", () => {
    expect(cachedPart(breakpoint, [at(4000, 5200, 100)], 5500)).toBeUndefined();
    expect(cachedPart(breakpoint, [at(4000, 5200, 400), at(4400, 5720, 400)], 5300)).toBeUndefined();
    expect(cachedPart(breakpoint, [at(4000, 5200, 100)], 0)).toBeUndefined();
    expect(cachedPart(breakpoint, [at(4000, 5200, 100)], undefined)).toBeUndefined();
    expect(cachedPart(breakpoint, [], 5200)).toBeUndefined();
  });
});

/**
 * An automatic cache (OpenAI, DeepSeek, a local server), in the review's harsher setting: chats that
 * grow or stay one size, the usual hit on the previous request, and a share of hits on older, shorter
 * entries that the meter cannot tell apart.
 */
function autoChat(opts: { family: Family; slope: number; overhead: number; rules: CacheRules; growing: boolean; withParts: boolean; seed: number; olderShare: number; local?: boolean }) {
  const rand = mulberry32(opts.seed);
  const cal = newCalibration(opts.family, 0);
  const block = Math.max(1, opts.rules.block ?? 128);
  const sizes: number[] = [];
  let accepted = 0;
  let size = opts.growing ? 4000 : 20_000;
  for (let i = 0; i < 80; i++) {
    const prev = sizes[sizes.length - 1];
    size = opts.growing ? size + 150 + Math.floor(rand() * 250) : 20_000 + Math.floor((rand() * 2 - 1) * 300);
    let cached: CachedPart | undefined;
    if (opts.withParts && prev !== undefined && prev < size) {
      const hitBase = rand() < opts.olderShare && sizes.length > 3 ? sizes[Math.floor(rand() * (sizes.length - 1))]! : prev;
      // A local server's reuse can run a little way into the next message.
      const trueCount = opts.slope * hitBase + opts.overhead + (opts.local ? Math.floor(rand() * 30) : 0);
      const cacheRead = opts.local ? Math.round(trueCount) : Math.floor(trueCount / block) * block;
      const e = estimate(cal, prose(prev));
      cached = cachedPart(opts.rules, [{ base: prose(prev), estimate: e.mid, uncertainty: e.bound - e.mid }], cacheRead);
      if (cached) accepted++;
    }
    observe(cal, { base: prose(size), real: Math.round(opts.slope * size + opts.overhead), ...(cached ? { cached } : {}) }, i);
    sizes.push(size);
  }
  const truth = (x: number) => opts.slope * x + opts.overhead;
  const margin = (x: number) => (estimate(cal, prose(x)).bound - truth(x)) / truth(x);
  return { accepted, m3: margin(3000), mNow: margin(size), m3x: margin(size * 3), miss3: Math.abs(estimate(cal, prose(3000)).mid - truth(3000)) / truth(3000) };
}

describe("learning from an automatic cache", () => {
  const local = cacheRulesFor("ollama", "llama3");
  const deepseek = cacheRulesFor("deepseek", "deepseek-chat");

  test("with hits on older entries mixed in, no bound goes under the truth, growing or same-size, cloud or local", () => {
    for (const [family, slope, overhead] of models) {
      for (const [rules, isLocal] of [[automatic, false], [deepseek, false], [local, true]] as const) {
        for (const growing of [true, false]) {
          for (let seed = 1; seed <= 8; seed++) {
            const r = autoChat({ family, slope, overhead, rules, growing, withParts: true, seed, olderShare: 0.5, local: isLocal });
            expect({ family, growing, seed, ok: r.m3 >= 0 && r.mNow >= 0 && r.m3x >= 0 }).toEqual({ family, growing, seed, ok: true });
          }
        }
      }
    }
  });

  test("once confident, a same-size chat's small-prompt estimate improves, and never gets worse", () => {
    let accepted = 0;
    let withMiss = 0;
    let withoutMiss = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const on = autoChat({ family: "claude", slope: 1.3, overhead: 900, rules: automatic, growing: false, withParts: true, seed, olderShare: 0.2 });
      const off = autoChat({ family: "claude", slope: 1.3, overhead: 900, rules: automatic, growing: false, withParts: false, seed, olderShare: 0.2 });
      accepted += on.accepted;
      withMiss += on.miss3;
      withoutMiss += off.miss3;
    }
    expect(accepted).toBeGreaterThan(0);
    expect(withMiss).toBeLessThan(withoutMiss);
  });
});

describe("cachedPart on an automatic cache", () => {
  const at = (total: number, estimate: number, uncertainty: number) => ({ base: prose(total), estimate, uncertainty });

  test("a confident meter's count near the one offered place is used, rounded back up by half a block", () => {
    const part = cachedPart(automatic, [at(10_000, 13_000, 300)], 12_928);
    expect(part).toMatchObject({ base: prose(10_000), real: 12_928 + 63.5 });
    expect(part!.sd).toBeCloseTo((64 + Math.abs(13_000 - 12_991.5)) / 12_991.5, 6);
    expect(cachedPart(cacheRulesFor("ollama", "llama3"), [at(10_000, 13_000, 300)], 13_010)).toMatchObject({ real: 13_010 });
  });

  test("it is refused while the meter is unsure, far from the offered place, or offered more than one place", () => {
    expect(cachedPart(automatic, [at(10_000, 13_000, 900)], 12_928)).toBeUndefined();
    expect(cachedPart(automatic, [at(10_000, 13_000, 300)], 12_000)).toBeUndefined();
    expect(cachedPart(automatic, [at(10_000, 13_000, 300), at(12_000, 15_600, 300)], 12_928)).toBeUndefined();
  });
});
