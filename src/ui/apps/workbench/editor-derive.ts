/**
 * Pure derivations for the character editor - tolerant readers and rough estimates over a draft body,
 * lifted out of Editor.tsx so they get a tested home the component body never gave them. No React, no
 * state: deterministic functions of a plain object.
 */
import { readPath } from "./editor-core";
import { recOr } from "../../../core/guards";
import { roughTokenCount } from "../../../core/tokens/estimate";

/** tolerant reader for the app-wide editor scale (out-of-range or malformed drops to 1). */
export const parseScale = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 2 ? v : 1;

/** a string, or "" for anything else */
export const str = (x: unknown): string => (typeof x === "string" ? x : "");
export interface Greeting {
  text: string;
  title?: string;
  /** stable editing identity; preserved through retitle/reorder */
  id?: string;
}

/** the greetings at a path as {text,title,id?} rows (tolerant; non-arrays -> []) */
export const greetingsOf = (draft: unknown, path: string): Greeting[] => {
  const raw = readPath(draft, path);
  if (!Array.isArray(raw)) return [];
  return raw.map((g) => {
    const row = recOr(g);
    const id = str(row.id);
    return {
      text: str(row.text),
      title: str(row.title) || undefined,
      ...(id !== "" ? { id } : {}),
    };
  });
};

/** honest rough size: prose chars / 4 (roughTokenCount), labeled "~tokens" (a real tokenizer is macro-layer work) */
export function tokenEstimate(draft: unknown): number {
  const paths = ["identity.description", "persona.personality", "persona.scenario", "greetings.firstMessage", "examples.exampleMessages", "prompts.systemPrompt"];
  const chars = paths.reduce((n, p) => n + str(readPath(draft, p)).length, 0);
  return roughTokenCount(chars);
}
