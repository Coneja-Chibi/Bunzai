/**
 * Family priors: where a model the meter has never seen starts.
 * The ratios are seeds, not facts. Each says roughly how many of the family's tokens one o200k token
 * becomes, erring high, and carries a wide spread, so the first estimates for a new model overcount a
 * little rather than overflow. Real replies replace them within a few turns.
 *
 * Grounds for the seeds (research, 2026-09-27):
 * - OpenAI's current models use o200k itself (1.0). Older GPT-4 and 3.5 models use cl100k, a little
 *   costlier on English.
 * - Anthropic states its newer tokenizer (Opus 4.7 and later, the 5 family) produces about 30
 *   percent more tokens than its earlier one, and the earlier one already ran above o200k; there is
 *   no open-source build of either.
 * - The open-weight families (Llama, Qwen, DeepSeek, GLM, Kimi, Mistral) and Gemini use large
 *   vocabularies near o200k's efficiency on English and costlier on code and CJK.
 * - An unknown family starts deliberately high.
 */

import { classifyModelId, type ModelFamily } from "./model-family";

export type Family = ModelFamily;

export interface Prior {
  /** Real tokens per base token. */
  ratio: number;
  /** Typical relative miss before any evidence, as a fraction (0.2 = 20 percent). */
  spread: number;
}

export const PRIORS: Readonly<Record<Family, Prior>> = {
  openai: { ratio: 1.0, spread: 0.04 },
  "openai-legacy": { ratio: 1.08, spread: 0.08 },
  claude: { ratio: 1.45, spread: 0.2 },
  "claude-legacy": { ratio: 1.2, spread: 0.15 },
  gemini: { ratio: 1.1, spread: 0.15 },
  llama: { ratio: 1.08, spread: 0.12 },
  qwen: { ratio: 1.1, spread: 0.12 },
  deepseek: { ratio: 1.1, spread: 0.12 },
  glm: { ratio: 1.1, spread: 0.15 },
  kimi: { ratio: 1.1, spread: 0.15 },
  mistral: { ratio: 1.15, spread: 0.15 },
  grok: { ratio: 1.1, spread: 0.15 },
  unknown: { ratio: 1.4, spread: 0.35 },
};

/**
 * The family a model id belongs to, read from the id alone. Aggregator ids ("anthropic/claude-...",
 * "meta-llama/llama-4-...") match by what follows the slash as well. Claude models before Opus 4.7
 * keep the older tokenizer.
 */
export const familyOf: (modelId: string) => Family = classifyModelId;
