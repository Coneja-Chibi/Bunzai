/**
 * Build an entry's scan text and evaluate its triggers. Ported from RoleCall's
 * matching/scan-sources.ts (buildScanText) and the selective-logic + probability halves of
 * engine.ts's evaluateTriggers / matching/recursion.ts's evaluateEntryTriggers.
 *
 * RoleCall is inconsistent between its two callers and this keeps that inconsistency rather than
 * quietly fixing it (the port plan's precedent, its own finding 2): the direct pass combines a
 * matched advanced entry's per-trigger probabilities with "highest wins" (probabilityMode is a
 * dropped RC field - canonical has no way to ask for 'additive' there), while the recursion pass
 * (recursion.ts) is hardcoded additive regardless. Both are kept, selected by `mode`.
 */
import type { LorebookBody, LorebookEntry, SelectiveLogic, Trigger } from "../../../entities/lorebook/schema";
import type { LoreScan, LoreScanMessage } from "./types";
import { isTriggerReady, type TimersIndex } from "./timers";
import { matchKeywordTrigger, type KeywordMatchOptions } from "./triggers-keyword";
import { isSpecialTrigger, matchSpecialTrigger } from "./triggers-special";
import { matchEmotionTrigger } from "./triggers-emotion";
import type { KeyHits } from "./key-index";

export interface ScanSources {
  /** oldest first, same shape as LoreScan.messages */
  messages: LoreScanMessage[];
  characterDescription?: string;
  characterPersonality?: string;
  userPersona?: string;
  scenario?: string;
}

/** RoleCall builds scan text newest-message-first (engine.ts pushes the reply being answered at
 * depth 0, then walks history backward); a plain string join has no order sensitivity except for
 * anchored ^/$ or multiline patterns, so this keeps that order rather than the more natural
 * oldest-first for byte-for-byte parity there. */
/** The newest `scanDepth` messages' text, newest first: the chat half of a lore entry's scan text, and a skill's whole one (core/skill.ts). */
export function recentScanParts(messages: readonly LoreScanMessage[], scanDepth: number): string[] {
  if (scanDepth <= 0) return [];
  const recent = messages.slice(Math.max(0, messages.length - scanDepth));
  const parts: string[] = [];
  for (let i = recent.length - 1; i >= 0; i--) parts.push(recent[i]?.content ?? "");
  return parts;
}

export function buildScanText(entry: LorebookEntry, book: LorebookBody, sources: ScanSources): string {
  const parts = recentScanParts(sources.messages, entry.scanDepth ?? book.globalScanDepth);

  if (entry.scanCharacterDescription && sources.characterDescription) parts.push(sources.characterDescription);
  if (entry.scanCharacterPersonality && sources.characterPersonality) parts.push(sources.characterPersonality);
  if (entry.scanUserPersona && sources.userPersona) parts.push(sources.userPersona);
  if (entry.scanScenario && sources.scenario) parts.push(sources.scenario);

  return parts.join("\n");
}

/** Unify keyword, special and emotion triggers - RoleCall's triggers/index.ts matchTrigger.
 * `keyHits` is the compiled matcher's per-scan-text hit
 * lookup: when given, a plain (non-regex) keyword trigger is answered from it instead of calling
 * matchKeywordTrigger's own substring/whole-word check - every other trigger kind is unaffected.
 * Omitted, this is byte-for-byte today's function (recursion.ts, the Workbench preview, and every
 * test that doesn't pass one). */
export function matchTrigger(
  trigger: Trigger,
  text: string,
  keywordOptions: KeywordMatchOptions,
  scan: LoreScan,
  rng: () => number,
  textLower?: string,
  keyHits?: KeyHits,
): boolean {
  const keyword = trigger.keyword;
  if (isSpecialTrigger(keyword)) {
    const emotionMatch = /^\[emotion:(\w+)\]$/i.exec(keyword);
    if (emotionMatch) return matchEmotionTrigger(emotionMatch[1] as string, text);
    return matchSpecialTrigger(keyword, scan, rng);
  }
  if (keyHits && !trigger.isRegex) return keyHits.has(keyword, keywordOptions.caseSensitive, keywordOptions.matchWholeWords);
  return matchKeywordTrigger(trigger, text, keywordOptions, textLower);
}

export interface SelectiveResult {
  matched: boolean;
  matchedPrimary: Trigger[];
  matchedSecondary: Trigger[];
  /** explain-only: true when every primary trigger was blocked by its own frequency window */
  primaryAllFrequencyBlocked?: boolean;
}

