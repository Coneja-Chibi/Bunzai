/**
 * The Lore & state tabs' pure rules (RoleCall `DebugWingPanelV2.tsx` Sources, Flow and Compose, rc-parity 08). All three read the one list of request blocks
 * the assembler counted (`trace.blocks`): Sources groups them by what they are, Flow ranks the groups, Compose lists them in send order. A share is its tokens
 * over the request's total; nothing is recounted. Grouping and colours are the Tokens sheet's (props/trackhare/tokens-core.ts), so the two never disagree.
 */
import type { SceneTrace, TraceBlockView, TraceCategory } from "../../../app-contract-scenes";
import { CATEGORY_COLOR_VARS, CATEGORY_LABELS, CATEGORY_ORDER } from "../props/trackhare/tokens-core";

export const totalTokens = (trace: SceneTrace): number => trace.blocks.reduce((n, b) => n + b.tokens, 0);
const share = (tokens: number, total: number): number => (total > 0 ? Math.round((tokens / total) * 100) : 0);

export interface SourceChild { index: number; label: string; role: TraceBlockView["role"]; tokens: number; percent: number }
export interface SourceNode { category: TraceCategory; label: string; colorVar: string; tokens: number; percent: number; children: SourceChild[] }

/** The request grouped by what each block is, in the Tokens sheet's order; a group with no blocks is not listed. */
export function sourceTree(trace: SceneTrace): SourceNode[] {
  const total = totalTokens(trace);
  return CATEGORY_ORDER.flatMap((category) => {
    const children = trace.blocks.flatMap((b, index): SourceChild[] => (b.category === category ? [{ index, label: b.label, role: b.role, tokens: b.tokens, percent: share(b.tokens, total) }] : []));
    if (children.length === 0) return [];
    const tokens = children.reduce((n, c) => n + c.tokens, 0);
    return [{ category, label: CATEGORY_LABELS[category], colorVar: CATEGORY_COLOR_VARS[category], tokens, percent: share(tokens, total), children }];
  });
}

/** Flow's bars: the same groups, largest first. */
export function flowBars(trace: SceneTrace): Omit<SourceNode, "children">[] {
  return sourceTree(trace).map(({ children: _children, ...bar }) => bar).sort((a, b) => b.tokens - a.tokens);
}

export interface ComposeRow { position: number; index: number; category: TraceCategory; label: string; role: TraceBlockView["role"]; colorVar: string; tokens: number; percent: number; text?: string }

/** Compose's rows: the request in send order, numbered from 1; text only when the trace kept it. */
export function composeRows(trace: SceneTrace): ComposeRow[] {
  const total = totalTokens(trace);
  return trace.blocks.map((b, index) => ({ position: index + 1, index, category: b.category, label: b.label, role: b.role, colorVar: CATEGORY_COLOR_VARS[b.category], tokens: b.tokens, percent: share(b.tokens, total), ...(b.text !== undefined ? { text: b.text } : {}) }));
}

/** What Sources points Compose at: a whole group, or one block of it. */
export type Highlight = { category: TraceCategory; index?: number } | null;

export const isHighlighted = (h: Highlight, row: Pick<ComposeRow, "category" | "index">): boolean => h !== null && h.category === row.category && (h.index === undefined || h.index === row.index);
