/**
 * The Tokens sheet's pure math (design/wireframes/props/trackhare.html?state=tokens): category totals,
 * the what-if exclusion math, the donut's conic-gradient stops, the budget bar's segments, and the
 * JSON/raw-request export shapes. No DOM; tokens-sheet.tsx renders what this computes.
 */
import type { SceneTrace, TraceBlockView, TraceCategory } from "../../../../app-contract-scenes";

/** The legend's fixed default order (also the donut's stacking order and the color list below). */
export const CATEGORY_ORDER: readonly TraceCategory[] = ["preset", "character", "persona", "lore", "history", "current", "trackers", "other"];

export const CATEGORY_LABELS: Readonly<Record<TraceCategory, string>> = {
  preset: "Preset prompts",
  character: "Character card",
  persona: "Persona",
  lore: "Lore",
  history: "Chat history",
  current: "Current message",
  trackers: "Trackers",
  other: "Other",
};

/** The donut/legend/budget-bar color for each category, a theme token var name (no hardcoded colors). */
export const CATEGORY_COLOR_VARS: Readonly<Record<TraceCategory, string>> = {
  preset: "--deck-preset",
  character: "--deck-character",
  persona: "--deck-persona",
  lore: "--deck-lorebook",
  history: "--stage-var",
  current: "--stage-card",
  trackers: "--stage-ok",
  other: "--deck-fog",
};

/** Message numbers as ranges: [2, 3, 4, 7] reads "2-4, 7". */
export function numberRanges(numbers: readonly number[]): string {
  const out: string[] = [];
  const sorted = [...numbers].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (sorted[j + 1] === sorted[j]! + 1) j++;
    out.push(j === i ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return out.join(", ");
}

/** Tokens sent per category, summed from the trace's blocks; zero for a category with none. */
export function categoryTotals(blocks: readonly TraceBlockView[]): Record<TraceCategory, number> {
  const totals = {} as Record<TraceCategory, number>;
  for (const c of CATEGORY_ORDER) totals[c] = 0;
  for (const b of blocks) totals[b.category] += b.tokens;
  return totals;
}

/** The categories with any tokens, in the fixed order (the sheet's default before a drag reorders it). */
export function legendOrder(totals: Readonly<Record<TraceCategory, number>>): TraceCategory[] {
  return CATEGORY_ORDER.filter((c) => totals[c] > 0);
}

/** The grand total minus every excluded category's tokens: the what-if total. */
export function effectiveTokens(totals: Readonly<Record<TraceCategory, number>>, excluded: ReadonlySet<TraceCategory>): number {
  return CATEGORY_ORDER.reduce((sum, c) => sum + (excluded.has(c) ? 0 : totals[c]), 0);
}

/** Percent of the context window a token count uses; 0 when the window is unknown (context <= 0). */
export function usedPercent(tokens: number, context: number): number {
  return context > 0 ? (tokens / context) * 100 : 0;
}

export interface GradientStop {
  category: TraceCategory;
  colorVar: string;
  startPct: number;
  endPct: number;
}

/** The donut's conic-gradient stops for the non-excluded, non-zero categories, in `order`. The last
 * stop's `endPct` is forced to exactly 100 so the stops always sum to a full circle, float error included. */
export function gradientStops(
  totals: Readonly<Record<TraceCategory, number>>,
  order: readonly TraceCategory[],
  excluded: ReadonlySet<TraceCategory>,
): GradientStop[] {
  const included = order.filter((c) => !excluded.has(c) && totals[c] > 0);
  const total = included.reduce((sum, c) => sum + totals[c], 0);
  if (total === 0) return [];
  let cursor = 0;
  return included.map((category, i): GradientStop => {
    const span = i === included.length - 1 ? 100 - cursor : (totals[category] / total) * 100;
    const stop: GradientStop = { category, colorVar: CATEGORY_COLOR_VARS[category], startPct: cursor, endPct: cursor + span };
    cursor += span;
    return stop;
  });
}

export interface BudgetSegment {
  category: TraceCategory;
  colorVar: string;
  widthPct: number;
}

/** One bar segment per non-excluded, non-zero category, its width against the context window. */
export function budgetSegments(
  totals: Readonly<Record<TraceCategory, number>>,
  order: readonly TraceCategory[],
  excluded: ReadonlySet<TraceCategory>,
  context: number,
): BudgetSegment[] {
  if (context <= 0) return [];
  return order
    .filter((c) => !excluded.has(c) && totals[c] > 0)
    .map((category): BudgetSegment => ({ category, colorVar: CATEGORY_COLOR_VARS[category], widthPct: usedPercent(totals[category], context) }));
}

/** Copy/Export as JSON: the whole trace, verbatim. */
export function traceJsonText(trace: SceneTrace): string {
  return JSON.stringify(trace, null, 2);
}

/** Copy/Export the raw request: every block's text in send order, a role line before each. `null`
 * when the trace carries no text (`rawAvailable` false). */
export function rawRequestText(trace: SceneTrace): string | null {
  if (!trace.rawAvailable) return null;
  return trace.blocks.map((b) => `[${b.role}] ${b.label}\n${b.text ?? ""}`).join("\n\n");
}

/** The Lore card's group for the Compendium's recall block. */
export const RECALLED_GROUP = "Recalled by the Compendium";

export interface LoreBlockGroup {
  /** empty for a lore block this reply's fired entries don't explain (an old trace, or a static lore
   * anchor block that is not itself a fired entry) */
  bookName: string;
  rows: { block: TraceBlockView; index: number }[];
}

/**
 * The Tokens sheet's Lore card, sub-grouped under the book each entry came from (th-t4-gaps 4): the
 * category's blocks, in send order, matched to `lore.injected` by title, in order. Both lists are
 * built from the same trace in the same order, so pairing positionally by title is reliable; a shared
 * title still pairs correctly because each match consumes one hit, so the next same-titled block pairs
 * with the next same-titled hit. Each book keeps the order it first appears in.
 */
export function loreBookGroups(blocks: readonly TraceBlockView[], lore: SceneTrace["lore"]): LoreBlockGroup[] {
  const remaining = lore ? [...lore.injected] : [];
  const order: string[] = [];
  const by = new Map<string, { block: TraceBlockView; index: number }[]>();
  blocks.forEach((block, index) => {
    if (block.category !== "lore") return;
    // The Compendium's recall is one block, not a fired entry, so it has its own group (recall-place.ts).
    const at = block.kind === "recall" ? -1 : remaining.findIndex((h) => h.title === block.label);
    const bookName = block.kind === "recall" ? RECALLED_GROUP : at >= 0 ? remaining.splice(at, 1)[0]!.bookName : "";
    if (!by.has(bookName)) {
      by.set(bookName, []);
      order.push(bookName);
    }
    by.get(bookName)!.push({ block, index });
  });
  return order.map((bookName) => ({ bookName, rows: by.get(bookName)! }));
}
