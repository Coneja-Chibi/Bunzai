/**
 * The token meter's usage reader ("Usage reader"): one canonical record
 * from whatever a provider reported, for every usage shape the research found (2026-09-27).
 *
 * The number the meter learns from is `promptTotal`, every prompt token the provider processed:
 * uncached plus cache reads plus cache writes. Providers disagree on whether their input count
 * includes the cached part. OpenAI, Gemini, vLLM, LM Studio, DeepSeek, and the Responses API include
 * it. Anthropic's `input_tokens` counts only what follows the last cache breakpoint. So each shape
 * is mapped by itself, never by one guess.
 *
 * A number the provider did not send stays undefined. It never becomes 0: a 0 would teach the meter
 * that a prompt cost nothing (rule "never makes up a field").
 *
 * Mapping sources: RoleCall's managed-ai adapters (packages/managed-ai/src/adapters.ts:90-183 at for OpenAI, Anthropic, and Gemini; provider docs for the rest, cited per shape below.
 * Pure: no I/O, never throws.
 */
import { isRecord, type Rec } from "../guards";

/** Which usage shape a record was read from. */
export type UsageShape = "openai" | "responses" | "anthropic" | "gemini" | "deepseek" | "ollama" | "llamacpp";

/** One reply's reported usage, canonical. Every count is a whole number of tokens, or absent. */
export interface TokenReport {
  shape: UsageShape;
  /** Every prompt token processed: uncached + cacheRead + cacheWrite. Absent when it cannot be known. */
  promptTotal?: number;
  /** Prompt tokens neither read from nor written to a cache. */
  uncached?: number;
  cacheRead?: number;
  /** Prompt tokens written to a cache (Anthropic, OpenAI 5.6+, OpenRouter, NanoGPT, Qwen). */
  cacheWrite?: number;
  /** The part of `cacheWrite` kept for an hour rather than five minutes (Anthropic). */
  cacheWrite1h?: number;
  /** Tokens the reply cost, reasoning included where the provider counts it inside output. */
  output?: number;
  /** Hidden reasoning tokens, when the provider breaks them out. */
  reasoning?: number;
  /** True when `reasoning` is counted inside `output` (OpenAI, DeepSeek); false when separate (Gemini). */
  reasoningInOutput?: boolean;
  /** Prompt tokens spent on tool definitions, when broken out (Gemini). */
  toolPrompt?: number;
  /** The provider's own cost for this reply, in US dollars, when it reports one (OpenRouter). */
  cost?: number;
}

/** A usable count: a finite, non-negative number, rounded to a whole token. */
const count = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined;
const sum = (...parts: (number | undefined)[]): number | undefined =>
  parts.some((p) => p !== undefined) ? parts.reduce<number>((t, p) => t + (p ?? 0), 0) : undefined;
/** Drop absent fields so a record compares cleanly and never carries `undefined` keys. */
function tidy(report: TokenReport): TokenReport {
  const out: Rec = {};
  for (const [k, v] of Object.entries(report)) if (v !== undefined) out[k] = v;
  return out as unknown as TokenReport;
}

/**
 * Anthropic Messages (platform.claude.com prompt-caching, 2026-09-27): `input_tokens` excludes both
 * cache reads and cache writes; `cache_creation` splits writes by TTL.
 */
function anthropic(u: Rec): TokenReport {
  const uncached = count(u.input_tokens);
  const cacheRead = count(u.cache_read_input_tokens);
  const cacheWrite = count(u.cache_creation_input_tokens);
  const split = isRecord(u.cache_creation) ? u.cache_creation : undefined;
  return tidy({
    shape: "anthropic",
    promptTotal: uncached === undefined ? undefined : sum(uncached, cacheRead, cacheWrite),
    uncached,
    cacheRead,
    cacheWrite,
    cacheWrite1h: split ? count(split.ephemeral_1h_input_tokens) : undefined,
    output: count(u.output_tokens),
  });
}

