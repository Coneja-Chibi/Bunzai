/**
 * The bound never undercounting, under the conditions an
 * independent review (2026-09-27) found it failing. Each is run across many seeds, not one:
 * - a model with only a few replies;
 * - a prompt far smaller than any the model has seen;
 * - a model whose true ratio is well above its family's prior;
 * - normal (not uniform) noise;
 * - a chat of many short messages, whose template cost is per message.
 */
import { describe, expect, test } from "bun:test";
import { mulberry32 } from "../lore/rng";
import { countPrompt, type BaseCount } from "./base";
import { estimate, estimatePart, newCalibration, observe, type ModelCalibration } from "./calibrate";
import type { Family } from "./priors";

const prose = (total: number): BaseCount => ({ total, prose: total, code: 0, json: 0, cjk: 0 });
/** A normal draw from a seeded uniform stream (Box-Muller). */
const normal = (rand: () => number) => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());

/** Coverage of the bound over fresh prompts for many independently seeded models. */
function coverage(opts: {
  family: Family;
  slope: number;
  overhead: number;
  noise: number;
  train: number;
  trainSize: [number, number];
  testSize: [number, number];
  seeds?: number;
  /** Fresh prompts tested per seed. */
  probes?: number;
  /** Test against a fresh noisy report, as a provider would send, instead of the noise-free count. */
  againstReports?: boolean;
}): number {
  return coverageBySeed(opts).overall;
}

/**
 * Coverage overall and seed by seed. Pooling can hide a minority of badly fitted models, so the
 * per-seed count is what catches a fit that is overconfident only sometimes.
 */
function coverageBySeed(opts: Parameters<typeof coverage>[0]): { overall: number; badSeeds: number } {
  let covered = 0;
  let total = 0;
  let badSeeds = 0;
  for (let seed = 1; seed <= (opts.seeds ?? 200); seed++) {
    const rand = mulberry32(seed * 7919);
    const truth = (b: number) => Math.max(1, Math.round((opts.slope * b + opts.overhead) * (1 + opts.noise * normal(rand))));
    const size = ([lo, hi]: [number, number]) => lo + Math.floor(rand() * (hi - lo));
    const cal: ModelCalibration = newCalibration(opts.family, 0);
    for (let i = 0; i < opts.train; i++) {
      const b = size(opts.trainSize);
      observe(cal, { base: prose(b), real: truth(b) }, i);
    }
    let mine = 0;
    const probes = opts.probes ?? 10;
    for (let i = 0; i < probes; i++) {
      const b = size(opts.testSize);
      const target = opts.againstReports ? truth(b) : opts.slope * b + opts.overhead;
      if (estimate(cal, prose(b)).bound >= target) mine++;
    }
    covered += mine;
    total += probes;
    if (mine / probes < 0.97) badSeeds++;
  }
  return { overall: covered / total, badSeeds };
}

describe("the bound holds where it used to undercount", () => {
  test("an unknown model at 1.8x, after only two or three replies, is not trusted too far", () => {
    for (const train of [0, 1, 2, 3]) {
      expect(coverage({ family: "unknown", slope: 1.8, overhead: 300, noise: 0.02, train, trainSize: [20_000, 60_000], testSize: [1000, 61_000] })).toBeGreaterThanOrEqual(0.97);
    }
  });

  test("Claude-like at 1.3x plus overhead, from its prior on", () => {
    for (const train of [0, 2, 5, 20]) {
      expect(coverage({ family: "claude", slope: 1.3, overhead: 300, noise: 0.02, train, trainSize: [2000, 60_000], testSize: [1000, 61_000] })).toBeGreaterThanOrEqual(0.97);
    }
  });

  test("a prompt far smaller than anything the model learned on keeps a margin", () => {
    expect(coverage({ family: "deepseek", slope: 1.12, overhead: 250, noise: 0.01, train: 20, trainSize: [20_000, 30_000], testSize: [300, 2000] })).toBeGreaterThanOrEqual(0.97);
  });

  test("a model noisier than the fit assumes still covers each real report on small prompts, seed by seed", () => {
    // The fit learns assuming 2 percent noise; these models wander 5 and 10 percent, and the bound must
    // cover the noisy report the provider actually sends, not only the average.
    for (const noise of [0.05, 0.1]) {
      const r = coverageBySeed({ family: "claude", slope: 1.3, overhead: 300, noise, train: 40, trainSize: [20_000, 30_000], testSize: [300, 2000], probes: 100, againstReports: true });
      expect(r.overall).toBeGreaterThanOrEqual(0.97);
      expect(r.badSeeds).toBeLessThanOrEqual(5);
    }
  });

  test("normal noise of 5 percent, after warm-up", () => {
    expect(coverage({ family: "gemini", slope: 1.05, overhead: 100, noise: 0.05, train: 40, trainSize: [2000, 40_000], testSize: [2000, 40_000] })).toBeGreaterThanOrEqual(0.97);
  });

  test("an unknown model at 2.2x, before any reply", () => {
    expect(coverage({ family: "unknown", slope: 2.2, overhead: 0, noise: 0, train: 0, trainSize: [1000, 2000], testSize: [1000, 60_000], seeds: 20 })).toBe(1);
  });

  test("many short messages: the per-message template cost is counted before anything is learned", () => {
    const texts = Array.from({ length: 200 }, (_, i) => `ok ${i}`);
    const base = countPrompt(texts);
    const textOnly = base.total - 4 * texts.length;
    const truth = textOnly + 4 * texts.length;
    expect(estimate(newCalibration("openai", 0), base).bound).toBeGreaterThanOrEqual(truth);
  });

  test("a message's part estimate carries no fixed overhead, so summing messages counts it once", () => {
    const cal = newCalibration("openai", 0);
    for (let i = 0; i < 30; i++) {
      const b = 4000 + i * 300;
      observe(cal, { base: prose(b), real: b + 900 }, i);
    }
    expect(cal.whole.w[1]!).toBeGreaterThan(600);
    const part = estimatePart(cal, prose(100));
    expect(part.mid).toBeLessThan(200);
    expect(part.bound).toBeGreaterThanOrEqual(100);
    expect(estimate(cal, prose(100)).mid - part.mid).toBeGreaterThan(500);
  });
});
