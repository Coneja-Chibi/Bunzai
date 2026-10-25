/**
 * The calibrator against synthetic models with a known tokenizer (test
 * plan). A model's "true" count is a known function of the base count plus seeded noise, so every
 * claim is measurable: the bound covers the truth, a tokenizer change is re-learned, an outlier does
 * not move the fit, and a long chat of near-identical prompts still separates slope from overhead.
 */
import { describe, expect, test } from "bun:test";
import { mulberry32 } from "../lore/rng";
import type { BaseCount } from "./base";
import { estimate, newCalibration, observe } from "./calibrate";

const prose = (total: number): BaseCount => ({ total, prose: total, code: 0, json: 0, cjk: 0 });
/** A true model: real = slope · base + overhead, with relative noise of ±jitter. */
const truth = (rand: () => number, slope: number, overhead: number, jitter: number) => (base: number) =>
  Math.round((slope * base + overhead) * (1 + (rand() * 2 - 1) * jitter));

describe("calibration", () => {
  test("a new model's bound, from its family prior alone, does not undercount a prompt within the prior", () => {
    const cal = newCalibration("claude", 0);
    const e = estimate(cal, prose(10_000));
    expect(e.source).toBe("prior");
    expect(e.bound).toBeGreaterThan(Math.round(1.45 * 10_000));
  });

  test("the learned bound covers the true count on at least 97 percent of fresh prompts", () => {
    const rand = mulberry32(7);
    const real = truth(rand, 1.32, 180, 0.02);
    const cal = newCalibration("claude", 0);
    for (let i = 0; i < 40; i++) observe(cal, { base: prose(2000 + Math.floor(rand() * 30_000)), real: 0 }, i); // refused: a zero report teaches nothing
    for (let i = 0; i < 40; i++) {
      const b = 2000 + Math.floor(rand() * 30_000);
      observe(cal, { base: prose(b), real: real(b) }, i);
    }
    let covered = 0;
    let worstMid = 0;
    for (let i = 0; i < 400; i++) {
      const b = 2000 + Math.floor(rand() * 30_000);
      const t = real(b);
      const e = estimate(cal, prose(b));
      if (e.bound >= t) covered++;
      worstMid = Math.max(worstMid, Math.abs(e.mid - t) / t);
    }
    expect(covered / 400).toBeGreaterThanOrEqual(0.97);
    expect(worstMid).toBeLessThan(0.06);
  });

  test("a tokenizer change is re-learned within a bounded number of replies", () => {
    const rand = mulberry32(11);
    const cal = newCalibration("openai", 0);
    const before = truth(rand, 1.0, 50, 0.01);
    const after = truth(rand, 1.3, 50, 0.01);
    for (let i = 0; i < 60; i++) {
      const b = 3000 + Math.floor(rand() * 20_000);
      observe(cal, { base: prose(b), real: before(b) }, i);
    }
    let turnsToRelearn = -1;
    for (let i = 0; i < 40; i++) {
      const b = 3000 + Math.floor(rand() * 20_000);
      observe(cal, { base: prose(b), real: after(b) }, 100 + i);
      const probe = 10_000;
      const miss = Math.abs(estimate(cal, prose(probe)).mid - (1.3 * probe + 50)) / (1.3 * probe + 50);
      if (miss < 0.05 && turnsToRelearn < 0) turnsToRelearn = i + 1;
    }
    expect(turnsToRelearn).toBeGreaterThan(0);
    expect(turnsToRelearn).toBeLessThanOrEqual(15);
  });

  test("a wild report is set aside and does not move the fit", () => {
    const rand = mulberry32(3);
    const real = truth(rand, 1.1, 100, 0.01);
    const cal = newCalibration("deepseek", 0);
    for (let i = 0; i < 30; i++) {
      const b = 5000 + Math.floor(rand() * 10_000);
      observe(cal, { base: prose(b), real: real(b) }, i);
    }
    const before = estimate(cal, prose(8000)).mid;
    expect(observe(cal, { base: prose(8000), real: 90_000 }, 99)).toBe("rejected");
    expect(Math.abs(estimate(cal, prose(8000)).mid - before)).toBeLessThanOrEqual(1);
    expect(observe(cal, { base: prose(8000), real: 0 }, 100)).toBe("rejected");
  });

  test("a long chat, each prompt mostly the one before, still finds the slope and the overhead", () => {
    // Whole prompts this alike are nearly collinear; the fit still separates slope from overhead
    // because it carries its own uncertainty instead of trusting any one reply.
    const rand = mulberry32(21);
    const cal = newCalibration("unknown", 0);
    let base = 3000;
    for (let i = 0; i < 60; i++) {
      base += 150 + Math.floor(rand() * 250);
      observe(cal, { base: prose(base), real: Math.round(1.25 * base + 900 + (rand() * 2 - 1) * 40) }, i);
    }
    expect(Math.abs((cal.whole.w[0] ?? 0) - 1.25)).toBeLessThan(0.02);
    expect(cal.whole.n).toBe(60);
  });

  test("with enough mixed prompts the per-class fit takes over and misses less than one ratio", () => {
    const rand = mulberry32(5);
    const cal = newCalibration("qwen", 0);
    const mixed = (): BaseCount => {
      const p = 2000 + Math.floor(rand() * 8000);
      const c = Math.floor(rand() * 4000);
      return { total: p + c, prose: p, code: 0, json: 0, cjk: c };
    };
    const real = (b: BaseCount) => Math.round(1.0 * b.prose + 2.1 * b.cjk + 300);
    for (let i = 0; i < 120; i++) {
      const b = mixed();
      observe(cal, { base: b, real: real(b) }, i);
    }
    const b = { total: 9000, prose: 5000, code: 0, json: 0, cjk: 4000 };
    const e = estimate(cal, b);
    expect(e.source).toBe("by-class");
    expect(Math.abs(e.mid - real(b)) / real(b)).toBeLessThan(0.03);
  });
});