/** Shared count truth table for runtime activation and the deterministic authoring preview. */
export function selectiveLogicMatches(
  primaryMatched: number,
  secondaryMatched: number,
  secondaryTotal: number,
  logic: SelectiveLogic,
): boolean {
  if (primaryMatched === 0) return false;
  switch (logic) {
    case "and_any": return secondaryMatched >= 1;
    case "and_all": return secondaryMatched === secondaryTotal;
    case "not_any": return secondaryMatched === 0;
    case "not_all": return secondaryMatched < secondaryTotal;
  }
}

/** RoleCall's triggers/index.ts evaluateSelectiveLogic, frequency-gated via the derived timers. */
export function evaluateSelectiveLogic(
  primaryTriggers: Trigger[],
  secondaryTriggers: Trigger[],
  logic: SelectiveLogic,
  text: string,
  keywordOptions: KeywordMatchOptions,
  scan: LoreScan,
  rng: () => number,
  timers: TimersIndex,
  textLower?: string,
  keyHits?: KeyHits,
): SelectiveResult {
  const matchedPrimary: Trigger[] = [];
  let anyPrimaryReady = false;
  for (const trigger of primaryTriggers) {
    if (!isTriggerReady(timers, trigger.keyword, trigger.frequency)) continue;
    anyPrimaryReady = true;
    if (matchTrigger(trigger, text, keywordOptions, scan, rng, textLower, keyHits)) matchedPrimary.push(trigger);
  }
  if (matchedPrimary.length === 0) {
    return {
      matched: false,
      matchedPrimary: [],
      matchedSecondary: [],
      primaryAllFrequencyBlocked: primaryTriggers.length > 0 && !anyPrimaryReady,
    };
  }

  if (secondaryTriggers.length === 0) return { matched: true, matchedPrimary, matchedSecondary: [] };

  const matchedSecondary: Trigger[] = [];
  for (const trigger of secondaryTriggers) {
    if (!isTriggerReady(timers, trigger.keyword, trigger.frequency)) continue;
    if (matchTrigger(trigger, text, keywordOptions, scan, rng, textLower, keyHits)) matchedSecondary.push(trigger);
  }

  const matched = selectiveLogicMatches(matchedPrimary.length, matchedSecondary.length, secondaryTriggers.length, logic);
  return { matched, matchedPrimary, matchedSecondary };
}

export interface EntryEvalResult {
  matched: boolean;
  /** matched trigger keywords, primary + secondary (LoreFire.keywords / RoleCall's frequency key) */
  matchedKeywords: string[];
  /** at least one secondary trigger participated in the match (engine.ts's LoreReason categorization) */
  usedSecondary: boolean;
  /** 0-1 scale, ready to roll */
  probability: number;
  /** explain-only: why `matched` is false */
  noMatch?: { primaryMatched: boolean; frequencyBlocked: boolean };
}

/**
 * Evaluate one non-constant, non-sticky entry's triggers. `mode` selects RoleCall's two different
 * advanced-mode probability combiners: 'highest' for the direct pass, 'additive' for recursion.
 */
export function evaluateEntry(
  entry: LorebookEntry,
  scanText: string,
  keywordOptions: KeywordMatchOptions,
  scan: LoreScan,
  rng: () => number,
  timers: TimersIndex,
  mode: "highest" | "additive",
  textLower?: string,
  keyHits?: KeyHits,
): EntryEvalResult {
  const selective = evaluateSelectiveLogic(
    entry.triggers,
    entry.secondaryTriggers,
    entry.selectiveLogic,
    scanText,
    keywordOptions,
    scan,
    rng,
    timers,
    textLower,
    keyHits,
  );
  if (!selective.matched) {
    return {
      matched: false,
      matchedKeywords: [],
      usedSecondary: false,
      probability: 0,
      noMatch: {
        primaryMatched: selective.matchedPrimary.length > 0,
        frequencyBlocked: selective.primaryAllFrequencyBlocked ?? false,
      },
    };
  }

  const matchedKeywords = [...selective.matchedPrimary, ...selective.matchedSecondary].map((t) => t.keyword);
  const usedSecondary = selective.matchedSecondary.length > 0;

  if (entry.triggerMode === "simple") {
    return { matched: true, matchedKeywords, usedSecondary, probability: entry.probability / 100 };
  }

  // B2: reuse the match pass's own result instead of calling matchTrigger again. A second call
  // would roll the rng a second time for a [randomChance] trigger, and an independent roll can
  // disagree with the first - reporting matched:true from one draw while silently excluding that
  // same trigger's probability from `total` because the second draw came up false.
  let total = 0;
  for (const trigger of selective.matchedPrimary) {
    const trigProb = trigger.probability ?? 100;
    total = mode === "additive" ? total + trigProb : Math.max(total, trigProb);
  }
  return { matched: true, matchedKeywords, usedSecondary, probability: Math.min(total, 100) / 100 };
}
