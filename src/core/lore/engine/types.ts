/**
 * Public API types for the lore engine plus the internal
 * book+entry pairing shared across engine/*.ts. Ported from RoleCall's lorebook engine
 * onto canonical LorebookBody/LorebookEntry,
 * with Bunzai's four changes: derived timers, seeded rng, sortOrder/priority split, positions
 * returned rather than placed. See the "Public API" section of the port plan for the exact contract.
 */
import type { LorebookBody, LorebookEntry } from "../../../entities/lorebook/schema";

/** A lorebook as the engine sees it: id + name for entryKey/outlet purposes, plus its canonical body. */
export interface LoreBookInput {
  id: string;
  name: string;
  body: LorebookBody;
}

/**
 * One entry's fire record from a past reply on the active branch. `messagesAgo` 1 = the previous
 * reply. `fresh` distinguishes a real activation from a sticky reinjection (only fresh fires start
 * a new sticky/cooldown window). `keywords` are the trigger keywords that matched on that fire -
 * RoleCall's per-trigger frequency key (special.ts recordTriggerActivation keys by trigger.keyword).
 * Empty for constant/sticky-reinjection fires, which match no trigger.
 */
export interface LoreFire {
  entryKey: string;
  messagesAgo: number;
  fresh: boolean;
  keywords: string[];
}

export interface LoreScanMessage {
  role: "user" | "assistant" | "system";
  content: string;
  name?: string;
  /** epoch ms. Missing = RoleCall's "no timestamp" fallback for [recency:...] (always passes). */
  at?: number;
}

export interface LoreScan {
  /** oldest first */
  messages: LoreScanMessage[];
  /** messages in the scene, including the one being answered */
  messageCount: number;
  character: { name: string; tags: string[]; description: string; personality: string; scenario: string };
  persona: string;
  generationType: "normal" | "regenerate" | "swipe" | "continue" | "impersonate";
  currentSpeaker?: string;
  /** read-only view for triggers; side effects are returned, not applied */
  variables: Record<string, string | number>;
  /** epoch ms, injected by the caller rather than read from the system clock. Powers [recency:...]. */
  now: number;
}

export interface LoreRunOptions {
  rng: () => number;
  countTokens: (text: string) => number;
  /** the lore share of the context; Infinity means no cap */
  budgetTokens: number;
  recentFires: LoreFire[];
  /** when true, LoreRun.verdicts carries one entry per book entry (2e) */
  explain?: boolean;
  /** "roll" (default) uses rng; "always"/"never" force every probability check without calling rng.
   * The Workbench previews use "always"/"never"; Rehearsal keeps real "roll". */
  chance?: "roll" | "always" | "never";
}

export type LorePosition =
  | { kind: "world" | "character" | "scene" | "before_example" | "after_example" | "prepend_top" | "append_bottom" }
  | { kind: "depth"; depth: number; role: "system" | "user" | "assistant" }
  | { kind: "append"; depth: number };

export type LoreReason = "constant" | "key" | "secondary" | "sticky" | "recursion" | "special" | "emotion";

export interface LoreHit {
  entryKey: string;
  bookId: string;
  entryId: string;
  title: string;
  content: string;
  position: LorePosition;
  tokens: number;
  reason: LoreReason;
  matched: string[];
}

export interface LoreSideEffectOp {
  op: "set" | "add" | "inc" | "dec" | "del";
  name: string;
  value?: string | number;
  scope: "local" | "global";
}

export interface LoreRun {
  /** in final placement order */
  injected: LoreHit[];
  /** matched but dropped by the budget, with the reason they matched */
  cut: LoreHit[];
  /** what to store in this reply's trace for the next turn's timers */
  fires: { entryKey: string; fresh: boolean; keywords: string[] }[];
  sideEffects: LoreSideEffectOp[];
  totalTokens: number;
  /** present only when options.explain is true: one verdict per entry, book order then entry order */
  verdicts?: LoreVerdict[];
}

/** Every skip kind the engine can report when explain is on. */
export type LoreSkip =
  | "disabled"
  | "no-key-match"
  | "secondary-logic"
  | "chance"
  | "cooldown"
  | "delay"
  | "frequency"
  | "budget-cut"
  | "exclude-recursion"
  | "delay-until-recursion"
  | "empty-keys"
  | "character-filter"
  | "group-lost";

export interface LoreVerdict {
  entryKey: string;
  bookId: string;
  entryId: string;
  fired: boolean;
  /** why it fired (LoreReason) or why not (LoreSkip) */
  reason: LoreReason | LoreSkip;
  matched: string[];
  /** recursion loop it fired or was judged on; 0 for a direct match */
  loop: number;
  tokens: number;
  /** extra numbers the Workbench shows: chance rolled/needed, cooldown or delay remaining, budget cost/left */
  detail?: { rolled?: number; needed?: number; remaining?: number; cost?: number; left?: number };
}

// ---------------------------------------------------------------------------
// Internal (not part of the public surface)
// ---------------------------------------------------------------------------

/** A book+entry pairing, keyed for cross-book uniqueness. RC keys runtime state by bare entry.id;
 * that collides across books here, so every internal map/set uses entryKey(book.id, entry.id). */
export interface EntryRef {
  book: LoreBookInput;
  entry: LorebookEntry;
}

export function entryKey(bookId: string, entryId: string): string {
  return `${bookId}:${entryId}`;
}

/**
 * Whether a `vectorized` entry may take part in recursion at all, as a source (its content seeds
 * another entry) or a target (another entry's content wakes it). A non-vectorized entry is always eligible; a vectorized one follows its book's
 * `vectorizedRecursion` (default true, today's engine behavior). The runtime engine
 * (`recursion.ts`) and the Workbench's wake map (`wake.ts`) both call this single predicate so
 * they can never disagree.
 */
export function vectorizedRecursionOk(entryVectorized: boolean | undefined, book: LorebookBody): boolean {
  return !entryVectorized || (book.vectorizedRecursion ?? true);
}
