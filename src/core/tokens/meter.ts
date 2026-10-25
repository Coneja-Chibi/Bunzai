/**
 * The token meter's document: every model it has learned,
 * keyed by provider, model, and the backend an aggregator actually routed to, so two tokenizers
 * never blend. It holds numbers and model ids only, never prompt text or anything derived from it.
 * It lives in the library as one sealed StateStore document (`meter`).
 *
 * Reading a stored document is strict. A model entry that is not exactly the expected shape is
 * dropped and named in `discarded`, so the caller can report it, rather than trusted. The entries are
 * learned numbers, not anything a person wrote, so dropping one costs a few replies of relearning.
 * Pure: the caller supplies the clock.
 */
import type { BaseCount } from "./base";
import { isRecord } from "../guards";
import { estimate, estimatePart, MAX_INTERCEPT, MAX_WEIGHT, MIN_INTERCEPT, MIN_WEIGHT, newCalibration, observe, observeCache, type Estimate, type ModelCalibration, type Sample } from "./calibrate";
import { isFiniteFit, positiveDefinite, type Fit } from "./fit";
import { familyOf, PRIORS, type Family } from "./priors";

export interface Meter {
  version: 1;
  models: Record<string, ModelCalibration>;
}

export const emptyMeter = (): Meter => ({ version: 1, models: {} });

/** The key one model's evidence lives under. The routed backend counts: OpenRouter can route one id two ways. */
export const modelKey = (provider: string, model: string, routedModel?: string): string =>
  [provider.toLowerCase(), model, routedModel && routedModel !== model ? routedModel : ""].join("|");

/**
 * The key to read before a request goes out. The backend an aggregator routes to is only known from
 * the reply, so a turn reads the entry most recently taught for the model it asks for (whatever it
 * was routed to last time), or the model's own key when nothing has been learned yet.
 */
export function readKey(meter: Meter, provider: string, model: string): string {
  // The unrouted key ends in its separator, so "auto" never matches "autopilot".
  const prefix = modelKey(provider, model);
  let best: string | undefined;
  for (const [key, cal] of Object.entries(meter.models)) {
    if (key.startsWith(prefix) && (!best || cal.updatedAt > meter.models[best]!.updatedAt)) best = key;
  }
  return best ?? modelKey(provider, model);
}

const providerOf = (key: string) => key.split("|")[0] ?? "";
const modelOf = (key: string) => {
  const [, model, routed] = key.split("|");
  return routed || model || "";
};

function calibrationFor(meter: Meter, key: string, now: number): ModelCalibration {
  return meter.models[key] ?? newCalibration(familyOf(modelOf(key)), now);
}

/** Twins: two models of one provider and family whose fits agree closely on enough evidence (rule 7). */
const TWIN_MIN = 15;
function twinsOf(meter: Meter, key: string): string[] {
  const me = meter.models[key];
  if (!me || me.whole.n < TWIN_MIN) return [];
  return Object.keys(meter.models).filter((other) => {
    const them = meter.models[other]!;
    return (
      other !== key &&
      providerOf(other) === providerOf(key) &&
      them.family === me.family &&
      them.whole.n >= TWIN_MIN &&
      Math.abs((them.whole.w[0] ?? 0) - (me.whole.w[0] ?? 0)) < 0.03 &&
      Math.abs((them.whole.w[1] ?? 0) - (me.whole.w[1] ?? 0)) < 40
    );
  });
}

/**
 * The estimate for a prompt on this model. Twins pool: their estimates are averaged, weighted by
 * evidence, which steadies the midpoint; the bound and spread are the widest of theirs, so pooling
 * never narrows the bound below what any twin has shown.
 */
export function estimateFor(meter: Meter, key: string, base: BaseCount, now: number): Estimate & { twins: number } {
  const own = estimate(calibrationFor(meter, key, now), base);
  const twins = twinsOf(meter, key);
  if (!twins.length) return { ...own, twins: 0 };
  const all = [own, ...twins.map((t) => estimate(meter.models[t]!, base))];
  const weight = all.reduce((s, e) => s + e.samples, 0);
  const mid = Math.round(all.reduce((s, e) => s + e.mid * e.samples, 0) / weight);
  const spread = Math.max(...all.map((e) => e.spread));
  const bound = Math.max(...all.map((e) => e.bound));
  return { ...own, mid, bound, spread, samples: weight, twins: twins.length };
}

/**
 * The estimate for one message inside a prompt (estimatePart: no fixed overhead), pooled with twins
 * the same way estimateFor pools a whole prompt, so a budget summing parts and a whole agree.
 */
export function partFor(meter: Meter, key: string, base: BaseCount, now: number): Estimate {
  const own = estimatePart(calibrationFor(meter, key, now), base);
  const twins = twinsOf(meter, key);
  if (!twins.length) return own;
  const all = [own, ...twins.map((t) => estimatePart(meter.models[t]!, base))];
  const weight = all.reduce((s, e) => s + e.samples, 0);
  return { ...own, mid: Math.round(all.reduce((s, e) => s + e.mid * e.samples, 0) / weight), bound: Math.max(...all.map((e) => e.bound)), spread: Math.max(...all.map((e) => e.spread)), samples: weight };
}

export interface ReplyEvidence {
  sample: Sample;
  /** The provider's report, for the cache hit rate. */
  cacheRead?: number;
  promptTotal: number;
}

