/** Public listing shapes derived from one live entity and its lightweight shelf facts. */
import type { StudioEntityKind } from "../../studio/path-policy";
import type { LoreFacts, PersonaFacts } from "../../studio/piece-facts";

export interface RegexShelfFacts {
  enabled: boolean;
  ruleCount: number;
  enabledRuleCount: number;
  doesWhat: string;
  slowCount: number;
}

export interface PieceSummaryContent {
  name: string;
  importedAt?: string;
  hasPortrait?: boolean;
  accent?: string;
  sourceFormat?: string;
  sourceVariant?: string;
  tags?: string[];
  /** identity.tagline, characters only. */
  tagline?: string;
  /** A short excerpt, never the full description. */
  description?: string;
  /** Approximate whole-body token count. */
  tokens: number;
  /** Characters: "n/9" filled card fields. */
  filled?: string;
  /** Preset sampler values. */
  samplers?: { temperature?: number; topP?: number; topK?: number };
  /** Preset prompt block count. */
  blocks?: number;
  /** Preset imported from a SillyTavern sampler file: which dialect. */
  samplerSet?: "kobold" | "textgen" | "novelai";
  /** Prompt format: which halves it holds. */
  formatParts?: ("instruct" | "context")[];
  regex?: RegexShelfFacts;
  lore?: LoreFacts & { enabled: boolean };
  persona?: PersonaFacts;
}

export interface PieceSummary extends PieceSummaryContent {
  id: string;
  kind: StudioEntityKind;
  revision: string;
  version: number;
  /** Monotonic identity of the committed live row, including coalesced autosaves. */
  writeId: number;
  updatedAt: number;
}
