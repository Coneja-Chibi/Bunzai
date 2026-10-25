/**
 * The prompt pipeline's hook contract (Decision 3). Hooks never edit
 * the prompt themselves: each returns an effect, and the pipeline applies it, so depth math and
 * budget accounting live in one place. Placements carry their true source, so the prompt trace says
 * where every line came from instead of disguising features as lorebook entries. Types only.
 */
import type { ProviderMessage } from "./provider";

/**
 * Where a placement goes. The first nine are RoleCall's lorebook positions (lorebook/types.ts
 * InjectionPosition), unchanged. The last two are positions RoleCall uses informally:
 * `system_end` is the end of the leading system block (where Orison inserts), and `history_start`
 * is the start of the history region, resolved after `{{message_history}}` expands (where the
 * visual novel facts go).
 */
export type PlacementPosition =
  | "world"
  | "character"
  | "before_example"
  | "after_example"
  | "depth"
  | "append"
  | "append_bottom"
  | "prepend_top"
  | "scene"
  | "system_end"
  | "history_start";

/** Positions that read `depth`: counted from the newest message, as RoleCall counts it. */
export const DEPTH_POSITIONS: ReadonlySet<PlacementPosition> = new Set(["depth", "append"]);

export type PlacementRole = "system" | "user" | "assistant";

/** Where a placement truly came from. The trace records this as is. */
export type PlacementSource =
  | { kind: "lorebook"; lorebookId: string; entryId: string; title: string }
  | { kind: "hook"; hookId: string; label: string };

export interface Placement {
  /** Unique within one assembly. */
  id: string;
  content: string;
  position: PlacementPosition;
  /** Read only for `depth` and `append`. */
  depth?: number;
  role: PlacementRole;
  /** Higher places first within a position, as RoleCall orders matched entries. */
  priority: number;
  /** Placed even when the budget is spent, like a lorebook entry's ignoreBudget. */
  ignoreBudget?: boolean;
  source: PlacementSource;
}

/** A lorebook entry the matcher chose, as `after-lorebook` sees it. */
export interface MatchedEntry {
  placement: Placement & { source: Extract<PlacementSource, { kind: "lorebook" }> };
  matchedTriggers: readonly string[];
}

/** One history message as `shape-history` sees it. `id` is the chat store's message id. */
export interface HistoryMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

/** A note a hook adds to the trace; it never changes the prompt. */
export interface TraceAnnotation {
  label: string;
  detail: string;
}

// The four points that may change the prompt, in the order they run.

export interface BeforeAssemblyContext {
  /** Identifiers of the active preset's prompts and whether each is on. */
  promptStates: Readonly<Record<string, boolean>>;
  lorebookIds: readonly string[];
}
export interface BeforeAssemblyEffect {
  macroValues?: Record<string, string>;
  /** Switch preset prompts on or off by identifier. An unknown identifier is an error. */
  promptStates?: Record<string, boolean>;
  excludeLorebookIds?: string[];
  excludeEntryIds?: string[];
}

export interface AfterLorebookContext {
  matched: readonly MatchedEntry[];
}
export interface AfterLorebookEffect {
  /** Must carry `source.kind === "hook"` with this hook's id. */
  placements?: Placement[];
  dropEntryIds?: string[];
}

export interface ShapeHistoryContext {
  /** Oldest first, after budgeting. */
  history: readonly HistoryMessage[];
}
export interface ShapeHistoryEffect {
  /**
   * Older messages to drop, and older messages to replace (a summary standing in for them). The
   * newest message is never touched; the pipeline rejects an effect that tries.
   */
  dropIds?: string[];
  replace?: Array<{ id: string; content: string }>;
}

export interface BeforeSendContext {
  messages: readonly ProviderMessage[];
}
export interface BeforeSendEffect {
  annotations?: TraceAnnotation[];
  /** Stops the send; the reason is shown to the user. */
  veto?: { reason: string };
}

export interface HookContexts {
  "before-assembly": BeforeAssemblyContext;
  "after-lorebook": AfterLorebookContext;
  "shape-history": ShapeHistoryContext;
  "before-send": BeforeSendContext;
}
export interface HookEffects {
  "before-assembly": BeforeAssemblyEffect;
  "after-lorebook": AfterLorebookEffect;
  "shape-history": ShapeHistoryEffect;
  "before-send": BeforeSendEffect;
}
export type PromptHookPoint = keyof HookContexts;

/** The points in running order. */
export const PROMPT_HOOK_POINTS: readonly PromptHookPoint[] = ["before-assembly", "after-lorebook", "shape-history", "before-send"];

/**
 * A hook at one point. Contexts are read-only views; the returned effect is the only way to change
 * anything. `on-token`, `on-checkpoint`, `after-turn`, and `on-branch` belong to the turn loop's
 * contract, not this one: they may not edit the prompt.
 */
export type PipelineHook = {
  [P in PromptHookPoint]: {
    id: string;
    label: string;
    point: P;
    run(context: HookContexts[P], io: { signal: AbortSignal }): HookEffects[P] | Promise<HookEffects[P]>;
  };
}[PromptHookPoint];