/** Learns from one reply. Creates the model's entry on first sight. */
export function learn(meter: Meter, key: string, evidence: ReplyEvidence, now: number): ReturnType<typeof observe> {
  const cal = calibrationFor(meter, key, now);
  const outcome = observe(cal, evidence.sample, now);
  if (evidence.cacheRead !== undefined) observeCache(cal, evidence.cacheRead, evidence.promptTotal);
  meter.models[key] = cal;
  return outcome;
}

/** Forgets one model, or every model. */
export function reset(meter: Meter, key?: string): void {
  if (key === undefined) meter.models = {};
  else delete meter.models[key];
}

export interface ModelSummary {
  key: string;
  provider: string;
  model: string;
  family: Family;
  samples: number;
  /** Real tokens per base token. */
  ratio: number;
  /** Fixed overhead per prompt, in real tokens. */
  overhead: number;
  /** Typical miss, as a fraction. */
  spread: number;
  cacheHitRate: number;
  cacheSamples: number;
  twins: number;
  updatedAt: number;
}

/** Every learned model, most recently used first: the Kit model page's rows. */
export function summaries(meter: Meter): ModelSummary[] {
  return Object.entries(meter.models)
    .map(([key, cal]) => ({
      key,
      provider: providerOf(key),
      model: modelOf(key),
      family: cal.family,
      samples: cal.whole.n,
      ratio: cal.whole.w[0] ?? PRIORS[cal.family].ratio,
      overhead: cal.whole.w[1] ?? 0,
      spread: cal.spread,
      cacheHitRate: cal.cacheHitRate,
      cacheSamples: cal.cacheSamples,
      twins: twinsOf(meter, key).length,
      updatedAt: cal.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export const serializeMeter = (meter: Meter): string => JSON.stringify(meter);

/** Reads a stored meter. Entries that fail the shape check are dropped and named. */
export function parseMeter(text: string | null): { meter: Meter; discarded: string[] } {
  if (text === null) return { meter: emptyMeter(), discarded: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { meter: emptyMeter(), discarded: ["(the whole document: not JSON)"] };
  }
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.models)) return { meter: emptyMeter(), discarded: ["(the whole document: unknown shape)"] };
  const meter = emptyMeter();
  const discarded: string[] = [];
  for (const [key, value] of Object.entries(raw.models)) {
    if (isKey(key) && isCalibration(value)) meter.models[key] = value;
    else discarded.push(key);
  }
  return { meter, discarded };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * A stored fit, checked against exactly what the learner keeps (calibrate.ts keepPlausible): the
 * right size, every ratio within [MIN_WEIGHT, MAX_WEIGHT], the intercept within [MIN_INTERCEPT, MAX_INTERCEPT], every
 * variance positive and bounded, and the covariance positive definite. A fit outside that would steer
 * the budget, so it is refused.
 */
function isFit(v: unknown, k: number): v is Fit {
  if (!isRecord(v) || !Array.isArray(v.w) || v.w.length !== k || !Array.isArray(v.p) || v.p.length !== k * k) return false;
  if (!v.w.every(num) || !v.p.every(num) || !num(v.n) || !Number.isInteger(v.n) || v.n < 0) return false;
  const w = v.w as number[];
  const p = v.p as number[];
  for (let i = 0; i < k; i++) {
    const weight = w[i]!;
    // The last two weights are the two overheads (the whole prompt's and the cached slice's).
    const intercept = i >= k - 2;
    if (intercept ? !(weight >= MIN_INTERCEPT && weight <= MAX_INTERCEPT) : !(weight >= MIN_WEIGHT && weight <= MAX_WEIGHT)) return false;
    const variance = p[i * k + i]!;
    if (!(variance > 0 && variance < 1e13)) return false;
  }
  return isFiniteFit(v as unknown as Fit) && positiveDefinite(p, k);
}

const inRange = (v: unknown, lo: number, hi: number): boolean => num(v) && v >= lo && v <= hi;
const count = (v: unknown): boolean => num(v) && Number.isInteger(v) && v >= 0;

/** A stored model entry: its own family name (never an inherited property), and every number in range. */
function isCalibration(v: unknown): v is ModelCalibration {
  if (!isRecord(v) || typeof v.family !== "string" || !Object.hasOwn(PRIORS, v.family)) return false;
  const known = new Set(["family", "whole", "byClass", "spread", "classSpread", "fast", "drifting", "rejected", "cacheHitRate", "cacheSamples", "updatedAt"]);
  return (
    Object.keys(v).every((k) => known.has(k)) &&
    inRange(v.spread, 0, 1) &&
    inRange(v.classSpread, 0, 1) &&
    inRange(v.fast, -10, 10) &&
    count(v.drifting) &&
    count(v.rejected) &&
    inRange(v.cacheHitRate, 0, 1) &&
    count(v.cacheSamples) &&
    inRange(v.updatedAt, 0, Number.MAX_SAFE_INTEGER) &&
    isFit(v.whole, 3) &&
    isFit(v.byClass, 6)
  );
}

/** A key the meter would write: a provider and a model, and an optional routed backend. */
const isKey = (key: string): boolean => {
  const parts = key.split("|");
  return parts.length === 3 && parts[0] !== "" && parts[1] !== "";
};
