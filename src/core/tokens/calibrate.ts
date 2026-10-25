/**
 * One model's calibration: what the meter knows about how
 * the base count maps onto this model's real count, how it estimates, and how it learns from a reply.
 *
 * Two fits run side by side:
 * - `whole`: real ≈ a · base + b. This is the one to trust early.
 * - `byClass`: real ≈ prose·p + code·c + json·j + cjk·k + b. It takes over once it has enough evidence
 *   and misses less, since tokenizers disagree most on exactly those classes.
 *
 * Each also carries a correction, `d`, for the cached part of a prompt (rule 4): a cached slice shares
 * the per-token weights and the overhead with the whole prompt, less any overhead that sits after the
 * cached part, which `d` absorbs (a slice is fitted with overhead b + d). `d` starts at zero with a
 * narrow prior, since most overhead sits at the start, so a slice informs the shared weights at once,
 * while a consistent end overhead is learned into `d` rather than pulling `b` the wrong way.
 *
 * Estimates carry a midpoint for display and an upper bound for budgeting (rule 2: never undercount
 * on purpose). The bound adds two uncertainties: how far this model's reports wander around its fit,
 * and how unsure the fit itself still is at this prompt's size. The second is what keeps a model with
 * three replies, or a prompt much smaller than any it has seen, from being trusted too far. Pure; the
 * caller supplies the clock.
 */
import type { BaseCount } from "./base";
import { isFiniteFit, loosen, predict, predictionVariance, priorFit, update, type Fit } from "./fit";
import { PRIORS, type Family } from "./priors";

export interface ModelCalibration {
  family: Family;
  whole: Fit;
  byClass: Fit;
  /** Running typical relative miss of the whole fit (0.05 = 5 percent), before each update. */
  spread: number;
  /** Running typical relative miss of the class fit. */
  classSpread: number;
  /** Fast signed average of recent relative misses, for the drift check. */
  fast: number;
  /** Consecutive turns the drift check has fired. */
  drifting: number;
  /** Consecutive samples rejected as outliers. */
  rejected: number;
  /** Running share of the prompt the provider served from cache, and how many replies it rests on. */
  cacheHitRate: number;
  cacheSamples: number;
  /** Epoch ms of the last sample. */
  updatedAt: number;
}

export interface Estimate {
  /** The likeliest real count, for display. */
  mid: number;
  /** The count to budget with: the midpoint plus a margin from how far this model has missed. */
  bound: number;
  /** Replies the estimate rests on; 0 means the family prior alone. */
  samples: number;
  /** The relative spread the margin used. */
  spread: number;
  source: "prior" | "learned" | "by-class";
}

/**
 * One reply's evidence: the prompt's base count and the total the provider reported for it, and,
 * when the provider served part of the prompt from its cache and it is known which messages that
 * part covered, the base count of those messages and the cached count reported for them (rule 4).
 */
export interface Sample {
  base: BaseCount;
  real: number;
  cached?: CachedPart;
}

/**
 * The cached part of a prompt as a second measurement: an earlier, shorter slice of the same prompt,
 * counted by the provider. `sd` is how unsure it is which slice the count covers, as a share of it:
 * small when the count lands squarely on the one boundary it could be, larger when it lands off it
 * or the cache rounds (cache.ts cachedPart).
 */
export interface CachedPart {
  base: BaseCount;
  real: number;
  sd: number;
}

const LAMBDA = 0.985;
/** Standard deviations of margin in the bound: about 98.6 percent one-sided under normal noise. */
const Z = 2.2;
/** A spread is a mean absolute miss; a normal miss's standard deviation is about 1.25 times that. */
const SD_PER_SPREAD = 1.25;
/** No estimate goes below this share of the base count: the one place the meter errs high by rule. */
export const FLOOR_RATIO = 0.8;
/**
 * No report below this share of the base count is believed. It sits under FLOOR_RATIO so a tokenizer
 * that genuinely counts a little under o200k (CJK-tuned vocabularies on CJK text) still learns, while a
 * provider reporting only part of a prompt (new work, not the cached prefix) is refused.
 */