/**
 * OpenAI Chat Completions and everything that copies it (OpenRouter, NanoGPT, vLLM, LM Studio, xAI,
 * Mistral, GLM, Qwen's compatible mode). `prompt_tokens` includes cached reads. Cache writes come as
 * `prompt_tokens_details.cache_write_tokens` (OpenAI 5.6+, OpenRouter) or a bare
 * `cache_creation_input_tokens` (NanoGPT, Qwen, OpenRouter's Anthropic pass-through). RoleCall's
 * router folds an Anthropic write into `prompt_tokens` when it translates, and NanoGPT and OpenRouter
 * do the same, so a write reported beside `prompt_tokens` is already inside it.
 */
function openai(u: Rec): TokenReport {
  const prompt = count(u.prompt_tokens);
  const pd = isRecord(u.prompt_tokens_details) ? u.prompt_tokens_details : {};
  const cd = isRecord(u.completion_tokens_details) ? u.completion_tokens_details : {};
  const cacheRead = count(pd.cached_tokens) ?? count(u.cache_read_input_tokens);
  const cacheWrite = count(pd.cache_write_tokens) ?? count(u.cache_creation_input_tokens);
  const reasoning = count(cd.reasoning_tokens) ?? count(u.reasoning_tokens);
  const uncached = prompt === undefined ? undefined : Math.max(0, prompt - (cacheRead ?? 0) - (cacheWrite ?? 0));
  return tidy({
    shape: "openai",
    promptTotal: prompt,
    uncached,
    cacheRead,
    cacheWrite,
    output: count(u.completion_tokens),
    reasoning,
    reasoningInOutput: reasoning === undefined ? undefined : true,
    cost: typeof u.cost === "number" && Number.isFinite(u.cost) && u.cost >= 0 ? u.cost : undefined,
  });
}

/** DeepSeek (api-docs.deepseek.com kv_cache): hit and miss, and `prompt_tokens` as the total. */
function deepseek(u: Rec): TokenReport {
  const base = openai(u);
  const hit = count(u.prompt_cache_hit_tokens);
  const miss = count(u.prompt_cache_miss_tokens);
  const total = base.promptTotal ?? sum(hit, miss);
  return tidy({ ...base, shape: "deepseek", promptTotal: total, cacheRead: hit ?? base.cacheRead, uncached: miss ?? base.uncached });
}

/** OpenAI's Responses API: `input_tokens` includes cached reads, like Chat Completions. */
function responses(u: Rec): TokenReport {
  const input = count(u.input_tokens);
  const id = isRecord(u.input_tokens_details) ? u.input_tokens_details : {};
  const od = isRecord(u.output_tokens_details) ? u.output_tokens_details : {};
  const cacheRead = count(id.cached_tokens);
  const reasoning = count(od.reasoning_tokens);
  return tidy({
    shape: "responses",
    promptTotal: input,
    uncached: input === undefined ? undefined : Math.max(0, input - (cacheRead ?? 0)),
    cacheRead,
    output: count(u.output_tokens),
    reasoning,
    reasoningInOutput: reasoning === undefined ? undefined : true,
  });
}

/**
 * Gemini `usageMetadata` (ai.google.dev generate-content, 2026-09-27): `promptTokenCount` includes
 * `cachedContentTokenCount`; tool prompts and thoughts are their own counts. Whether thoughts sit
 * inside `candidatesTokenCount` is not documented, so it is recorded as separate; the meter learns
 * from prompt totals only, so this never skews what it learns.
 */
