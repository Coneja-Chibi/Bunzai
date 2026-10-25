/**
 * The token meter's cache planner ("Cache planner", rules 9 and 10):
 * - how each provider caches;
 * - what share of the next prompt it will likely serve from cache;
 * - how long that cache stays warm;
 * - what a reply cost at cache prices.
 *
 * Providers cache an exact prefix of the prompt. So the planner fingerprints the prompt at every
 * message boundary and finds how far this prompt matches the last one sent on the same take.
 * Anthropic caches only up to a breakpoint the request marks. The rest cache automatically once the
 * prefix passes their minimum length. Nothing here is stored: fingerprints live in memory for one
 * session, since even a one-way hash of a short message could be guessed.
 *
 * Provider rules are from each provider's documentation, 2026-09-27. Rules marked `unverified` are
 * the research's open gaps (token-meter.md edge case 6); their numbers are conservative, and cost
 * shown for them is labeled as an estimate.
 */
import { sha256Hex } from "../sha256";
import { classifyModelId } from "./model-family";

export type CacheMode = "breakpoint" | "automatic" | "none";

export interface CacheRules {
  mode: CacheMode;
  /** Shortest prefix the provider caches, in its own tokens. */
  minTokens: number;
  /** How long an unused cache survives, in ms. */
  ttlMs: number;
  /** Price multiplier on the input price for a cache read. */
  readMultiplier: number;
  /** Price multiplier for a cache write (5-minute writes, where there are two kinds). */
  writeMultiplier: number;
  /** Price multiplier for a one-hour cache write (Anthropic). */
  write1hMultiplier?: number;
  /**
   * The unit an automatic cache counts in: a cached count is rounded down to it. OpenAI documents 128
   * tokens and DeepSeek 64; a local server reuses its exact prefix (1); others are assumed 128.
   */
  block?: number;
  /** True where the research could not confirm these numbers against the provider's own docs. */
  unverified?: boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/** The rules for a provider kind and model. Aggregators follow the backend the model id names. */
export function cacheRulesFor(provider: string, modelId: string): CacheRules {
  const kind = backendOf(provider, modelId);
  // One spelling for every source: lower case, dots as dashes ("claude-opus-4.5" is "claude-opus-4-5").
  const id = modelId.toLowerCase().replace(/\./g, "-");
  switch (kind) {
    case "anthropic":
      return { mode: "breakpoint", minTokens: anthropicMin(id), ttlMs: 5 * MIN, readMultiplier: anthropicRead(id), writeMultiplier: 1.25, write1hMultiplier: 2 };
    case "openai": {
      const newer = /gpt-5-(6|[7-9])|gpt-[6-9]/.test(id);
      // Reads are 0.1x from the GPT-5 family on. The older discounts (gpt-4o half price, gpt-4.1 a
      // quarter) are from memory, not re-checked against the docs this session: marked unverified.
      if (/gpt-4o|chatgpt-4o/.test(id)) return { mode: "automatic", minTokens: 1024, ttlMs: 5 * MIN, readMultiplier: 0.5, writeMultiplier: 1, block: 128, unverified: true };
      if (/gpt-4-1/.test(id)) return { mode: "automatic", minTokens: 1024, ttlMs: 5 * MIN, readMultiplier: 0.25, writeMultiplier: 1, block: 128, unverified: true };
      return { mode: "automatic", minTokens: 1024, ttlMs: newer ? 30 * MIN : 5 * MIN, readMultiplier: 0.1, writeMultiplier: newer ? 1.25 : 1, block: 128 };
    }
    case "gemini":
      // The minimums are Google's; the implicit cache's lifetime and read discount are not documented.
      return { mode: "automatic", minTokens: /gemini-[3-9]/.test(id) ? 4096 : 2048, ttlMs: 3 * MIN, readMultiplier: 0.1, writeMultiplier: 1, block: 128, unverified: true };
    case "deepseek":
      // DeepSeek prices a hit at about a thirtieth of a miss (0.022 against 0.66 per million, 2026-09-27).
      return { mode: "automatic", minTokens: 64, ttlMs: HOUR, readMultiplier: /flash/.test(id) ? 0.02 : 0.034, writeMultiplier: 1, block: 64 };
    case "qwen":
      return { mode: "automatic", minTokens: 1024, ttlMs: 5 * MIN, readMultiplier: 0.2, writeMultiplier: 1, block: 128, unverified: true };
    case "grok":
      return { mode: "automatic", minTokens: 1024, ttlMs: 5 * MIN, readMultiplier: 0.25, writeMultiplier: 1, block: 128, unverified: true };
    case "mistral":
      return { mode: "automatic", minTokens: 1024, ttlMs: 5 * MIN, readMultiplier: 0.1, writeMultiplier: 1, block: 128, unverified: true };
    case "glm":
      return { mode: "automatic", minTokens: 512, ttlMs: 5 * MIN, readMultiplier: 0.5, writeMultiplier: 1, block: 128, unverified: true };
    case "kimi":
      return { mode: "automatic", minTokens: 1024, ttlMs: 5 * MIN, readMultiplier: 0.1, writeMultiplier: 1, block: 128, unverified: true };
    case "local":
      // A local server keeps its KV cache for the session and charges nothing.
      return { mode: "automatic", minTokens: 0, ttlMs: 24 * HOUR, readMultiplier: 0, writeMultiplier: 0, block: 1 };
    default:
      return { mode: "none", minTokens: Number.POSITIVE_INFINITY, ttlMs: 0, readMultiplier: 1, writeMultiplier: 1 };
  }
}

/**
 * Anthropic's minimum cacheable length varies by model (prompt-caching docs, 2026-09-27). Ids arrive
 * with dots already turned to dashes, in either order Anthropic has used ("claude-3-5-haiku",
 * "claude-haiku-3-5").
 */
function anthropicMin(id: string): number {
  if (/mythos-preview|opus-4-7|haiku-3-5|3-5-haiku/.test(id)) return 2048;
  if (/opus-4-[56]|haiku-4-5|4-5-haiku/.test(id)) return 4096;
  if (/\b(fable|mythos)\b|opus-5/.test(id)) return 512;
  return 1024;
}

/** Anthropic's cache-read price: 0.1x, with lower rates for a few models (prompt-caching docs, 2026-09-27). */
function anthropicRead(id: string): number {
  if (/\b(fable|mythos)-5-1\b/.test(id) && !/mythos-preview/.test(id)) return 0.025;
  if (/opus-5-5/.test(id)) return 0.05;
  return 0.1;
}

type Backend = "anthropic" | "openai" | "gemini" | "deepseek" | "qwen" | "grok" | "mistral" | "glm" | "kimi" | "local" | "unknown";

/** classifyModelId's family set is finer than a cache Backend needs (legacy tokenizer tiers, llama);
 *  collapse onto the backend that actually caches it. */
const BACKEND_BY_FAMILY: Readonly<Record<ReturnType<typeof classifyModelId>, Backend>> = {
  claude: "anthropic",
  "claude-legacy": "anthropic",
  openai: "openai",
  "openai-legacy": "openai",
  gemini: "gemini",
  deepseek: "deepseek",
  qwen: "qwen",
  llama: "unknown",
  glm: "glm",
  kimi: "kimi",
  mistral: "mistral",
  grok: "grok",
  unknown: "unknown",
};

/**
 * Which backend actually caches: the connection's kind, or, behind an aggregator, the model's maker.
 *
 * The aggregator-id fallback now reads classifyModelId (core/tokens/model-family.ts) instead of its
 * own narrower regex, fixing B12 (fable/mythos, qwen's qwq/dashscope aliases) by construction - but
 * classifyModelId recognizes real aliases this function's own id-sniffing never did, so the fold
 * widened recognition beyond those two cases. Recorded here rather than guessed past, per a bare
 * model id behind an aggregator (no provider match):
 * - "gemma-*" now classifies as gemini (previously unmatched - old regex was gemini|google/ only);
 * - ministral/magistral/pixtral/devstral now classify as mistral (old regex: mistral|mixtral|
 *   codestral only);
 * - a bare "zhipu" or "xai" (no hyphen) in the id now classifies as glm/grok respectively;
 * - "chatgpt"/"codex" now classify as openai (previously unmatched);
 * - "o1foo"-shaped ids (a digit with no following "-" or end) NO LONGER match the openai o-series
 *   check (narrower, not wider - classifyModelId requires `\bo[1-9](-|$)`).
 * Preferred the more complete, actively-maintained classifier (priors.ts's familyOf, now
 * classifyModelId) per the fold brief's "prefer the most correct existing copy" rule, since this
 * function's own list was the stale, narrower one B12 found drifting in the first place.
 */
export function backendOf(provider: string, modelId: string): Backend {
  const p = provider.toLowerCase();
  if (p === "local" || p === "ollama" || p === "llamacpp" || p === "lmstudio" || p === "vllm") return "local";
  const direct: Record<string, Backend> = { anthropic: "anthropic", openai: "openai", google: "gemini", gemini: "gemini", deepseek: "deepseek", mistral: "mistral", xai: "grok", qwen: "qwen", dashscope: "qwen", zhipu: "glm", glm: "glm", moonshot: "kimi", kimi: "kimi" };
  if (direct[p]) return direct[p];
  return BACKEND_BY_FAMILY[classifyModelId(modelId)];
}

/** A prompt's fingerprint at every message boundary: entry i covers messages 0..i. */
export function prefixChain(messages: readonly { role: string; content: string }[]): string[] {
  const out: string[] = [];
  let h = "";
  for (const m of messages) {
    h = sha256Hex(`${h}\u0000${m.role}\u0000${m.content}`).slice(0, 32);
    out.push(h);
  }
  return out;
}

/** How many leading messages two prompts share exactly. */
export function sharedPrefix(a: readonly string[], b: readonly string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export interface CachePrediction {
  /** Prompt tokens the provider will likely read from cache. */
  read: number;
  /** Prompt tokens it will likely write to cache this time. */
  write: number;
  /** How long the cache stays warm if nothing is sent, in ms; 0 when cold. */
  warmForMs: number;
  /** Messages the cached prefix covers. */
  messages: number;
}

/** How far back, in blocks, an Anthropic breakpoint looks for an entry an earlier request wrote. */
const LOOKBACK = 20;

/**
 * The likely cache split for the next prompt. `tokens` holds each message's estimated real tokens.
 * `last` is what was sent before on this take: its fingerprints, when, and, for a breakpoint cache,
 * the message indexes it marked. `breakpoints` are the indexes this request marks (Anthropic: the
 * system prompt, the tools, and the last message).
 *
 * An automatic cache reads the whole shared prefix. A breakpoint cache reads only an entry an earlier
 * request wrote: the furthest of last time's marks inside the shared prefix that one of this
 * request's marks can reach within its lookback. It then writes from there to this request's last
 * mark. Estimates only: the provider's report is the truth, and the meter learns the real rate.
 */
export function predictCache(
  rules: CacheRules,
  chain: readonly string[],
  tokens: readonly number[],
  last: { chain: readonly string[]; at: number; breakpoints?: readonly number[] } | undefined,
  now: number,
  breakpoints: readonly number[] = [],
): CachePrediction {
  const cold: CachePrediction = { read: 0, write: 0, warmForMs: 0, messages: 0 };
  if (rules.mode === "none") return cold;
  const upTo = (n: number) => tokens.slice(0, n).reduce((s, t) => s + t, 0);
  const warm = last !== undefined && now - last.at <= rules.ttlMs;
  const shared = warm ? sharedPrefix(chain, last.chain) : 0;
  let readTo = shared;
  if (rules.mode === "breakpoint") {
    const ends = breakpoints.map((b) => b + 1);
    const reachable = (point: number) => ends.some((end) => end >= point && end - point <= LOOKBACK);
    const written = (last?.breakpoints ?? []).map((b) => b + 1).filter((p) => p <= shared && reachable(p));
    readTo = written.length ? Math.max(...written) : 0;
  }
  const read = readTo > 0 && upTo(readTo) >= rules.minTokens ? upTo(readTo) : 0;
  let write = 0;
  if (rules.mode === "breakpoint" && rules.writeMultiplier > 0) {
    const lastMark = breakpoints.length ? Math.max(...breakpoints) + 1 : 0;
    const cachedTo = read > 0 ? readTo : 0;
    if (lastMark > cachedTo && upTo(lastMark) >= rules.minTokens) write = upTo(lastMark) - upTo(cachedTo);
  }
  return { read, write, warmForMs: warm ? Math.max(0, rules.ttlMs - (now - last.at)) : 0, messages: read > 0 ? readTo : 0 };
}

type Counts = { total: number; prose: number; code: number; json: number; cjk: number };

/** An automatic cache's count is used only once the meter is this sure of the slice: 5 percent. */
const CONFIDENT = 0.05;

/**
 * The cached part of a reply as a calibration sample (token-meter rule 4), or undefined when it cannot
 * be pinned to one slice of the prompt. `candidates` are the places the cache could have ended, each
 * with its base count, the meter's estimate of its tokens, and that estimate's uncertainty in tokens
 * (bound minus midpoint):
 * - a breakpoint cache (Anthropic) ends only at a marked message: the caller offers the system
 *   prompt's mark and the previous request's marks. The count is used when it lands within its
 *   mark's uncertainty and clearly apart from every other, and is then exact;
 * - an automatic cache (OpenAI, DeepSeek, Gemini, a local server) can end anywhere and rounds down to
 *   its block (a local server's reuse can also run well into the next message, when its cache keeps
 *   the previous reply), so the caller offers one place: where this prompt stops matching the previous request,
 *   the usual hit. The count is used only while the meter is already sure of that slice (its
 *   uncertainty within CONFIDENT of it), and only when it lands within that uncertainty plus one block;
 *   anything further, such as a hit on a much older, shorter entry, is refused. A near older hit
 *   cannot be told from the usual one, so the rounding and how far the count landed are its noise.
 *   Matching an automatic count by an unsure meter's estimates picked the wrong slice most of the time
 *   (independent review, round 5). The two gates guard accuracy rather than safety: without them no
 *   bound undercounted either, but a cache running short every turn steadily worsened the estimate.
 */
export function cachedPart(
  rules: CacheRules,
  candidates: readonly { base: Counts; estimate: number; uncertainty: number }[],
  cacheRead: number | undefined,
): { base: Counts; real: number; sd: number } | undefined {
  if (!cacheRead || cacheRead <= 0 || rules.mode === "none" || candidates.length === 0) return undefined;
  if (rules.mode === "automatic") {
    const [only] = candidates;
    if (candidates.length !== 1 || !only || !(only.estimate > 0) || only.base.total <= 0) return undefined;
    const block = Math.max(1, rules.block ?? 128);
    const real = cacheRead + (block - 1) / 2;
    if (only.uncertainty > CONFIDENT * only.estimate) return undefined;
    if (Math.abs(only.estimate - real) > only.uncertainty + block) return undefined;
    // A hit on an older entry within the tolerance cannot be told from the usual one, so how far the
    // count landed from the estimate is part of its noise, with the rounding.
    return { base: only.base, real, sd: (block / 2 + Math.abs(only.estimate - real)) / real };
  }
  const ranked = candidates
    .filter((c) => c.estimate > 0 && c.base.total > 0 && c.uncertainty >= 0)
    .map((c) => ({ c, gap: Math.abs(c.estimate - cacheRead) }))
    .sort((a, b) => a.gap - b.gap);
  const [best, next] = ranked;
  if (!best || best.gap > best.c.uncertainty) return undefined;
  if (next && next.gap - best.gap < 2 * Math.max(best.c.uncertainty, next.c.uncertainty)) return undefined;
  // Matched, the count is exact: how far it landed from the estimate is the estimate's error, not the
  // count's, and treating it as noise let the meter's own bias blunt the evidence that corrects it.
  return { base: best.c.base, real: cacheRead, sd: 0 };
}

/** Prices in US dollars per million tokens. Absent cache prices follow from the rules' multipliers. */
export interface Prices {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  cacheWrite1h?: number;
}

export interface Cost {
  total: number;
  /** What the cache saved against paying full input price for every prompt token; negative when writes cost more. */
  saved: number;
}

/** What a reply cost, from the usage it reported. Reported cost (OpenRouter) wins when present. */
export function costOf(
  usage: { uncached?: number; cacheRead?: number; cacheWrite?: number; cacheWrite1h?: number; output?: number; cost?: number },
  prices: Prices,
  rules: CacheRules,
): Cost {
  const per = (tokens: number | undefined, price: number) => ((tokens ?? 0) * price) / 1_000_000;
  const readPrice = prices.cacheRead ?? prices.input * rules.readMultiplier;
  const writePrice = prices.cacheWrite ?? prices.input * rules.writeMultiplier;
  const write1hPrice = prices.cacheWrite1h ?? prices.input * (rules.write1hMultiplier ?? rules.writeMultiplier);
  const long = usage.cacheWrite1h ?? 0;
  const short = Math.max(0, (usage.cacheWrite ?? 0) - long);
  const computed =
    per(usage.uncached, prices.input) + per(usage.cacheRead, readPrice) + per(short, writePrice) + per(long, write1hPrice) + per(usage.output, prices.output);
  const fullPrice = per((usage.uncached ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0), prices.input) + per(usage.output, prices.output);
  const total = usage.cost ?? computed;
  return { total, saved: fullPrice - computed };
}