export const REPORT_FLOOR = 0.5;
/** While a model has fewer than this many replies, a report this many times above the bound is set aside. */
const EARLY_SAMPLES = 5;
const EARLY_CEILING = 2;
/** The relative noise a reply is learned with: how far a count can differ from a clean fit for reasons no fit captures. */
const UPDATE_NOISE = 0.02;
/** The widest the fit's own uncertainty may grow, as a multiple of the prior's. */
const PRIOR_CAP = 2;
/** The range a learned weight is held to, and the stored meter's reader checks (meter.ts). */
export const MIN_WEIGHT = 0.3;
export const MAX_WEIGHT = 20;
export const MAX_INTERCEPT = 100_000;
/** The most negative fixed overhead a fit may hold: a template never takes tokens away. */
export const MIN_INTERCEPT = -5_000;
const CLASS_MIN_SAMPLES = 40;
/** Evidence weight of the prior spread, in replies. */
const PRIOR_WEIGHT = 5;
/**
 * The prior on a fixed overhead, in tokens squared. Hidden costs such as tool schemas a caller does not
 * count can run to thousands of tokens, so the prior allows that (independent review, round 5).
 */
const INTERCEPT_VAR = 1500 ** 2;
/** The prior on the cached slice's correction: overhead after the cached part, usually small. */
const END_VAR = 500 ** 2;

const variances = (family: Family) => {
  const { ratio, spread } = PRIORS[family];
  const slope = (ratio * spread) ** 2;
  return { slope, cap: [slope * 4, INTERCEPT_VAR * 4, END_VAR * 4] };
};
const classCap = (family: Family) => {
  const v = variances(family);
  return [v.cap[0]!, v.cap[0]! * 2, v.cap[0]! * 2, v.cap[0]! * 4, INTERCEPT_VAR * 4, END_VAR * 4];
};

/** A model the meter has never seen: its family's prior, no evidence. */
export function newCalibration(family: Family, now: number): ModelCalibration {
  const { ratio, spread } = PRIORS[family];
  const { slope } = variances(family);
  return {
    family,
    whole: priorFit([ratio, 0, 0], [slope, INTERCEPT_VAR, END_VAR]),
    // Seeds per class: code and JSON cost a little more than prose, CJK noticeably more.
    byClass: priorFit([ratio, ratio * 1.1, ratio * 1.1, ratio * 1.3, 0, 0], [slope, slope * 2, slope * 2, slope * 4, INTERCEPT_VAR, END_VAR]),
    spread,
    classSpread: spread,
    fast: 0,
    drifting: 0,
    rejected: 0,
    cacheHitRate: 0,
    cacheSamples: 0,
    updatedAt: now,
  };
}

/** A whole prompt: its base count and its overhead. */
const wholeX = (b: BaseCount) => [b.total, 1, 0];
const classX = (b: BaseCount) => [b.prose, b.code, b.json, b.cjk, 1, 0];
/** A cached slice: its base count, the shared overhead, and the slice's correction. */
const partWholeX = (b: BaseCount) => [b.total, 1, 1];
const partClassX = (b: BaseCount) => [b.prose, b.code, b.json, b.cjk, 1, 1];

/** The spread to trust: the learned one, leaning on the prior's while evidence is thin. */
const effectiveSpread = (learned: number, n: number, prior: number) => (n * learned + PRIOR_WEIGHT * prior) / (n + PRIOR_WEIGHT);

/** The relative standard deviation of this model's reports around its fit. */
const sigma = (cal: ModelCalibration, useClass: boolean): number => {
  const n = useClass ? cal.byClass.n : cal.whole.n;
  const learned = useClass ? cal.classSpread : cal.spread;
  return Math.max(0.01, SD_PER_SPREAD * effectiveSpread(learned, n, PRIORS[cal.family].spread));
};
const useClassFit = (cal: ModelCalibration) => cal.byClass.n >= CLASS_MIN_SAMPLES && cal.classSpread < cal.spread;

