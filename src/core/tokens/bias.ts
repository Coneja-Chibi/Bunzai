/**
 * Logit Bias entries (RoleCall's logit-bias-helper.ts, SillyTavern's three text forms) turned into token
 * id biases. RoleCall tokenizes every model's words with one tokenizer; a bias on the wrong ids
 * suppresses or boosts the wrong words, so here a word is tokenized only by the exact tokenizer of the
 * model's family (OpenAI's two encodings) and refused for any other. A raw id list needs no tokenizer.
 */
import { encode as o200k } from "gpt-tokenizer/encoding/o200k_base";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { classifyModelId } from "./model-family";

export interface BiasEntry {
  id: string;
  /** `normal text` (a leading space is added), `{verbatim}`, or `[1234, 5678]` raw token ids. */
  text: string;
  /** -100 to 100. */
  value: number;
}

export type BiasTokenizer = "o200k_base" | "cl100k_base";

/** The exact tokenizer for a model, or null when Bunraku has none for it. */
export function exactTokenizer(model: string): BiasTokenizer | null {
  const family = classifyModelId(model);
  return family === "openai" ? "o200k_base" : family === "openai-legacy" ? "cl100k_base" : null;
}

/** The token ids an entry's text stands for, "no-tokenizer" for words with no exact tokenizer, or "invalid" for a bad id list. */
export function entryTokens(text: string, tokenizer: BiasTokenizer | null): number[] | "no-tokenizer" | "invalid" {
  const t = text.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    try {
      const ids: unknown = JSON.parse(t);
      return Array.isArray(ids) && ids.every((n) => Number.isInteger(n) && n >= 0) ? (ids as number[]) : "invalid";
    } catch {
      return "invalid";
    }
  }
  if (!tokenizer) return "no-tokenizer";
  const encode = tokenizer === "o200k_base" ? o200k : cl100k;
  return t.startsWith("{") && t.endsWith("}") ? encode(t.slice(1, -1)) : encode(` ${t}`);
}

/** Token id to bias for the model, or why it cannot be built. Blank entries are skipped; later entries win. */
export function biasFrom(entries: readonly BiasEntry[], model: string): { bias: Record<string, number> } | { problem: "no-tokenizer" | "invalid" | "empty" } {
  const tokenizer = exactTokenizer(model);
  const bias: Record<string, number> = {};
  for (const e of entries) {
    if (!e.text.trim()) continue;
    const ids = entryTokens(e.text, tokenizer);
    if (typeof ids === "string") return { problem: ids };
    const value = Math.max(-100, Math.min(100, e.value));
    for (const id of ids) bias[String(id)] = value;
  }
  return Object.keys(bias).length > 0 ? { bias } : { problem: "empty" };
}