function gemini(u: Rec): TokenReport {
  const prompt = count(u.promptTokenCount);
  const cacheRead = count(u.cachedContentTokenCount);
  const toolPrompt = count(u.toolUsePromptTokenCount);
  const reasoning = count(u.thoughtsTokenCount);
  return tidy({
    shape: "gemini",
    promptTotal: prompt === undefined ? undefined : prompt + (toolPrompt ?? 0),
    // Tool-definition tokens are paid at the input price, so they are part of the uncached prompt.
    uncached: prompt === undefined ? undefined : Math.max(0, prompt - (cacheRead ?? 0)) + (toolPrompt ?? 0),
    cacheRead,
    output: count(u.candidatesTokenCount),
    reasoning,
    reasoningInOutput: reasoning === undefined ? undefined : false,
    toolPrompt,
  });
}

/**
 * Ollama (docs.ollama.com): `prompt_eval_count` is the whole prompt, cached part included; the
 * cache reuse is `prompt_eval_cached_count`. Reading the first as new work would hide every cache hit.
 */
function ollama(u: Rec): TokenReport {
  const prompt = count(u.prompt_eval_count);
  const cacheRead = count(u.prompt_eval_cached_count);
  return tidy({
    shape: "ollama",
    promptTotal: prompt,
    uncached: prompt === undefined ? undefined : Math.max(0, prompt - (cacheRead ?? 0)),
    cacheRead,
    output: count(u.eval_count),
  });
}

/**
 * llama.cpp server `timings` (tools/server README): `prompt_n` is the new work and `cache_n` the
 * reused prefix. Without `cache_n` (older builds and forks), `prompt_n` is only the new work, so no
 * total can be told from it: the total stays absent rather than being read as the new part.
 */
function llamacpp(t: Rec): TokenReport {
  const fresh = count(t.prompt_n);
  const cacheRead = count(t.cache_n);
  return tidy({
    shape: "llamacpp",
    promptTotal: cacheRead === undefined ? undefined : sum(fresh, cacheRead),
    uncached: cacheRead === undefined ? undefined : fresh,
    cacheRead,
    output: count(t.predicted_n),
  });
}

/**
 * Reads a reply body's usage into the canonical record, or undefined when the body carries none.
 * Pass the whole reply body (or the final stream chunk): the shape is found by where the numbers are.
 */
export function readTokenReport(body: unknown): TokenReport | undefined {
  if (!isRecord(body)) return undefined;
  const found = shapeOf(body);
  if (!found) return undefined;
  const report = found.read(found.from);
  // A record with no count at all is no report: an empty `usage: {}` is not a free prompt.
  const counts = [report.promptTotal, report.output, report.cacheRead, report.cacheWrite];
  return counts.some((c) => c !== undefined) ? report : undefined;
}

function shapeOf(body: Rec): { read: (u: Rec) => TokenReport; from: Rec } | undefined {
  if (isRecord(body.usageMetadata)) return { read: gemini, from: body.usageMetadata };
  // Timings win only when they carry the cache split; otherwise a usage block beside them is the total.
  if (isRecord(body.timings) && "cache_n" in body.timings) return { read: llamacpp, from: body.timings };
  if (isRecord(body.timings) && "prompt_n" in body.timings && !isRecord(body.usage)) return { read: llamacpp, from: body.timings };
  if ("prompt_eval_count" in body || "eval_count" in body) return { read: ollama, from: body };
  const u = isRecord(body.usage) ? body.usage : undefined;
  if (!u) return undefined;
  if ("prompt_cache_hit_tokens" in u || "prompt_cache_miss_tokens" in u) return { read: deepseek, from: u };
  if ("prompt_tokens" in u) return { read: openai, from: u };
  // Anthropic's own cache fields beside `input_tokens` mean Anthropic, whatever else the body carries:
  // read as the Responses API, its cache reads would be dropped.
  if ("input_tokens" in u && ("cache_read_input_tokens" in u || "cache_creation_input_tokens" in u)) return { read: anthropic, from: u };
  if ("input_tokens_details" in u || "output_tokens_details" in u) return { read: responses, from: u };
  if ("input_tokens" in u || "cache_read_input_tokens" in u || "cache_creation_input_tokens" in u) return { read: anthropic, from: u };
  return undefined;
}