function shape(cal: ModelCalibration, base: BaseCount, raw: number, paramVar: number, priorVar: number, useClass: boolean): Estimate {
  // Never below the base count scaled by the smallest plausible ratio, and never negative.
  const mid = Math.max(0, Math.round(Math.max(raw, base.total * FLOOR_RATIO)));
  const sd = sigma(cal, useClass);
  // The fit's own uncertainty was learned assuming UPDATE_NOISE; a model that wanders more makes the
  // fit less sure than it believes, so that term widens by the ratio. Before any reply the prior is the
  // whole story and is not widened: widening it made a new model's bound several times its midpoint,
  // too large to send a first message at all. After, it never widens past PRIOR_CAP times the prior's.
  const widen = Math.max(1, (sd / UPDATE_NOISE) ** 2);
  const n = useClass ? cal.byClass.n : cal.whole.n;
  const fitVar = n === 0 ? paramVar : Math.min(paramVar * widen, Math.max(paramVar, PRIOR_CAP * priorVar));
  const bound = base.total === 0 ? 0 : Math.ceil(mid + Z * Math.sqrt(fitVar + (sd * mid) ** 2));
  return { mid, bound, samples: n, spread: sd / SD_PER_SPREAD, source: n === 0 ? "prior" : useClass ? "by-class" : "learned" };
}

/** The meter's estimate for a whole prompt of this base count: the fixed overhead counted once. */
export function estimate(cal: ModelCalibration, base: BaseCount): Estimate {
  const useClass = useClassFit(cal);
  const fit = useClass ? cal.byClass : cal.whole;
  const x = useClass ? classX(base) : wholeX(base);
  return shape(cal, base, predict(fit, x), predictionVariance(fit, x), priorVariance(cal, x, useClass), useClass);
}

/** How uncertain the family prior alone is about a prediction for `x`. */
function priorVariance(cal: ModelCalibration, x: readonly number[], useClass: boolean): number {
  const prior = newCalibration(cal.family, 0);
  return predictionVariance(useClass ? prior.byClass : prior.whole, x);
}

/**
 * The estimate for one message inside a prompt: its tokens only, no fixed overhead, so a budget that
 * sums messages counts the overhead once (in the part that is not history), not once per message.
 */
export function estimatePart(cal: ModelCalibration, base: BaseCount): Estimate {
  const useClass = useClassFit(cal);
  const fit = useClass ? cal.byClass : cal.whole;
  const x = useClass ? [base.prose, base.code, base.json, base.cjk, 0, 0] : [base.total, 0, 0];
  return shape(cal, base, predict(fit, x), predictionVariance(fit, x), priorVariance(cal, x, useClass), useClass);
}

/**
 * Learns from one reply. Returns what happened, for the trace: learned, or rejected as an outlier.
 * A zero or impossible report is refused before it can move anything.
 */
export function observe(cal: ModelCalibration, sample: Sample, now: number): "learned" | "rejected" | "drift" {
  const { base, real } = sample;
  if (!(real > 0) || !Number.isFinite(real) || base.total <= 0) return "rejected";
  // No tokenizer counts this far under o200k, so such a report is a provider counting only part of
  // the prompt (new work, not the cached prefix). Refused at any sample count: one of these used to
  // teach the spread a miss of many times the prompt.
  if (real < base.total * REPORT_FLOOR) return "rejected";
  // A new model has no history to call a report wild against, so a report far above even the prior's
  // bound (usage summed across a tool loop, say) waits for a second opinion. If it keeps coming, it
  // is the truth, and the third one is learned.
  if (cal.whole.n < EARLY_SAMPLES && real > EARLY_CEILING * estimate(cal, base).bound) {
    cal.rejected += 1;
    if (cal.rejected < 3) return "rejected";
  }
  const prior = PRIORS[cal.family];
  const predicted = predict(cal.whole, wholeX(base));
  const error = real - predicted;
  // Measured against the larger of the two, so one report can never make the miss exceed 1.
  const rel = error / Math.max(real, predicted, 1);
  const spread = effectiveSpread(cal.spread, cal.whole.n, prior.spread);

  // Rule 6: a report far outside what this model has shown is set aside, unless it keeps happening,
  // which means the model changed rather than one report being wrong.
  let outcome: "learned" | "drift" = "learned";
  if (cal.whole.n >= 5 && Math.abs(rel) > Math.max(0.5, 6 * spread)) {
    cal.rejected += 1;
    if (cal.rejected < 3) return "rejected";
    relearn(cal);
    outcome = "drift";
  }
  cal.rejected = 0;

  // Rule 5: a drift check on recent misses, independent of outliers.
  cal.fast = 0.7 * cal.fast + 0.3 * rel;
  if (cal.whole.n >= 5 && Math.abs(cal.fast) > Math.max(2 * spread, 0.05)) {
    cal.drifting += 1;
    if (cal.drifting >= 3) {
      relearn(cal);
      outcome = "drift";
    }
  } else cal.drifting = 0;

  const classErr = real - predict(cal.byClass, classX(base));
  cal.spread = cal.whole.n === 0 ? Math.abs(rel) : 0.9 * cal.spread + 0.1 * Math.abs(rel);
  const classRel = Math.abs(classErr) / Math.max(real, real - classErr, 1);
  cal.classSpread = cal.byClass.n === 0 ? classRel : 0.9 * cal.classSpread + 0.1 * classRel;

  const { cap } = variances(cal.family);
  const cCap = classCap(cal.family);
  // Each sample's noise, in tokens squared. A provider's count is exact, so this is not the model's
  // learned spread: feeding that back in made a lagging fit look noisy, which slowed it further. It is
  // a small fixed share of the size, which still stops one reply from pinning a model (fit.ts).
  const noiseAt = (size: number) => (UPDATE_NOISE * Math.max(size, 1)) ** 2;
  update(cal.whole, wholeX(base), real, noiseAt(Math.max(predicted, real)), LAMBDA, cap);
  update(cal.byClass, classX(base), real, noiseAt(Math.max(predicted, real)), LAMBDA, cCap);
  // Rule 4: the cached part is a second, smaller slice of the prompt measured in the same reply, fitted
  // with the shared overhead plus its correction. Its noise is how unsure the match is. It adds
  // evidence, not a reply, and it never forgets on its own.
  const part = sample.cached;
  if (part && part.base.total > 0 && part.base.total < base.total && part.real >= part.base.total * REPORT_FLOOR && part.real < real && part.sd >= 0) {
    const partNoise = (Math.max(part.sd, UPDATE_NOISE) * part.real) ** 2;
    update(cal.whole, partWholeX(part.base), part.real, partNoise, 1, cap);
    update(cal.byClass, partClassX(part.base), part.real, partNoise, 1, cCap);
    cal.whole.n -= 1;
    cal.byClass.n -= 1;
  }
  keepPlausible(cal.whole);
  keepPlausible(cal.byClass);
  if (!isFiniteFit(cal.whole) || !isFiniteFit(cal.byClass)) {
    const fresh = newCalibration(cal.family, now);
    Object.assign(cal, fresh);
    return "rejected";
  }
  cal.updatedAt = now;
  return outcome;
}

/**
 * Holds each weight where a real tokenizer can be: a ratio in [MIN_WEIGHT, MAX_WEIGHT], and both
 * overheads (the whole prompt's and the cached slice's, the last two weights) in [MIN_INTERCEPT,
 * MAX_INTERCEPT]. A class seen too rarely could otherwise wander below zero on noise, and the stored
 * meter's reader refuses exactly such a fit (meter.ts), so this keeps what is learned reloadable.
 */
function keepPlausible(fit: Fit): void {
  const overheads = fit.w.length - 2;
  fit.w = fit.w.map((w, i) => (i >= overheads ? Math.max(MIN_INTERCEPT, Math.min(MAX_INTERCEPT, w)) : Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, w))));
}

/** Records how much of a prompt the provider served from its cache. */
export function observeCache(cal: ModelCalibration, cacheRead: number, promptTotal: number): void {
  if (!(promptTotal > 0) || !(cacheRead >= 0)) return;
  const rate = Math.min(1, cacheRead / promptTotal);
  cal.cacheHitRate = cal.cacheSamples === 0 ? rate : 0.8 * cal.cacheHitRate + 0.2 * rate;
  cal.cacheSamples += 1;
}

/** A detected tokenizer change: loosen both fits and forget the spread, so the next replies retrain. */
function relearn(cal: ModelCalibration): void {
  loosen(cal.whole, variances(cal.family).cap);
  loosen(cal.byClass, classCap(cal.family));
  cal.spread = PRIORS[cal.family].spread;
  cal.classSpread = PRIORS[cal.family].spread;
  cal.fast = 0;
  cal.drifting = 0;
  cal.rejected = 0;
}
